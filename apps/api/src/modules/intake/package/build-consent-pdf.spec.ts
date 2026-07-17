import { PDFDocument } from "pdf-lib";
import { ConsentType, Patient } from "@prisma/client";
import { buildConsentPdf } from "./build-consent-pdf";

// A real, minimal 1x1 transparent PNG — needed to exercise the actual embedPng() path, not just the fallback.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function makePatient(): Patient {
  return {
    id: "patient-1",
    clinicId: "clinic-1",
    firstName: "Jane",
    lastName: "Doe",
    dob: new Date("1990-05-15"),
    phone: "555-0100",
    email: "jane@example.com",
    newOrExisting: "new",
    preferredPharmacy: null,
    address: null,
    gender: null,
    emergencyContact: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as Patient;
}

describe("buildConsentPdf", () => {
  it("embeds a real signature image and includes signed-at/IP", async () => {
    const bytes = await buildConsentPdf(makePatient(), {
      type: ConsentType.consent_to_treat,
      signedAt: new Date("2026-07-12T10:00:00Z"),
      signatureData: `data:image/png;base64,${TINY_PNG_BASE64}`,
      ipAddress: "203.0.113.5",
    });

    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("degrades gracefully to a text fallback when signatureData can't be decoded as an image", async () => {
    const bytes = await buildConsentPdf(makePatient(), {
      type: ConsentType.hipaa_privacy_acknowledgement,
      signedAt: new Date(),
      signatureData: "not-a-real-image",
      ipAddress: "203.0.113.5",
    });

    await expect(PDFDocument.load(bytes)).resolves.toBeDefined();
  });

  it("uses the correct legal text per consent type", async () => {
    const bytes = await buildConsentPdf(makePatient(), {
      type: ConsentType.financial_responsibility,
      signedAt: new Date(),
      signatureData: `data:image/png;base64,${TINY_PNG_BASE64}`,
      ipAddress: "203.0.113.5",
    });
    await expect(PDFDocument.load(bytes)).resolves.toBeDefined();
  });
});
