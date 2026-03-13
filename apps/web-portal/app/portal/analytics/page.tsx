'use client';

import { useCallback, useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { apiRequest } from '../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Student {
  id: string;
  fullName?: string;
  admissionNo?: string;
}

interface AnalyticsData {
  subject: string;
  averageScore?: number;
  attendanceRate?: number;
  rank?: number;
  totalStudents?: number;
}

// ── Content ───────────────────────────────────────────────────────────────────
function PortalAnalyticsContent() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-load students on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<Student[]>('/portal/students');
        if (cancelled) return;
        setStudents(data);
        if (data.length > 0) setSelectedStudentId(data[0].id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '[ERR-PRT-ANLY-5001] Failed to load student list');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-load analytics when student selection changes
  const loadAnalytics = useCallback(async () => {
    if (!selectedStudentId) return;
    setAnalyticsLoading(true);
    setError('');
    try {
      const data = await apiRequest<AnalyticsData[]>(
        `/portal/students/${encodeURIComponent(selectedStudentId)}/analytics`,
      );
      setAnalytics(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '[ERR-PRT-ANLY-5001] Failed to load analytics data');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Analytics</h1>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          PARENT
        </span>
      </div>

      {/* Student selector */}
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-slate-600">Student</label>
        <select
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          value={selectedStudentId}
          onChange={(e) => setSelectedStudentId(e.target.value)}
          disabled={loading}
        >
          {loading ? (
            <option>Loading…</option>
          ) : students.length === 0 ? (
            <option>No students linked</option>
          ) : (
            students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName ?? s.admissionNo ?? s.id}
              </option>
            ))
          )}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Analytics table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="grand-table w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Subject</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Avg. Score</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Attendance</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Rank</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {analyticsLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Loading analytics…</td></tr>
            ) : analytics.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">[ERR-PRT-ANLY-4004] No analytics available.</td></tr>
            ) : (
              analytics.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{row.subject}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {row.averageScore != null ? row.averageScore.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.attendanceRate != null ? (
                      <span className={`font-medium ${
                        row.attendanceRate >= 90
                          ? 'text-green-600'
                          : row.attendanceRate >= 75
                            ? 'text-amber-600'
                            : 'text-red-600'
                      }`}>
                        {row.attendanceRate.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {row.rank != null
                      ? `${row.rank}${row.totalStudents ? ` / ${row.totalStudents}` : ''}`
                      : '—'}
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
export default function PortalAnalyticsPage() {
  return (
    <AuthGuard>
      {() => <PortalAnalyticsContent />}
    </AuthGuard>
  );
}
