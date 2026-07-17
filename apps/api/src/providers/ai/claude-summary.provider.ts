import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiSummaryProvider,
  IntakeSummaryInput,
  IntakeSummaryResult,
} from "./ai-summary-provider.interface";

/**
 * Optional upgrade path (AI_PROVIDER=anthropic). Wraps the Claude API to
 * turn structured intake data into prose for provider review. Falls back
 * is the caller's responsibility (AiModule swaps back to DbGeneratedSummary
 * on error) so a Claude outage never blocks the intake workflow.
 *
 * Swapping in OpenAI/Gemini later means adding a sibling class here — no
 * changes to IntakeModule or the AI_SUMMARY_PROVIDER consumers.
 */
@Injectable()
export class ClaudeSummaryProvider implements AiSummaryProvider {
  private readonly logger = new Logger(ClaudeSummaryProvider.name);

  constructor(private readonly config: ConfigService) {}

  async generateSummary(input: IntakeSummaryInput): Promise<IntakeSummaryResult> {
    const apiKey = this.config.get<string>("ai.anthropicApiKey");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set. Set AI_PROVIDER=db_generated for local development.");
    }

    // TODO: call the Claude Messages API with `input` rendered into a
    // clinical-summary prompt once a key is provisioned.
    this.logger.warn("ClaudeSummaryProvider.generateSummary() is not yet implemented against the live API");
    throw new Error("Claude AI summary integration not yet implemented");
  }
}
