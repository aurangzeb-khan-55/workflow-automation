import { SetMetadata } from "@nestjs/common";

/**
 * Opts a route out of ClerkAuthGuard. Used only for the handful of routes
 * that must be reachable without a session: the health check, the Clerk
 * webhook, and patient-facing intake-token routes (which authenticate via
 * Intake.secureToken instead, not Clerk). Everything else requires
 * authentication by default — safer for a healthcare app than opt-in per
 * controller, where a forgotten @UseGuards() could silently expose PHI.
 */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
