import { IsEnum, IsString, MaxLength } from "class-validator";
import { DocumentType } from "@prisma/client";

export class RequestUploadUrlDto {
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(100)
  contentType!: string;
}
