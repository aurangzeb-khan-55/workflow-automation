import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Query logging is intentionally NOT wired to `log: ['query']` here — raw
 * queries can contain PHI in parameter values, and Prisma's query log
 * includes bound params. Enable only with a redacting log target if ever
 * needed for local debugging.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
      ],
    });
  }

  async onModuleInit() {
    (this as any).$on("error", (e: unknown) => this.logger.error(e));
    (this as any).$on("warn", (e: unknown) => this.logger.warn(e));
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
