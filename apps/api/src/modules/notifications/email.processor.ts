import { Inject, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { IntakeStatus, NotificationStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EMAIL_PROVIDER, EmailProvider } from "../../providers/email/email-provider.interface";
import { canTransition } from "../intake/intake-status.state-machine";
import { buildIntakeInvitationEmail } from "./intake-email-template";
import { SendIntakeEmailJobData } from "./email-queue.service";

/**
 * Runs as a background BullMQ worker, entirely outside any HTTP request —
 * there's no authenticated request.user/clinicId to scope through
 * TenantPrismaService here, so this uses the raw PrismaService directly.
 * Safe specifically because every lookup is by a single, already-known id
 * (the notificationId the job was queued with, and ids reached from it) —
 * never a list/findMany across clinics.
 */
@Processor("email")
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {
    super();
  }

  async process(job: Job<SendIntakeEmailJobData>): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id: job.data.notificationId } });
    if (!notification || !notification.intakeId) {
      this.logger.error(`Notification ${job.data.notificationId} not found or missing intakeId; dropping job`);
      return;
    }

    const intake = await this.prisma.intake.findUnique({ where: { id: notification.intakeId } });
    if (!intake || !intake.secureToken) {
      this.logger.error(`Intake for notification ${notification.id} not found or missing secureToken; dropping job`);
      return;
    }

    const [patient, clinic] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: intake.patientId } }),
      this.prisma.clinic.findUnique({ where: { id: intake.clinicId } }),
    ]);
    if (!patient) {
      this.logger.error(`Patient for intake ${intake.id} not found; dropping job`);
      return;
    }

    const intakeLinkBase = this.config.get<string>("intakeLinkBaseUrl");
    const { subject, html } = buildIntakeInvitationEmail({
      patientFirstName: patient.firstName,
      intakeLink: `${intakeLinkBase}/${intake.secureToken}`,
      clinicName: clinic?.name ?? "our clinic",
    });

    // Errors thrown here propagate to BullMQ, which retries per the job's
    // configured backoff (see EmailQueueService) — no catch/retry logic
    // needed in this method itself.
    const result = await this.emailProvider.send({ to: patient.email, subject, html });

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { status: NotificationStatus.sent, sentAt: new Date(), provider: result.provider },
    });

    // messageId/status/intakeId only — never the recipient, subject, or body.
    this.logger.log(`Intake email sent: messageId=${result.providerMessageId} status=sent intakeId=${intake.id}`);
  }

  /**
   * Fires on every failed attempt, not just the last — only act once
   * BullMQ's retry policy is actually exhausted (attemptsMade has reached
   * the job's configured `attempts`), otherwise a single transient
   * failure would incorrectly flip the intake to email_failed while a
   * retry is still pending.
   */
  @OnWorkerEvent("failed")
  async onFailed(job: Job<SendIntakeEmailJobData> | undefined): Promise<void> {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    this.logger.error(
      `Intake email permanently failed after ${job.attemptsMade} attempts: notificationId=${job.data.notificationId}`,
    );

    const notification = await this.prisma.notification.findUnique({ where: { id: job.data.notificationId } });
    if (!notification || !notification.intakeId) return;

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { status: NotificationStatus.failed },
    });

    const intake = await this.prisma.intake.findUnique({ where: { id: notification.intakeId } });
    // Skip if the intake has already moved on (e.g. a manual resend
    // already succeeded before this exhausted-retry event was processed)
    // — never force it backwards.
    if (!intake || !canTransition(intake.status, IntakeStatus.email_failed)) return;

    await this.prisma.intake.update({
      where: { id: intake.id },
      data: { status: IntakeStatus.email_failed },
    });
  }
}
