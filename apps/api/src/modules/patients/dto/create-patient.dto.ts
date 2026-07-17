import { Type } from "class-transformer";
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { NewOrExisting } from "@prisma/client";
import { PatientAddressDto } from "./patient-address.dto";
import { EmergencyContactDto } from "./emergency-contact.dto";

export class CreatePatientDto {
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsDate()
  @Type(() => Date)
  dob!: Date;

  @IsString()
  @MaxLength(30)
  phone!: string;

  @IsEmail()
  email!: string;

  @IsEnum(NewOrExisting)
  newOrExisting!: NewOrExisting;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  preferredPharmacy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  gender?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PatientAddressDto)
  address?: PatientAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContact?: EmergencyContactDto;
}
