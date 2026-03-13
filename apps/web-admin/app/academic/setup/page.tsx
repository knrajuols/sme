'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { DataTable, TableColumn } from '../../../components/DataTable';
import { apiRequest } from '../../../lib/api';
import { getAuthClaims, getToken } from '../../../lib/auth';

// ── Types ────────────────────────────────────────────────────────────────────

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SeedResult {
  seeded: number;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AcademicSetupPage() {
  const [years, setYears]               = useState<AcademicYear[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [seeding, setSeeding]           = useState(false);
  const [toast, setToast]               = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // form state
  const [name, setName]           = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [isActive, setIsActive]   = useState(false);
  const [saving, setSaving]       = useState(false);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadYears = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<AcademicYear[]>('/tenant/academic/years');
      setYears(data);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load academic years');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void loadYears(); }, [loadYears]);

  // ── Seed handler ───────────────────────────────────────────────────────────

  async function handleSeed() {
    setSeeding(true);
    try {
      const token = getToken();
      const claims = getAuthClaims();
      if (!token) throw new Error('Not authenticated');

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      if (claims?.tenantId) headers['x-tenant-id'] = claims.tenantId;

      const res = await fetch('/api/academic/years/seed', {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        const body = await res.json() as { message?: string };
        throw new Error(body.message ?? 'Seed request failed');
      }
      const result = await res.json() as SeedResult;
      showToast('success', `✨ ${result.seeded} academic year${result.seeded !== 1 ? 's' : ''} created successfully`);
      await loadYears();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  }

  // ── Create handler ─────────────────────────────────────────────────────────

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/tenant/academic/years', {
        method: 'POST',
        body: JSON.stringify({ name, startDate: new Date(startDate), endDate: new Date(endDate), isActive }),
      });
      showToast('success', `Academic year "${name}" created`);
      setShowForm(false);
      setName(''); setStartDate(''); setEndDate(''); setIsActive(false);
      await loadYears();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create academic year');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete handler ─────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    try {
      await apiRequest(`/tenant/academic/years/${id}`, { method: 'DELETE' });
      showToast('success', 'Academic year deleted');
      await loadYears();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete academic year');
    }
  }

  // ── Table columns ──────────────────────────────────────────────────────────

  const columns: TableColumn<AcademicYear>[] = [
    {
      key: 'name',
      label: 'Year',
      render: (row) => (
        <span className="font-semibold text-slate-800">{row.name}</span>
      ),
    },
    {
      key: 'startDate',
      label: 'Start Date',
      render: (row) => new Date(row.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      key: 'endDate',
      label: 'End Date',
      render: (row) => new Date(row.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => row.isActive
        ? <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 border border-teal-200">● Active</span>
        : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 border border-slate-200">◌ Inactive</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <button
          type="button"
          disabled={row.isActive}
          title={row.isActive ? 'Cannot delete an active year' : 'Delete'}
          className="rounded border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => void handleDelete(row.id)}
        >
          Delete
        </button>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AuthGuard>
      {() => (
        <main className="mx-auto max-w-5xl p-6 space-y-6">

          {/* Toast */}
          {toast && (
            <div className={`fixed top-20 right-6 z-50 flex items-center gap-2 rounded-xl border px-5 py-3 shadow-lg text-sm font-medium transition-all ${
              toast.type === 'success'
                ? 'bg-teal-50 border-teal-200 text-teal-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {toast.type === 'success' ? '✓' : '✕'} {toast.message}
            </div>
          )}

          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Academic Setup</h1>
              <p className="mt-0.5 text-sm text-slate-500">Manage academic years for your institution</p>
            </div>
            <div className="flex items-center gap-2">
              {years.length === 0 && !loading && (
                <button
                  type="button"
                  disabled={seeding}
                  onClick={() => void handleSeed()}
                  className="flex items-center gap-2 rounded-lg border border-teal-200 bg-white px-4 py-2 text-sm font-medium text-teal-700 shadow-sm hover:bg-teal-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {seeding ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <span>✨</span>
                  )}
                  {seeding ? 'Generating…' : 'Generate Sample Data'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-all shadow-sm"
              >
                {showForm ? '✕ Cancel' : '+ Add Year'}
              </button>
            </div>
          </div>

          {/* Add form */}
          {showForm && (
            <form
              onSubmit={(e) => void handleCreate(e)}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm grid grid-cols-1 gap-4 md:grid-cols-4"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Year Name</label>
                <input
                  required
                  pattern="^\d{4}-\d{4}$"
                  placeholder="e.g. 2026-2027"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Start Date</label>
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">End Date</label>
                <input
                  required
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-teal-600"
                  />
                  Set as Active
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="ml-auto rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-all disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}

          {/* Empty state */}
          {!loading && years.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
              <div className="text-4xl mb-3">🎓</div>
              <p className="text-base font-semibold text-slate-700">No academic years yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Click <strong>✨ Generate Sample Data</strong> to populate 3 years automatically, or add one manually.
              </p>
            </div>
          )}

          {/* Table */}
          {(loading || years.length > 0) && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <DataTable
                columns={columns}
                data={years}
                loading={loading}
                filters={null}
                page={1}
                pageSize={years.length || 10}
                total={years.length}
                onPageChange={() => {}}
                onPageSizeChange={() => {}}
              />
            </div>
          )}

        </main>
      )}
    </AuthGuard>
  );
}
