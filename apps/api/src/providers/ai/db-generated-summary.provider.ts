import { Injectable } from "@nestjs/common";
import {
  AiSummaryProvider,
  IntakeSummaryInput,
  IntakeSummaryResult,
} from "./ai-summary-provider.interface";

/**
 * V1 default (AI_PROVIDER=db_generated): deterministic, template-based
 * summary built straight from structured intake data. No external API
 * calls, no latency/cost, works identically in every environment.
 */
@Injectable()
export class DbGeneratedSummaryProvider implements AiSummaryProvider {
  async generateSummary(input: IntakeSummaryInput): Promise<IntakeSummaryResult> {
    const lines: string[] = [];

    lines.push(`Reason for visit: ${input.reasonForVisit || "Not provided"}`);
    lines.push(`Conditions: ${input.conditions.length ? input.conditions.join(", ") : "None reported"}`);
    lines.push(`Allergies: ${input.allergies.length ? input.allergies.join(", ") : "None reported"}`);
    lines.push(`Medications: ${input.medications.length ? input.medications.join(", ") : "None reported"}`);

    if (input.familyHistory?.length) {
      lines.push(`Family history: ${input.familyHistory.join(", ")}`);
    }
    if (input.socialHistory?.length) {
      lines.push(`Social history: ${input.socialHistory.join(", ")}`);
    }

    lines.push(
      `Documents uploaded: ${input.uploadedDocumentTypes.length ? input.uploadedDocumentTypes.join(", ") : "None"}`,
    );
    lines.push(`Insurance on file: ${input.insuranceProvided ? "Yes" : "No"}`);
    lines.push(
      `Missing items: ${input.missingItems.length ? input.missingItems.join(", ") : "None — intake is complete"}`,
    );

    return { summaryText: lines.join("\n"), source: "db_generated" };
  }
}
