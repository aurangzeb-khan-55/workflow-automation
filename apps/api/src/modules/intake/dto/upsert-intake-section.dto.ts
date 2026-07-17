import { IsObject } from "class-validator";

/**
 * Deliberately permissive on save — patients fill sections incrementally
 * and partial/incomplete data is expected mid-form. Required-field
 * validation happens once, at submit time (see section-validation.ts),
 * not on every draft save.
 */
export class UpsertIntakeSectionDto {
  @IsObject()
  data!: Record<string, unknown>;
}
