export interface OcrResult {
  extractedText: string;
  confidence?: number;
}

/**
 * V1 does not run OCR — uploaded documents (insurance cards, IDs, referrals)
 * are stored as-is via StorageModule and reviewed visually by staff. This
 * interface exists so a future OCR pass (AWS Textract, Google Vision,
 * Azure Document Intelligence) can be dropped in per document type without
 * touching DocumentsModule's upload/list/download logic.
 */
export const OCR_PROVIDER = Symbol("OCR_PROVIDER");

export interface OcrProvider {
  extractText(fileBuffer: Buffer, mimeType: string): Promise<OcrResult>;
}
