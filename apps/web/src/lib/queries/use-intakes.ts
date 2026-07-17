"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface IntakeListItem {
  id: string;
  status: string;
  createdAt: string;
  patient: { firstName: string; lastName: string } | null;
  appointment: { scheduledAt: string; providerId: string | null; reasonForVisit: string } | null;
}

export interface IntakeFilters {
  search: string;
  providerId: string | null;
  status: string | null;
  appointmentDate: string | null;
}

function buildQuery(filters: IntakeFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.providerId) params.set("providerId", filters.providerId);
  if (filters.search) params.set("patientName", filters.search);
  if (filters.appointmentDate) {
    // Single date picker in the UI maps to a same-day [fromDate, toDate]
    // range against the API, which filters a range rather than one day.
    params.set("fromDate", `${filters.appointmentDate}T00:00:00.000Z`);
    params.set("toDate", `${filters.appointmentDate}T23:59:59.999Z`);
  }
  return params.toString();
}

export function useIntakesQuery(filters: IntakeFilters) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useQuery({
    queryKey: ["intakes", filters],
    // Don't fire until Clerk has fully hydrated client-side and confirmed
    // a session — the middleware check happens server-side and can be
    // ready slightly before useAuth() is, and getToken() during that gap
    // can resolve to null, which would otherwise silently send a literal
    // "Bearer null" Authorization header.
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error("No Clerk session token available yet");
      }
      return apiFetch<IntakeListItem[]>(`/intakes?${buildQuery(filters)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
  });
}
