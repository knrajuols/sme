'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AuthGuard } from '../../components/AuthGuard';
import { apiRequest } from '../../lib/api';

interface SchoolProfile {
  tenantId: string;
  tenantCode: string;
  schoolName: string;
  status: string;
}

interface PendingSchool {
  tenantId: string;
  tenantCode: string;
  schoolName: string;
  status: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    void apiRequest<SchoolProfile | null>('/school/profile')
      .then((result) => setSchoolProfile(result))
      .catch(() => setSchoolProfile(null));
  }, []);

  useEffect(() => {
    void apiRequest<PendingSchool[]>('/platform/tenants/pending')
      .then((rows) => setPendingCount(rows.length))
      .catch(() => {}); // only succeeds for PLATFORM_ADMIN
  }, []);

  return (
    <AuthGuard>
      {(claims) => (
        <main className="mx-auto max-w-6xl p-6">
          <h1 className="mb-6 text-2xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>

          {/* Platform admin: pending school approvals banner */}
          {claims.roles.includes('PLATFORM_ADMIN') && pendingCount !== null && pendingCount > 0 && (
            <div className="mb-6 flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-4 py-3">
              <div>
                <p className="font-semibold text-amber-900">{pendingCount} school{pendingCount !== 1 ? 's' : ''} pending approval</p>
                <p className="text-sm text-amber-700">New school registrations are waiting for your review.</p>
              </div>
              <Link
                href="/platform/registered-schools"
                className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Review Schools
              </Link>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Account</p>
              <p className="text-lg font-medium">{claims.roles.includes('PLATFORM_ADMIN') ? 'Platform Admin' : (schoolProfile?.schoolName ?? claims.tenantId)}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">User</p>
              <p className="text-lg font-medium">{claims.sub}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Roles</p>
              <p className="text-lg font-medium">{claims.roles.join(', ')}</p>
            </div>
          </div>
        </main>
      )}
    </AuthGuard>
  );
}
