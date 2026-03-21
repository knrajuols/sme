import { forceLogout, getToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

// ── Envelope shape emitted by NestJS ResponseEnvelopeInterceptor ─────────────
interface ApiEnvelope<T> {
  status: string;
  message: string;
  data: T;
}

/**
 * Unwraps the NestJS ResponseEnvelopeInterceptor shape.
 * If the body matches { status, message, data } it returns `data`.
 * Falls back to the raw body so plain responses are never broken.
 */
function unwrapEnvelope<T>(body: unknown): T {
  const candidate = body as Partial<ApiEnvelope<T>>;
  if (
    candidate !== null &&
    typeof candidate === 'object' &&
    'status' in candidate &&
    'data' in candidate
  ) {
    return candidate.data as T;
  }
  return body as T;
}

// ── Direct API request (goes to NEXT_PUBLIC_API_BASE_URL) ─────────────────────
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers ?? {});

  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    // [SEC-AUTH-004] Token rejected by backend — wipe session and redirect.
    forceLogout();
    throw new Error('Unauthorized');
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message ?? 'Request failed');
  }

  return unwrapEnvelope<T>(body);
}

// ── BFF fetch (targets relative Next.js API routes, e.g. /api/academic-setup/years) ──
/**
 * Use this for all internal BFF routes (/api/...).
 * Automatically attaches the Bearer token from localStorage and unwraps the
 * NestJS ResponseEnvelopeInterceptor envelope so callers always receive <T>
 * directly — never a wrapper object.
 */
export async function bffFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts?.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...opts, headers });

  // [SEC-AUTH-005] BFF 401 interceptor — mirrors the apiRequest() guard.
  // Fires when the JWT has expired mid-session and the Next.js BFF layer
  // returns 401 before the response body is even parsed.
  if (res.status === 401) {
    forceLogout();
    throw new Error('Unauthorized');
  }

  const body: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (body as Record<string, unknown>)?.message ?? `Request failed (${res.status})`;
    throw new Error(String(msg));
  }

  return unwrapEnvelope<T>(body);
}
