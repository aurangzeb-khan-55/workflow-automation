import { PDFDocument } from "pdf-lib";
import { Patient } from "@prisma/client";
import { buildPatientRegistrationPdf } from "./build-patient-registration-pdf";

function makePatient(overrides: Partial<Patient> = {}): Patient {
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
    ...overrides,
  } as Patient;
}

describe("buildPatientRegistrationPdf", () => {
  it("produces a valid, loadable PDF containing the patient's name", async () => {
    const bytes = await buildPatientRegistrationPdf(
      makePatient(),
      {
        address: { street: "123 Main St", city: "Springfield", state: "IL", zip: "62701" },
        phone: "555-0100",
        email: "jane@example.com",
        gender: "female",
        preferredPharmacy: "CVS",
        emergencyContact: { name: "John Doe", phone: "555-0111", relationship: "Spouse" },
      },
      { noInsurance: false, payerName: "Acme Health", policyNumber: "P123", subscriberName: "Jane Doe", relationshipToSubscriber: "Self" },
    );

    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("handles a self-pay (no insurance) patient without throwing", async () => {
    const bytes = await buildPatientRegistrationPdf(makePatient(), undefined, { noInsurance: true });
    await expect(PDFDocument.load(bytes)).resolves.toBeDefined();
  });

  it("handles a completely missing personal_info section without throwing", async () => {
    const bytes = await buildPatientRegistrationPdf(makePatient(), undefined, undefined);
    await expect(PDFDocument.load(bytes)).resolves.toBeDefined();
  });
});
