import { IsHexColor, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Validated shape for Clinic.brandingConfig. The column stays a flexible
 * JSON blob in the schema (so new branding knobs don't need a migration),
 * but the API surface only ever accepts these known fields — never an
 * arbitrary object.
 */
export class ClinicBrandingDto {
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;
}
