import { IsOptional, IsString, MaxLength } from "class-validator";

export class EmergencyContactDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(50)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationship?: string;
}
