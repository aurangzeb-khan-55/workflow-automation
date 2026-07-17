import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Intake } from "@prisma/client";
import { IntakePortalRequest } from "../types/intake-portal-request";

export const CurrentIntake = createParamDecorator((_data: unknown, ctx: ExecutionContext): Intake => {
  const request = ctx.switchToHttp().getRequest<IntakePortalRequest>();
  if (!request.intake) {
    throw new Error("@CurrentIntake() used on a route not covered by IntakeTokenGuard");
  }
  return request.intake;
});
