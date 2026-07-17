import { ApiError } from "./api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Separate from apiFetch: the patient portal carries no Clerk session at
 * all — the intake's secure token in the URL path is the only credential,
 * never a bearer header (see IntakeTokenGuard on the backend).
 */
export async function portalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1/patient-intake${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? res.statusText));
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Uploads raw file bytes directly to the storage provider's signed URL — never through our own API. */
export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) {
    throw new Error("File upload failed — please try again.");
  }
}
