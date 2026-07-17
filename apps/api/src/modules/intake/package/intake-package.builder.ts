import archiver from "archiver";
import { DocumentType, IntakeSection, IntakeSectionType, Patient } from "@prisma/client";
import { documentTypeLabel } from "../document-consent-labels";
import { buildPatientRegistrationPdf } from "./build-patient-registration-pdf";
import { buildMedicalHistoryPdf } from "./build-medical-history-pdf";
import { buildConsentPdf, ConsentPdfInput } from "./build-consent-pdf";

export interface PackageDocumentInput {
  type: DocumentType;
  fileName: string;
  buffer: Buffer;
}

export interface BuildIntakePackageInput {
  patient: Patient;
  /** The package's "IntakeDate" — submittedAt, since this workflow only ever applies to already-submitted intakes. */
  intakeDate: Date;
  sections: IntakeSection[];
  documents: PackageDocumentInput[];
  consents: ConsentPdfInput[];
}

/**
 * Assembles the full staff document package as a single zip: generated PDFs
 * (Patient Registration, Medical History, one per signed consent — this
 * naturally includes the HIPAA acknowledgement whenever it was required and
 * signed) plus the patient's original uploaded files, unmodified, under
 * Uploads/. See IntakeService.generatePackage() for why this is a zip
 * rather than one merged PDF.
 */
export async function buildIntakePackage(
  input: BuildIntakePackageInput,
): Promise<{ filename: string; buffer: Buffer }> {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on("data", (chunk) => chunks.push(chunk));
  const finished = new Promise<void>((resolve, reject) => {
    archive.on("end", () => resolve());
    archive.on("error", reject);
  });

  const personalInfo = sectionData(input.sections, IntakeSectionType.personal_info);
  const medicalHistory = sectionData(input.sections, IntakeSectionType.medical_history);
  const insuranceInfo = sectionData(input.sections, IntakeSectionType.insurance_info);

  const registrationPdf = await buildPatientRegistrationPdf(input.patient, personalInfo, insuranceInfo);
  archive.append(Buffer.from(registrationPdf), { name: "Patient_Registration.pdf" });

  const medicalHistoryPdf = await buildMedicalHistoryPdf(input.patient, medicalHistory);
  archive.append(Buffer.from(medicalHistoryPdf), { name: "Medical_History.pdf" });

  for (const consent of input.consents) {
    const consentPdf = await buildConsentPdf(input.patient, consent);
    archive.append(Buffer.from(consentPdf), { name: `Consent_${pascalCase(consent.type)}.pdf` });
  }

  for (const document of input.documents) {
    const label = sanitizeFilePart(documentTypeLabel(document.type));
    archive.append(document.buffer, { name: `Uploads/${label}_${sanitizeFilePart(document.fileName)}` });
  }

  archive.finalize();
  await finished;

  return { filename: buildPackageFilename(input.patient, input.intakeDate), buffer: Buffer.concat(chunks) };
}

function sectionData(sections: IntakeSection[], type: IntakeSectionType): Record<string, unknown> | undefined {
  return sections.find((s) => s.sectionType === type)?.data as Record<string, unknown> | undefined;
}

function pascalCase(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9.]+/g, "_").replace(/^_+|_+$/g, "");
}

function buildPackageFilename(patient: Patient, intakeDate: Date): string {
  const lastName = sanitizeFilePart(patient.lastName);
  const firstName = sanitizeFilePart(patient.firstName);
  const dob = new Date(patient.dob).toISOString().slice(0, 10);
  const date = new Date(intakeDate).toISOString().slice(0, 10);
  return `${lastName}_${firstName}_${dob}_${date}.zip`;
}
