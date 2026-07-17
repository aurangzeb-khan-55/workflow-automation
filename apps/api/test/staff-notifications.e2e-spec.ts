import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { ClinicFixture, cleanupClinicFixture, seedClinicFixture } from "./support/seed-clinic-fixture";

describe("Staff notifications (in-app alerts, e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clinicA: ClinicFixture;
  let clinicB: ClinicFixture;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    clinicA = await seedClinicFixture(prisma, "StaffNotifA");
    clinicB = await seedClinicFixture(prisma, "StaffNotifB");
  });

  afterAll(async () => {
    await cleanupClinicFixture(prisma, clinicA.clinicId);
    await cleanupClinicFixture(prisma, clinicB.clinicId);
    await app.close();
  }, 20_000);

  let uniqueSuffix = 0;

  /** Drives an intake to ready_for_staff_review via the real patient portal — the only legitimate way a StaffNotification gets created. */
  async function createSubmittedIntake(clinic: ClinicFixture, patientLastName = "Notified") {
    uniqueSuffix += 1;
    const created = await request(app.getHttpServer())
      .post("/api/v1/intakes")
      .set("Authorization", `Bearer ${clinic.adminToken}`)
      .send({
        firstName: "Nora",
        lastName: patientLastName,
        dob: "1992-02-02",
        email: `staff-notif-${uniqueSuffix}@example.com`,
        phone: "555-0188",
        newOrExisting: "new",
        reasonForVisit: "Annual physical",
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        requiredDocumentTypes: [],
        action: "create_and_send",
      })
      .expect(201);
    const token = created.body.secureToken;

    await request(app.getHttpServer())
      .patch(`/api/v1/patient-intake/${token}/sections/personal_info`)
      .send({
        data: {
          address: { street: "1 Main St", city: "Springfield", state: "IL", zip: "62701" },
          phone: "555-0188",
          email: "nora@example.com",
        },
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/patient-intake/${token}/sections/medical_history`)
      .send({ data: { conditions: [], allergies: [], medications: [] } })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/patient-intake/${token}/sections/insurance_info`)
      .send({ data: { noInsurance: true } })
      .expect(200);

    for (const consentType of ["consent_to_treat", "hipaa_privacy_acknowledgement", "financial_responsibility"]) {
      await request(app.getHttpServer())
        .put(`/api/v1/patient-intake/${token}/consents/${consentType}`)
        .send({ signatureData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" })
        .expect(200);
    }

    const submitRes = await request(app.getHttpServer()).post(`/api/v1/patient-intake/${token}/submit`).expect(201);
    expect(submitRes.body.status).toBe("ready_for_staff_review");

    return created.body.id as string;
  }

  it("lists notifications most-recent-first with an accurate unread count", async () => {
    const before = await request(app.getHttpServer())
      .get("/api/v1/staff-notifications")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);
    const baselineUnread = before.body.unreadCount;

    await createSubmittedIntake(clinicA, "First");
    await createSubmittedIntake(clinicA, "Second");

    const res = await request(app.getHttpServer())
      .get("/api/v1/staff-notifications")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);

    expect(res.body.unreadCount).toBe(baselineUnread + 2);
    expect(res.body.notifications[0].message).toBe("Nora Second has submitted their intake form");
    expect(res.body.notifications[1].message).toBe("Nora First has submitted their intake form");
    expect(new Date(res.body.notifications[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(res.body.notifications[1].createdAt).getTime(),
    );
  });

  it("marks a single notification read, and it stops counting as unread", async () => {
    const intakeId = await createSubmittedIntake(clinicA, "MarkOne");
    const list = await request(app.getHttpServer())
      .get("/api/v1/staff-notifications")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);
    const notification = list.body.notifications.find((n: { intakeId: string }) => n.intakeId === intakeId);
    expect(notification.readAt).toBeNull();

    const marked = await request(app.getHttpServer())
      .patch(`/api/v1/staff-notifications/${notification.id}/read`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);
    expect(marked.body.readAt).not.toBeNull();

    const after = await request(app.getHttpServer())
      .get("/api/v1/staff-notifications")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);
    const stillThere = after.body.notifications.find((n: { id: string }) => n.id === notification.id);
    expect(stillThere.readAt).not.toBeNull();
  });

  it("marking the same notification read twice is a harmless no-op", async () => {
    const intakeId = await createSubmittedIntake(clinicA, "Idempotent");
    const list = await request(app.getHttpServer())
      .get("/api/v1/staff-notifications")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);
    const notification = list.body.notifications.find((n: { intakeId: string }) => n.intakeId === intakeId);

    await request(app.getHttpServer())
      .patch(`/api/v1/staff-notifications/${notification.id}/read`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/staff-notifications/${notification.id}/read`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);
  });

  it("mark-all-read clears every unread notification for the clinic", async () => {
    await createSubmittedIntake(clinicA, "BulkA");
    await createSubmittedIntake(clinicA, "BulkB");

    await request(app.getHttpServer())
      .patch("/api/v1/staff-notifications/read-all")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);

    const after = await request(app.getHttpServer())
      .get("/api/v1/staff-notifications")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);
    expect(after.body.unreadCount).toBe(0);
    expect(after.body.notifications.every((n: { readAt: string | null }) => n.readAt !== null)).toBe(true);
  });

  it("404s marking a notification that doesn't exist", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/staff-notifications/00000000-0000-0000-0000-000000000000/read")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);
  });

  it("THE STANDING CROSS-TENANT CASE: Clinic A staff cannot see or mark read Clinic B's notifications", async () => {
    const clinicBIntakeId = await createSubmittedIntake(clinicB, "CrossTenant");
    const clinicBList = await request(app.getHttpServer())
      .get("/api/v1/staff-notifications")
      .set("Authorization", `Bearer ${clinicB.adminToken}`)
      .expect(200);
    const clinicBNotification = clinicBList.body.notifications.find(
      (n: { intakeId: string }) => n.intakeId === clinicBIntakeId,
    );
    expect(clinicBNotification).toBeDefined();

    const clinicAList = await request(app.getHttpServer())
      .get("/api/v1/staff-notifications")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);
    expect(clinicAList.body.notifications.some((n: { id: string }) => n.id === clinicBNotification.id)).toBe(false);

    await request(app.getHttpServer())
      .patch(`/api/v1/staff-notifications/${clinicBNotification.id}/read`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);
  });

  it("a read_only staff member can view and mark notifications read (informational, not a business action)", async () => {
    const intakeId = await createSubmittedIntake(clinicA, "ReadOnlyCheck");
    const list = await request(app.getHttpServer())
      .get("/api/v1/staff-notifications")
      .set("Authorization", `Bearer ${clinicA.readOnlyToken}`)
      .expect(200);
    const notification = list.body.notifications.find((n: { intakeId: string }) => n.intakeId === intakeId);

    await request(app.getHttpServer())
      .patch(`/api/v1/staff-notifications/${notification.id}/read`)
      .set("Authorization", `Bearer ${clinicA.readOnlyToken}`)
      .expect(200);
  });
});
