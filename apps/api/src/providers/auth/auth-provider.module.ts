import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AUTH_TOKEN_VERIFIER } from "./auth-token-verifier.interface";
import { StubAuthTokenVerifier } from "./stub-auth-token-verifier";
import { ClerkAuthTokenVerifier } from "./clerk-auth-token-verifier";

@Module({
  imports: [ConfigModule],
  providers: [
    StubAuthTokenVerifier,
    ClerkAuthTokenVerifier,
    {
      provide: AUTH_TOKEN_VERIFIER,
      useFactory: (
        config: ConfigService,
        stub: StubAuthTokenVerifier,
        clerk: ClerkAuthTokenVerifier,
      ) => (config.get<string>("auth.provider") === "clerk" ? clerk : stub),
      inject: [ConfigService, StubAuthTokenVerifier, ClerkAuthTokenVerifier],
    },
  ],
  exports: [AUTH_TOKEN_VERIFIER],
})
export class AuthProviderModule {}
