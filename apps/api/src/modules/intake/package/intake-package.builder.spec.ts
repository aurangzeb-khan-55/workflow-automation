import { ConsentType, DocumentType, IntakeSection, IntakeSectionType, Patient } from "@prisma/client";
import { buildIntakePackage } from "./intake-package.builder";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function makePatient(): Patient {
  return {
    id: "patient-1",
    clinicId: "clinic-1",
    firstName: "Jane",
    lastName: "O'Doe",
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

function makeSection(type: IntakeSectionType, data: Record<string, unknown>): IntakeSection {
  return {
    id: `section-${type}`,
    intakeId: "intake-1",
    sectionType: type,
    data,
    completedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as IntakeSection;
}

describe("buildIntakePackage", () => {
  it("produces a valid zip (PK magic bytes) with the expected filename", async () => {
    const result = await buildIntakePackage({
      patient: makePatient(),
      intakeDate: new Date("2026-07-15"),
      sections: [
        makeSection(IntakeSectionType.personal_info, { phone: "555-0100", email: "jane@example.com" }),
        makeSection(IntakeSectionType.medical_history, { conditions: [], allergies: [], medications: [] }),
      ],
      documents: [{ type: DocumentType.insurance_card_front, fileName: "card.jpg", buffer: Buffer.from("fake-jpeg-bytes") }],
      consents: [
        {
          type: ConsentType.consent_to_treat,
          signedAt: new Date(),
          signatureData: `data:image/png;base64,${TINY_PNG_BASE64}`,
          ipAddress: "203.0.113.5",
        },
      ],
    });

    // Sanitizer replaces runs of non-alphanumeric characters with a single underscore.
    expect(result.filename).toBe("O_Doe_Jane_1990-05-15_2026-07-15.zip");
    expect(result.buffer.subarray(0, 2).toString()).toBe("PK");
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("still produces a valid zip when there are no documents or consents at all", async () => {
    const result = await buildIntakePackage({
      patient: makePatient(),
      intakeDate: new Date("2026-07-15"),
      sections: [],
      documents: [],
      consents: [],
    });

    expect(result.buffer.subarray(0, 2).toString()).toBe("PK");
  });
});
