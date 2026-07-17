import "reflect-metadata";
import { config } from "dotenv";
config();

import { randomUUID } from "crypto";
import { NewOrExisting } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantPrismaService } from "../src/prisma/tenant-prisma.service";
import { AuthenticatedRequest } from "../src/modules/auth/types/authenticated-request";

/**
 * Proves the TenantPrismaService guarantee that every future module
 * (Patients, Appointments, Documents, ...) will rely on: a query scoped to
 * one clinic can never read, mutate, or reach — even through a relation
 * include — another clinic's rows. Runs against the real Docker Postgres,
 * not a mock, because the guarantee lives in actual SQL behavior.
 */
function tenantClientFor(prisma: PrismaService, clinicId: string) {
  return new TenantPrismaService(prisma, {
    user: { id: "test-user", clinicId, role: "clinic_admin", clerkUserId: "test" },
  } as unknown as AuthenticatedRequest).scoped;
}

describe("TenantPrismaService cross-tenant isolation (e2e)", () => {
  const prisma = new PrismaService();
  let clinicAId: string;
  let clinicBId: string;

  beforeAll(async () => {
    await prisma.onModuleInit();

    const clinicA = await prisma.clinic.create({
      data: { name: "Tenant Test Clinic A", slug: `tenant-test-a-${randomUUID()}` },
    });
    const clinicB = await prisma.clinic.create({
      data: { name: "Tenant Test Clinic B", slug: `tenant-test-b-${randomUUID()}` },
    });
    clinicAId = clinicA.id;
    clinicBId = clinicB.id;
  });

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { clinicId: { in: [clinicAId, clinicBId] } } });
    await prisma.intake.deleteMany({ where: { clinicId: { in: [clinicAId, clinicBId] } } });
    await prisma.patient.deleteMany({ where: { clinicId: { in: [clinicAId, clinicBId] } } });
    await prisma.clinic.deleteMany({ where: { id: { in: [clinicAId, clinicBId] } } });
    await prisma.onModuleDestroy();
  });

  function patientData(clinicId: string) {
    return {
      clinicId,
      firstName: "Test",
      lastName: "Patient",
      dob: new Date("1990-01-01"),
      phone: "555-0100",
      email: `patient-${randomUUID()}@example.com`,
      newOrExisting: NewOrExisting.new,
    };
  }

  it("findMany only returns rows for the caller's clinic", async () => {
    const tenantA = tenantClientFor(prisma, clinicAId);
    const patientA = await prisma.patient.create({ data: patientData(clinicAId) });
    const patientB = await prisma.patient.create({ data: patientData(clinicBId) });

    const results = await tenantA.patient.findMany({
      where: { id: { in: [patientA.id, patientB.id] } },
    });

    expect(results.map((p) => p.id)).toEqual([patientA.id]);
  });

  it("findUnique returns null for another clinic's row by id", async () => {
    const tenantA = tenantClientFor(prisma, clinicAId);
    const patientB = await prisma.patient.create({ data: patientData(clinicBId) });

    const result = await tenantA.patient.findUnique({ where: { id: patientB.id } });

    expect(result).toBeNull();
  });

  it("findUniqueOrThrow throws for another clinic's row by id", async () => {
    const tenantA = tenantClientFor(prisma, clinicAId);
    const patientB = await prisma.patient.create({ data: patientData(clinicBId) });

    await expect(tenantA.patient.findUniqueOrThrow({ where: { id: patientB.id } })).rejects.toThrow();
  });

  it("create always tags the row with the caller's clinicId, even if a different clinicId is supplied", async () => {
    const tenantA = tenantClientFor(prisma, clinicAId);

    const created = await tenantA.patient.create({
      data: patientData(clinicBId), // attempts to smuggle Clinic B's id
    });

    expect(created.clinicId).toBe(clinicAId);
  });

  it("update/delete cannot affect another clinic's row", async () => {
    const tenantA = tenantClientFor(prisma, clinicAId);
    const patientB = await prisma.patient.create({ data: patientData(clinicBId) });

    const updateResult = await tenantA.patient.updateMany({
      where: { id: patientB.id },
      data: { firstName: "Hacked" },
    });
    expect(updateResult.count).toBe(0);

    const stillThere = await prisma.patient.findUnique({ where: { id: patientB.id } });
    expect(stillThere?.firstName).not.toBe("Hacked");
  });

  it("THE STANDING CROSS-TENANT CASE: a nested include never surfaces another clinic's related rows, even when a child's own clinicId is inconsistent with its parent's", async () => {
    const tenantA = tenantClientFor(prisma, clinicAId);
    const patientA = await prisma.patient.create({ data: patientData(clinicAId) });

    // Deliberately corrupted row: an Intake that's correctly linked (by
    // patientId FK) to Clinic A's patient, but tagged with Clinic B's
    // clinicId — the exact shape of leak this recursive scoping exists to
    // prevent. Without it, a plain `include: { intakes: true }` would
    // surface this row anyway, since Prisma resolves it purely by FK with
    // no clinicId filter unless one is injected.
    const corruptedIntake = await prisma.intake.create({
      data: {
        clinicId: clinicBId,
        patientId: patientA.id,
        secureToken: randomUUID(),
        tokenExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const result = await tenantA.patient.findUnique({
      where: { id: patientA.id },
      include: { intakes: true },
    });

    expect(result).not.toBeNull();
    expect(result?.intakes.map((i) => i.id)).not.toContain(corruptedIntake.id);

    await prisma.intake.delete({ where: { id: corruptedIntake.id } });
  });
});
