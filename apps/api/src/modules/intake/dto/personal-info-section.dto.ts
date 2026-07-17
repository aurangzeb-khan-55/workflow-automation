import { Type } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString, ValidateNested } from "class-validator";

class PersonalInfoAddressDto {
  @IsString()
  @IsNotEmpty()
  street!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  zip!: string;
}

/** Required-field shape for the `personal_info` section, checked only at submit time. */
export class PersonalInfoSectionDto {
  @ValidateNested()
  @Type(() => PersonalInfoAddressDto)
  address!: PersonalInfoAddressDto;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsEmail()
  email!: string;
}
