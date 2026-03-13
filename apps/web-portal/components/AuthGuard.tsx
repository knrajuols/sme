'use client';

import { useEffect, useState } from 'react';

import { getMeClaims, getToken, type UserClaims } from '../lib/auth';

export function AuthGuard({
  children,
}: {
  children: (claims: UserClaims) => JSX.Element;
}) {
  const [claims, setClaims] = useState<UserClaims | null>(null);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = '/login';
      return;
    }

    void getMeClaims().then((result) => {
      if (!result) {
        window.location.href = '/login';
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
