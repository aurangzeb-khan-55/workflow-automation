import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

/** Validated shape for Clinic.settings — see ClinicBrandingDto for the same rationale. */
export class ClinicSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  appointmentReminderHoursBefore?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  janeExportEnabled?: boolean;
}
