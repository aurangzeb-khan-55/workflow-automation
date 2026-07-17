import { SetMetadata } from "@nestjs/common";

/**
 * Tags a patient-portal route as mutating — IntakeTokenGuard additionally
 * rejects it (403) once the intake has left PORTAL_EDITABLE_STATUSES (e.g.
 * already submitted). Routes without this — the read-only GET — stay
 * reachable in any non-expired state, so a patient can still load a
 * confirmation/status screen after submitting.
 */
export const REQUIRE_EDITABLE_INTAKE_KEY = "requireEditableIntake";
export const RequireEditableIntake = () => SetMetadata(REQUIRE_EDITABLE_INTAKE_KEY, true);
