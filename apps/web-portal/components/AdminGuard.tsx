'use client';

import { useEffect, useState } from 'react';

import { getMeClaims, getToken } from '../lib/auth';

/**
 * Client-side route guard for all /admin/* routes.
 *
 * On mount it reads the JWT from localStorage and inspects the `roles` claim:
 *   - No token           → redirect to /login
 *   - SCHOOL_ADMIN       → allow through (renders children)
 *   - TEACHER            → redirect to /portal/teacher
 *   - PARENT / STUDENT   → redirect to /portal/family
 *
 * This is intentionally client-side because the token lives in localStorage,
 * which is inaccessible to Next.js Edge Middleware.  The layout layer is the
 * earliest point we can inspect it without a server-side session cookie.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = '/login';
      return;
    }

    void getMeClaims().then((claims) => {
      if (!claims) {
        window.location.href = '/login';
        return;
      }

      if (claims.roles.includes('SCHOOL_ADMIN')) {
        setAuthorized(true);
        return;
      }

      // Non-admin: redirect to the correct role portal
      if (claims.roles.includes('TEACHER')) {
        window.location.href = '/portal/teacher';
      } else {
        // PARENT, STUDENT, or any other role → family portal
        window.location.href = '/portal/family';
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
