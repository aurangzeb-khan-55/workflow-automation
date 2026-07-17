export interface IntakeInvitationEmailInput {
  patientFirstName: string;
  intakeLink: string;
  clinicName: string;
}

const ESTIMATED_MINUTES = "8–10 minutes";

/**
 * The intake invitation email — greets the patient by name, sets
 * expectations for what they'll be asked to complete, and gives them the
 * secure link. Pure function, deliberately: easy to unit-test the exact
 * content without spinning up the queue/provider machinery around it.
 */
export function buildIntakeInvitationEmail(input: IntakeInvitationEmailInput): { subject: string; html: string } {
  const subject = "Complete Your Patient Registration";

  const html = `
    <p>Hi ${escapeHtml(input.patientFirstName)},</p>
    <p>
      Thanks for scheduling your visit with ${escapeHtml(input.clinicName)}. Before your
      appointment, we ask that you complete your patient registration online —
      it takes about ${ESTIMATED_MINUTES}.
    </p>
    <p>You'll be asked to provide:</p>
    <ul>
      <li>Personal information</li>
      <li>Medical history</li>
      <li>Insurance information</li>
      <li>A photo of your driver's license</li>
      <li>Any relevant medical documents</li>
      <li>Consent to treat, HIPAA acknowledgement, and financial responsibility forms</li>
    </ul>
    <p>
      <a href="${input.intakeLink}">Complete your registration</a>
    </p>
    <p>This link is unique to you and expires in 14 days.</p>
    <p>See you soon,<br>${escapeHtml(input.clinicName)}</p>
  `.trim();

  return { subject, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
