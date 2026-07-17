export interface EmailAttachment {
  filename: string;
  /** Base64-encoded content. */
  content: string;
  contentType: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Not used by the intake invitation email — a seam for the future Documents module sending completed packages. */
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  providerMessageId: string;
  provider: string;
}

/**
 * Every email-sending call in the app goes through this interface, never
 * a concrete provider SDK directly. Swapping MailHippo for SendGrid/SES/
 * Mailgun later means writing one new class + a config flag — zero
 * changes to callers (NotificationsModule, BullMQ processors, etc).
 */
export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
