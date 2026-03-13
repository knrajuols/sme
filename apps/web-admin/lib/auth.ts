export const TOKEN_KEY = 'sme_web_admin_token';

export interface UserClaims {
  sub: string;
  tenantId: string;
  roles: string[];
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export async function login(email: string, _password: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://sme.test:3000';
  const response = await fetch(`${baseUrl}/iam/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.message ?? 'Login failed');
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

export function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthClaims(): UserClaims | null {
  const token = getToken();
  if (!token) {
    return null;
  }

  return decodeTokenClaims(token);
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

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://sme.test:3000';
  try {
    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const body = await response.json();
      return (body?.data ?? body) as UserClaims;
    }
  } catch {
    // Fallback to local token decode for now.
  }

  return decodeTokenClaims(token);
}
