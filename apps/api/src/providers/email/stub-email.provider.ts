import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { EmailProvider, SendEmailInput, SendEmailResult } from "./email-provider.interface";

const STUB_EMAIL_PREVIEW_DIR = join(process.cwd(), ".local", "stub-emails");

/**
 * V1 default when EMAIL_PROVIDER=stub. Logs subject/recipient only (never
 * body content, which may embed PHI) and returns a synthetic message id so
 * the rest of the pipeline (notifications, audit log) behaves exactly as
 * it would with a real provider wired up.
 *
 * Also drops the full rendered email (to/subject/html) as a local .html
 * file purely so a developer can eyeball what would have been sent —
 * this is a stub-only, local-filesystem convenience with no bearing on
 * the real MailHippo path, logs, or the Notification table, and the
 * directory is gitignored.
 */
@Injectable()
export class StubEmailProvider implements EmailProvider {
  private readonly logger = new Logger(StubEmailProvider.name);

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    this.logger.log(`[stub-email] would send "${input.subject}" to ${input.to}`);
    await this.writeLocalPreview(input);
    return { providerMessageId: randomUUID(), provider: "stub" };
  }

  private async writeLocalPreview(input: SendEmailInput): Promise<void> {
    try {
      await mkdir(STUB_EMAIL_PREVIEW_DIR, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeRecipient = input.to.replace(/[^a-zA-Z0-9@._-]/g, "_");
      const filePath = join(STUB_EMAIL_PREVIEW_DIR, `${timestamp}-${safeRecipient}.html`);

      const content = `<!--
  STUB EMAIL PREVIEW — never actually sent.
  To: ${input.to}
  Subject: ${input.subject}
  Generated: ${new Date().toISOString()}
-->
<div style="background:#fffae6;border:1px solid #e0c36b;padding:8px 12px;margin-bottom:16px;font-family:sans-serif;font-size:13px;">
  <strong>STUB EMAIL — not actually sent.</strong><br>
  To: ${input.to}<br>
  Subject: ${input.subject}
</div>
${input.html}
`;

      await writeFile(filePath, content, "utf8");
    } catch (err) {
      // Local dev convenience only — never let a filesystem hiccup break
      // the actual stub send.
      this.logger.warn(`Failed to write local stub email preview: ${(err as Error).message}`);
    }
  }
}
