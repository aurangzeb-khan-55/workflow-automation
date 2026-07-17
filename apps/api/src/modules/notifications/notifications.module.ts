import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QueueModule } from "../../queue/queue.module";
import { EmailModule } from "../../providers/email/email.module";
import { EmailQueueService } from "./email-queue.service";
import { EmailProcessor } from "./email.processor";

@Module({
  imports: [QueueModule, BullModule.registerQueue({ name: "email" }), EmailModule],
  providers: [EmailQueueService, EmailProcessor],
  exports: [EmailQueueService],
})
export class NotificationsModule {}
