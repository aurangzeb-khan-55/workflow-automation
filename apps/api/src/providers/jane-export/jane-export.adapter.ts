/**
 * Jane App (the clinic's EHR) has no document-upload API as of this
 * writing. This adapter is the seam where that would plug in if/when one
 * exists — every other module (Intake, Documents, Dashboard) only ever
 * calls `JaneExportAdapter`, never anything Jane-specific directly.
 *
 * V1 behavior: `prepareExportPackage` builds the downloadable document
 * bundle (registration, medical history, signed consents, insurance
 * images, ID, prior records, AI summary) via PackagingService and returns
 * a signed URL. `confirmManualUpload` is called by staff, via the
 * dashboard "mark uploaded to Jane" checklist action, after they've
 * manually uploaded that package into the patient's Jane record — it just
 * timestamps `intakes.uploadedToJaneAt` and writes an audit log entry.
 *
 * If Jane ever ships a document-upload API, `confirmManualUpload` is
 * replaced by an `uploadToJane(packageUrl)` method that calls it directly,
 * and the manual "mark completed" dashboard step goes away. No other
 * module needs to change.
 */
export interface PreparedExportPackage {
  intakeId: string;
  downloadUrl: string;
  fileCount: number;
}

export const JANE_EXPORT_ADAPTER = Symbol("JANE_EXPORT_ADAPTER");

export interface JaneExportAdapter {
  prepareExportPackage(intakeId: string): Promise<PreparedExportPackage>;
  confirmManualUpload(intakeId: string, confirmedByUserId: string): Promise<void>;
}
