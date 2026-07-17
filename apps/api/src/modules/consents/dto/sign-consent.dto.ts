import { IsNotEmpty, IsString } from "class-validator";

/** `signatureData` is a base64-encoded PNG data URI captured from the patient portal's signature pad. */
export class SignConsentDto {
  @IsString()
  @IsNotEmpty()
  signatureData!: string;
}
