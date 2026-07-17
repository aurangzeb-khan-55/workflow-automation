import { Module } from "@nestjs/common";
import { OCR_PROVIDER } from "./ocr-provider.interface";
import { NoopOcrProvider } from "./noop-ocr.provider";

@Module({
  providers: [NoopOcrProvider, { provide: OCR_PROVIDER, useExisting: NoopOcrProvider }],
  exports: [OCR_PROVIDER],
})
export class OcrModule {}
