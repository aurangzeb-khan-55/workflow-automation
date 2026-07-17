import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Everything under the `(staff)` route group (currently just /dashboard)
 * requires a signed-in Clerk session. Unauthenticated requests are
 * redirected to /sign-in automatically by auth.protect(). This proves
 * *identity* only — role/clinic authorization is enforced API-side by
 * ClerkAuthGuard/RolesGuard on every request, this middleware doesn't
 * duplicate that logic.
 */
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)", "/__clerk/:path*"],
};
