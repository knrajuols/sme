'use client';

import { useEffect, useState } from 'react';

import { forceLogout, getMeClaims, getToken, isTokenExpired } from '../lib/auth';

/**
 * Client-side route guard for /web-admin/* routes.
 *
 * On mount it reads the JWT from localStorage and inspects the `roles` claim:
 *   - No token          → redirect to /login
 *   - PLATFORM_ADMIN    → allow through (renders children)
 *   - SCHOOL_ADMIN      → redirect to /admin/dashboard
 *   - Any other role    → redirect to /login
 */
export function PlatformAdminGuard({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = getToken();

    // [SEC-AUTH-009] Fast-path expiry check — mirrors AdminGuard pattern.
    if (!token || isTokenExpired(token)) {
      forceLogout();
      return;
    }

    void getMeClaims().then((claims) => {
      if (!claims) {
        // getMeClaims already called forceLogout() internally.
        return;
      }

      if (claims.roles.includes('PLATFORM_ADMIN')) {
        setAuthorized(true);
        return;
      }

      // School admin → their portal
      if (claims.roles.includes('SCHOOL_ADMIN')) {
        window.location.href = '/admin/dashboard';
      } else {
        window.location.href = '/login';
      }
    });
  }, []);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-400">Verifying access…</p>
      </div>
    );
  }

  return <>{children}</>;
}
