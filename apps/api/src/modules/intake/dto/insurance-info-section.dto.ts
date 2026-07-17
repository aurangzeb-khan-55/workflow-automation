import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateIf } from "class-validator";

/**
 * Required-field shape for the `insurance_info` section, checked only at
 * submit time. `noInsurance` is the self-pay escape hatch — when true, the
 * rest of the fields aren't required (there's nothing to declare).
 */
export class InsuranceInfoSectionDto {
  @IsBoolean()
  noInsurance!: boolean;

  @ValidateIf((o) => !o.noInsurance)
  @IsString()
  @IsNotEmpty()
  payerName?: string;

  @ValidateIf((o) => !o.noInsurance)
  @IsString()
  @IsNotEmpty()
  policyNumber?: string;

  @IsOptional()
  @IsString()
  groupNumber?: string;

  @ValidateIf((o) => !o.noInsurance)
  @IsString()
  @IsNotEmpty()
  subscriberName?: string;

  @ValidateIf((o) => !o.noInsurance)
  @IsString()
  @IsNotEmpty()
  relationshipToSubscriber?: string;
}
