"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalFetch, uploadToSignedUrl } from "@/lib/patient-portal-api";

export interface PortalDocument {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  downloadUrl: string;
}

export interface PortalConsent {
  type: string;
  signedAt: string;
}

export interface PortalSection {
  sectionType: string;
  data: Record<string, unknown>;
  completedAt: string | null;
}

export interface PortalIntake {
  id: string;
  status: string;
  tokenExpiresAt: string | null;
  requiredDocumentTypes: string[];
  requiredConsentTypes: string[];
  patient: { firstName: string; lastName: string; dob: string } | null;
  appointment: { reasonForVisit: string; scheduledAt: string } | null;
  sections: PortalSection[];
  documents: PortalDocument[];
  consents: PortalConsent[];
}

export interface MissingItem {
  category: "section" | "document" | "consent";
  type: string;
  message: string;
}

export interface SubmitResult {
  id: string;
  status: string;
  missing: MissingItem[];
}

function queryKey(token: string) {
  return ["patient-intake", token];
}

export function useIntakeQuery(token: string) {
  return useQuery({
    queryKey: queryKey(token),
    queryFn: () => portalFetch<PortalIntake>(`/${token}`),
    retry: false,
  });
}

export function useSaveSectionMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionType, data }: { sectionType: string; data: Record<string, unknown> }) =>
      portalFetch(`/${token}/sections/${sectionType}`, { method: "PATCH", body: JSON.stringify({ data }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(token) }),
  });
}

export function useUploadDocumentMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentType, file }: { documentType: string; file: File }) => {
      const { key, uploadUrl } = await portalFetch<{ key: string; uploadUrl: string }>(`/${token}/documents/upload-url`, {
        method: "POST",
        body: JSON.stringify({ documentType, fileName: file.name, contentType: file.type || "application/octet-stream" }),
      });
      await uploadToSignedUrl(uploadUrl, file);
      return portalFetch(`/${token}/documents`, {
        method: "POST",
        body: JSON.stringify({
          documentType,
          key,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(token) }),
  });
}

export function useDeleteDocumentMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => portalFetch(`/${token}/documents/${documentId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(token) }),
  });
}

export function useSignConsentMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ consentType, signatureData }: { consentType: string; signatureData: string }) =>
      portalFetch(`/${token}/consents/${consentType}`, { method: "PUT", body: JSON.stringify({ signatureData }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(token) }),
  });
}

export function useSubmitIntakeMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => portalFetch<SubmitResult>(`/${token}/submit`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(token) }),
  });
}
