'use client';

/**
 * /staff/dashboard — Staff member landing page after login.
 * ──────────────────────────────────────────────────────────────────────────────
 * Shows a welcome message and basic navigation for authenticated staff.
 */
import { useEffect, useState } from 'react';

import { decodeTokenClaims, getToken, forceLogout } from '../../../lib/auth';
import type { UserClaims } from '../../../lib/auth';

export default function StaffDashboardPage() {
  const [claims, setClaims] = useState<UserClaims | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    const decoded = decodeTokenClaims(token);
    if (!decoded) {
      window.location.href = '/login';
      return;
    }
    setClaims(decoded);
    const stored = localStorage.getItem('sme_staff_name');
    if (stored) setName(stored);
  }, []);

  if (!claims) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏫</span>
            <h1 className="text-lg font-bold text-slate-900">Staff Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{name || 'Staff Member'}</span>
            <button
              onClick={() => forceLogout()}
              className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-md shadow-slate-200/50 border border-slate-100 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Welcome{name ? `, ${name}` : ''}!
          </h2>
          <p className="text-slate-500 mb-6">You are signed in as a staff member.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: '📋', label: 'My Timetable', desc: 'View your class schedule', color: 'blue' },
              { icon: '✅', label: 'Attendance', desc: 'Mark student attendance', color: 'green' },
              { icon: '📝', label: 'Marks Entry', desc: 'Enter examination marks', color: 'purple' },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-slate-50 rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
              >
                <span className="text-3xl mb-3 block">{card.icon}</span>
                <h3 className="font-bold text-slate-800 mb-1">{card.label}</h3>
                <p className="text-sm text-slate-500">{card.desc}</p>
              </div>
            ))}
          </div>

          {/* Roles Debug */}
          <div className="mt-8 bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Session Info</p>
            <p className="text-sm text-slate-700"><span className="font-medium">Roles:</span> {claims.roles?.join(', ') || 'None'}</p>
            <p className="text-sm text-slate-700"><span className="font-medium">Tenant:</span> {claims.tenantId}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
