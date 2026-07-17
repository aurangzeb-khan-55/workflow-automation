import { Type } from "class-transformer";
import { IsDate, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateAppointmentDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsString()
  @MaxLength(500)
  reasonForVisit!: string;

  @IsDate()
  @Type(() => Date)
  scheduledAt!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
