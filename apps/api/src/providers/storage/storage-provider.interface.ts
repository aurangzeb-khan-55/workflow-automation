/**
 * All file I/O in the app (documents, generated PDF packages) goes through
 * this interface. Folder structure convention enforced by callers:
 * `clinics/{clinicId}/patients/{patientId}/intakes/{intakeId}/{fileName}`
 */
export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<{ key: string }>;
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getSignedUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
  /** Server-side read of the raw bytes — used to bundle uploaded files into the staff document package (never exposed to a browser directly; that's what signed URLs are for). */
  getObject(key: string): Promise<Buffer>;
}
