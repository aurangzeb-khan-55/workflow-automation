import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { AuthTokenVerifier, VerifiedToken } from "./auth-token-verifier.interface";

/**
 * Verifies a Clerk-issued session JWT against Clerk's JWKS. This is the
 * only place a Clerk token is ever decoded — no separate JWT is minted or
 * stored by this API; Clerk remains the sole session authority.
 */
@Injectable()
export class ClerkAuthTokenVerifier implements AuthTokenVerifier {
  private readonly logger = new Logger(ClerkAuthTokenVerifier.name);

  constructor(private readonly config: ConfigService) {}

  private getSecretKey(): string {
    const secretKey = this.config.get<string>("auth.clerkSecretKey");
    if (!secretKey) {
      throw new Error("CLERK_SECRET_KEY is not set. Set AUTH_PROVIDER=stub for local development.");
    }
    return secretKey;
  }

  async verify(token: string): Promise<VerifiedToken> {
    const secretKey = this.getSecretKey();
    const result = await verifyToken(token, { secretKey });

    // @clerk/backend's declared return type is a `{ data, errors }`
    // wrapper, but the runtime actually installed in this monorepo
    // returns the decoded JWT payload directly (sub/iss/exp/etc. as
    // top-level properties) — confirmed by logging the raw object.
    // This is the same transitive @clerk/types version mismatch already
    // worked around elsewhere in this file; handle both shapes rather
    // than trust the declared type.
    type Wrapped = { data?: { sub?: string }; errors?: { reason: string; action?: string; message: string }[] };
    type Flat = { sub?: string };
    const wrapped = result as Wrapped;
    const flat = result as unknown as Flat;

    const sub = wrapped.data?.sub ?? flat.sub;
    const errors = wrapped.errors;

    if (errors) {
      // The thrown 401 is deliberately generic (never leak verification
      // internals to the client) — but the *real* reason is essential for
      // debugging, so it's logged here, server-side only.
      for (const error of errors) {
        this.logger.warn(
          `Clerk token verification failed: reason=${error.reason} action=${error.action ?? "n/a"} message=${error.message}`,
        );
      }
    }

    if (!sub) {
      this.logger.warn(`Clerk token verification produced no usable sub claim. raw=${JSON.stringify(result)}`);
      throw new UnauthorizedException("Invalid or expired session token");
    }

    return { externalUserId: sub };
  }

  async getEmail(externalUserId: string): Promise<string | null> {
    try {
      const clerkClient = createClerkClient({ secretKey: this.getSecretKey() });
      const user = await clerkClient.users.getUser(externalUserId);
      const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
      return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
    } catch (err) {
      this.logger.warn(`Failed to look up Clerk user email for first-login binding: ${(err as Error).message}`);
      return null;
    }
  }
}
