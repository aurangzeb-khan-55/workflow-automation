export interface IntakeSummaryInput {
  reasonForVisit: string;
  conditions: string[];
  allergies: string[];
  medications: string[];
  familyHistory?: string[];
  socialHistory?: string[];
  uploadedDocumentTypes: string[];
  insuranceProvided: boolean;
  missingItems: string[];
}

export interface IntakeSummaryResult {
  summaryText: string;
  source: "db_generated" | "ai_generated";
}

/**
 * The core intake workflow (create -> notify -> submit -> review -> package)
 * must succeed with zero AI involvement — this interface exists so the AI
 * module can be entirely absent/disabled without touching IntakeModule.
 */
export const AI_SUMMARY_PROVIDER = Symbol("AI_SUMMARY_PROVIDER");

export interface AiSummaryProvider {
  generateSummary(input: IntakeSummaryInput): Promise<IntakeSummaryResult>;
}
