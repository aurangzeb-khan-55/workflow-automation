import { PDFDocument } from "pdf-lib";
import { Patient } from "@prisma/client";
import { buildMedicalHistoryPdf } from "./build-medical-history-pdf";

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

describe("buildMedicalHistoryPdf", () => {
  it("produces a valid, loadable PDF with the medical history fields", async () => {
    const bytes = await buildMedicalHistoryPdf(makePatient(), {
      conditions: ["Hypertension"],
      allergies: ["Penicillin"],
      medications: ["Lisinopril"],
      surgicalHistory: [],
      familyHistory: [],
      socialHistory: [],
    });

    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
    await expect(PDFDocument.load(bytes)).resolves.toBeDefined();
  });

  it("renders 'None reported' rather than throwing when arrays are empty or missing", async () => {
    const bytes = await buildMedicalHistoryPdf(makePatient(), undefined);
    await expect(PDFDocument.load(bytes)).resolves.toBeDefined();
  });
});
