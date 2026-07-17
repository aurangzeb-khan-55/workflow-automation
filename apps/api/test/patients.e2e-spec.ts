import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { ClinicFixture, cleanupClinicFixture, seedClinicFixture } from "./support/seed-clinic-fixture";

describe("Patients (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clinicA: ClinicFixture;
  let clinicB: ClinicFixture;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    clinicA = await seedClinicFixture(prisma, "PatientsA");
    clinicB = await seedClinicFixture(prisma, "PatientsB");
  });

  afterAll(async () => {
    await cleanupClinicFixture(prisma, clinicA.clinicId);
    await cleanupClinicFixture(prisma, clinicB.clinicId);
    await app.close();
  });

  const validPatientBody = {
    firstName: "Jane",
    lastName: "Doe",
    dob: "1990-05-15",
    phone: "555-0100",
    email: "jane.doe@example.com",
    newOrExisting: "new",
  };

  it("creates a patient scoped to the caller's clinic", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send(validPatientBody)
      .expect(201);

    expect(res.body.firstName).toBe("Jane");
    expect(res.body.clinicId).toBe(clinicA.clinicId);
  });

  it("read_only cannot create a patient", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${clinicA.readOnlyToken}`)
      .send(validPatientBody)
      .expect(403);
  });

  it("THE STANDING CROSS-TENANT CASE: Clinic A staff cannot read, update, or delete Clinic B's patient by id", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${clinicB.adminToken}`)
      .send(validPatientBody)
      .expect(201);
    const clinicBPatientId = created.body.id;

    await request(app.getHttpServer())
      .get(`/api/v1/patients/${clinicBPatientId}`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/patients/${clinicBPatientId}`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send({ firstName: "Hacked" })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/patients/${clinicBPatientId}`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);

    // Confirm it's untouched from Clinic B's own perspective.
    const stillThere = await request(app.getHttpServer())
      .get(`/api/v1/patients/${clinicBPatientId}`)
      .set("Authorization", `Bearer ${clinicB.adminToken}`)
      .expect(200);
    expect(stillThere.body.firstName).toBe("Jane");
  });

  it("search filters by first/last name, case-insensitively, within the caller's clinic only", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send({ ...validPatientBody, firstName: "Zzsearchable", lastName: "Zzsurname" })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get("/api/v1/patients")
      .query({ search: "zzsearchable" })
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((p: { firstName: string }) => p.firstName === "Zzsearchable")).toBe(true);
  });
});
