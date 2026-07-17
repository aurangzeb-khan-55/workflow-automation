import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { ClinicFixture, cleanupClinicFixture, seedClinicFixture } from "./support/seed-clinic-fixture";

describe("Users (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clinicA: ClinicFixture;
  let clinicB: ClinicFixture;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    clinicA = await seedClinicFixture(prisma, "UsersA");
    clinicB = await seedClinicFixture(prisma, "UsersB");
  });

  afterAll(async () => {
    await cleanupClinicFixture(prisma, clinicA.clinicId);
    await cleanupClinicFixture(prisma, clinicB.clinicId);
    await app.close();
  });

  it("lists only the caller's own clinic's users", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);

    const ids: string[] = res.body.map((u: { id: string }) => u.id);
    expect(ids).toContain(clinicA.providerId);
    expect(ids).not.toContain(clinicB.providerId);
  });

  it("THE STANDING CROSS-TENANT CASE: Clinic A's user list never includes Clinic B's staff regardless of filters", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/users")
      .query({ role: "provider" })
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);

    const ids: string[] = res.body.map((u: { id: string }) => u.id);
    expect(ids).toContain(clinicA.providerId);
    expect(ids).not.toContain(clinicB.providerId);
  });

  it("filters by role", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/users")
      .query({ role: "provider" })
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);

    expect(res.body.every((u: { role: string }) => u.role === "provider")).toBe(true);
  });

  it("does not expose clerkUserId", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(200);

    expect(res.body.every((u: object) => !("clerkUserId" in u))).toBe(true);
  });
});
