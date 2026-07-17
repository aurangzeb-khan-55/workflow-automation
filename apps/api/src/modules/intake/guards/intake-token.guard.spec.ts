import { ExecutionContext, ForbiddenException, GoneException, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IntakeStatus } from "@prisma/client";
import { IntakeTokenGuard } from "./intake-token.guard";

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("IntakeTokenGuard", () => {
  function makeGuard(intake: unknown, requireEditable: boolean) {
    const prisma = { intake: { findUnique: jest.fn().mockResolvedValue(intake) } };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requireEditable) } as unknown as Reflector;
    const guard = new IntakeTokenGuard(prisma as any, reflector);
    return { guard, prisma };
  }

  it("404s when no intake matches the token", async () => {
    const { guard } = makeGuard(null, false);
    const request: Record<string, unknown> = { params: { token: "nope" } };
    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(NotFoundException);
  });

  it("410s when the token has expired", async () => {
    const { guard } = makeGuard(
      { status: IntakeStatus.intake_email_sent, tokenExpiresAt: new Date(Date.now() - 1000) },
      false,
    );
    const request: Record<string, unknown> = { params: { token: "expired" } };
    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(GoneException);
  });

  it("410s when tokenExpiresAt is null (shouldn't happen once sent, but fail closed)", async () => {
    const { guard } = makeGuard({ status: IntakeStatus.intake_email_sent, tokenExpiresAt: null }, false);
    const request: Record<string, unknown> = { params: { token: "x" } };
    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(GoneException);
  });

  it("allows a read-only route (no @RequireEditableIntake) even once submitted", async () => {
    const { guard } = makeGuard(
      { status: IntakeStatus.ready_for_staff_review, tokenExpiresAt: new Date(Date.now() + 100_000) },
      false,
    );
    const request: Record<string, unknown> = { params: { token: "x" } };
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect((request as any).intake).toBeDefined();
  });

  it("403s a @RequireEditableIntake route once the intake has left the editable statuses", async () => {
    const { guard } = makeGuard(
      { status: IntakeStatus.ready_for_staff_review, tokenExpiresAt: new Date(Date.now() + 100_000) },
      true,
    );
    const request: Record<string, unknown> = { params: { token: "x" } };
    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(ForbiddenException);
  });

  it("allows a @RequireEditableIntake route while still in an editable status, and attaches request.intake", async () => {
    const intake = { status: IntakeStatus.waiting_for_patient, tokenExpiresAt: new Date(Date.now() + 100_000) };
    const { guard } = makeGuard(intake, true);
    const request: Record<string, unknown> = { params: { token: "x" } };
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect((request as any).intake).toBe(intake);
  });
});
