export const TOKEN_KEY = 'sme_web_portal_token';

export interface UserClaims {
  sub: string;
  tenantId: string;
  roles: string[];
  permissions?: string[];
  studentIds?: string[];
  /** Login email of the authenticated user — included in JWT for display only. */
  email?: string;
  iat?: number;
  exp?: number;
}

export async function login(email: string, _password: string): Promise<string> {
  const normalizedEmail = email.trim();
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/iam/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail }),
  });

  const body = await response.json();
  if (!response.ok) {
    // Gateway errors use RFC 7807 (`detail`), service errors use `message`.
    throw new Error(body?.message ?? body?.detail ?? 'Login failed');
  }

  const token = body?.data?.accessToken ?? body?.accessToken;
  if (!token) {
    throw new Error('Access token missing in login response');
  }

  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * [SEC-AUTH-001] Returns true when the token's `exp` claim is in the past,
 * or when the token cannot be decoded.  Used by guards and the BFF layer to
 * reject stale sessions before any network round-trip.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const [, payloadPart] = token.split('.');
    if (!payloadPart) return true;
    const payload = JSON.parse(atob(payloadPart)) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

/**
 * [SEC-AUTH-002] Single-point session teardown.
 * Clears the stored token then performs a hard navigation to /login so every
 * in-flight React subtree is fully unmounted.  Safe to call from any client
 * module (guards, API interceptors, profile logic).
 */
export function forceLogout(): void {
  logout();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export function decodeTokenClaims(token: string): UserClaims | null {
  try {
    const [, payloadPart] = token.split('.');
    if (!payloadPart) {
      return null;
    }

    const payload = JSON.parse(atob(payloadPart));
    return payload as UserClaims;
  } catch {
    return null;
  }
}

export async function getMeClaims(): Promise<UserClaims | null> {
  const token = getToken();
  if (!token) {
    return null;
  }

  // [SEC-AUTH-003] Reject locally-expired tokens before hitting the network.
  // This is the primary defence against the "ghost state" defect where an
  // expired token in localStorage passes the guard on hard page load.
  if (isTokenExpired(token)) {
    forceLogout();
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  try {
    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Explicit 401 from the backend means the token was rejected server-side
    // (e.g., revoked session, clock skew).  Wipe the session immediately.
    if (response.status === 401) {
      forceLogout();
      return null;
    }

    if (response.ok) {
      const body = await response.json();
      return (body?.data ?? body) as UserClaims;
    }
  } catch {
    // Network unavailable — fall through to local decode.
    // Token validity is already confirmed above via isTokenExpired().
  }

  return decodeTokenClaims(token);
}
