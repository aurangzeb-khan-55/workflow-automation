import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  AUTH_TOKEN_VERIFIER,
  AuthTokenVerifier,
} from "../../../providers/auth/auth-token-verifier.interface";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AuthenticatedRequest } from "../types/authenticated-request";

/**
 * Verifies the bearer token via the configured AuthTokenVerifier (Clerk or
 * stub), then resolves it to a local `User` row — the single source of
 * truth for clinicId/role, never the token itself. Deliberately uses the
 * raw, unscoped PrismaService for this one lookup: at this point in the
 * request we don't yet know the tenant, so there's nothing to scope by.
 * Every other module scopes through TenantPrismaService instead.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_TOKEN_VERIFIER) private readonly tokenVerifier: AuthTokenVerifier,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const { externalUserId } = await this.tokenVerifier.verify(token);

    let user = await this.prisma.user.findUnique({
      where: { clerkUserId: externalUserId },
    });

    if (!user) {
      user = await this.tryBindByEmail(externalUserId);
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException("No active user found for this session");
    }

    request.user = {
      id: user.id,
      clinicId: user.clinicId,
      role: user.role,
      clerkUserId: user.clerkUserId,
    };

    return true;
  }

  /**
   * First-login binding for invited staff: a Clinic Administrator can
   * create a `User` row (with a real clinicId/role/email) before that
   * person has ever signed into Clerk, leaving `clerkUserId` null. The
   * first time they successfully authenticate, this matches the pending
   * row by email and backfills clerkUserId — no separate "accept invite"
   * step needed.
   *
   * `User.email` is only unique per clinic (`@@unique([clinicId, email])`),
   * not globally, and `clerkUserId` IS globally unique (`@unique`) — so if
   * more than one clinic has an unbound row for the same email, there's no
   * way to know which one this login is for. Rather than guess, that's
   * treated as "no match" (401) instead of silently binding an arbitrary
   * one of them.
   */
  private async tryBindByEmail(externalUserId: string) {
    const email = await this.tokenVerifier.getEmail(externalUserId);
    if (!email) return null;

    const candidates = await this.prisma.user.findMany({ where: { email, clerkUserId: null } });
    if (candidates.length !== 1) {
      return null;
    }

    return this.prisma.user.update({
      where: { id: candidates[0].id },
      data: { clerkUserId: externalUserId },
    });
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return undefined;
    return header.slice("Bearer ".length).trim() || undefined;
  }
}
