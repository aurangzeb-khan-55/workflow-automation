"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type NewOrExisting = "new" | "existing";

export interface CreateIntakeInput {
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  phone: string;
  newOrExisting: NewOrExisting;
  reasonForVisit: string;
  providerId?: string;
  scheduledAt: string;
  notes?: string;
  requiredDocumentTypes?: string[];
  isTelehealth?: boolean;
  action: "save_draft" | "create_and_send";
}

export type UpdateIntakeInput = Partial<Omit<CreateIntakeInput, "action">>;

async function authorizedFetch<T>(
  getToken: () => Promise<string | null>,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new Error("No Clerk session token available yet");
  }
  return apiFetch<T>(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  });
}

/** Shared invalidation: every mutation here changes what the dashboard's intake list should show. */
function useInvalidateIntakes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["intakes"] });
}

export function useCreateIntakeMutation() {
  const { getToken } = useAuth();
  const invalidate = useInvalidateIntakes();

  return useMutation({
    mutationFn: (input: CreateIntakeInput) =>
      authorizedFetch(getToken, "/intakes", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export function useUpdateIntakeMutation() {
  const { getToken } = useAuth();
  const invalidate = useInvalidateIntakes();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateIntakeInput }) =>
      authorizedFetch(getToken, `/intakes/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export function useSendIntakeEmailMutation() {
  const { getToken } = useAuth();
  const invalidate = useInvalidateIntakes();

  return useMutation({
    mutationFn: (id: string) => authorizedFetch(getToken, `/intakes/${id}/send`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

export function useDeleteIntakeMutation() {
  const { getToken } = useAuth();
  const invalidate = useInvalidateIntakes();

  return useMutation({
    mutationFn: (id: string) => authorizedFetch(getToken, `/intakes/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export interface IntakePreview {
  id: string;
  status: string;
  patient: { firstName: string; lastName: string; dob: string };
  appointment: { reasonForVisit: string; scheduledAt: string; notes: string | null } | null;
  sections: { sectionType: string; data: unknown; completedAt: string | null }[];
}

export function usePreviewIntake() {
  const { getToken } = useAuth();
  return (id: string) => authorizedFetch<IntakePreview>(getToken, `/intakes/${id}/preview`);
}

export interface IntakeReviewDocument {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  downloadUrl: string;
}

export interface IntakeReviewConsent {
  type: string;
  signedAt: string;
}

export interface IntakeReview {
  id: string;
  status: string;
  submittedAt: string | null;
  uploadedToJaneAt: string | null;
  patient: { firstName: string; lastName: string; dob: string; phone: string; email: string };
  appointment: { reasonForVisit: string; scheduledAt: string; notes: string | null } | null;
  personalInfo: Record<string, unknown> | undefined;
  medicalHistory: Record<string, unknown> | undefined;
  insuranceInfo: Record<string, unknown> | undefined;
  documents: IntakeReviewDocument[];
  consents: IntakeReviewConsent[];
}

/** The full read-only staff review of a submitted intake — see IntakeService.review() on the API side. */
export function useReviewIntake() {
  const { getToken } = useAuth();
  return (id: string) => authorizedFetch<IntakeReview>(getToken, `/intakes/${id}/review`);
}

export function useMarkUploadedToJaneMutation() {
  const { getToken } = useAuth();
  const invalidate = useInvalidateIntakes();
  return useMutation({
    mutationFn: (id: string) => authorizedFetch(getToken, `/intakes/${id}/mark-uploaded-to-jane`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

export function useMarkCompletedMutation() {
  const { getToken } = useAuth();
  const invalidate = useInvalidateIntakes();
  return useMutation({
    mutationFn: (id: string) => authorizedFetch(getToken, `/intakes/${id}/mark-completed`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

/**
 * Streams the zip package and triggers a real browser download — bypasses
 * apiFetch since that assumes a JSON response body, not a binary blob.
 * Filename comes from the server's Content-Disposition header so it always
 * matches IntakeService.generatePackage()'s naming, never guessed here.
 */
export function useDownloadPackageMutation() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("No Clerk session token available yet");

      const res = await fetch(`${API_URL}/api/v1/intakes/${id}/package`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new ApiError(res.status, Array.isArray(body.message) ? body.message.join(", ") : body.message);
      }

      const disposition = res.headers.get("content-disposition") ?? "";
      const filenameMatch = /filename="([^"]+)"/.exec(disposition);
      const filename = filenameMatch?.[1] ?? "intake-package.zip";

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  });
}
