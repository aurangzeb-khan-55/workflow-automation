import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DocumentType, Intake } from "@prisma/client";
import { DocumentsService } from "./documents.service";

function makeIntake(overrides: Partial<Intake> = {}): Intake {
  return {
    id: "intake-1",
    clinicId: "clinic-1",
    patientId: "patient-1",
    appointmentId: null,
    secureToken: "tok",
    tokenExpiresAt: new Date(Date.now() + 100_000),
    status: "waiting_for_patient",
    requiredDocumentTypes: [DocumentType.insurance_card_front, DocumentType.drivers_license],
    requiredConsentTypes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    submittedAt: null,
    reviewedAt: null,
    uploadedToJaneAt: null,
    ...overrides,
  } as Intake;
}

describe("DocumentsService", () => {
  function makeService() {
    const prisma = {
      document: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const storage = {
      putObject: jest.fn(),
      getSignedDownloadUrl: jest.fn().mockResolvedValue("https://signed-download"),
      getSignedUploadUrl: jest.fn().mockResolvedValue("https://signed-upload"),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DocumentsService(prisma as any, storage as any);
    return { service, prisma, storage };
  }

  describe("requestUploadUrl", () => {
    it("rejects a document type that wasn't requested for this intake", async () => {
      const { service } = makeService();
      const intake = makeIntake();
      await expect(
        service.requestUploadUrl(intake, { documentType: DocumentType.mammogram, fileName: "x.pdf", contentType: "application/pdf" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("always allows 'other' regardless of requiredDocumentTypes", async () => {
      const { service } = makeService();
      const intake = makeIntake({ requiredDocumentTypes: [] });
      await expect(
        service.requestUploadUrl(intake, { documentType: DocumentType.other, fileName: "x.pdf", contentType: "application/pdf" }),
      ).resolves.toMatchObject({ documentType: DocumentType.other });
    });

    it("builds a key under the clinic/patient/intake prefix and signs an upload URL", async () => {
      const { service, storage } = makeService();
      const intake = makeIntake();
      const result = await service.requestUploadUrl(intake, {
        documentType: DocumentType.insurance_card_front,
        fileName: "card.jpg",
        contentType: "image/jpeg",
      });
      expect(result.key).toMatch(
        /^clinics\/clinic-1\/patients\/patient-1\/intakes\/intake-1\/insurance_card_front\/.+-card\.jpg$/,
      );
      expect(storage.getSignedUploadUrl).toHaveBeenCalledWith(result.key, "image/jpeg");
    });
  });

  describe("confirmUpload", () => {
    it("rejects a key that doesn't belong to this intake (forged key defense)", async () => {
      const { service } = makeService();
      const intake = makeIntake();
      await expect(
        service.confirmUpload(intake, {
          documentType: DocumentType.insurance_card_front,
          key: "clinics/other-clinic/patients/other-patient/intakes/other-intake/insurance_card_front/x-card.jpg",
          fileName: "card.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates the Document row when the key and type are valid", async () => {
      const { service, prisma } = makeService();
      const intake = makeIntake();
      const key = `clinics/clinic-1/patients/patient-1/intakes/intake-1/insurance_card_front/abc-card.jpg`;
      prisma.document.create.mockResolvedValue({ id: "doc-1" });

      await service.confirmUpload(intake, {
        documentType: DocumentType.insurance_card_front,
        key,
        fileName: "card.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1000,
      });

      expect(prisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ clinicId: "clinic-1", intakeId: "intake-1", type: DocumentType.insurance_card_front, s3Key: key }),
      });
    });
  });

  describe("remove", () => {
    it("404s when the document belongs to a different intake", async () => {
      const { service, prisma } = makeService();
      const intake = makeIntake();
      prisma.document.findUnique.mockResolvedValue({ id: "doc-1", intakeId: "some-other-intake", s3Key: "k" });

      await expect(service.remove(intake, "doc-1")).rejects.toThrow(NotFoundException);
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it("404s when the document doesn't exist at all", async () => {
      const { service, prisma } = makeService();
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.remove(makeIntake(), "missing")).rejects.toThrow(NotFoundException);
    });

    it("soft-deletes and best-effort removes the S3 object when it does belong to this intake", async () => {
      const { service, prisma, storage } = makeService();
      const intake = makeIntake();
      prisma.document.findUnique.mockResolvedValue({ id: "doc-1", intakeId: intake.id, s3Key: "clinics/.../file.jpg" });

      await service.remove(intake, "doc-1");

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { deletedAt: expect.any(Date) },
      });
      expect(storage.deleteObject).toHaveBeenCalledWith("clinics/.../file.jpg");
    });
  });

  describe("requiredTypesPresence", () => {
    it("returns an empty set when nothing is required", async () => {
      const { service } = makeService();
      const result = await service.requiredTypesPresence(makeIntake({ requiredDocumentTypes: [] }));
      expect(result.size).toBe(0);
    });

    it("returns exactly the required types that have a live upload", async () => {
      const { service, prisma } = makeService();
      const intake = makeIntake({ requiredDocumentTypes: [DocumentType.insurance_card_front, DocumentType.drivers_license] });
      prisma.document.findMany.mockResolvedValue([{ type: DocumentType.insurance_card_front }]);

      const result = await service.requiredTypesPresence(intake);
      expect(result.has(DocumentType.insurance_card_front)).toBe(true);
      expect(result.has(DocumentType.drivers_license)).toBe(false);
    });
  });
});
