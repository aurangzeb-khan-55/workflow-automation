import { Patient } from "@prisma/client";
import { drawField, startPdfPage } from "./pdf-helpers";

interface MedicalHistoryData {
  conditions?: string[];
  surgicalHistory?: string[];
  medications?: string[];
  allergies?: string[];
  familyHistory?: string[];
  socialHistory?: string[];
}

function formatList(items: string[] | undefined): string {
  return items && items.length > 0 ? items.join(", ") : "None reported";
}

/** Built from the intake's medical_history section — the "Medical History" document in the staff package. */
export async function buildMedicalHistoryPdf(patient: Patient, medicalHistory: MedicalHistoryData | undefined): Promise<Uint8Array> {
  const cursor = await startPdfPage("Medical History", `${patient.firstName} ${patient.lastName}`);

  drawField(cursor, "Existing Medical Conditions", formatList(medicalHistory?.conditions));
  drawField(cursor, "Surgical History", formatList(medicalHistory?.surgicalHistory));
  drawField(cursor, "Current Medications", formatList(medicalHistory?.medications));
  drawField(cursor, "Allergies", formatList(medicalHistory?.allergies));
  drawField(cursor, "Family Medical History", formatList(medicalHistory?.familyHistory));
  drawField(cursor, "Social History", formatList(medicalHistory?.socialHistory));

  return cursor.doc.save();
}
