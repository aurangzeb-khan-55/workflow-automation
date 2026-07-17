import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { ConsentType, Intake, IntakeSectionType } from "@prisma/client";
import { Public } from "../auth/decorators/public.decorator";
import { IntakePortalService } from "./intake-portal.service";
import { DocumentsService } from "../documents/documents.service";
import { ConsentsService } from "../consents/consents.service";
import { UpsertIntakeSectionDto } from "./dto/upsert-intake-section.dto";
import { RequestUploadUrlDto } from "../documents/dto/request-upload-url.dto";
import { ConfirmDocumentDto } from "../documents/dto/confirm-document.dto";
import { SignConsentDto } from "../consents/dto/sign-consent.dto";
import { IntakeTokenGuard } from "./guards/intake-token.guard";
import { IntakePortalThrottlerGuard } from "./guards/intake-portal-throttler.guard";
import { RequireEditableIntake } from "./guards/require-editable-intake.decorator";
import { CurrentIntake } from "./decorators/current-intake.decorator";

/**
 * Patient-facing, addressed by secure token — never Clerk-authenticated.
 * IntakePortalThrottlerGuard runs first (bounds abuse before any DB lookup),
 * then IntakeTokenGuard resolves+validates the token and attaches
 * `request.intake` (see both guards' doc-comments for the full design).
 */
@Public()
@UseGuards(IntakePortalThrottlerGuard, IntakeTokenGuard)
@Controller("patient-intake")
export class IntakePortalController {
  constructor(
    private readonly intakePortalService: IntakePortalService,
    private readonly documentsService: DocumentsService,
    private readonly consentsService: ConsentsService,
  ) {}

  @Get(":token")
  getIntake(@CurrentIntake() intake: Intake) {
    return this.intakePortalService.findByToken(intake);
  }

  @RequireEditableIntake()
  @Patch(":token/sections/:sectionType")
  upsertSection(
    @CurrentIntake() intake: Intake,
    @Param("sectionType") sectionType: string,
    @Body() dto: UpsertIntakeSectionDto,
  ) {
    if (!Object.values(IntakeSectionType).includes(sectionType as IntakeSectionType)) {
      throw new BadRequestException(`Unknown section type "${sectionType}"`);
    }
    if (sectionType === IntakeSectionType.consents) {
      throw new BadRequestException("Consents are signed via /consents/:consentType, not this endpoint");
    }
    return this.intakePortalService.upsertSection(intake, sectionType as IntakeSectionType, dto.data);
  }

  @RequireEditableIntake()
  @Post(":token/documents/upload-url")
  requestUploadUrl(@CurrentIntake() intake: Intake, @Body() dto: RequestUploadUrlDto) {
    return this.documentsService.requestUploadUrl(intake, dto);
  }

  @RequireEditableIntake()
  @Post(":token/documents")
  confirmDocument(@CurrentIntake() intake: Intake, @Body() dto: ConfirmDocumentDto) {
    return this.documentsService.confirmUpload(intake, dto);
  }

  @RequireEditableIntake()
  @Delete(":token/documents/:documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDocument(@CurrentIntake() intake: Intake, @Param("documentId") documentId: string) {
    await this.documentsService.remove(intake, documentId);
  }

  @RequireEditableIntake()
  @Put(":token/consents/:consentType")
  signConsent(
    @CurrentIntake() intake: Intake,
    @Param("consentType") consentType: string,
    @Body() dto: SignConsentDto,
    @Req() req: Request,
  ) {
    if (!Object.values(ConsentType).includes(consentType as ConsentType)) {
      throw new BadRequestException(`Unknown consent type "${consentType}"`);
    }
    return this.consentsService.sign(intake, consentType as ConsentType, dto, req.ip ?? "unknown");
  }

  @RequireEditableIntake()
  @Post(":token/submit")
  submit(@CurrentIntake() intake: Intake) {
    return this.intakePortalService.submit(intake);
  }
}
