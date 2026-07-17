export enum UserRole {
  SUPER_ADMIN = "super_admin",
  CLINIC_ADMIN = "clinic_admin",
  RECEPTIONIST = "receptionist",
  MEDICAL_ASSISTANT = "medical_assistant",
  PROVIDER = "provider",
  READ_ONLY = "read_only",
}

/**
 * Coarse capability tiers used by RBAC guards. Kept separate from UserRole
 * so a role's permissions can be adjusted without touching every guard.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.CLINIC_ADMIN]: 80,
  [UserRole.PROVIDER]: 60,
  [UserRole.MEDICAL_ASSISTANT]: 50,
  [UserRole.RECEPTIONIST]: 40,
  [UserRole.READ_ONLY]: 10,
};
