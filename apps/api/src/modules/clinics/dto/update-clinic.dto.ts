import { Type } from "class-transformer";
import { IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from "class-validator";
import { ClinicBrandingDto } from "./clinic-branding.dto";
import { ClinicSettingsDto } from "./clinic-settings.dto";

/**
 * Used for both `PATCH /clinics/:id` (Super Admin, any clinic) and
 * `PATCH /clinics/me` (Clinic Administrator, own clinic only) — the two
 * routes differ in who the caller may target, not in what fields they may
 * change. `slug` is deliberately not editable here (see CreateClinicDto).
 */
export class UpdateClinicDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClinicBrandingDto)
  brandingConfig?: ClinicBrandingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClinicSettingsDto)
  settings?: ClinicSettingsDto;
}
