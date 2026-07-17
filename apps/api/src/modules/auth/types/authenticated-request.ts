import { Request } from "express";
import { UserRole } from "@prisma/client";

/**
 * Populated exclusively by ClerkAuthGuard from the local `User` row looked
 * up by the verified token's external user id. Never trust a `clinicId`
 * from anywhere else (body, query, route param) for scoping decisions —
 * this is the only source of truth for "which clinic is this request for".
 */
export interface AuthenticatedUser {
  id: string;
  clinicId: string;
  role: UserRole;
  clerkUserId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
