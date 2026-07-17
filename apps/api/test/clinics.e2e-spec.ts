import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * The standing cross-tenant case for the Clinics module: a Clinic A staff
 * member must never be able to reach Clinic B's data, including by
 * crafting a request with Clinic B's real id. Exercised over real HTTP
 * through the actual guards (ClerkAuthGuard + RolesGuard, AUTH_PROVIDER=
 * stub) against the real Docker Postgres — not mocked.
 */
describe("Clinics tenant isolation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let clinicAId: string;
  let clinicBId: string;
  const clinicAAdminToken = `stub-clinic-a-admin-${randomUUID()}`;
  const clinicBAdminToken = `stub-clinic-b-admin-${randomUUID()}`;
  const superAdminToken = `stub-super-admin-${randomUUID()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    const clinicA = await prisma.clinic.create({
      data: { name: "E2E Clinic A", slug: `e2e-clinic-a-${randomUUID()}` },
    });
    const clinicB = await prisma.clinic.create({
      data: { name: "E2E Clinic B", slug: `e2e-clinic-b-${randomUUID()}` },
    });
    clinicAId = clinicA.id;
    clinicBId = clinicB.id;

    await prisma.user.create({
      data: {
        clinicId: clinicAId,
        clerkUserId: clinicAAdminToken,
        name: "Clinic A Admin",
        email: `a-admin-${randomUUID()}@example.com`,
        role: UserRole.clinic_admin,
      },
    });
    await prisma.user.create({
      data: {
        clinicId: clinicBId,
        clerkUserId: clinicBAdminToken,
        name: "Clinic B Admin",
        email: `b-admin-${randomUUID()}@example.com`,
        role: UserRole.clinic_admin,
      },
    });
    await prisma.user.create({
      data: {
        clinicId: clinicAId,
        clerkUserId: superAdminToken,
        name: "Platform Super Admin",
        email: `super-admin-${randomUUID()}@example.com`,
        role: UserRole.super_admin,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { clinicId: { in: [clinicAId, clinicBId] } } });
    await prisma.clinic.deleteMany({ where: { id: { in: [clinicAId, clinicBId] } } });
    await app.close();
  });

  it("GET /clinics/me returns only the caller's own clinic", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/clinics/me")
      .set("Authorization", `Bearer ${clinicAAdminToken}`)
      .expect(200);

    expect(res.body.id).toBe(clinicAId);
  });

  it("GET /clinics/me ignores a client-supplied clinicId and still returns the caller's own clinic", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/clinics/me")
      .query({ clinicId: clinicBId })
      .set("Authorization", `Bearer ${clinicAAdminToken}`)
      .expect(200);

    expect(res.body.id).toBe(clinicAId);
  });

  it("THE STANDING CROSS-TENANT CASE: a Clinic A admin cannot reach Clinic B by id", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/clinics/${clinicBId}`)
      .set("Authorization", `Bearer ${clinicAAdminToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/clinics/${clinicBId}`)
      .set("Authorization", `Bearer ${clinicAAdminToken}`)
      .send({ name: "Hacked" })
      .expect(403);
  });

  it("positive control: a Super Admin can reach any clinic by id", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/clinics/${clinicBId}`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.id).toBe(clinicBId);
  });

  it("rejects requests with no bearer token at all", async () => {
    await request(app.getHttpServer()).get("/api/v1/clinics/me").expect(401);
  });
});
