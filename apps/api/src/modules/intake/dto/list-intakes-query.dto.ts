import { Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { IntakeStatus } from "@prisma/client";

/** Backs the staff dashboard's filter bar: provider, status, appointment date range, patient name. */
export class ListIntakesQueryDto {
  @IsOptional()
  @IsEnum(IntakeStatus)
  status?: IntakeStatus;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fromDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  toDate?: Date;

  /** Matches against the linked patient's first or last name, case-insensitive substring. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  patientName?: string;
}
