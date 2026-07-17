import { ConflictException } from "@nestjs/common";
import { IntakeStatus } from "@prisma/client";

/**
 * The intake status lifecycle. Each transition is tagged with who/what
 * triggers it in code — nothing here is enforced by this file beyond
 * "is this edge legal"; callers are responsible for calling
 * assertTransition() at the point each trigger actually fires.
 *
 *   draft -> intake_email_sent
 *   email_failed -> intake_email_sent
 *     STAFF — IntakeService.sendEmail(), either as part of the initial
 *     "Create Intake & Send Email" action, later from an existing draft
 *     ("send the intake email whenever ready"), or as a resend after a
 *     delivery failure. Generates the secure token, writes an audit log,
 *     and queues the actual send via the `email` BullMQ queue —
 *     reaching intake_email_sent means the send was *queued*, not that
 *     it was necessarily delivered (see the next transition).
 *
 *   intake_email_sent -> email_failed
 *     SYSTEM — EmailProcessor's `failed` worker event, but only once
 *     BullMQ's retry policy (exponential backoff, configured where the
 *     job is queued) has been exhausted — a single transient failure
 *     does not move the status, only final failure does. Without this,
 *     an intake whose email genuinely never reached the patient would
 *     sit in intake_email_sent indefinitely with no visible signal to
 *     staff that anything is wrong.
 *
 *   intake_email_sent -> patient_started_intake
 *     AUTOMATIC — IntakePortalService.upsertSection(), fires the first
 *     time any section is saved for this intake.
 *
 *   patient_started_intake -> waiting_for_patient
 *     AUTOMATIC — IntakePortalService.upsertSection(), fires on every
 *     subsequent section save. patient_started_intake is deliberately a
 *     one-tick "just began" marker; waiting_for_patient is the steady
 *     "in progress" state dashboards filter on.
 *
 *   patient_started_intake -> intake_submitted
 *   waiting_for_patient -> intake_submitted
 *   missing_documents -> intake_submitted
 *     AUTOMATIC — IntakePortalService.submit(), when required-field,
 *     document, and consent validation all pass. Allowed from
 *     patient_started_intake too (not just waiting_for_patient) because a
 *     premature submit attempt should surface as a validation error, not
 *     an illegal-transition error.
 *
 *   patient_started_intake -> missing_documents
 *   waiting_for_patient -> missing_documents
 *   missing_documents -> waiting_for_patient
 *     AUTOMATIC (patient_started_intake/waiting_for_patient -> missing_documents)
 *     — IntakePortalService.submit(), when a submit attempt is incomplete:
 *     rather than just throwing a validation error, the intake visibly
 *     moves to "Missing Information" (the staff-facing label for this
 *     status) so dashboards surface it, and the response tells the patient
 *     exactly what's still missing. STAFF (missing_documents ->
 *     waiting_for_patient) — IntakeService.markDocumentsResolved(), a
 *     manual override seam for cases staff resolve out-of-band.
 *
 *   intake_submitted -> ready_for_staff_review
 *     AUTOMATIC — IntakePortalService.submit(), immediately after a
 *     successful submission: generates the intake summary via
 *     AI_SUMMARY_PROVIDER and advances the status in the same request.
 *
 *   ready_for_staff_review -> uploaded_to_jane
 *     STAFF — IntakeService.markUploadedToJane(). Manual step matching the
 *     JaneExportAdapter seam (no automated Jane upload in V1).
 *
 *   uploaded_to_jane -> completed
 *     STAFF — IntakeService.markCompleted().
 *
 *   completed -> (none)
 *     Terminal.
 */
const ALLOWED_TRANSITIONS: Record<IntakeStatus, IntakeStatus[]> = {
  [IntakeStatus.draft]: [IntakeStatus.intake_email_sent],
  [IntakeStatus.intake_email_sent]: [
    IntakeStatus.patient_started_intake,
    IntakeStatus.email_failed,
  ],
  [IntakeStatus.email_failed]: [IntakeStatus.intake_email_sent],
  [IntakeStatus.patient_started_intake]: [
    IntakeStatus.waiting_for_patient,
    IntakeStatus.missing_documents,
    IntakeStatus.intake_submitted,
  ],
  [IntakeStatus.waiting_for_patient]: [
    IntakeStatus.missing_documents,
    IntakeStatus.intake_submitted,
  ],
  [IntakeStatus.missing_documents]: [
    IntakeStatus.waiting_for_patient,
    IntakeStatus.intake_submitted,
  ],
  [IntakeStatus.intake_submitted]: [IntakeStatus.ready_for_staff_review],
  [IntakeStatus.ready_for_staff_review]: [IntakeStatus.uploaded_to_jane],
  [IntakeStatus.uploaded_to_jane]: [IntakeStatus.completed],
  [IntakeStatus.completed]: [],
};

export function canTransition(from: IntakeStatus, to: IntakeStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Throws ConflictException (409) if `to` isn't a legal next state from `from`. */
export function assertTransition(from: IntakeStatus, to: IntakeStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictException(`Cannot transition intake status from "${from}" to "${to}"`);
  }
}

/**
 * Statuses in which the patient portal (IntakeTokenGuard + IntakePortalService)
 * still allows mutating actions — section saves, document upload/delete,
 * consent signing, submit. `draft` is deliberately absent: a draft intake has
 * no secureToken yet, so it's structurally unreachable via the token-only
 * portal path in the first place. Shared by the guard (which enforces this at
 * the request boundary) and the service (defense in depth).
 */
export const PORTAL_EDITABLE_STATUSES: IntakeStatus[] = [
  IntakeStatus.intake_email_sent,
  IntakeStatus.patient_started_intake,
  IntakeStatus.waiting_for_patient,
  IntakeStatus.missing_documents,
];
