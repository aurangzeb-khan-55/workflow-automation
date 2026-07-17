import { randomUUID } from "crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentType, Intake } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { STORAGE_PROVIDER, StorageProvider } from "../../providers/storage/storage-provider.interface";
import { RequestUploadUrlDto } from "./dto/request-upload-url.dto";
import { ConfirmDocumentDto } from "./dto/confirm-document.dto";

/**
 * Patient-facing document uploads, addressed only through an already
 * token-resolved `Intake` (see IntakeTokenGuard) — every query here is
 * scoped to that one intake's id, never a client-supplied id, matching the
 * same invariant IntakePortalService relies on for sections.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /** Requests a direct-to-S3 signed PUT URL; the Document row is only created once confirmUpload() reports success. */
  async requestUploadUrl(intake: Intake, dto: RequestUploadUrlDto) {
    this.assertRequestedType(intake, dto.documentType);
    const key = this.buildKey(intake, dto.documentType, dto.fileName);
    const uploadUrl = await this.storage.getSignedUploadUrl(key, dto.contentType);
    return { key, uploadUrl, documentType: dto.documentType };
  }

  /** Records the Document row after the browser has PUT the bytes to the signed URL. */
  async confirmUpload(intake: Intake, dto: ConfirmDocumentDto) {
    this.assertRequestedType(intake, dto.documentType);
    if (!dto.key.startsWith(this.keyPrefix(intake))) {
      throw new BadRequestException("Upload key does not belong to this intake");
    }

    return this.prisma.document.create({
      data: {
        clinicId: intake.clinicId,
        intakeId: intake.id,
        type: dto.documentType,
        s3Key: dto.key,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
      },
    });
  }

  async listForIntake(intakeId: string) {
    const documents = await this.prisma.document.findMany({
      where: { intakeId, deletedAt: null },
      orderBy: { uploadedAt: "desc" },
    });
    return Promise.all(
      documents.map(async (d) => ({
        id: d.id,
        type: d.type,
        fileName: d.fileName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        uploadedAt: d.uploadedAt,
        downloadUrl: await this.storage.getSignedDownloadUrl(d.s3Key),
      })),
    );
  }

  /** `documentId` is never trusted alone — it must resolve to a row belonging to this exact intake. */
  async remove(intake: Intake, documentId: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.intakeId !== intake.id) {
      throw new NotFoundException("Document not found");
    }

    await this.prisma.document.update({ where: { id: documentId }, data: { deletedAt: new Date() } });
    await this.storage.deleteObject(document.s3Key).catch(() => undefined);
  }

  /** For submit() validation: which of the intake's required document types have at least one live upload. */
  async requiredTypesPresence(intake: Intake): Promise<Set<DocumentType>> {
    if (intake.requiredDocumentTypes.length === 0) return new Set();
    const rows = await this.prisma.document.findMany({
      where: { intakeId: intake.id, deletedAt: null, type: { in: intake.requiredDocumentTypes } },
      select: { type: true },
    });
    return new Set(rows.map((r) => r.type));
  }

  /** "other" is always available as a catch-all regardless of what staff explicitly requested. */
  private assertRequestedType(intake: Intake, type: DocumentType) {
    if (type !== DocumentType.other && !intake.requiredDocumentTypes.includes(type)) {
      throw new BadRequestException(`Document type "${type}" was not requested for this intake`);
    }
  }

  private keyPrefix(intake: Intake): string {
    return `clinics/${intake.clinicId}/patients/${intake.patientId}/intakes/${intake.id}/`;
  }

  private buildKey(intake: Intake, type: DocumentType, fileName: string): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-100);
    return `${this.keyPrefix(intake)}${type}/${randomUUID()}-${safeName}`;
  }
}
