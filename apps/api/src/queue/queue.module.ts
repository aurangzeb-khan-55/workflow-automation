import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";

/**
 * Central BullMQ/Redis wiring. Feature modules register their own queues
 * via `BullModule.registerQueue({ name: '...' })` and import this module —
 * they never construct a Redis connection themselves. Queues planned:
 * `email`, `ai-summary`, `pdf-generation`, `reminders`.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>("redis.host"),
          port: config.get<number>("redis.port"),
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
