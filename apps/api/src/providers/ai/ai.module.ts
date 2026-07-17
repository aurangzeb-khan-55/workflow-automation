import { Logger, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AI_SUMMARY_PROVIDER, AiSummaryProvider } from "./ai-summary-provider.interface";
import { DbGeneratedSummaryProvider } from "./db-generated-summary.provider";
import { ClaudeSummaryProvider } from "./claude-summary.provider";

const logger = new Logger("AiModule");

/**
 * Wraps whichever provider is configured so a Claude API failure degrades
 * to the deterministic DB summary instead of blocking staff review.
 */
class FallbackAiSummaryProvider implements AiSummaryProvider {
  constructor(
    private readonly primary: AiSummaryProvider,
    private readonly fallback: DbGeneratedSummaryProvider,
  ) {}

  async generateSummary(input: Parameters<AiSummaryProvider["generateSummary"]>[0]) {
    try {
      return await this.primary.generateSummary(input);
    } catch (err) {
      logger.warn(`AI summary provider failed, falling back to db_generated: ${(err as Error).message}`);
      return this.fallback.generateSummary(input);
    }
  }
}

@Module({
  imports: [ConfigModule],
  providers: [
    DbGeneratedSummaryProvider,
    ClaudeSummaryProvider,
    {
      provide: AI_SUMMARY_PROVIDER,
      useFactory: (
        config: ConfigService,
        dbGenerated: DbGeneratedSummaryProvider,
        claude: ClaudeSummaryProvider,
      ) => {
        const provider = config.get<string>("ai.provider");
        if (provider === "anthropic") {
          return new FallbackAiSummaryProvider(claude, dbGenerated);
        }
        return dbGenerated;
      },
      inject: [ConfigService, DbGeneratedSummaryProvider, ClaudeSummaryProvider],
    },
  ],
  exports: [AI_SUMMARY_PROVIDER],
})
export class AiModule {}
