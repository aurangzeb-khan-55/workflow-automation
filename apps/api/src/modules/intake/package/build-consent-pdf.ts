import { ConsentType, Patient } from "@prisma/client";
import { CONSENT_TYPE_TEXT, consentTypeLabel } from "../document-consent-labels";
import { drawField, drawParagraph, MARGIN, startPdfPage } from "./pdf-helpers";

export interface ConsentPdfInput {
  type: ConsentType;
  signedAt: Date;
  signatureData: string;
  ipAddress: string;
}

/** One PDF per signed consent — includes the exact legal text the patient agreed to, plus their captured signature, timestamp, and IP. */
export async function buildConsentPdf(patient: Patient, consent: ConsentPdfInput): Promise<Uint8Array> {
  const label = consentTypeLabel(consent.type);
  const cursor = await startPdfPage(label, `${patient.firstName} ${patient.lastName}`);

  drawParagraph(cursor, CONSENT_TYPE_TEXT[consent.type]);
  cursor.y -= 8;

  drawField(cursor, "Signed At", consent.signedAt.toISOString().replace("T", " ").slice(0, 19) + " UTC");
  drawField(cursor, "IP Address", consent.ipAddress);

  cursor.page.drawText("Signature:", { x: MARGIN, y: cursor.y, size: 10, font: cursor.boldFont });
  cursor.y -= 16;

  try {
    const pngBytes = decodeDataUri(consent.signatureData);
    const image = await cursor.doc.embedPng(pngBytes);
    const maxWidth = 220;
    const scale = Math.min(1, maxWidth / image.width);
    const height = image.height * scale;
    cursor.page.drawImage(image, { x: MARGIN, y: cursor.y - height, width: image.width * scale, height });
    cursor.y -= height + 10;
  } catch {
    // Malformed/unrecognized signature data (shouldn't happen for anything
    // captured through the real signature pad) — degrade to a text note
    // rather than fail the whole package.
    cursor.page.drawText("[signature on file — could not render image]", {
      x: MARGIN,
      y: cursor.y,
      size: 9,
      font: cursor.font,
    });
    cursor.y -= 16;
  }

  return cursor.doc.save();
}

function decodeDataUri(dataUri: string): Uint8Array {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUri);
  const base64 = match ? match[1] : dataUri;
  return Uint8Array.from(Buffer.from(base64, "base64"));
}
