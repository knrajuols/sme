'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { apiRequest } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Student {
  id: string;
  fullName?: string;
  admissionNo?: string;
}

// ── Internal content component ────────────────────────────────────────────────
function PortalDashboardContent({ claims }: { claims: UserClaims }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<Student[]>('/portal/students');
        if (cancelled) return;
        setStudents(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '[ERR-PRT-DASH-5001] Failed to load linked students');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Parent Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Tenant</p>
          <p className="text-lg font-medium">{claims.tenantId}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Parent User</p>
          <p className="text-lg font-medium">{claims.sub}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Linked Students</p>
          <p className="text-lg font-medium">{claims.studentIds?.length ?? 0}</p>
        </div>
      </div>

      <div className="mt-6 rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Mapped Students</h2>
        {error && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <ul className="space-y-1 text-sm">
          {loading ? (
            <li className="animate-pulse text-slate-400">Loading students…</li>
          ) : students.length === 0 ? (
            <li className="text-slate-500">[ERR-PRT-DASH-4004] No students linked to this account.</li>
          ) : (
            students.map((student) => (
              <li key={student.id} className="rounded border border-slate-200 px-3 py-2">
                {student.fullName ?? student.admissionNo ?? student.id}
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
}

// ── Page export (strict naming) ───────────────────────────────────────────────
export default function PortalDashboardPage() {
  return (
    <AuthGuard>
      {(claims) => <PortalDashboardContent claims={claims} />}
    </AuthGuard>
  );
}
