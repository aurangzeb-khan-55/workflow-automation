"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Backs the dashboard's provider filter dropdown with real names, via GET /users?role=provider. */
export function useProvidersQuery() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useQuery({
    queryKey: ["users", "provider"],
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error("No Clerk session token available yet");
      }
      return apiFetch<StaffUser[]>("/users?role=provider", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
  });
}
