import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { NotificationStatus } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { ClinicFixture, cleanupClinicFixture, seedClinicFixture } from "./support/seed-clinic-fixture";

/**
 * Exercises the real pipeline end to end: HTTP request -> IntakeService
 * queues a real BullMQ job on real Redis -> EmailProcessor picks it up ->
 * StubEmailProvider "sends" it (EMAIL_PROVIDER=stub in this env, so no
 * real HTTP call — the queue/worker/DB-update machinery is what's under
 * test here, not MailHippo itself) -> Notification and Intake reflect
 * success. Polls with a bounded timeout since processing is async.
 */
describe("Intake email queue pipeline (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clinicA: ClinicFixture;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    clinicA = await seedClinicFixture(prisma, "EmailQueueA");
  });

  afterAll(async () => {
    await cleanupClinicFixture(prisma, clinicA.clinicId);
    await app.close();
  });

  async function waitForNotificationStatus(intakeId: string, status: NotificationStatus, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const notification = await prisma.notification.findFirst({ where: { intakeId } });
      if (notification?.status === status) return notification;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`Notification for intake ${intakeId} did not reach status "${status}" within ${timeoutMs}ms`);
  }

  it("THE STANDING REQUIREMENT: a successful send updates the intake and notification status correctly", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/intakes")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send({
        firstName: "Jane",
        lastName: "Doe",
        dob: "1990-05-15",
        email: "jane.emailqueue@example.com",
        phone: "555-0100",
        newOrExisting: "new",
        reasonForVisit: "Annual physical",
        providerId: clinicA.providerId,
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        action: "create_and_send",
      })
      .expect(201);

    expect(created.body.status).toBe("intake_email_sent");

    const notification = await waitForNotificationStatus(created.body.id, NotificationStatus.sent);
    expect(notification.sentAt).not.toBeNull();
    expect(notification.provider).toBe("stub");

    // Success must never silently produce a different status — it stays
    // exactly where the synchronous part of sendEmail() left it.
    const intake = await prisma.intake.findUnique({ where: { id: created.body.id } });
    expect(intake?.status).toBe("intake_email_sent");
  }, 15000);
});
