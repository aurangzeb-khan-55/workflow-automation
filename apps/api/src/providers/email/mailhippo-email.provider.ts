import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailAttachment, EmailProvider, SendEmailInput, SendEmailResult } from "./email-provider.interface";

const MAILHIPPO_SEND_URL = "https://api.mailhippo.com/SendMessage";

interface MailHippoResponse {
  messageId: number;
  status: string;
  displayName?: string;
}

/**
 * Real MailHippo integration. The API key is used only as the
 * X-Auth-Secret request header value — it is never written to any log
 * line, thrown error, or exception message anywhere in this class. Only
 * `messageId` and `status` (both non-PHI) are ever logged.
 */
@Injectable()
export class MailHippoEmailProvider implements EmailProvider {
  private readonly logger = new Logger(MailHippoEmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = this.config.get<string>("email.mailhippoApiKey");
    if (!apiKey) {
      throw new Error(
        "MAILHIPPO_API_KEY is not set. Set EMAIL_PROVIDER=stub for local development, " +
          "or provide a real key to send via MailHippo.",
      );
    }
    const fromEmail = this.config.get<string>("email.fromAddress");

    let response: Response;
    try {
      response = await fetch(MAILHIPPO_SEND_URL, {
        method: "POST",
        headers: {
          "X-Auth-Secret": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          FromEmail: fromEmail,
          ToEmails: [input.to],
          CcEmails: [],
          BccEmails: [],
          Subject: input.subject,
          Body: input.html,
          Attachments: (input.attachments ?? []).map(toMailHippoAttachment),
        }),
      });
    } catch (err) {
      // Network-level failure (DNS, connection refused, timeout, ...).
      // Deliberately rebuilds a plain message rather than surfacing the
      // caught error object, which some fetch implementations attach the
      // original request (headers included) to.
      throw new Error(`MailHippo request failed: ${(err as Error).message}`);
    }

    let body: MailHippoResponse | undefined;
    try {
      body = (await response.json()) as MailHippoResponse;
    } catch {
      throw new Error(`MailHippo returned a non-JSON response (HTTP ${response.status})`);
    }

    // A 200 OK alone doesn't mean delivered — MailHippo can return 200
    // with a non-"Sent" status, which must be treated as a failure too.
    if (!response.ok || body.status !== "Sent") {
      this.logger.error(
        `MailHippo send failed: httpStatus=${response.status} messageId=${body?.messageId ?? "n/a"} mailhippoStatus=${body?.status ?? "n/a"}`,
      );
      throw new Error(`MailHippo did not confirm delivery (status: ${body?.status ?? "unknown"})`);
    }

    this.logger.log(`MailHippo send succeeded: messageId=${body.messageId} status=${body.status}`);

    return { providerMessageId: String(body.messageId), provider: "mailhippo" };
  }
}

// Field names for individual attachment objects aren't shown in MailHippo's
// documented example (only the empty `Attachments: []` case is) — this is
// a reasonable inference from the rest of the payload's PascalCase
// convention, not a confirmed contract. Revisit against real docs/a live
// call before the Documents module actually starts sending attachments.
function toMailHippoAttachment(attachment: EmailAttachment) {
  return {
    FileName: attachment.filename,
    Content: attachment.content,
    ContentType: attachment.contentType,
  };
}
