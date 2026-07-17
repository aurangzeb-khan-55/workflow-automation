import { plainToInstance } from "class-transformer";
import { ValidationError, validateSync } from "class-validator";
import { IntakeSectionType } from "@prisma/client";
import { PersonalInfoSectionDto } from "./dto/personal-info-section.dto";
import { MedicalHistorySectionDto } from "./dto/medical-history-section.dto";
import { InsuranceInfoSectionDto } from "./dto/insurance-info-section.dto";

/** Section types this pass actually collects data for and can validate on submit. */
export const SUBMITTABLE_SECTION_TYPES: IntakeSectionType[] = [
  IntakeSectionType.personal_info,
  IntakeSectionType.medical_history,
  IntakeSectionType.insurance_info,
];

const SECTION_DTOS: Partial<Record<IntakeSectionType, new () => object>> = {
  [IntakeSectionType.personal_info]: PersonalInfoSectionDto,
  [IntakeSectionType.medical_history]: MedicalHistorySectionDto,
  [IntakeSectionType.insurance_info]: InsuranceInfoSectionDto,
};

/**
 * Validates one section's stored `data` against its required-field DTO.
 * Returns a list of human-readable problems — empty means valid. Missing
 * data entirely (patient never saved this section) is reported the same
 * way as incomplete data, not thrown as an error, so submit() can collect
 * every problem across all required sections in one pass.
 */
export function validateSectionData(sectionType: IntakeSectionType, data: unknown): string[] {
  const dtoClass = SECTION_DTOS[sectionType];
  if (!dtoClass) return [];

  if (data == null || typeof data !== "object") {
    return [`${sectionType} section is required`];
  }

  const instance = plainToInstance(dtoClass, data);
  const errors = validateSync(instance, { skipMissingProperties: false, whitelist: true });

  return errors.flatMap((error) => flattenValidationError(error, sectionType));
}

/** class-validator nests errors for `@ValidateNested()` properties under `.children`, not `.constraints`. */
function flattenValidationError(error: ValidationError, pathPrefix: string): string[] {
  const path = `${pathPrefix}.${error.property}`;
  const ownMessages = Object.values(error.constraints ?? {}).map((message) => `${path}: ${message}`);
  const childMessages = (error.children ?? []).flatMap((child) => flattenValidationError(child, path));
  return [...ownMessages, ...childMessages];
}
