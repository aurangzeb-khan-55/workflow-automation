import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

export interface SendIntakeEmailJobData {
  notificationId: string;
}

/**
 * 5 attempts with exponential backoff starting at 2s (2s, 4s, 8s, 16s,
 * 32s) — a reasonable default for a transient-failure-tolerant email
 * send; not tuned against real MailHippo failure-rate data yet.
 */
const JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
};

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue("email") private readonly emailQueue: Queue<SendIntakeEmailJobData>) {}

  async enqueueIntakeInvitation(notificationId: string): Promise<void> {
    await this.emailQueue.add("send-intake-email", { notificationId }, JOB_OPTIONS);
  }
}
