import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport } from "nodemailer";
import { promises as dns } from "dns";
import { EmailProvider, SendEmailInput, SendEmailResult } from "./email-provider.interface";

/**
 * Generic SMTP delivery — works against any standard mail server (cPanel
 * hosting, Gmail, etc.), not tied to one provider's hostname. SMTP_PASSWORD
 * is used only as transport auth and never appears in any log line, thrown
 * error, or exception message. Only `messageId` and success/failure are
 * ever logged.
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const host = this.config.get<string>("email.smtpHost");
    const port = this.config.get<number>("email.smtpPort") ?? 465;
    const user = this.config.get<string>("email.smtpUser");
    const pass = this.config.get<string>("email.smtpPassword");
    if (!host || !user || !pass) {
      throw new Error(
        "SMTP_HOST / SMTP_USER / SMTP_PASSWORD are not set. Set EMAIL_PROVIDER=stub for local " +
          "development, or provide SMTP credentials to send via this provider.",
      );
    }
    // Sending "From" a different address than the authenticated account is
    // what most SMTP servers (cPanel-hosted ones especially) reject or
    // flag as spam — default to the authenticated account itself.
    const fromEmail = this.config.get<string>("email.fromAddress") || user;

    // Render's outbound network doesn't route IPv6, but nodemailer's own DNS
    // resolution looks up both A and AAAA records and picks one at random —
    // a `family` option on the transport doesn't stop that, since by the
    // time it would apply, `host` has already been rewritten to whichever
    // resolved IP nodemailer picked. So resolve the A record ourselves and
    // connect to that literal IPv4 address; `tls.servername` keeps SNI and
    // certificate hostname validation pointed at the real hostname.
    let connectHost = host;
    let servername: string | undefined;
    try {
      const addresses = await dns.resolve4(host);
      if (addresses[0]) {
        connectHost = addresses[0];
        servername = host;
      }
    } catch {
      // No A record (e.g. an IPv6-only mail server) — fall back to letting
      // nodemailer resolve the hostname itself.
    }

    const transporter = createTransport({
      host: connectHost,
      port,
      secure: true,
      auth: { user, pass },
      ...(servername ? { tls: { servername } } : {}),
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
      // failure paths can embed parts of the request.
      throw new Error(`SMTP send failed: ${(err as Error).message}`);
    }

    if (info.rejected && info.rejected.length > 0) {
      this.logger.error(`SMTP rejected recipient(s): count=${info.rejected.length}`);
      throw new Error("SMTP server rejected the recipient");
    }

    this.logger.log(`SMTP send succeeded: messageId=${info.messageId} status=sent`);

    return { providerMessageId: info.messageId, provider: "smtp" };
  }
}
