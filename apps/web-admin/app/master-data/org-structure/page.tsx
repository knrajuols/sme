'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────
interface Department {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  parentId: string | null;
  children?: { id: string; name: string; code: string; isActive: boolean }[];
}

interface EmployeeRole {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  systemCategory: string;
  department?: { id: string; name: string; code: string };
}

interface OrgData {
  departments: Department[];
  roles: EmployeeRole[];
}

// ── Tree helper ────────────────────────────────────────────────────────────
function flattenTree(depts: Department[]): { dept: Department; depth: number }[] {
  const byParent = new Map<string, Department[]>();
  for (const d of depts) {
    const key = d.parentId ?? '__root__';
    const list = byParent.get(key) ?? [];
    list.push(d);
    byParent.set(key, list);
  }
  const result: { dept: Department; depth: number }[] = [];
  function walk(parentKey: string, depth: number) {
    for (const d of byParent.get(parentKey) ?? []) {
      result.push({ dept: d, depth });
      walk(d.id, depth + 1);
    }
  }
  walk('__root__', 0);
  return result;
}

// ── Content ────────────────────────────────────────────────────────────────
function OrgStructureContent() {
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [seeding, setSeeding] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await bffFetch<OrgData>('/api/web-admin/org-structure');
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load org structure');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleSeed() {
    setSeeding(true);
    setError('');
    try {
      const res = await bffFetch<{ departments: number; roles: number }>(
        '/api/web-admin/org-structure/seed',
        { method: 'POST' },
      );
      setSuccessMsg(
        `Seeded ${res.departments} department${res.departments !== 1 ? 's' : ''} and ${res.roles} role${res.roles !== 1 ? 's' : ''}.`,
      );
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  }

  const deptRows = data ? flattenTree(data.departments) : [];

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Org Structure</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Master template departments, roles &amp; system categories.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSeed}
          disabled={seeding}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 transition-colors flex-shrink-0"
        >
          {seeding ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Seeding…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Seed Master Org Structure
            </>
          )}
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
      )}

      {!loading && data && (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Departments table */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-3">Departments</h2>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deptRows.map(({ dept, depth }) => (
                    <tr key={dept.id} className="hover:bg-slate-50/50 transition-colors">
                      <td
                        className="px-4 py-2.5 text-slate-900 font-medium"
                        style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
                      >
                        {depth > 0 && <span className="text-slate-300 mr-1.5">└</span>}
                        {dept.name}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {dept.code}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {deptRows.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-12 text-center text-sm text-slate-400">
                        No departments seeded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {data.departments.length} department{data.departments.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Roles table */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-3">Employee Roles</h2>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Dept</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.roles.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-900 font-medium">{r.name}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs">
                        {r.department?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                          {r.systemCategory}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.roles.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-sm text-slate-400">
                        No roles seeded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {data.roles.length} role{data.roles.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrgStructurePage() {
  return <AuthGuard>{() => <OrgStructureContent />}</AuthGuard>;
}
