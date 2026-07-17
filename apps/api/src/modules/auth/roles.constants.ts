import { UserRole } from "@prisma/client";

/** Every staff role except Read Only — the standard write-access set for clinical CRUD modules. */
export const CLINICAL_STAFF_ROLES = [
  UserRole.clinic_admin,
  UserRole.receptionist,
  UserRole.medical_assistant,
  UserRole.provider,
];
