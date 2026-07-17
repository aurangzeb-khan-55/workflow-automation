import { Appointment, Document, IntakeSection, IntakeSectionType } from "@prisma/client";
import { IntakeSummaryInput } from "../../providers/ai/ai-summary-provider.interface";

/** Builds the AI/db-generated summary provider's input from what this pass actually collects. */
export function buildIntakeSummaryInput(
  appointment: Appointment | null,
  sections: IntakeSection[],
  documents: Document[],
): IntakeSummaryInput {
  const medicalHistory = sections.find((s) => s.sectionType === IntakeSectionType.medical_history)
    ?.data as
    | { conditions?: string[]; allergies?: string[]; medications?: string[]; familyHistory?: string[]; socialHistory?: string[] }
    | undefined;
  const insuranceInfo = sections.find((s) => s.sectionType === IntakeSectionType.insurance_info)?.data as
    | { noInsurance?: boolean }
    | undefined;

  return {
    reasonForVisit: appointment?.reasonForVisit ?? "Not specified",
    conditions: medicalHistory?.conditions ?? [],
    allergies: medicalHistory?.allergies ?? [],
    medications: medicalHistory?.medications ?? [],
    familyHistory: medicalHistory?.familyHistory,
    socialHistory: medicalHistory?.socialHistory,
    uploadedDocumentTypes: documents.map((d) => d.type),
    insuranceProvided: insuranceInfo != null && insuranceInfo.noInsurance !== true,
    missingItems: [],
  };
}
