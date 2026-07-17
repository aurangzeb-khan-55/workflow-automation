import { IsOptional, IsString, MaxLength } from "class-validator";

export class PatientAddressDto {
  @IsString()
  @MaxLength(200)
  street!: string;

  @IsString()
  @MaxLength(100)
  city!: string;

  @IsString()
  @MaxLength(50)
  state!: string;

  @IsString()
  @MaxLength(20)
  zip!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;
}
