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

interface AttendanceRecord {
  date: string;
  status: string;
}

// ── Content ───────────────────────────────────────────────────────────────────
function PortalAttendanceContent() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
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
        if (!cancelled) setError(e instanceof Error ? e.message : '[ERR-PRT-ATTN-5001] Failed to load student list');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-load attendance when student selection changes
  const loadAttendance = useCallback(async () => {
    if (!selectedStudentId) return;
    setRecordsLoading(true);
    setError('');
    try {
      const data = await apiRequest<AttendanceRecord[]>(
        `/portal/students/${encodeURIComponent(selectedStudentId)}/attendance`,
      );
      setRecords(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '[ERR-PRT-ATTN-5001] Failed to load attendance records');
    } finally {
      setRecordsLoading(false);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Attendance</h1>
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

      {/* Attendance table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="grand-table w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Date</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recordsLoading ? (
              <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-400">Loading attendance…</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-400">[ERR-PRT-ATTN-4004] No attendance records found.</td></tr>
            ) : (
              records.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{r.date}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.status?.toUpperCase() === 'PRESENT'
                          ? 'bg-green-100 text-green-700'
                          : r.status?.toUpperCase() === 'ABSENT'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.status}
                    </span>
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
export default function PortalAttendancePage() {
  return (
    <AuthGuard>
      {() => <PortalAttendanceContent />}
    </AuthGuard>
  );
}
