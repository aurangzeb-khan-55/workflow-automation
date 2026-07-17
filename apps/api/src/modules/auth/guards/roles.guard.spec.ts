import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { RolesGuard } from "./roles.guard";
import { AuthenticatedRequest } from "../types/authenticated-request";

function makeContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows any authenticated user when no @Roles() metadata is present", () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = makeContext({ user: { id: "u1", clinicId: "c1", role: UserRole.receptionist, clerkUserId: "x" } });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("allows a request whose role is in the required list", () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.clinic_admin, UserRole.super_admin],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = makeContext({ user: { id: "u1", clinicId: "c1", role: UserRole.clinic_admin, clerkUserId: "x" } });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("rejects a request whose role is not in the required list", () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.super_admin],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = makeContext({ user: { id: "u1", clinicId: "c1", role: UserRole.clinic_admin, clerkUserId: "x" } });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("rejects when there is no authenticated user at all", () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.super_admin],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = makeContext({});

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
