'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://sme.test:3000';
const TOKEN_KEY = 'sme_platform_token';

interface Tenant {
  tenantId: string;
  tenantCode: string;
  schoolName: string;
  status: string;
  createdAt: string;
}

async function platformApi<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message ?? `Request failed (${res.status})`);
  return (json?.data ?? json) as T;
}

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activating, setActivating] = useState<string | null>(null);
  // After approval, show the hosts-file instructions for local dev
  const [justApproved, setJustApproved] = useState<Tenant | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      window.location.href = '/smeadmin/login';
      return;
    }
    loadTenants();
  }, []);

  async function loadTenants() {
    setLoading(true);
    setError('');
    try {
      const data = await platformApi<Tenant[]>('/platform/tenants/pending');
      setTenants(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function approveTenant(tenant: Tenant) {
    setActivating(tenant.tenantId);
    setError('');
    try {
      await platformApi(`/platform/tenants/${tenant.tenantId}/activate`, 'POST');
      // Remove from pending list and show activation instructions
      setTenants((prev) => prev.filter((t) => t.tenantId !== tenant.tenantId));
      setJustApproved(tenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setActivating(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/smeadmin/dashboard" className="text-white font-bold text-xl hover:text-slate-300">SME</a>
          <span className="text-slate-400 text-sm">/ School Approvals</span>
        </div>
        <a href="/smeadmin/dashboard" className="text-slate-400 hover:text-white text-sm">
          &larr; Dashboard
        </a>
      </nav>

      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Pending School Approvals</h1>
          <button
            onClick={loadTenants}
            className="text-sm text-blue-600 hover:underline"
          >
            Refresh
          </button>
        </div>

        {/* ── Just-approved success card ── */}
        {justApproved && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div className="flex-1">
                <div className="font-semibold text-green-800 text-lg">
                  {justApproved.schoolName} — Approved!
                </div>
                <p className="text-green-700 text-sm mt-1">
                  Subdomain: <code className="font-mono font-bold">{justApproved.tenantCode}</code>
                </p>

                <div className="mt-4 bg-white border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    Local Dev — Add subdomain to hosts file (run as Administrator):
                  </p>
                  <code className="block text-xs bg-slate-900 text-green-400 rounded px-4 py-3 font-mono">
                    .\scripts\setup-sme-local.ps1 -AddSchool &quot;{justApproved.tenantCode}&quot;
                  </code>
                  <p className="text-xs text-slate-500 mt-2">
                    After running, school users can login at:{' '}
                    <a
                      href={`http://${justApproved.tenantCode}.sme.test:3102/login`}
                      className="text-blue-600 underline font-mono"
                      target="_blank"
                      rel="noreferrer"
                    >
                      http://{justApproved.tenantCode}.sme.test:3102/login
                    </a>
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    ℹ️ In production, this step is not needed — wildcard DNS handles it automatically.
                  </p>
                </div>

                <button
                  onClick={() => setJustApproved(null)}
                  className="mt-3 text-xs text-green-600 underline hover:text-green-800"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* ── Tenant list ── */}
        {loading ? (
          <div className="text-slate-500 text-sm">Loading...</div>
        ) : tenants.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <div className="text-slate-600 font-medium">No pending approvals</div>
            <div className="text-slate-400 text-sm mt-1">All schools have been processed.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {tenants.map((tenant) => (
              <div
                key={tenant.tenantId}
                className="bg-white rounded-xl border border-slate-200 p-6 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900">{tenant.schoolName}</div>
                  <div className="text-sm text-slate-500 mt-1">
                    Subdomain: <code className="font-mono text-blue-700">{tenant.tenantCode}</code>
                    {' · '}
                    ID: <code className="font-mono text-xs text-slate-400">{tenant.tenantId}</code>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Registered: {new Date(tenant.createdAt).toLocaleString()}
                  </div>
                  <div className="mt-1">
                    <span className="inline-block text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
                      {tenant.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => approveTenant(tenant)}
                  disabled={activating === tenant.tenantId}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  {activating === tenant.tenantId ? 'Approving...' : 'Approve & Activate'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
