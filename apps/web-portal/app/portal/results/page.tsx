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

interface ResultRecord {
  subject: string;
  totalMarks: number;
  obtainedMarks: number;
  grade?: string;
}

// ── Content ───────────────────────────────────────────────────────────────────
function PortalResultsContent() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
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
        if (!cancelled) setError(e instanceof Error ? e.message : '[ERR-PRT-RSLT-5001] Failed to load student list');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-load results when student selection changes
  const loadResults = useCallback(async () => {
    if (!selectedStudentId) return;
    setResultsLoading(true);
    setError('');
    try {
      const data = await apiRequest<ResultRecord[]>(
        `/portal/students/${encodeURIComponent(selectedStudentId)}/results`,
      );
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '[ERR-PRT-RSLT-5001] Failed to load result records');
    } finally {
      setResultsLoading(false);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Results</h1>
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

      {/* Results table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="grand-table w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Subject</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Total</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Obtained</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">%</th>
              <th className="px-4 py-3 font-medium text-slate-600">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {resultsLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading results…</td></tr>
            ) : results.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">[ERR-PRT-RSLT-4004] No results available.</td></tr>
            ) : (
              results.map((r, i) => {
                const pct = r.totalMarks > 0 ? (r.obtainedMarks / r.totalMarks) * 100 : 0;
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.subject}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.totalMarks}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.obtainedMarks}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{pct.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      {r.grade ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.grade === 'A' || r.grade === 'A+'
                            ? 'bg-green-100 text-green-700'
                            : r.grade === 'B' || r.grade === 'B+'
                              ? 'bg-blue-100 text-blue-700'
                              : r.grade === 'C'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                        }`}>
                          {r.grade}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Page export (strict naming) ───────────────────────────────────────────────
export default function PortalResultsPage() {
  return (
    <AuthGuard>
      {() => <PortalResultsContent />}
    </AuthGuard>
  );
}
