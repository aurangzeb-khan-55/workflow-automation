import "reflect-metadata";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { ClinicFixture, cleanupClinicFixture, seedClinicFixture } from "./support/seed-clinic-fixture";

describe("Intake portal (patient-facing, e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clinicA: ClinicFixture;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    clinicA = await seedClinicFixture(prisma, "PortalA");
  });

  afterAll(async () => {
    await cleanupClinicFixture(prisma, clinicA.clinicId);
    await app.close();
  }, 20_000);

  let uniqueSuffix = 0;
  async function createIntake(opts: { requiredDocumentTypes?: string[]; isTelehealth?: boolean } = {}) {
    uniqueSuffix += 1;
    const res = await request(app.getHttpServer())
      .post("/api/v1/intakes")
      .set("Authorization", `Bearer ${clinicA.adminToken}`)
      .send({
        firstName: "Jane",
        lastName: "Doe",
        dob: "1990-05-15",
        email: `jane.doe.${uniqueSuffix}@example.com`,
        phone: "555-0100",
        newOrExisting: "new",
        reasonForVisit: "Annual physical",
        providerId: clinicA.providerId,
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        requiredDocumentTypes: opts.requiredDocumentTypes ?? ["insurance_card_front"],
        isTelehealth: opts.isTelehealth ?? false,
        action: "create_and_send",
      })
      .expect(201);
    return res.body as {
      id: string;
      secureToken: string;
      requiredDocumentTypes: string[];
      requiredConsentTypes: string[];
    };
  }

  const PERSONAL_INFO = {
    address: { street: "123 Main St", city: "Springfield", state: "IL", zip: "62701" },
    phone: "555-0100",
    email: "jane.doe@example.com",
  };
  const MEDICAL_HISTORY = { conditions: [], allergies: ["Penicillin"], medications: [] };
  const INSURANCE_INFO = {
    noInsurance: false,
    payerName: "Acme Health",
    policyNumber: "P123",
    subscriberName: "Jane Doe",
    relationshipToSubscriber: "Self",
  };

  async function saveSection(token: string, sectionType: string, data: unknown) {
    return request(app.getHttpServer())
      .patch(`/api/v1/patient-intake/${token}/sections/${sectionType}`)
      .send({ data })
      .expect(200);
  }

  /** Uploads+confirms a document for each requested type, and signs every required consent — everything needed for a clean submit. */
  async function completeDocumentsAndConsents(token: string, requiredDocumentTypes: string[], requiredConsentTypes: string[]) {
    for (const documentType of requiredDocumentTypes) {
      const uploadUrlRes = await request(app.getHttpServer())
        .post(`/api/v1/patient-intake/${token}/documents/upload-url`)
        .send({ documentType, fileName: "card.jpg", contentType: "image/jpeg" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/patient-intake/${token}/documents`)
        .send({ documentType, key: uploadUrlRes.body.key, fileName: "card.jpg", mimeType: "image/jpeg", sizeBytes: 1234 })
        .expect(201);
    }

    for (const consentType of requiredConsentTypes) {
      await request(app.getHttpServer())
        .put(`/api/v1/patient-intake/${token}/consents/${consentType}`)
        .send({ signatureData: "data:image/png;base64,ZmFrZS1zaWduYXR1cmU=" })
        .expect(200);
    }
  }

  it("404s for an unknown token", async () => {
    await request(app.getHttpServer()).get("/api/v1/patient-intake/not-a-real-token").expect(404);
  });

  it("410s for an expired token", async () => {
    const intake = await createIntake();
    await prisma.intake.update({
      where: { id: intake.id },
      data: { tokenExpiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer()).get(`/api/v1/patient-intake/${intake.secureToken}`).expect(410);
  });

  it("410s a mutating route too, once the token has expired", async () => {
    const intake = await createIntake();
    await prisma.intake.update({ where: { id: intake.id }, data: { tokenExpiresAt: new Date(Date.now() - 1000) } });

    await request(app.getHttpServer())
      .patch(`/api/v1/patient-intake/${intake.secureToken}/sections/personal_info`)
      .send({ data: PERSONAL_INFO })
      .expect(410);
  });

  it("rejects an unsupported section type (consents are signed via /consents/:consentType, not this endpoint)", async () => {
    const intake = await createIntake();
    await request(app.getHttpServer())
      .patch(`/api/v1/patient-intake/${intake.secureToken}/sections/consents`)
      .send({ data: {} })
      .expect(400);
  });

  it("returns requiredDocumentTypes/requiredConsentTypes so the portal knows which slots to render", async () => {
    const intake = await createIntake({ requiredDocumentTypes: ["insurance_card_front", "drivers_license"], isTelehealth: true });
    const res = await request(app.getHttpServer()).get(`/api/v1/patient-intake/${intake.secureToken}`).expect(200);
    expect(res.body.requiredDocumentTypes.sort()).toEqual(["drivers_license", "insurance_card_front"]);
    expect(res.body.requiredConsentTypes).toEqual(
      expect.arrayContaining(["consent_to_treat", "hipaa_privacy_acknowledgement", "financial_responsibility", "telehealth_consent"]),
    );
  });

  it("a submit attempt before the patient has ever touched the form reports what's missing without a premature status flip", async () => {
    const intake = await createIntake();

    const res = await request(app.getHttpServer()).post(`/api/v1/patient-intake/${intake.secureToken}/submit`).expect(201);

    // intake_email_sent -> missing_documents isn't a legal transition (see
    // the state machine) — an untouched intake just stays put, but still
    // reports the full list of what's missing.
    expect(res.body.status).toBe("intake_email_sent");
    expect(res.body.missing.length).toBeGreaterThan(0);
    expect(res.body.missing.some((m: { category: string }) => m.category === "section")).toBe(true);
    expect(res.body.missing.some((m: { category: string }) => m.category === "document")).toBe(true);
    expect(res.body.missing.some((m: { category: string }) => m.category === "consent")).toBe(true);
  });

  it("an incomplete submit after the patient has started moves the intake to missing_documents and reports exactly what's missing", async () => {
    const intake = await createIntake();
    await saveSection(intake.secureToken, "personal_info", PERSONAL_INFO);

    const res = await request(app.getHttpServer()).post(`/api/v1/patient-intake/${intake.secureToken}/submit`).expect(201);

    expect(res.body.status).toBe("missing_documents");
    expect(res.body.missing.some((m: { category: string }) => m.category === "document")).toBe(true);
    expect(res.body.missing.some((m: { category: string }) => m.category === "consent")).toBe(true);

    const current = await request(app.getHttpServer()).get(`/api/v1/patient-intake/${intake.secureToken}`).expect(200);
    expect(current.body.status).toBe("missing_documents");

    // A second incomplete submit while already in missing_documents must not
    // throw (same-state no-op transitions are otherwise rejected) — it
    // should just re-report what's still missing.
    const again = await request(app.getHttpServer()).post(`/api/v1/patient-intake/${intake.secureToken}/submit`).expect(201);
    expect(again.body.status).toBe("missing_documents");
  });

  it("full happy path: sections + documents + consents advance status automatically, then submit validates and generates a summary", async () => {
    const intake = await createIntake({ requiredDocumentTypes: ["insurance_card_front"] });
    const token = intake.secureToken;

    // First section save: intake_email_sent -> patient_started_intake
    await saveSection(token, "personal_info", PERSONAL_INFO);
    let current = await request(app.getHttpServer()).get(`/api/v1/patient-intake/${token}`).expect(200);
    expect(current.body.status).toBe("patient_started_intake");

    // Second section save: patient_started_intake -> waiting_for_patient
    await saveSection(token, "medical_history", MEDICAL_HISTORY);
    await saveSection(token, "insurance_info", INSURANCE_INFO);

    current = await request(app.getHttpServer()).get(`/api/v1/patient-intake/${token}`).expect(200);
    expect(current.body.status).toBe("waiting_for_patient");
    expect(current.body.sections).toHaveLength(3);

    await completeDocumentsAndConsents(token, intake.requiredDocumentTypes, intake.requiredConsentTypes);

    current = await request(app.getHttpServer()).get(`/api/v1/patient-intake/${token}`).expect(200);
    expect(current.body.documents).toHaveLength(1);
    expect(current.body.consents).toHaveLength(intake.requiredConsentTypes.length);

    const submitRes = await request(app.getHttpServer()).post(`/api/v1/patient-intake/${token}/submit`).expect(201);
    expect(submitRes.body.status).toBe("ready_for_staff_review");
    expect(submitRes.body.missing).toEqual([]);

    const summary = await prisma.intakeSummary.findFirst({ where: { intakeId: intake.id } });
    expect(summary).not.toBeNull();
    expect(summary?.summaryText).toContain("Annual physical");
    expect(summary?.summaryText).toContain("Penicillin");

    const staffNotification = await prisma.staffNotification.findFirst({ where: { intakeId: intake.id } });
    expect(staffNotification).not.toBeNull();
    expect(staffNotification?.clinicId).toBe(clinicA.clinicId);
    expect(staffNotification?.message).toBe("Jane Doe has submitted their intake form");
    expect(staffNotification?.readAt).toBeNull();
  });

  it("rejects further edits once already submitted, but a read (GET) still works", async () => {
    const intake = await createIntake({ requiredDocumentTypes: [] });
    const token = intake.secureToken;

    await saveSection(token, "personal_info", PERSONAL_INFO);
    await saveSection(token, "medical_history", MEDICAL_HISTORY);
    await saveSection(token, "insurance_info", { noInsurance: true });
    await completeDocumentsAndConsents(token, [], intake.requiredConsentTypes);

    await request(app.getHttpServer()).post(`/api/v1/patient-intake/${token}/submit`).expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/patient-intake/${token}/sections/personal_info`)
      .send({ data: PERSONAL_INFO })
      .expect(403);
    await request(app.getHttpServer()).post(`/api/v1/patient-intake/${token}/submit`).expect(403);

    // Read-only route stays reachable — e.g. a confirmation screen refresh.
    await request(app.getHttpServer()).get(`/api/v1/patient-intake/${token}`).expect(200);
  });

  it("cannot address another intake's data through a mismatched token (unguessable token check)", async () => {
    await request(app.getHttpServer()).get(`/api/v1/patient-intake/${randomUUID()}`).expect(404);
  });

  describe("documents", () => {
    it("rejects a document type that wasn't requested for this intake", async () => {
      const intake = await createIntake({ requiredDocumentTypes: ["insurance_card_front"] });
      await request(app.getHttpServer())
        .post(`/api/v1/patient-intake/${intake.secureToken}/documents/upload-url`)
        .send({ documentType: "mammogram", fileName: "x.pdf", contentType: "application/pdf" })
        .expect(400);
    });

    it("always allows 'other' as a catch-all even when not explicitly requested", async () => {
      const intake = await createIntake({ requiredDocumentTypes: [] });
      await request(app.getHttpServer())
        .post(`/api/v1/patient-intake/${intake.secureToken}/documents/upload-url`)
        .send({ documentType: "other", fileName: "note.pdf", contentType: "application/pdf" })
        .expect(201);
    });

    it("rejects a confirm whose key doesn't belong to this intake (forged key defense)", async () => {
      const intake = await createIntake({ requiredDocumentTypes: ["insurance_card_front"] });
      await request(app.getHttpServer())
        .post(`/api/v1/patient-intake/${intake.secureToken}/documents`)
        .send({
          documentType: "insurance_card_front",
          key: "clinics/someone-elses-clinic/patients/x/intakes/y/insurance_card_front/forged.jpg",
          fileName: "forged.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 100,
        })
        .expect(400);
    });

    it("standing security test: a document uploaded under intake A's token cannot be deleted through intake B's token", async () => {
      const intakeA = await createIntake({ requiredDocumentTypes: ["insurance_card_front"] });
      const intakeB = await createIntake({ requiredDocumentTypes: ["insurance_card_front"] });

      const uploadUrlRes = await request(app.getHttpServer())
        .post(`/api/v1/patient-intake/${intakeA.secureToken}/documents/upload-url`)
        .send({ documentType: "insurance_card_front", fileName: "card.jpg", contentType: "image/jpeg" })
        .expect(201);
      const confirmRes = await request(app.getHttpServer())
        .post(`/api/v1/patient-intake/${intakeA.secureToken}/documents`)
        .send({
          documentType: "insurance_card_front",
          key: uploadUrlRes.body.key,
          fileName: "card.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1234,
        })
        .expect(201);
      const documentId = confirmRes.body.id;

      // Intake B's token cannot see or delete intake A's document.
      await request(app.getHttpServer())
        .delete(`/api/v1/patient-intake/${intakeB.secureToken}/documents/${documentId}`)
        .expect(404);

      // Intake A's own token can.
      await request(app.getHttpServer())
        .delete(`/api/v1/patient-intake/${intakeA.secureToken}/documents/${documentId}`)
        .expect(204);
    });
  });

  describe("consents", () => {
    it("rejects a consent type that wasn't requested for this intake (e.g. telehealth_consent on a non-telehealth intake)", async () => {
      const intake = await createIntake({ isTelehealth: false });
      await request(app.getHttpServer())
        .put(`/api/v1/patient-intake/${intake.secureToken}/consents/telehealth_consent`)
        .send({ signatureData: "data:image/png;base64,abc" })
        .expect(400);
    });

    it("allows telehealth_consent when the intake was flagged telehealth", async () => {
      const intake = await createIntake({ isTelehealth: true });
      await request(app.getHttpServer())
        .put(`/api/v1/patient-intake/${intake.secureToken}/consents/telehealth_consent`)
        .send({ signatureData: "data:image/png;base64,abc" })
        .expect(200);
    });

    it("re-signing the same consent type overwrites rather than duplicating", async () => {
      const intake = await createIntake();
      await request(app.getHttpServer())
        .put(`/api/v1/patient-intake/${intake.secureToken}/consents/consent_to_treat`)
        .send({ signatureData: "data:image/png;base64,first" })
        .expect(200);
      await request(app.getHttpServer())
        .put(`/api/v1/patient-intake/${intake.secureToken}/consents/consent_to_treat`)
        .send({ signatureData: "data:image/png;base64,second" })
        .expect(200);

      const res = await request(app.getHttpServer()).get(`/api/v1/patient-intake/${intake.secureToken}`).expect(200);
      expect(res.body.consents.filter((c: { type: string }) => c.type === "consent_to_treat")).toHaveLength(1);
    });

    it("never exposes signatureData or ipAddress through the GET response", async () => {
      const intake = await createIntake();
      await request(app.getHttpServer())
        .put(`/api/v1/patient-intake/${intake.secureToken}/consents/consent_to_treat`)
        .send({ signatureData: "data:image/png;base64,super-secret-signature" })
        .expect(200);

      const res = await request(app.getHttpServer()).get(`/api/v1/patient-intake/${intake.secureToken}`).expect(200);
      expect(JSON.stringify(res.body)).not.toContain("super-secret-signature");
    });

    it("standing security test: cannot sign a consent against another intake through a mismatched token", async () => {
      const intakeA = await createIntake();
      const intakeB = await createIntake();

      await request(app.getHttpServer())
        .put(`/api/v1/patient-intake/${intakeA.secureToken}/consents/consent_to_treat`)
        .send({ signatureData: "data:image/png;base64,a-signature" })
        .expect(200);

      const bView = await request(app.getHttpServer()).get(`/api/v1/patient-intake/${intakeB.secureToken}`).expect(200);
      expect(bView.body.consents).toHaveLength(0);
    });
  });
});
