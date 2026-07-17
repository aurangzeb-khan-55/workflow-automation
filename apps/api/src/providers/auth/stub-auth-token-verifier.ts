import { Injectable } from "@nestjs/common";
import { AuthTokenVerifier, VerifiedToken } from "./auth-token-verifier.interface";

/**
 * Local-dev/test stand-in for Clerk. Performs no signature verification —
 * the bearer token *is* the external user id to impersonate, matched
 * directly against `User.clerkUserId`. Never enabled outside
 * AUTH_PROVIDER=stub (see env.validation.ts, which restricts AUTH_PROVIDER
 * to "stub" | "clerk").
 */
@Injectable()
export class StubAuthTokenVerifier implements AuthTokenVerifier {
  async verify(token: string): Promise<VerifiedToken> {
    return { externalUserId: token };
  }

  /**
   * There's no real Clerk account to look an email up from in stub mode,
   * so the first-login bind-by-email fallback is exercised via a plain
   * token convention instead: a bearer token of the form
   * "email:<address>:<anything>" carries the email directly. Tokens
   * without that prefix have no derivable email, same as a real Clerk
   * account with none.
   */
  async getEmail(externalUserId: string): Promise<string | null> {
    const match = /^email:([^:]+@[^:]+):/.exec(externalUserId);
    return match ? match[1] : null;
  }
}
