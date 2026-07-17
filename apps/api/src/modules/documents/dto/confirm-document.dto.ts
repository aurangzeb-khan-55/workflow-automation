import { IsEnum, IsInt, IsString, Max, MaxLength, Min } from "class-validator";
import { DocumentType } from "@prisma/client";

export class ConfirmDocumentDto {
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsString()
  key!: string;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(100)
  mimeType!: string;

  // 25MB cap — comfortably covers a scanned document or phone-camera photo.
  @IsInt()
  @Min(1)
  @Max(25_000_000)
  sizeBytes!: number;
}
