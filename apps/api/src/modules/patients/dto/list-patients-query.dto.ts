import { IsOptional, IsString, MaxLength } from "class-validator";

export class ListPatientsQueryDto {
  /** Matches against first or last name, case-insensitive substring. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
