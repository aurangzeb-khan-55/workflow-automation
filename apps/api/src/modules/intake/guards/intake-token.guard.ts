import { CanActivate, ExecutionContext, ForbiddenException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../../prisma/prisma.service";
import { PORTAL_EDITABLE_STATUSES } from "../intake-status.state-machine";
import { REQUIRE_EDITABLE_INTAKE_KEY } from "./require-editable-intake.decorator";
import { IntakePortalRequest } from "../types/intake-portal-request";

/**
 * The authentication boundary for the entire patient-facing portal: there is
 * no Clerk session here at all, so the 256-bit secureToken in the URL *is*
 * the credential. This guard is the one place that resolves it, so every
 * route downstream — sections, documents, consents, submit — receives an
 * already-validated `request.intake` and only ever queries scoped to that
 * one row's id, never a client-supplied id and never a list across intakes.
 *
 * Runs after IntakePortalThrottlerGuard (registration order in
 * @UseGuards()), so a request that's already being rate-limited never even
 * reaches a database lookup.
 */
@Injectable()
export class IntakeTokenGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IntakePortalRequest>();
    const token = request.params.token;
    if (!token) {
      throw new NotFoundException("Intake not found");
    }

    const intake = await this.prisma.intake.findUnique({ where: { secureToken: token } });
    if (!intake) {
      throw new NotFoundException("Intake not found");
    }
    if (!intake.tokenExpiresAt || intake.tokenExpiresAt < new Date()) {
      throw new GoneException("This intake link has expired");
    }

    const requiresEditable = this.reflector.getAllAndOverride<boolean>(REQUIRE_EDITABLE_INTAKE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiresEditable && !PORTAL_EDITABLE_STATUSES.includes(intake.status)) {
      throw new ForbiddenException("This intake has already been submitted and can no longer be edited");
    }

    request.intake = intake;
    return true;
  }
}
