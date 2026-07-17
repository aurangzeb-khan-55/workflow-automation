import { BadRequestException } from "@nestjs/common";
import { ConsentType, Intake } from "@prisma/client";
import { ConsentsService } from "./consents.service";

function makeIntake(overrides: Partial<Intake> = {}): Intake {
  return {
    id: "intake-1",
    clinicId: "clinic-1",
    patientId: "patient-1",
    appointmentId: null,
    secureToken: "tok",
    tokenExpiresAt: new Date(Date.now() + 100_000),
    status: "waiting_for_patient",
    requiredDocumentTypes: [],
    requiredConsentTypes: [ConsentType.consent_to_treat, ConsentType.hipaa_privacy_acknowledgement],
    createdAt: new Date(),
    updatedAt: new Date(),
    submittedAt: null,
    reviewedAt: null,
    uploadedToJaneAt: null,
    ...overrides,
  } as Intake;
}

describe("ConsentsService", () => {
  function makeService() {
    const prisma = {
      consent: {
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const service = new ConsentsService(prisma as any);
    return { service, prisma };
  }

  it("rejects a consent type that wasn't requested for this intake", async () => {
    const { service } = makeService();
    const intake = makeIntake();
    await expect(
      service.sign(intake, ConsentType.telehealth_consent, { signatureData: "data:image/png;base64,abc" }, "127.0.0.1"),
    ).rejects.toThrow(BadRequestException);
  });

  it("upserts the signature, storing signedAt and the caller's IP", async () => {
    const { service, prisma } = makeService();
    const intake = makeIntake();
    prisma.consent.upsert.mockResolvedValue({ id: "c1" });

    await service.sign(intake, ConsentType.consent_to_treat, { signatureData: "data:image/png;base64,abc" }, "10.0.0.1");

    expect(prisma.consent.upsert).toHaveBeenCalledWith({
      where: { intakeId_type: { intakeId: "intake-1", type: ConsentType.consent_to_treat } },
      create: expect.objectContaining({
        intakeId: "intake-1",
        type: ConsentType.consent_to_treat,
        signatureData: "data:image/png;base64,abc",
        ipAddress: "10.0.0.1",
      }),
      update: expect.objectContaining({
        signatureData: "data:image/png;base64,abc",
        ipAddress: "10.0.0.1",
      }),
    });
  });

  it("listForIntake never exposes signatureData or ipAddress", async () => {
    const { service, prisma } = makeService();
    prisma.consent.findMany.mockResolvedValue([
      { type: ConsentType.consent_to_treat, signedAt: new Date(), signatureData: "secret-signature", ipAddress: "1.2.3.4" },
    ]);

    const result = await service.listForIntake("intake-1");
    expect(result).toEqual([{ type: ConsentType.consent_to_treat, signedAt: expect.any(Date) }]);
    expect(JSON.stringify(result)).not.toContain("secret-signature");
    expect(JSON.stringify(result)).not.toContain("1.2.3.4");
  });

  describe("requiredTypesPresence", () => {
    it("returns exactly the required types that have been signed", async () => {
      const { service, prisma } = makeService();
      const intake = makeIntake();
      prisma.consent.findMany.mockResolvedValue([{ type: ConsentType.consent_to_treat }]);

      const result = await service.requiredTypesPresence(intake);
      expect(result.has(ConsentType.consent_to_treat)).toBe(true);
      expect(result.has(ConsentType.hipaa_privacy_acknowledgement)).toBe(false);
    });
  });
});
