import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { DocumentType, NewOrExisting } from "@prisma/client";

/**
 * Two actions share this one shape rather than two separate DTOs, since
 * the fields captured are identical either way — only what happens after
 * validation differs (see IntakeService.create()).
 */
export enum CreateIntakeAction {
  save_draft = "save_draft",
  create_and_send = "create_and_send",
}

export class CreateIntakeDto {
  // ── Patient ──────────────────────────────────────────────────────────
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsDate()
  @Type(() => Date)
  dob!: Date;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(30)
  phone!: string;

  @IsEnum(NewOrExisting)
  newOrExisting!: NewOrExisting;

  // ── Appointment ──────────────────────────────────────────────────────
  @IsString()
  @MaxLength(500)
  reasonForVisit!: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsDate()
  @Type(() => Date)
  scheduledAt!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // ── Documents & consents requested for this intake ──────────────────
  // Which upload slots the patient portal should show; defaults to none
  // (self-pay/no extra documents) if omitted. "other" is always available
  // to the patient as a catch-all regardless of this list — see
  // DocumentsService.
  @IsOptional()
  @IsArray()
  @IsEnum(DocumentType, { each: true })
  requiredDocumentTypes?: DocumentType[];

  // Adds telehealth_consent on top of the three always-required consents
  // (consent_to_treat, hipaa_privacy_acknowledgement, financial_responsibility).
  @IsOptional()
  @IsBoolean()
  isTelehealth?: boolean;

  // ── Action ───────────────────────────────────────────────────────────
  @IsEnum(CreateIntakeAction)
  action!: CreateIntakeAction;
}
