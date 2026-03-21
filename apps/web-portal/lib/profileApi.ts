/**
 * lib/profileApi.ts
 *
 * Calls the Next.js internal API route (/api/school/profile) with the current
 * JWT so the request goes through the server-side proxy instead of directly to
 * the external backend URL in NEXT_PUBLIC_API_BASE_URL.
 *
 * Error codes:
 *   [ERR-SCH-PROF-5001]  GET fetch failure
 *   [ERR-SCH-PROF-5002]  PATCH update failure
 */

import { forceLogout, getToken } from './auth';

// ── Typed API error ───────────────────────────────────────────────────────────
export class ProfileApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Machine-readable conflict field, present on HTTP 409 responses */
    public readonly conflictField?: 'contactEmail' | 'contactPhone',
  ) {
    super(message);
    this.name = 'ProfileApiError';
  }
}

// ── Internal helper ───────────────────────────────────────────────────────────
function buildHeaders(): HeadersInit {
  const token = getToken();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  return headers;
}

async function callProfile<T>(method: 'GET' | 'PATCH', payload?: Record<string, unknown>): Promise<T> {
  const init: RequestInit = {
    method,
    headers: buildHeaders(),
    cache: 'no-store',
  };

  if (payload !== undefined) {
    init.body = JSON.stringify(payload);
  }

  const res = await fetch('/api/school/profile', init);

  if (res.status === 401) {
    // [SEC-AUTH-006] Profile 401 — always a dead session; tear it down.
    forceLogout();
    throw new ProfileApiError('Unauthorized', 401);
  }

  const body: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const b = body as Record<string, unknown> | null;
    const serverMsg =
      (b && typeof b.message === 'string' ? b.message : undefined) ??
      `${method === 'GET' ? '[ERR-SCH-PROF-5001]' : '[ERR-SCH-PROF-5002]'} Profile request failed`;

    // Detect conflict field from the server's machine-readable code
    let conflictField: 'contactEmail' | 'contactPhone' | undefined;
    if (res.status === 409) {
      const code = b && typeof b.code === 'string' ? b.code : '';
      if (code === 'DUPLICATE_EMAIL' || serverMsg.toLowerCase().includes('email')) {
        conflictField = 'contactEmail';
      } else if (code === 'DUPLICATE_PHONE' || serverMsg.toLowerCase().includes('phone')) {
        conflictField = 'contactPhone';
      }
    }

    throw new ProfileApiError(serverMsg, res.status, conflictField);
  }

  return ((body as { data?: unknown })?.data ?? body) as T;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function fetchProfile<T>(): Promise<T> {
  return callProfile<T>('GET');
}

export function updateProfile(payload: Record<string, unknown>): Promise<{ updated: boolean }> {
  return callProfile<{ updated: boolean }>('PATCH', payload);
}
