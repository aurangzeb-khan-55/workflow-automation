import { BadRequestException, Injectable } from "@nestjs/common";
import { ConsentType, Intake } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SignConsentDto } from "./dto/sign-consent.dto";

/**
 * Patient-facing e-signature capture, addressed only through an already
 * token-resolved `Intake` — same scoping invariant as DocumentsService.
 * `Consent` rows never carry the signature image or IP address back out to
 * the client at large (see listForIntake) — only type + signedAt, which is
 * all the portal UI needs to render "already signed".
 */
@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  async sign(intake: Intake, consentType: ConsentType, dto: SignConsentDto, ipAddress: string) {
    this.assertRequested(intake, consentType);

    return this.prisma.consent.upsert({
      where: { intakeId_type: { intakeId: intake.id, type: consentType } },
      create: {
        intakeId: intake.id,
        type: consentType,
        signatureData: dto.signatureData,
        ipAddress,
        signedAt: new Date(),
      },
      update: {
        signatureData: dto.signatureData,
        ipAddress,
        signedAt: new Date(),
      },
    });
  }

  async listForIntake(intakeId: string) {
    const rows = await this.prisma.consent.findMany({ where: { intakeId } });
    return rows.map((c) => ({ type: c.type, signedAt: c.signedAt }));
  }

  /** For submit() validation: which of the intake's required consent types have been signed. */
  async requiredTypesPresence(intake: Intake): Promise<Set<ConsentType>> {
    if (intake.requiredConsentTypes.length === 0) return new Set();
    const rows = await this.prisma.consent.findMany({
      where: { intakeId: intake.id, type: { in: intake.requiredConsentTypes } },
      select: { type: true },
    });
    return new Set(rows.map((r) => r.type));
  }

  private assertRequested(intake: Intake, type: ConsentType) {
    if (!intake.requiredConsentTypes.includes(type)) {
      throw new BadRequestException(`Consent type "${type}" was not requested for this intake`);
    }
  }
}
