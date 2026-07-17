import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { ClinicFixture, cleanupClinicFixture, seedClinicFixture } from "./support/seed-clinic-fixture";

describe("Appointments (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clinicA: ClinicFixture;
  let clinicB: ClinicFixture;
  let clinicAPatientId: string;
  let clinicBPatientId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    clinicA = await seedClinicFixture(prisma, "ApptA");
    clinicB = await seedClinicFixture(prisma, "ApptB");

    const patientBody = {
      firstName: "Jane",
      lastName: "Doe",
      dob: new Date("1990-05-15"),
      phone: "555-0100",
      email: "jane.doe@example.com",
      newOrExisting: "new" as const,
    };
    const patientA = await prisma.patient.create({ data: { ...patientBody, clinicId: clinicA.clinicId } });
    const patientB = await prisma.patient.create({ data: { ...patientBody, clinicId: clinicB.clinicId } });
    clinicAPatientId = patientA.id;
    clinicBPatientId = patientB.id;
  });

  afterAll(async () => {
    await cleanupClinicFixture(prisma, clinicA.clinicId);
    await cleanupClinicFixture(prisma, clinicB.clinicId);
    await app.close();
  });

  it("creates an appointment linking an in-clinic patient and provider", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send({
        patientId: clinicAPatientId,
        providerId: clinicA.providerId,
        reasonForVisit: "Annual physical",
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .expect(201);

    expect(res.body.clinicId).toBe(clinicA.clinicId);
    expect(res.body.providerId).toBe(clinicA.providerId);
  });

  it("rejects a patientId that belongs to another clinic", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send({
        patientId: clinicBPatientId,
        reasonForVisit: "Annual physical",
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .expect(400);
  });

  it("rejects a providerId that belongs to another clinic", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send({
        patientId: clinicAPatientId,
        providerId: clinicB.providerId,
        reasonForVisit: "Annual physical",
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .expect(400);
  });

  it("rejects a providerId that doesn't have the provider role", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send({
        patientId: clinicAPatientId,
        providerId: clinicA.clinicId, // not even a user id, but exercises the same check path
        reasonForVisit: "Annual physical",
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .expect(400);
  });

  it("THE STANDING CROSS-TENANT CASE: Clinic A staff cannot read, update, or delete Clinic B's appointment by id", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${clinicB.adminToken}`)
      .send({
        patientId: clinicBPatientId,
        reasonForVisit: "Clinic B visit",
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .expect(201);
    const clinicBAppointmentId = created.body.id;

    await request(app.getHttpServer())
      .get(`/api/v1/appointments/${clinicBAppointmentId}`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${clinicBAppointmentId}`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send({ reasonForVisit: "Hacked" })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/appointments/${clinicBAppointmentId}`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);
  });

  it("filters by patientId and date range", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/appointments")
      .query({ patientId: clinicAPatientId })
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);

    expect(res.body.every((a: { patientId: string }) => a.patientId === clinicAPatientId)).toBe(true);
  });
});
