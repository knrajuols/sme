'use client';

import { useCallback, useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { apiRequest } from '../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ClassSection {
  id: string;
  className: string;
  section?: string;
}

interface AnalyticsSummary {
  classId: string;
  className: string;
  section?: string;
  totalStudents: number;
  averageAttendance?: number;
  averageScore?: number;
  passRate?: number;
}

// ── Content ───────────────────────────────────────────────────────────────────
function AdminAnalyticsContent() {
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [summary, setSummary] = useState<AnalyticsSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<ClassSection[]>('/school/classes');
        if (cancelled) return;
        setClasses(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '[ERR-SCH-ANLY-5001] Failed to load class list');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadAnalytics = useCallback(async () => {
    setSummaryLoading(true);
    setError('');
    try {
      const params = selectedClassId
        ? `?classId=${encodeURIComponent(selectedClassId)}`
        : '';
      const data = await apiRequest<AnalyticsSummary[]>(`/school/analytics${params}`);
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '[ERR-SCH-ANLY-5001] Failed to load analytics data');
    } finally {
      setSummaryLoading(false);
    }
  }, [selectedClassId]);

  // Auto-fetch on mount and whenever the class filter changes
  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">School Analytics</h1>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          SCHOOL ADMIN
        </span>
      </div>

      {/* Filter */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Filter by Class</label>
          <select
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            disabled={loading}
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.className}{c.section ? ` – ${c.section}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Analytics table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="grand-table w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Class</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Students</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Avg. Attendance</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Avg. Score</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Pass Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {summaryLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading analytics…</td></tr>
            ) : summary.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">[ERR-SCH-ANLY-4004] No analytics data available.</td></tr>
            ) : (
              summary.map((row) => (
                <tr key={row.classId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {row.className}{row.section ? ` – ${row.section}` : ''}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{row.totalStudents}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {row.averageAttendance != null ? `${row.averageAttendance.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {row.averageScore != null ? row.averageScore.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.passRate != null ? (
                      <span className={`font-medium ${row.passRate >= 80 ? 'text-green-600' : row.passRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {row.passRate.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Page export (strict naming) ───────────────────────────────────────────────
export default function AdminAnalyticsPage() {
  return (
    <AuthGuard>
      {() => <AdminAnalyticsContent />}
    </AuthGuard>
  );
}
