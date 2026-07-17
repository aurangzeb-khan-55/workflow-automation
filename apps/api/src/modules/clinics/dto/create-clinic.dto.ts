import { Type } from "class-transformer";
import { IsOptional, IsString, IsUrl, Matches, MaxLength, ValidateNested } from "class-validator";
import { ClinicBrandingDto } from "./clinic-branding.dto";
import { ClinicSettingsDto } from "./clinic-settings.dto";

export class CreateClinicDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  /** Immutable after creation — used in intake links and branding lookups. */
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: "slug must be lowercase alphanumeric segments separated by hyphens",
  })
  slug!: string;

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
