import "reflect-metadata";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";

/**
 * The B2B invite flow: a Clinic Administrator creates a User row before
 * that person has ever signed into Clerk (clerkUserId null). This proves
 * that first successful authentication binds the row by email — required
 * for invited staff to ever be able to log in at all.
 */
describe("Auth first-login bind-by-email (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clinicId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    const clinic = await prisma.clinic.create({
      data: { name: "Bind Test Clinic", slug: `bind-test-${randomUUID()}` },
    });
    clinicId = clinic.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { clinicId } });
    await prisma.clinic.delete({ where: { id: clinicId } });
    await app.close();
  });

  it("binds an invited-but-never-logged-in User row on first successful authentication", async () => {
    const email = `invited-${randomUUID()}@example.com`;
    const invited = await prisma.user.create({
      data: {
        clinicId,
        clerkUserId: null,
        name: "Invited Provider",
        email,
        role: UserRole.provider,
      },
    });
    expect(invited.clerkUserId).toBeNull();

    // Stub convention: "email:<address>:<suffix>" — verify.ts uses the
    // whole token as the external user id; getEmail() extracts the email.
    const firstLoginToken = `email:${email}:${randomUUID()}`;

    const res = await request(app.getHttpServer())
      .get("/api/v1/clinics/me")
      .set("Authorization", `Bearer ${firstLoginToken}`)
      .expect(200);
    expect(res.body.id).toBe(clinicId);

    const updated = await prisma.user.findUnique({ where: { id: invited.id } });
    expect(updated?.clerkUserId).toBe(firstLoginToken);

    // Second request with the same (now-bound) token authenticates via
    // the ordinary clerkUserId lookup, not the fallback, and still works.
    const secondRes = await request(app.getHttpServer())
      .get("/api/v1/clinics/me")
      .set("Authorization", `Bearer ${firstLoginToken}`)
      .expect(200);
    expect(secondRes.body.id).toBe(clinicId);
  });

  it("401s when the email has no pending invite anywhere", async () => {
    const token = `email:nobody-${randomUUID()}@example.com:${randomUUID()}`;
    await request(app.getHttpServer())
      .get("/api/v1/clinics/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });

  it("401s (ambiguous) when the same email is pending invite at more than one clinic", async () => {
    const email = `ambiguous-${randomUUID()}@example.com`;
    const otherClinic = await prisma.clinic.create({
      data: { name: "Bind Test Clinic 2", slug: `bind-test-2-${randomUUID()}` },
    });

    await prisma.user.create({
      data: { clinicId, clerkUserId: null, name: "A", email, role: UserRole.provider },
    });
    await prisma.user.create({
      data: { clinicId: otherClinic.id, clerkUserId: null, name: "B", email, role: UserRole.provider },
    });

    const token = `email:${email}:${randomUUID()}`;
    await request(app.getHttpServer())
      .get("/api/v1/clinics/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);

    await prisma.user.deleteMany({ where: { email } });
    await prisma.clinic.delete({ where: { id: otherClinic.id } });
  });
});
