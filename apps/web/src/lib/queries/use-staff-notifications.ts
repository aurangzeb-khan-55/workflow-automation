"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

const POLL_INTERVAL_MS = 30_000;

export interface StaffNotification {
  id: string;
  clinicId: string;
  intakeId: string | null;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface StaffNotificationsResponse {
  notifications: StaffNotification[];
  unreadCount: number;
}

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

/** Polls every 30s rather than a websocket — matches the rest of the app's keep-it-simple approach so far. */
export function useStaffNotificationsQuery() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useQuery({
    queryKey: ["staff-notifications"],
    enabled: isLoaded && isSignedIn,
    refetchInterval: POLL_INTERVAL_MS,
    queryFn: () => authorizedFetch<StaffNotificationsResponse>(getToken, "/staff-notifications"),
  });
}

export function useMarkNotificationReadMutation() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => authorizedFetch(getToken, `/staff-notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-notifications"] }),
  });
}

export function useMarkAllNotificationsReadMutation() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authorizedFetch(getToken, "/staff-notifications/read-all", { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-notifications"] }),
  });
}
