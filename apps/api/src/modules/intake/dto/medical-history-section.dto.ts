import { IsArray } from "class-validator";

/**
 * Required-field shape for the `medical_history` section, checked only at
 * submit time. Arrays must be *present* (an empty array is a valid "none
 * reported" answer) — mirrors IntakeSummaryInput's shape in the AI
 * provider so the two line up when building the summary after submission.
 */
export class MedicalHistorySectionDto {
  @IsArray()
  conditions!: unknown[];

  @IsArray()
  allergies!: unknown[];

  @IsArray()
  medications!: unknown[];
}
