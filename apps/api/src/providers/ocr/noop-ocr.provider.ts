import { Injectable } from "@nestjs/common";
import { OcrProvider, OcrResult } from "./ocr-provider.interface";

/** V1 implementation: does nothing. Swap for a real OCR provider via DI when needed. */
@Injectable()
export class NoopOcrProvider implements OcrProvider {
  async extractText(): Promise<OcrResult> {
    return { extractedText: "" };
  }
}
