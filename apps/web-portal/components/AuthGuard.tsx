'use client';

import { useEffect, useState } from 'react';

import { forceLogout, getMeClaims, getToken, isTokenExpired, type UserClaims } from '../lib/auth';

export function AuthGuard({
  children,
}: {
  children: (claims: UserClaims) => JSX.Element;
}) {
  const [claims, setClaims] = useState<UserClaims | null>(null);

  useEffect(() => {
    const token = getToken();

    // [SEC-AUTH-007] Reject expired tokens immediately — before any network
    // call.  This eliminates the ghost-state on hard page load with a stale
    // token still in localStorage.
    if (!token || isTokenExpired(token)) {
      forceLogout();
      return;
    }

    void getMeClaims().then((result) => {
      if (!result) {
        // getMeClaims already called forceLogout() internally.
        return;
      }

      setClaims(result);
    });
  }, []);

  if (!claims) {
    return <div className="p-6">Loading...</div>;
  }

  return children(claims);
}
