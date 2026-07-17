/**
 * Verifies the bearer token attached to an incoming request and resolves it
 * to an external identity. This is deliberately the only thing the auth
 * provider layer does — mapping that identity to a clinic/role lives in
 * the local `User` table (see ClerkAuthGuard), never in the token itself,
 * so a role change or deactivation takes effect on the next request rather
 * than waiting for a cached claim to expire.
 */
export const AUTH_TOKEN_VERIFIER = Symbol("AUTH_TOKEN_VERIFIER");

export interface VerifiedToken {
  externalUserId: string;
}

export interface AuthTokenVerifier {
  verify(token: string): Promise<VerifiedToken>;

  /**
   * Resolves the verified email for an external user id, or null if
   * unavailable. Used only by ClerkAuthGuard's first-login fallback path
   * (no local User.clerkUserId match yet) — never called on the common
   * path where clerkUserId already matches, so this doesn't add latency
   * to ordinary requests.
   */
  getEmail(externalUserId: string): Promise<string | null>;
}
