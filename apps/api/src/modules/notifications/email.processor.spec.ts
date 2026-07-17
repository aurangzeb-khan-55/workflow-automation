import { ConfigService } from "@nestjs/config";
import { IntakeStatus, NotificationStatus } from "@prisma/client";
import { EmailProcessor } from "./email.processor";
import { EmailProvider } from "../../providers/email/email-provider.interface";
import { PrismaService } from "../../prisma/prisma.service";

function makePrisma() {
  return {
    notification: { findUnique: jest.fn(), update: jest.fn() },
    intake: { findUnique: jest.fn(), update: jest.fn() },
    patient: { findUnique: jest.fn() },
    clinic: { findUnique: jest.fn() },
  } as unknown as PrismaService;
}

function makeConfig() {
  return { get: () => "http://localhost:3000/intake" } as unknown as ConfigService;
}

describe("EmailProcessor", () => {
  describe("process()", () => {
    it("sends the invitation email and marks the notification sent", async () => {
      const prisma = makePrisma();
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue({ id: "n1", intakeId: "i1" });
      (prisma.intake.findUnique as jest.Mock).mockResolvedValue({
        id: "i1",
        patientId: "p1",
        clinicId: "c1",
        secureToken: "tok123",
      });
      (prisma.patient.findUnique as jest.Mock).mockResolvedValue({
        id: "p1",
        firstName: "Jane",
        email: "jane@example.com",
      });
      (prisma.clinic.findUnique as jest.Mock).mockResolvedValue({ id: "c1", name: "Atria Wellness" });

      const emailProvider: EmailProvider = {
        send: jest.fn().mockResolvedValue({ providerMessageId: "17703", provider: "mailhippo" }),
      };
      const processor = new EmailProcessor(prisma, makeConfig(), emailProvider);

      await processor.process({ data: { notificationId: "n1" } } as any);

      expect(emailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "jane@example.com",
          subject: expect.any(String),
          html: expect.stringContaining("tok123"),
        }),
      );
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: { status: NotificationStatus.sent, sentAt: expect.any(Date), provider: "mailhippo" },
      });
    });

    it("propagates the error when the email provider fails, so BullMQ's retry policy takes over", async () => {
      const prisma = makePrisma();
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue({ id: "n1", intakeId: "i1" });
      (prisma.intake.findUnique as jest.Mock).mockResolvedValue({
        id: "i1",
        patientId: "p1",
        clinicId: "c1",
        secureToken: "tok123",
      });
      (prisma.patient.findUnique as jest.Mock).mockResolvedValue({
        id: "p1",
        firstName: "Jane",
        email: "jane@example.com",
      });
      (prisma.clinic.findUnique as jest.Mock).mockResolvedValue({ id: "c1", name: "Atria Wellness" });

      const emailProvider: EmailProvider = {
        send: jest.fn().mockRejectedValue(new Error("MailHippo did not confirm delivery (status: Rejected)")),
      };
      const processor = new EmailProcessor(prisma, makeConfig(), emailProvider);

      await expect(processor.process({ data: { notificationId: "n1" } } as any)).rejects.toThrow(
        /did not confirm delivery/,
      );
      // A single failed attempt must not silently mark the notification sent.
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  describe("onFailed()", () => {
    it("does nothing while retry attempts remain", async () => {
      const prisma = makePrisma();
      const processor = new EmailProcessor(prisma, makeConfig(), { send: jest.fn() });

      await processor.onFailed({ data: { notificationId: "n1" }, attemptsMade: 2, opts: { attempts: 5 } } as any);

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(prisma.intake.update).not.toHaveBeenCalled();
    });

    it("THE STANDING REQUIREMENT: once retries are exhausted, marks the notification failed and moves the intake to email_failed rather than leaving it silently in intake_email_sent", async () => {
      const prisma = makePrisma();
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue({ id: "n1", intakeId: "i1" });
      (prisma.intake.findUnique as jest.Mock).mockResolvedValue({ id: "i1", status: IntakeStatus.intake_email_sent });
      const processor = new EmailProcessor(prisma, makeConfig(), { send: jest.fn() });

      await processor.onFailed({ data: { notificationId: "n1" }, attemptsMade: 5, opts: { attempts: 5 } } as any);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: { status: NotificationStatus.failed },
      });
      expect(prisma.intake.update).toHaveBeenCalledWith({
        where: { id: "i1" },
        data: { status: IntakeStatus.email_failed },
      });
    });

    it("does not force the intake status if it has already moved on (e.g. a resend already succeeded)", async () => {
      const prisma = makePrisma();
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue({ id: "n1", intakeId: "i1" });
      (prisma.intake.findUnique as jest.Mock).mockResolvedValue({
        id: "i1",
        status: IntakeStatus.patient_started_intake,
      });
      const processor = new EmailProcessor(prisma, makeConfig(), { send: jest.fn() });

      await processor.onFailed({ data: { notificationId: "n1" }, attemptsMade: 5, opts: { attempts: 5 } } as any);

      expect(prisma.notification.update).toHaveBeenCalled();
      expect(prisma.intake.update).not.toHaveBeenCalled();
    });

    it("does nothing when job is undefined", async () => {
      const prisma = makePrisma();
      const processor = new EmailProcessor(prisma, makeConfig(), { send: jest.fn() });

      await processor.onFailed(undefined);

      expect(prisma.notification.findUnique).not.toHaveBeenCalled();
    });
  });
});
