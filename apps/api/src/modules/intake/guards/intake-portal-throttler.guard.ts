import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectThrottlerStorage, ThrottlerStorage } from "@nestjs/throttler";
import { IntakePortalRequest } from "../types/intake-portal-request";

const WINDOW_MS = 60_000;

// Bounds brute-force guessing of the secureToken itself: a fixed cap per
// source IP across every token value it tries, regardless of which one (or
// how many different ones) it hits.
const IP_LIMIT_PER_WINDOW = 100;

// Bounds abuse/hammering of one specific (possibly leaked) valid token,
// independent of how many different IPs it's replayed from. Generous enough
// for a real multi-step form session (~10 section/document/consent calls).
const TOKEN_LIMIT_PER_WINDOW = 60;

/**
 * Runs before IntakeTokenGuard on every /patient-intake/:token route. Two
 * independent windows, both enforced via the same in-memory
 * ThrottlerStorage the rest of @nestjs/throttler uses (not currently applied
 * anywhere else in the app as a global guard) — see IntakeTokenGuard's
 * doc-comment for how the two guards compose.
 */
@Injectable()
export class IntakePortalThrottlerGuard implements CanActivate {
  constructor(@InjectThrottlerStorage() private readonly storage: ThrottlerStorage) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IntakePortalRequest>();
    const token = request.params.token ?? "no-token";
    const ip = request.ip ?? "unknown-ip";

    const ipResult = await this.storage.increment(
      `intake-portal-ip:${ip}`,
      WINDOW_MS,
      IP_LIMIT_PER_WINDOW,
      WINDOW_MS,
      "intake-portal-ip",
    );
    if (ipResult.isBlocked) {
      throw new HttpException("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const tokenResult = await this.storage.increment(
      `intake-portal-token:${token}`,
      WINDOW_MS,
      TOKEN_LIMIT_PER_WINDOW,
      WINDOW_MS,
      "intake-portal-token",
    );
    if (tokenResult.isBlocked) {
      throw new HttpException("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
