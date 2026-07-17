/**
 * Ordered intake lifecycle. Order matters: the dashboard groups/sorts by
 * this sequence and the state machine (apps/api IntakeStateMachine) only
 * allows forward transitions plus the two "needs patient action" branches.
 */
export enum IntakeStatus {
  APPOINTMENT_SCHEDULED = "appointment_scheduled",
  INTAKE_EMAIL_SENT = "intake_email_sent",
  PATIENT_STARTED_INTAKE = "patient_started_intake",
  WAITING_FOR_PATIENT = "waiting_for_patient",
  MISSING_DOCUMENTS = "missing_documents",
  INTAKE_SUBMITTED = "intake_submitted",
  READY_FOR_STAFF_REVIEW = "ready_for_staff_review",
  UPLOADED_TO_JANE = "uploaded_to_jane",
  COMPLETED = "completed",
}

export const INTAKE_STATUS_LABELS: Record<IntakeStatus, string> = {
  [IntakeStatus.APPOINTMENT_SCHEDULED]: "Appointment Scheduled",
  [IntakeStatus.INTAKE_EMAIL_SENT]: "Intake Email Sent",
  [IntakeStatus.PATIENT_STARTED_INTAKE]: "Patient Started Intake",
  [IntakeStatus.WAITING_FOR_PATIENT]: "Waiting for Patient",
  [IntakeStatus.MISSING_DOCUMENTS]: "Missing Documents",
  [IntakeStatus.INTAKE_SUBMITTED]: "Intake Submitted",
  [IntakeStatus.READY_FOR_STAFF_REVIEW]: "Ready for Staff Review",
  [IntakeStatus.UPLOADED_TO_JANE]: "Uploaded to Jane",
  [IntakeStatus.COMPLETED]: "Completed",
};
