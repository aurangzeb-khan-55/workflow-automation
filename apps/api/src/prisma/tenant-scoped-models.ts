/**
 * Prisma model names (as they appear in schema.prisma / Prisma.dmmf, not
 * the camelCase client accessor) that carry a `clinicId` column and must
 * never be read/written across clinics. `Clinic` itself is deliberately
 * excluded — it's the tenant root (its own `id` *is* the tenant boundary),
 * not a tenant-scoped child, and is guarded separately by explicit id
 * checks in ClinicsService rather than by this auto-filtering mechanism.
 */
export const TENANT_SCOPED_MODELS = new Set([
  "User",
  "Patient",
  "Appointment",
  "Intake",
  "Document",
  "Notification",
  "StaffNotification",
  "AuditLog",
]);
