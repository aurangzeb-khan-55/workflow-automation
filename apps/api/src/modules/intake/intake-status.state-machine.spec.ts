import { ConflictException } from "@nestjs/common";
import { IntakeStatus } from "@prisma/client";
import { assertTransition, canTransition } from "./intake-status.state-machine";

describe("intake status state machine", () => {
  const VALID_TRANSITIONS: [IntakeStatus, IntakeStatus][] = [
    [IntakeStatus.draft, IntakeStatus.intake_email_sent],
    [IntakeStatus.intake_email_sent, IntakeStatus.patient_started_intake],
    [IntakeStatus.intake_email_sent, IntakeStatus.email_failed],
    [IntakeStatus.email_failed, IntakeStatus.intake_email_sent],
    [IntakeStatus.patient_started_intake, IntakeStatus.waiting_for_patient],
    [IntakeStatus.patient_started_intake, IntakeStatus.missing_documents],
    [IntakeStatus.patient_started_intake, IntakeStatus.intake_submitted],
    [IntakeStatus.waiting_for_patient, IntakeStatus.missing_documents],
    [IntakeStatus.waiting_for_patient, IntakeStatus.intake_submitted],
    [IntakeStatus.missing_documents, IntakeStatus.waiting_for_patient],
    [IntakeStatus.missing_documents, IntakeStatus.intake_submitted],
    [IntakeStatus.intake_submitted, IntakeStatus.ready_for_staff_review],
    [IntakeStatus.ready_for_staff_review, IntakeStatus.uploaded_to_jane],
    [IntakeStatus.uploaded_to_jane, IntakeStatus.completed],
  ];

  it.each(VALID_TRANSITIONS)("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  const ALL_STATUSES = Object.values(IntakeStatus);

  it("rejects every transition not explicitly listed as valid", () => {
    const validSet = new Set(VALID_TRANSITIONS.map(([from, to]) => `${from}->${to}`));

    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const key = `${from}->${to}`;
        if (validSet.has(key)) continue;
        expect(canTransition(from, to)).toBe(false);
        expect(() => assertTransition(from, to)).toThrow(ConflictException);
      }
    }
  });

  it("rejects skipping states (e.g. draft straight to intake_submitted)", () => {
    expect(canTransition(IntakeStatus.draft, IntakeStatus.intake_submitted)).toBe(false);
  });

  it("rejects moving backwards (e.g. completed back to uploaded_to_jane)", () => {
    expect(canTransition(IntakeStatus.completed, IntakeStatus.uploaded_to_jane)).toBe(false);
  });

  it("rejects any transition out of the terminal completed state", () => {
    for (const to of ALL_STATUSES) {
      expect(canTransition(IntakeStatus.completed, to)).toBe(false);
    }
  });

  it("rejects a same-state no-op transition", () => {
    for (const status of ALL_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("allows missing_documents and waiting_for_patient to cycle between each other", () => {
    expect(canTransition(IntakeStatus.waiting_for_patient, IntakeStatus.missing_documents)).toBe(true);
    expect(canTransition(IntakeStatus.missing_documents, IntakeStatus.waiting_for_patient)).toBe(true);
  });

  it("allows intake_email_sent and email_failed to cycle between each other (resend after failure)", () => {
    expect(canTransition(IntakeStatus.intake_email_sent, IntakeStatus.email_failed)).toBe(true);
    expect(canTransition(IntakeStatus.email_failed, IntakeStatus.intake_email_sent)).toBe(true);
  });

  it("rejects email_failed skipping straight to a later state", () => {
    expect(canTransition(IntakeStatus.email_failed, IntakeStatus.patient_started_intake)).toBe(false);
    expect(canTransition(IntakeStatus.email_failed, IntakeStatus.intake_submitted)).toBe(false);
  });
});
