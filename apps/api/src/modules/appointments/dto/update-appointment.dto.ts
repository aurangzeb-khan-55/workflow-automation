import { Type } from "class-transformer";
import { IsDate, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateAppointmentDto {
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonForVisit?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledAt?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
