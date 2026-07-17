import { Inject, Injectable, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { TENANT_SCOPED_MODELS } from "./tenant-scoped-models";
import { AuthenticatedRequest } from "../modules/auth/types/authenticated-request";

interface RelationMeta {
  targetModel: string;
  isList: boolean;
}

// Built once at module load from Prisma's DMMF, not per request/query.
const relationMetaByModel = new Map<string, Map<string, RelationMeta>>();
for (const model of Prisma.dmmf.datamodel.models) {
  const fields = new Map<string, RelationMeta>();
  for (const field of model.fields) {
    if (field.kind === "object" && field.relationName) {
      fields.set(field.name, { targetModel: field.type, isList: field.isList });
    }
  }
  relationMetaByModel.set(model.name, fields);
}

/**
 * Recursively injects `clinicId` into every nested to-many relation
 * (`include`/`select`) whose target is a tenant-scoped model, mutating
 * the selection object in place.
 *
 * Why this is needed: Prisma Client Extensions only intercept the
 * top-level `prisma.<model>.<operation>()` call a caller makes. A relation
 * loaded via `include`/`select` is resolved internally by the query engine
 * and never becomes a second, independently-interceptable call — so
 * without this walk, `patient.findMany({ include: { intakes: true } })`
 * would return every clinic's intakes for the (already-scoped) patients
 * it found, defeating the whole point of tenant scoping.
 *
 * To-one relations (e.g. `Appointment.provider`) are NOT covered here —
 * Prisma's include/select API doesn't accept a `where` on a to-one
 * relation at all (it resolves a single row by FK; there's nothing to
 * filter). The only way to prevent a cross-tenant to-one leak is to never
 * let a cross-tenant FK be written in the first place: whenever a service
 * sets a FK pointing at another tenant-scoped model, it must resolve that
 * referenced row through this same TenantPrismaService first, so a
 * cross-tenant id 404s before it can ever be persisted.
 */
function scopeSelection(
  model: string,
  selection: Record<string, unknown> | undefined,
  clinicId: string,
): void {
  if (!selection) return;
  const relations = relationMetaByModel.get(model);
  if (!relations) return;

  for (const key of Object.keys(selection)) {
    const meta = relations.get(key);
    if (!meta || !TENANT_SCOPED_MODELS.has(meta.targetModel)) continue;

    const value = selection[key];
    if (value === false || value == null) continue;

    const nested = (value === true ? {} : { ...(value as Record<string, unknown>) }) as Record<
      string,
      any
    >;

    if (meta.isList) {
      nested.where = { ...(nested.where ?? {}), clinicId };
    }

    if (nested.include) scopeSelection(meta.targetModel, nested.include, clinicId);
    if (nested.select) scopeSelection(meta.targetModel, nested.select, clinicId);

    selection[key] = nested;
  }
}

const WHERE_SCOPED_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

function buildTenantScopedClient(prisma: PrismaService, clinicId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        // findUnique's `where` may only contain unique-constraint fields —
        // Prisma rejects an extra non-unique `clinicId` key outright — so
        // it can't be scoped by merging into the query itself. Fetch
        // normally, then verify tenancy on the result.
        async findUnique({ model, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) return query(args);
          scopeSelection(model, (args as any).include, clinicId);
          scopeSelection(model, (args as any).select, clinicId);
          const result: any = await query(args);
          return result && result.clinicId === clinicId ? result : null;
        },
        async findUniqueOrThrow({ model, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) return query(args);
          scopeSelection(model, (args as any).include, clinicId);
          scopeSelection(model, (args as any).select, clinicId);
          const result: any = await query(args);
          if (!result || result.clinicId !== clinicId) {
            throw new Prisma.PrismaClientKnownRequestError(
              "An operation failed because it depends on one or more records that were required but not found.",
              { code: "P2025", clientVersion: Prisma.prismaVersion.client },
            );
          }
          return result;
        },
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) return query(args);

          const scopedArgs = args as any;

          if (WHERE_SCOPED_OPERATIONS.has(operation)) {
            scopedArgs.where = { ...(scopedArgs.where ?? {}), clinicId };
          } else if (operation === "create") {
            scopedArgs.data = { ...scopedArgs.data, clinicId };
          } else if (operation === "createMany") {
            scopedArgs.data = Array.isArray(scopedArgs.data)
              ? scopedArgs.data.map((row: any) => ({ ...row, clinicId }))
              : { ...scopedArgs.data, clinicId };
          } else if (operation === "upsert") {
            scopedArgs.where = { ...(scopedArgs.where ?? {}), clinicId };
            scopedArgs.create = { ...scopedArgs.create, clinicId };
          }

          scopeSelection(model, scopedArgs.include, clinicId);
          scopeSelection(model, scopedArgs.select, clinicId);

          return query(scopedArgs);
        },
      },
    },
  });
}

export type TenantScopedPrismaClient = ReturnType<typeof buildTenantScopedClient>;

/**
 * Request-scoped Prisma client pre-filtered to the authenticated caller's
 * clinic. Every feature-module service must inject this — never the raw
 * `PrismaService` — so a query that omits a clinicId filter isn't a bug
 * that can ship: it's structurally impossible for it to return or mutate
 * another clinic's rows.
 *
 * The one intentional exception is the Super Admin cross-clinic escape
 * hatch, which lives in its own small, separately-reviewed module using
 * the raw `PrismaService` with an explicit clinicId argument on every call
 * — it deliberately never touches this service.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  private cachedClinicId?: string;
  private cachedScoped?: TenantScopedPrismaClient;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {
    // Deliberately does nothing with `request.user` here. Nest's
    // RouterExplorer instantiates every request-scoped provider once at
    // application bootstrap, with no real request, purely to build its
    // route table — a constructor that validates/throws synchronously
    // breaks that bootstrap-time instantiation (and, transitively, every
    // real request afterwards). Validation is deferred to first access
    // below, which only ever happens during an actual authenticated
    // request.
  }

  /**
   * Exposed so `create`/`createMany` call sites can satisfy Prisma's
   * generated types, which still require `clinicId` in `data` even though
   * the extension below overwrites it unconditionally — the runtime
   * guarantee doesn't depend on callers getting this right, but Prisma's
   * static types don't know that, so this keeps call sites honest instead
   * of reaching for an `as any` cast.
   */
  get clinicId(): string {
    if (!this.cachedClinicId) {
      const clinicId = this.request.user?.clinicId;
      if (!clinicId) {
        throw new Error("TenantPrismaService was used outside an authenticated request context");
      }
      this.cachedClinicId = clinicId;
    }
    return this.cachedClinicId;
  }

  get scoped(): TenantScopedPrismaClient {
    if (!this.cachedScoped) {
      this.cachedScoped = buildTenantScopedClient(this.prisma, this.clinicId);
    }
    return this.cachedScoped;
  }
}
