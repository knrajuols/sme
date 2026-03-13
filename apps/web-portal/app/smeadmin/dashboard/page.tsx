'use client';

import { useEffect, useState } from 'react';

const TOKEN_KEY = 'sme_platform_token';

interface JwtPayload {
  sub: string;
  tenantId: string;
  roles: string[];
  permissions?: string[];
  email?: string;
}

function decodeToken(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    return JSON.parse(atob(part)) as JwtPayload;
  } catch {
    return null;
  }
}

export default function PlatformAdminDashboard() {
  const [claims, setClaims] = useState<JwtPayload | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      window.location.href = '/smeadmin/login';
      return;
    }
    const decoded = decodeToken(token);
    if (!decoded || !decoded.roles.includes('PLATFORM_ADMIN')) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/smeadmin/login';
      return;
    }
    setClaims(decoded);
  }, []);

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/smeadmin/login';
  }

  if (!claims) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-xl">SME</span>
          <span className="text-slate-400 text-sm">Platform Admin</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-slate-300 hover:text-white text-sm underline"
        >
          Logout
        </button>
      </nav>

      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Platform Dashboard</h1>
        <p className="text-slate-500 text-sm mb-8">
          Logged in as <span className="font-medium text-slate-700">{claims.sub}</span> &mdash; Role:{' '}
          <span className="font-medium text-slate-700">{claims.roles.join(', ')}</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a
            href="/platform/tenants"
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-3">🏫</div>
            <div className="font-semibold text-slate-800">Manage Schools</div>
            <div className="text-slate-500 text-sm mt-1">View, approve and activate tenant registrations</div>
          </a>
          <a
            href="/platform/tenants?status=PENDING"
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-3">⏳</div>
            <div className="font-semibold text-slate-800">Pending Approvals</div>
            <div className="text-slate-500 text-sm mt-1">Schools awaiting platform admin activation</div>
          </a>
          <a
            href="/platform/users"
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-3">👥</div>
            <div className="font-semibold text-slate-800">Users</div>
            <div className="text-slate-500 text-sm mt-1">Manage all platform users</div>
          </a>
        </div>
      </div>
    </main>
  );
}
