const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Single fetch wrapper for all backend calls. Staff-facing requests must
 * carry the caller's current Clerk session token as `Authorization: Bearer
 * <token>` (pass it via `init.headers`) — Clerk's session cookie is scoped
 * to this app's own origin and is never set on the API's separate origin,
 * so cookie-forwarding across origins wouldn't authenticate anything.
 * Callers fetch the token client-side via `useAuth().getToken()` (see
 * src/lib/queries for the pattern). The patient portal instead passes the
 * intake's secure token explicitly per-request, not via this header.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, Array.isArray(body.message) ? body.message.join(", ") : body.message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
