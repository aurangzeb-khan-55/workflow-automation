import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { ClinicFixture, cleanupClinicFixture, seedClinicFixture } from "./support/seed-clinic-fixture";

describe("Intake (staff-facing, e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clinicA: ClinicFixture;
  let clinicB: ClinicFixture;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    clinicA = await seedClinicFixture(prisma, "IntakeA");
    clinicB = await seedClinicFixture(prisma, "IntakeB");
  });

  afterAll(async () => {
    await cleanupClinicFixture(prisma, clinicA.clinicId);
    await cleanupClinicFixture(prisma, clinicB.clinicId);
    await app.close();
  });

  let uniqueSuffix = 0;
  function validCreateBody(overrides: Record<string, unknown> = {}) {
    uniqueSuffix += 1;
    return {
      firstName: "Jane",
      lastName: "Doe",
      dob: "1990-05-15",
      email: `jane.doe.${uniqueSuffix}@example.com`,
      phone: "555-0100",
      newOrExisting: "new",
      reasonForVisit: "Annual physical",
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      action: "save_draft",
      ...overrides,
    };
  }

  it("save_draft creates a draft intake with no token and sends no email", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/intakes")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send(validCreateBody({ action: "save_draft" }))
      .expect(201);

    expect(res.body.status).toBe("draft");
    expect(res.body.secureToken).toBeNull();
    expect(res.body.tokenExpiresAt).toBeNull();
  });

  it("create_and_send creates the intake, generates a token, and writes an audit log", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/intakes")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send(validCreateBody({ action: "create_and_send" }))
      .expect(201);

    expect(res.body.status).toBe("intake_email_sent");
    expect(res.body.secureToken).toHaveLength(64);
    expect(new Date(res.body.tokenExpiresAt).getTime()).toBeGreaterThan(Date.now());

    const auditLog = await prisma.auditLog.findFirst({
      where: { entity: "Intake", entityId: res.body.id, action: "intake_email_sent" },
    });
    expect(auditLog).not.toBeNull();
    expect(auditLog?.clinicId).toBe(clinicA.clinicId);
  });

  it("links to an existing patient by email + DOB instead of creating a duplicate", async () => {
    const body = validCreateBody({ email: "repeat.visit@example.com", dob: "1975-06-20" });
    const first = await request(app.getHttpServer())
      .post("/api/v1/intakes")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send(body)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post("/api/v1/intakes")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send({ ...body, reasonForVisit: "Follow-up visit" })
      .expect(201);

    const firstIntake = await prisma.intake.findUnique({ where: { id: first.body.id } });
    const secondIntake = await prisma.intake.findUnique({ where: { id: second.body.id } });
    expect(secondIntake?.patientId).toBe(firstIntake?.patientId);

    const patientCount = await prisma.patient.count({
      where: { clinicId: clinicA.clinicId, email: "repeat.visit@example.com" },
    });
    expect(patientCount).toBe(1);
  });

  it("rejects a providerId belonging to another clinic", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/intakes")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send(validCreateBody({ providerId: clinicB.providerId }))
      .expect(400);
  });

  describe("draft workflow", () => {
    it("allows editing a draft's patient/appointment fields", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/intakes")
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .send(validCreateBody())
        .expect(201);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/intakes/${created.body.id}`)
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .send({ firstName: "Janet", reasonForVisit: "Updated reason" })
        .expect(200);

      expect(updated.body.patient.firstName).toBe("Janet");
      expect(updated.body.appointment.reasonForVisit).toBe("Updated reason");
    });

    it("previews the patient-facing experience even before any email is sent", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/intakes")
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .send(validCreateBody())
        .expect(201);

      const preview = await request(app.getHttpServer())
        .get(`/api/v1/intakes/${created.body.id}/preview`)
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(200);

      expect(preview.body.patient.firstName).toBe("Jane");
      expect(preview.body.sections).toEqual([]);
    });

    it("sends the email for an existing draft whenever ready", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/intakes")
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .send(validCreateBody({ action: "save_draft" }))
        .expect(201);
      expect(created.body.status).toBe("draft");

      const sent = await request(app.getHttpServer())
        .patch(`/api/v1/intakes/${created.body.id}/send`)
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(200);

      expect(sent.body.status).toBe("intake_email_sent");
      expect(sent.body.secureToken).toHaveLength(64);
    });

    it("rejects editing or deleting once no longer a draft", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/intakes")
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .send(validCreateBody({ action: "create_and_send" }))
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/intakes/${created.body.id}`)
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .send({ firstName: "Nope" })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/v1/intakes/${created.body.id}`)
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(403);
    });

    it("deletes a draft intake", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/intakes")
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .send(validCreateBody({ action: "save_draft" }))
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/intakes/${created.body.id}`)
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/v1/intakes/${created.body.id}`)
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(404);
    });
  });

  it("THE STANDING CROSS-TENANT CASE: Clinic A staff cannot read, edit, preview, send, or delete Clinic B's intake by id", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/intakes")
      .set("Authorization", `Bearer ${clinicB.adminToken}`)
      .send(validCreateBody({ email: "clinicb.patient@example.com" }))
      .expect(201);
    const clinicBIntakeId = created.body.id;

    await request(app.getHttpServer())
      .get(`/api/v1/intakes/${clinicBIntakeId}`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/intakes/${clinicBIntakeId}/preview`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/intakes/${clinicBIntakeId}`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send({ firstName: "Hacked" })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/intakes/${clinicBIntakeId}/send`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/intakes/${clinicBIntakeId}/mark-uploaded-to-jane`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/intakes/${clinicBIntakeId}/mark-completed`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/intakes/${clinicBIntakeId}/review`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/intakes/${clinicBIntakeId}/package`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/intakes/${clinicBIntakeId}`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(404);
  });

  it("rejects an illegal status transition with 409", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/intakes")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send(validCreateBody({ action: "create_and_send" }))
      .expect(201);

    // status is intake_email_sent; uploaded_to_jane is not a legal next step.
    await request(app.getHttpServer())
      .patch(`/api/v1/intakes/${created.body.id}/mark-uploaded-to-jane`)
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .expect(409);
  });

  describe("staff review, document package, and Jane upload workflow", () => {
    /** Drives an intake all the way to ready_for_staff_review via the real patient portal endpoints — the only way that status is legitimately reached. */
    async function createSubmittedIntake(clinic: ClinicFixture) {
      uniqueSuffix += 1;
      const created = await request(app.getHttpServer())
        .post("/api/v1/intakes")
        .set("Authorization", `Bearer ${clinic.adminToken}`)
        .send(
          validCreateBody({
            email: `review-workflow-${uniqueSuffix}@example.com`,
            requiredDocumentTypes: ["insurance_card_front"],
            action: "create_and_send",
          }),
        )
        .expect(201);
      const token = created.body.secureToken;

      await request(app.getHttpServer())
        .patch(`/api/v1/patient-intake/${token}/sections/personal_info`)
        .send({
          data: {
            address: { street: "123 Main St", city: "Springfield", state: "IL", zip: "62701" },
            phone: "555-0100",
            email: "jane.doe@example.com",
          },
        })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/patient-intake/${token}/sections/medical_history`)
        .send({ data: { conditions: [], allergies: ["Penicillin"], medications: [] } })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/patient-intake/${token}/sections/insurance_info`)
        .send({ data: { noInsurance: true } })
        .expect(200);

      const uploadUrlRes = await request(app.getHttpServer())
        .post(`/api/v1/patient-intake/${token}/documents/upload-url`)
        .send({ documentType: "insurance_card_front", fileName: "card.jpg", contentType: "image/jpeg" })
        .expect(201);

      // The package download later reads these bytes back from storage for
      // real (to bundle into the zip), so the test has to actually PUT
      // something to the signed URL — not just tell the API a key exists.
      const putRes = await fetch(uploadUrlRes.body.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: Buffer.from("fake-jpeg-bytes"),
      });
      expect(putRes.ok).toBe(true);

      await request(app.getHttpServer())
        .post(`/api/v1/patient-intake/${token}/documents`)
        .send({
          documentType: "insurance_card_front",
          key: uploadUrlRes.body.key,
          fileName: "card.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1234,
        })
        .expect(201);

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

    it("GET /review returns the full submitted intake with signed document URLs (not raw s3 paths) and consents without signature data", async () => {
      const intakeId = await createSubmittedIntake(clinicA);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/intakes/${intakeId}/review`)
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(200);

      expect(res.body.personalInfo).toMatchObject({ phone: "555-0100" });
      expect(res.body.medicalHistory).toMatchObject({ allergies: ["Penicillin"] });
      expect(res.body.insuranceInfo).toMatchObject({ noInsurance: true });
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.documents[0].downloadUrl).toMatch(/^https?:\/\/.*X-Amz-Signature=/);
      expect(res.body.documents[0]).not.toHaveProperty("s3Key");
      expect(res.body.consents).toHaveLength(3);
      expect(JSON.stringify(res.body.consents)).not.toContain("signatureData");
      expect(JSON.stringify(res.body)).not.toContain("iVBORw0KGgo"); // the base64 signature payload itself never leaks into the review response
    });

    it("GET /package streams a zip and writes a package_downloaded audit log", async () => {
      const intakeId = await createSubmittedIntake(clinicA);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/intakes/${intakeId}/package`)
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers["content-type"]).toBe("application/zip");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.headers["content-disposition"]).toMatch(/Doe_Jane_1990-05-15_\d{4}-\d{2}-\d{2}\.zip/);
      expect((res.body as Buffer).subarray(0, 2).toString()).toBe("PK");

      const auditLog = await prisma.auditLog.findFirst({
        where: { entity: "Intake", entityId: intakeId, action: "package_downloaded" },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.clinicId).toBe(clinicA.clinicId);
    });

    it("Mark as Uploaded to Jane then Mark as Completed: two distinct transitions, each audited", async () => {
      const intakeId = await createSubmittedIntake(clinicA);

      const uploaded = await request(app.getHttpServer())
        .patch(`/api/v1/intakes/${intakeId}/mark-uploaded-to-jane`)
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(200);
      expect(uploaded.body.status).toBe("uploaded_to_jane");
      expect(uploaded.body.uploadedToJaneAt).not.toBeNull();

      const uploadAudit = await prisma.auditLog.findFirst({
        where: { entity: "Intake", entityId: intakeId, action: "uploaded_to_jane" },
      });
      expect(uploadAudit).not.toBeNull();
      expect(uploadAudit?.previousValue).toEqual({ status: "ready_for_staff_review" });
      expect(uploadAudit?.newValue).toEqual({ status: "uploaded_to_jane" });

      const completed = await request(app.getHttpServer())
        .patch(`/api/v1/intakes/${intakeId}/mark-completed`)
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(200);
      expect(completed.body.status).toBe("completed");

      const completeAudit = await prisma.auditLog.findFirst({
        where: { entity: "Intake", entityId: intakeId, action: "marked_completed" },
      });
      expect(completeAudit).not.toBeNull();
    });

    it("cannot mark completed before uploaded to Jane (409 — the two steps are ordered)", async () => {
      const intakeId = await createSubmittedIntake(clinicA);

      await request(app.getHttpServer())
        .patch(`/api/v1/intakes/${intakeId}/mark-completed`)
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(409);
    });

    it("a read_only staff member can review and download the package, but cannot mark it uploaded to Jane", async () => {
      const intakeId = await createSubmittedIntake(clinicA);

      await request(app.getHttpServer())
        .get(`/api/v1/intakes/${intakeId}/review`)
        .set("Authorization", `Bearer ${clinicA.readOnlyToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/intakes/${intakeId}/mark-uploaded-to-jane`)
        .set("Authorization", `Bearer ${clinicA.readOnlyToken}`)
        .expect(403);
    });
  });

  describe("dashboard filter queries", () => {
    let filterIntakeId: string;
    const scheduledAt = new Date("2026-09-15T14:00:00Z");

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/intakes")
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .send(
          validCreateBody({
            firstName: "Filterable",
            lastName: "Zzdashboard",
            email: "filterable@example.com",
            dob: "1980-01-01",
            providerId: clinicA.providerId,
            scheduledAt: scheduledAt.toISOString(),
            action: "create_and_send",
          }),
        )
        .expect(201);
      filterIntakeId = res.body.id;
    });

    it("filters by status", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/intakes")
        .query({ status: "intake_email_sent" })
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(200);

      expect(res.body.some((i: { id: string }) => i.id === filterIntakeId)).toBe(true);
      expect(res.body.every((i: { status: string }) => i.status === "intake_email_sent")).toBe(true);
    });

    it("filters by providerId (via the linked appointment)", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/intakes")
        .query({ providerId: clinicA.providerId })
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(200);

      expect(res.body.some((i: { id: string }) => i.id === filterIntakeId)).toBe(true);
    });

    it("filters by appointment date range (via the linked appointment)", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/intakes")
        .query({ fromDate: "2026-09-01T00:00:00Z", toDate: "2026-09-30T00:00:00Z" })
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(200);
      expect(res.body.some((i: { id: string }) => i.id === filterIntakeId)).toBe(true);

      const outOfRange = await request(app.getHttpServer())
        .get("/api/v1/intakes")
        .query({ fromDate: "2027-01-01T00:00:00Z", toDate: "2027-01-31T00:00:00Z" })
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(200);
      expect(outOfRange.body.some((i: { id: string }) => i.id === filterIntakeId)).toBe(false);
    });

    it("filters by patient name, case-insensitively", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/intakes")
        .query({ patientName: "zzdashboard" })
        .set("Authorization", `Bearer ${clinicA.adminToken}`)
        .expect(200);

      expect(res.body.some((i: { id: string }) => i.id === filterIntakeId)).toBe(true);
    });

    it("dashboard queries never surface another clinic's intakes regardless of filters", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/intakes")
        .set("Authorization", `Bearer ${clinicB.adminToken}`)
        .expect(200);

      expect(res.body.some((i: { id: string }) => i.id === filterIntakeId)).toBe(false);
    });
  });
});
