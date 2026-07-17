import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../src/prisma/prisma.service";

export interface ClinicFixture {
  clinicId: string;
  adminToken: string;
  readOnlyToken: string;
  providerId: string;
  providerToken: string;
}

/** Seeds one clinic with a clinic_admin, a read_only user, and a provider — the standard cast for cross-tenant tests. */
export async function seedClinicFixture(prisma: PrismaService, label: string): Promise<ClinicFixture> {
  const clinic = await prisma.clinic.create({
    data: { name: `${label} Clinic`, slug: `${label.toLowerCase()}-${randomUUID()}` },
  });

  const adminToken = `stub-${label}-admin-${randomUUID()}`;
  await prisma.user.create({
    data: {
      clinicId: clinic.id,
      clerkUserId: adminToken,
      name: `${label} Admin`,
      email: `${label.toLowerCase()}-admin-${randomUUID()}@example.com`,
      role: UserRole.clinic_admin,
    },
  });

  const readOnlyToken = `stub-${label}-readonly-${randomUUID()}`;
  await prisma.user.create({
    data: {
      clinicId: clinic.id,
      clerkUserId: readOnlyToken,
      name: `${label} Read Only`,
      email: `${label.toLowerCase()}-readonly-${randomUUID()}@example.com`,
      role: UserRole.read_only,
    },
  });

  const providerToken = `stub-${label}-provider-${randomUUID()}`;
  const provider = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      clerkUserId: providerToken,
      name: `${label} Provider`,
      email: `${label.toLowerCase()}-provider-${randomUUID()}@example.com`,
      role: UserRole.provider,
    },
  });

  return { clinicId: clinic.id, adminToken, readOnlyToken, providerId: provider.id, providerToken };
}

export async function cleanupClinicFixture(prisma: PrismaService, clinicId: string) {
  await prisma.auditLog.deleteMany({ where: { clinicId } });
  await prisma.notification.deleteMany({ where: { clinicId } });
  await prisma.staffNotification.deleteMany({ where: { clinicId } });
  await prisma.intakeSummary.deleteMany({ where: { intake: { clinicId } } });
  await prisma.consent.deleteMany({ where: { intake: { clinicId } } });
  await prisma.intakeSection.deleteMany({ where: { intake: { clinicId } } });
  await prisma.document.deleteMany({ where: { clinicId } });
  await prisma.intake.deleteMany({ where: { clinicId } });
  await prisma.appointment.deleteMany({ where: { clinicId } });
  await prisma.patient.deleteMany({ where: { clinicId } });
  await prisma.user.deleteMany({ where: { clinicId } });
  await prisma.clinic.delete({ where: { id: clinicId } });
}
