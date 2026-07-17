// TEMPORARY: Gmail SMTP testing provider. This exists only to send real
// emails locally while MailHippo API access is still being confirmed —
// remove this file, its EmailModule wiring, GMAIL_USER/GMAIL_APP_PASSWORD
// config, and the "gmail" EMAIL_PROVIDER option once MailHippoEmailProvider
// is verified against a live account. Not intended for production use.
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport } from "nodemailer";
import { EmailProvider, SendEmailInput, SendEmailResult } from "./email-provider.interface";

/**
 * Same interface, same PHI/secret discipline as MailHippoEmailProvider —
 * GMAIL_APP_PASSWORD is used only as SMTP auth and never appears in any
 * log line, thrown error, or exception message. Only `messageId` (the
 * nearest Gmail/SMTP equivalent to MailHippo's) and success/failure are
 * ever logged.
 */
@Injectable()
export class GmailSmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(GmailSmtpEmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const user = this.config.get<string>("email.gmailUser");
    const pass = this.config.get<string>("email.gmailAppPassword");
    if (!user || !pass) {
      throw new Error(
        "GMAIL_USER / GMAIL_APP_PASSWORD are not set. Set EMAIL_PROVIDER=stub for local development, " +
          "or provide Gmail SMTP credentials to use this temporary testing provider.",
      );
    }
    const fromEmail = this.config.get<string>("email.fromAddress");

    const transporter = createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    let info: Awaited<ReturnType<typeof transporter.sendMail>>;
    try {
      info = await transporter.sendMail({
        from: fromEmail,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: (input.attachments ?? []).map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.from(attachment.content, "base64"),
          contentType: attachment.contentType,
        })),
      });
    } catch (err) {
      // Never surface the caught error object directly — some SMTP auth
      // failure paths can embed parts of the request; rebuild a plain
      // message instead, same discipline as MailHippoEmailProvider.
      throw new Error(`Gmail SMTP send failed: ${(err as Error).message}`);
    }

    if (info.rejected && info.rejected.length > 0) {
      this.logger.error(`Gmail SMTP rejected recipient(s): count=${info.rejected.length}`);
      throw new Error("Gmail SMTP rejected the recipient");
    }

    this.logger.log(`Gmail SMTP send succeeded: messageId=${info.messageId} status=sent`);

    return { providerMessageId: info.messageId, provider: "gmail" };
  }
}
