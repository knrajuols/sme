import { getAuthClaims, getToken, logout } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://sme.test:3000';

type RetryPolicy = {
  attempts?: number;
  baseDelayMs?: number;
};

export type ApiRequestOptions = RequestInit & {
  tenantId?: string;
  idempotencyKey?: string;
  correlationId?: string;
  retry?: RetryPolicy;
  disableTenantValidation?: boolean;
};

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD']);
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(method: string, status: number | null): boolean {
  if (!IDEMPOTENT_METHODS.has(method)) {
    return false;
  }

  if (status === null) {
    return true;
  }

  return status >= 500;
}

export async function apiRequest<T>(path: string, init: ApiRequestOptions = {}): Promise<T> {
  const token = getToken();
  const claims = getAuthClaims();
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers ?? {});
  const requestTenantId = init.tenantId ?? claims?.tenantId;

  if (!init.disableTenantValidation && init.tenantId && claims?.tenantId && init.tenantId !== claims.tenantId) {
    throw new Error('Tenant validation failed for request');
  }

  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (requestTenantId) {
    headers.set('x-tenant-id', requestTenantId);
  }

  if (!headers.has('x-correlation-id')) {
    headers.set('x-correlation-id', init.correlationId ?? generateRequestId());
  }

  if (MUTATING_METHODS.has(method) && !headers.has('x-idempotency-key')) {
    headers.set('x-idempotency-key', init.idempotencyKey ?? generateRequestId());
  }

  const retryAttempts = Math.max(1, init.retry?.attempts ?? 2);
  const baseDelayMs = Math.max(50, init.retry?.baseDelayMs ?? 250);
  let attempt = 0;

  while (attempt < retryAttempts) {
    attempt += 1;

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        method,
        headers,
      });

      if (response.status === 401) {
        logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Unauthorized');
      }

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (attempt < retryAttempts && shouldRetry(method, response.status)) {
          await delay(baseDelayMs * attempt);
          continue;
        }

        throw new Error(body?.message ?? 'Request failed');
      }

      return (body?.data ?? body) as T;
    } catch (error) {
      if (attempt < retryAttempts && shouldRetry(method, null)) {
        await delay(baseDelayMs * attempt);
        continue;
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Request failed');
    }
  }

  throw new Error('Request failed after retries');
}

// ── BFF fetch (targets relative Next.js API routes, e.g. /api/web-admin/periods) ──
export async function bffFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts?.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...opts, headers });
  const body: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (body as Record<string, unknown>)?.message ?? `Request failed (${res.status})`;
    throw new Error(String(msg));
  }

  const b = body as Record<string, unknown>;
  return (b?.data !== undefined ? b.data : body) as T;
}
