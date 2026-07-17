import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthProviderModule } from "../../providers/auth/auth-provider.module";
import { ClerkAuthGuard } from "./guards/clerk-auth.guard";
import { RolesGuard } from "./guards/roles.guard";

/**
 * Registers ClerkAuthGuard and RolesGuard globally (APP_GUARD), in that
 * order, so authentication resolves request.user before role checks run.
 * Routes opt out of auth via @Public(); role checks are opt-in via
 * @Roles(...) and otherwise allow any authenticated user.
 */
@Module({
  imports: [AuthProviderModule],
  providers: [
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
