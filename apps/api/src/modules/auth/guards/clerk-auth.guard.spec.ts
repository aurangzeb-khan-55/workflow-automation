import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { ClerkAuthGuard } from "./clerk-auth.guard";
import { AuthTokenVerifier } from "../../../providers/auth/auth-token-verifier.interface";
import { AuthenticatedRequest } from "../types/authenticated-request";

describe("ClerkAuthGuard", () => {
  function makeContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  const reflector = { getAllAndOverride: () => false } as unknown as Reflector;

  it("skips verification for routes marked @Public()", async () => {
    const publicReflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const tokenVerifier = { verify: jest.fn() } as unknown as AuthTokenVerifier;
    const prisma = { user: { findUnique: jest.fn() } } as any;
    const guard = new ClerkAuthGuard(tokenVerifier, prisma, publicReflector);

    const ctx = makeContext({ headers: {} });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(tokenVerifier.verify).not.toHaveBeenCalled();
  });

  it("rejects a request with no bearer token", async () => {
    const tokenVerifier = { verify: jest.fn() } as unknown as AuthTokenVerifier;
    const prisma = { user: { findUnique: jest.fn() } } as any;
    const guard = new ClerkAuthGuard(tokenVerifier, prisma, reflector);

    const ctx = makeContext({ headers: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects when the verified token has no matching active local user and no bindable email", async () => {
    const tokenVerifier = {
      verify: jest.fn().mockResolvedValue({ externalUserId: "clerk_123" }),
      getEmail: jest.fn().mockResolvedValue(null),
    } as unknown as AuthTokenVerifier;
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    const guard = new ClerkAuthGuard(tokenVerifier, prisma, reflector);

    const ctx = makeContext({ headers: { authorization: "Bearer clerk_123" } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a deactivated user even with a valid token", async () => {
    const tokenVerifier = {
      verify: jest.fn().mockResolvedValue({ externalUserId: "clerk_123" }),
    } as unknown as AuthTokenVerifier;
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "u1",
          clinicId: "clinic-a",
          role: UserRole.receptionist,
          clerkUserId: "clerk_123",
          isActive: false,
        }),
      },
    } as any;
    const guard = new ClerkAuthGuard(tokenVerifier, prisma, reflector);

    const ctx = makeContext({ headers: { authorization: "Bearer clerk_123" } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("derives request.user.clinicId strictly from the local User row, ignoring any client-supplied clinicId", async () => {
    const tokenVerifier = {
      verify: jest.fn().mockResolvedValue({ externalUserId: "clerk_123" }),
    } as unknown as AuthTokenVerifier;
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "u1",
          clinicId: "clinic-a",
          role: UserRole.receptionist,
          clerkUserId: "clerk_123",
          isActive: true,
        }),
      },
    } as any;
    const guard = new ClerkAuthGuard(tokenVerifier, prisma, reflector);

    // Attacker attempts to smuggle a different clinicId via a header and
    // the request body — neither should have any effect on the resolved
    // request.user, since it's derived only from the DB-loaded User row.
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: "Bearer clerk_123", "x-clinic-id": "clinic-b" } as any,
      body: { clinicId: "clinic-b" },
    };
    const ctx = makeContext(request);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((request as AuthenticatedRequest).user).toEqual({
      id: "u1",
      clinicId: "clinic-a",
      role: UserRole.receptionist,
      clerkUserId: "clerk_123",
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { clerkUserId: "clerk_123" } });
  });

  describe("first-login bind-by-email fallback", () => {
    it("binds an invited-but-never-logged-in User row by email and authenticates as it", async () => {
      const tokenVerifier = {
        verify: jest.fn().mockResolvedValue({ externalUserId: "clerk_new_456" }),
        getEmail: jest.fn().mockResolvedValue("invited@example.com"),
      } as unknown as AuthTokenVerifier;
      const invitedRow = {
        id: "u2",
        clinicId: "clinic-a",
        role: UserRole.provider,
        email: "invited@example.com",
        clerkUserId: null,
        isActive: true,
      };
      const boundRow = { ...invitedRow, clerkUserId: "clerk_new_456" };
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([invitedRow]),
          update: jest.fn().mockResolvedValue(boundRow),
        },
      } as any;
      const guard = new ClerkAuthGuard(tokenVerifier, prisma, reflector);

      const request: Partial<AuthenticatedRequest> = {
        headers: { authorization: "Bearer clerk_new_456" },
      };
      const ctx = makeContext(request);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { email: "invited@example.com", clerkUserId: null },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u2" },
        data: { clerkUserId: "clerk_new_456" },
      });
      expect((request as AuthenticatedRequest).user).toEqual({
        id: "u2",
        clinicId: "clinic-a",
        role: UserRole.provider,
        clerkUserId: "clerk_new_456",
      });
    });

    it("does not bind when no invited row matches the email", async () => {
      const tokenVerifier = {
        verify: jest.fn().mockResolvedValue({ externalUserId: "clerk_new_456" }),
        getEmail: jest.fn().mockResolvedValue("nobody@example.com"),
      } as unknown as AuthTokenVerifier;
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
        },
      } as any;
      const guard = new ClerkAuthGuard(tokenVerifier, prisma, reflector);

      const ctx = makeContext({ headers: { authorization: "Bearer clerk_new_456" } });
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("refuses to bind when more than one clinic has an unbound row for the same email (ambiguous)", async () => {
      const tokenVerifier = {
        verify: jest.fn().mockResolvedValue({ externalUserId: "clerk_new_456" }),
        getEmail: jest.fn().mockResolvedValue("shared@example.com"),
      } as unknown as AuthTokenVerifier;
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([
            { id: "u1", clinicId: "clinic-a", clerkUserId: null },
            { id: "u2", clinicId: "clinic-b", clerkUserId: null },
          ]),
          update: jest.fn(),
        },
      } as any;
      const guard = new ClerkAuthGuard(tokenVerifier, prisma, reflector);

      const ctx = makeContext({ headers: { authorization: "Bearer clerk_new_456" } });
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("never re-binds an already-bound row even if the email happens to match", async () => {
      // findMany's `clerkUserId: null` filter already excludes bound rows —
      // this asserts the guard passes that filter through rather than
      // matching on email alone.
      const tokenVerifier = {
        verify: jest.fn().mockResolvedValue({ externalUserId: "clerk_new_456" }),
        getEmail: jest.fn().mockResolvedValue("already-bound@example.com"),
      } as unknown as AuthTokenVerifier;
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]), // the bound row is excluded by the query itself
          update: jest.fn(),
        },
      } as any;
      const guard = new ClerkAuthGuard(tokenVerifier, prisma, reflector);

      const ctx = makeContext({ headers: { authorization: "Bearer clerk_new_456" } });
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { email: "already-bound@example.com", clerkUserId: null },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
