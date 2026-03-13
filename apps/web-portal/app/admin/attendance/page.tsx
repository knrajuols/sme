'use client';

import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PremiumCard } from '../../../components/ui/PremiumCard';

// ── Reference types ────────────────────────────────────────────────────────────
interface YearRef    { id: string; name: string; }
interface ClassRef   { id: string; name: string; code: string; academicYearId: string; }
interface SectionRef { id: string; name: string; classId: string; }
interface StudentRef { id: string; admissionNumber: string; firstName: string; lastName: string; }

// ── Data types ─────────────────────────────────────────────────────────────────
interface EnrollmentRef        { id: string; studentId: string; classId: string; sectionId: string; rollNumber: string; }
interface AttendanceSessionRow { id: string; date: string; classId: string; sectionId: string; academicYearId: string; status: string; }
interface SessionWithRecords extends AttendanceSessionRow {
  records: Array<{ id: string; studentId: string; status: string; remarks?: string }>;
}

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

const STATUS_OPTIONS: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-100 text-green-800 border-green-300',
  ABSENT:  'bg-red-100  text-red-800  border-red-300',
  LATE:    'bg-yellow-100 text-yellow-800 border-yellow-300',
  EXCUSED: 'bg-blue-100 text-blue-800 border-blue-300',
};

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Page component ─────────────────────────────────────────────────────────────
function AttendancePage({ user: _user }: { user: UserClaims }) {
  // Reference data
  const [years,    setYears]    = useState<YearRef[]>([]);
  const [classes,  setClasses]  = useState<ClassRef[]>([]);
  const [sections, setSections] = useState<SectionRef[]>([]);
  const [students, setStudents] = useState<StudentRef[]>([]);

  // Filter state
  const [date,           setDate]           = useState(todayDate());
  const [classId,        setClassId]        = useState('');
  const [sectionId,      setSectionId]      = useState('');
  const [academicYearId, setAcademicYearId] = useState('');

  // Student / attendance state
  const [enrollments,       setEnrollments]       = useState<EnrollmentRef[]>([]);
  const [records,           setRecords]           = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [existingSessionId, setExistingSessionId] = useState<string | null>(null);

  // UI state
  const [loadingRef,      setLoadingRef]      = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [banner,          setBanner]          = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Load reference data once on mount
  useEffect(() => {
    Promise.all([
      bffFetch<YearRef[]>('/api/academic-setup/years'),
      bffFetch<ClassRef[]>('/api/academic-setup/classes'),
      bffFetch<SectionRef[]>('/api/academic-setup/sections'),
      bffFetch<StudentRef[]>('/api/academic/students'),
    ])
      .then(([y, c, s, st]) => { setYears(y); setClasses(c); setSections(s); setStudents(st); })
      .catch(() => {})
      .finally(() => setLoadingRef(false));
  }, []);

  // Sections filtered by selected class
  const filteredSections = useMemo(
    () => sections.filter((s) => !classId || s.classId === classId),
    [sections, classId],
  );

  // Quick lookup: studentId → StudentRef
  const studentMap = useMemo(() => {
    const m: Record<string, StudentRef> = {};
    for (const s of students) m[s.id] = s;
    return m;
  }, [students]);

  function handleClassChange(cid: string) {
    setClassId(cid);
    setSectionId('');
    setEnrollments([]);
    setRecords({});
    setExistingSessionId(null);
  }

  // Auto-load students + check existing session when class / section / date change
  useEffect(() => {
    if (!classId || !sectionId || !date) {
      setEnrollments([]);
      setRecords({});
      setExistingSessionId(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoadingStudents(true);
      try {
        const [enrs, sessions] = await Promise.all([
          bffFetch<EnrollmentRef[]>(`/api/academic/enrollments?classId=${classId}&sectionId=${sectionId}`),
          bffFetch<AttendanceSessionRow[]>(
            `/api/academic/attendance/sessions?classId=${classId}&sectionId=${sectionId}&date=${date}`,
          ),
        ]);
        if (cancelled) return;

        // Build default records (all PRESENT)
        const defaults: Record<string, { status: AttendanceStatus; remarks: string }> = {};
        for (const e of enrs) defaults[e.studentId] = { status: 'PRESENT', remarks: '' };

        if (sessions.length > 0) {
          try {
            const sess = await bffFetch<SessionWithRecords>(
              `/api/academic/attendance/sessions/${sessions[0].id}`,
            );
            if (!cancelled) {
              setExistingSessionId(sess.id);
              for (const r of sess.records) {
                if (defaults[r.studentId]) {
                  defaults[r.studentId] = { status: r.status as AttendanceStatus, remarks: r.remarks ?? '' };
                }
              }
            }
          } catch { /* fall back to defaults */ }
        } else {
          if (!cancelled) setExistingSessionId(null);
        }

        if (!cancelled) {
          setEnrollments(enrs);
          setRecords(defaults);
        }
      } catch {
        if (!cancelled) {
          setBanner({ type: 'error', msg: 'Failed to load students for this class/section.' });
          setEnrollments([]);
        }
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [classId, sectionId, date]);

  function setRecord(studentId: string, field: 'status' | 'remarks', value: string) {
    setRecords((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  }

  async function handleSave() {
    if (!date || !classId || !sectionId || !academicYearId) {
      setBanner({ type: 'error', msg: 'Please fill in Date, Class, Section, and Academic Year before saving.' });
      return;
    }
    if (enrollments.length === 0) {
      setBanner({ type: 'error', msg: 'No students enrolled in this class/section to mark attendance for.' });
      return;
    }

    setSaving(true);
    setBanner(null);
    try {
      const payload = {
        date,
        classId,
        sectionId,
        academicYearId,
        records: enrollments.map((e) => ({
          studentId: e.studentId,
          status:    records[e.studentId]?.status  ?? 'PRESENT',
          ...(records[e.studentId]?.remarks?.trim() ? { remarks: records[e.studentId].remarks.trim() } : {}),
        })),
      };
      await bffFetch<{ sessionId: string }>('/api/academic/attendance/bulk', {
        method: 'POST',
        body:   JSON.stringify(payload),
      });
      setBanner({
        type: 'success',
        msg:  `Attendance saved for ${enrollments.length} student${enrollments.length !== 1 ? 's' : ''}.`,
      });
    } catch (e) {
      setBanner({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to save attendance.' });
    } finally {
      setSaving(false);
    }
  }

  const selectCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-400 transition-colors';

  if (loadingRef) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-500 mt-1">Mark daily attendance for a class and section.</p>
        </div>

        {/* ── Banner ─────────────────────────────────────────────────────── */}
        {banner && (
          <div className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium
            ${banner.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
            <span className="flex-1">{banner.msg}</span>
            <button type="button" onClick={() => setBanner(null)}
              className="text-current opacity-60 hover:opacity-100 leading-none">✕</button>
          </div>
        )}

        {/* ── Filter Bar ─────────────────────────────────────────────────── */}
        <PremiumCard accentColor="yellow" className="p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Date <span className="text-red-500">*</span>
              </label>
              <input type="date" className={selectCls} value={date}
                max={todayDate()}
                onChange={(e) => setDate(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Academic Year <span className="text-red-500">*</span>
              </label>
              <select className={selectCls} value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}>
                <option value="">— select year —</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Class <span className="text-red-500">*</span>
              </label>
              <select className={selectCls} value={classId}
                onChange={(e) => handleClassChange(e.target.value)}>
                <option value="">— select class —</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Section <span className="text-red-500">*</span>
              </label>
              <select className={selectCls} value={sectionId}
                disabled={!classId}
                onChange={(e) => setSectionId(e.target.value)}>
                <option value="">— select section —</option>
                {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {!classId && <p className="mt-1 text-xs text-slate-400">Select a class first.</p>}
            </div>
          </div>
        </PremiumCard>

        {/* ── Student Grid ───────────────────────────────────────────────── */}
        {loadingStudents ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
            <p className="text-sm text-slate-500">Loading students…</p>
          </div>

        ) : enrollments.length === 0 && classId && sectionId ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
            <p className="text-sm text-slate-500">No students enrolled in this class and section.</p>
          </div>

        ) : enrollments.length > 0 ? (
          <>
            {/* ── Desktop table ────────────────────────────────────────── */}
            <PremiumCard accentColor="blue" className="overflow-hidden hidden sm:block mb-6">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Student Attendance</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {existingSessionId
                      ? 'Editing saved attendance — save again to update.'
                      : 'New attendance session — save to record.'}
                  </p>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                  {enrollments.length} student{enrollments.length !== 1 ? 's' : ''}
                </span>
              </div>

              <table className="grand-table w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Student</th>
                    <th className="px-5 py-3 text-left font-semibold">Admission No.</th>
                    <th className="px-5 py-3 text-left font-semibold">Status</th>
                    <th className="px-5 py-3 text-left font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrollments.map((e) => {
                    const stu = studentMap[e.studentId];
                    const rec = records[e.studentId] ?? { status: 'PRESENT' as AttendanceStatus, remarks: '' };
                    return (
                      <tr key={e.studentId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800">
                          {stu ? `${stu.firstName} ${stu.lastName}` : e.studentId}
                        </td>
                        <td className="px-5 py-3 text-slate-500 font-mono text-xs">
                          {stu?.admissionNumber ?? '—'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {STATUS_OPTIONS.map((s) => (
                              <button key={s} type="button"
                                onClick={() => setRecord(e.studentId, 'status', s)}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all
                                  ${rec.status === s
                                    ? STATUS_COLORS[s]
                                    : 'border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600'}`}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <input type="text"
                            className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="Optional note…"
                            maxLength={500}
                            value={rec.remarks}
                            onChange={(ev) => setRecord(e.studentId, 'remarks', ev.target.value)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </PremiumCard>

            {/* ── Mobile card stack ─────────────────────────────────────── */}
            <div className="sm:hidden space-y-3 mb-6">
              {enrollments.map((e) => {
                const stu = studentMap[e.studentId];
                const rec = records[e.studentId] ?? { status: 'PRESENT' as AttendanceStatus, remarks: '' };
                return (
                  <div key={e.studentId} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="mb-3">
                      <p className="font-semibold text-slate-800 text-sm">
                        {stu ? `${stu.firstName} ${stu.lastName}` : e.studentId}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">{stu?.admissionNumber ?? '—'}</p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {STATUS_OPTIONS.map((s) => (
                        <button key={s} type="button"
                          onClick={() => setRecord(e.studentId, 'status', s)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all
                            ${rec.status === s ? STATUS_COLORS[s] : 'border-slate-200 text-slate-400'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <input type="text"
                      className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="Optional note…"
                      maxLength={500}
                      value={rec.remarks}
                      onChange={(ev) => setRecord(e.studentId, 'remarks', ev.target.value)} />
                  </div>
                );
              })}
            </div>

            {/* ── Save button ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
              {!academicYearId && (
                <p className="text-xs text-amber-600 font-medium">Select an Academic Year to enable saving.</p>
              )}
              <div className="ml-auto">
                <button type="button" onClick={handleSave}
                  disabled={saving || !academicYearId}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2">
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Saving…
                    </>
                  ) : 'Save Attendance'}
                </button>
              </div>
            </div>
          </>

        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
            <p className="text-sm text-slate-500">Select a date, class, and section to load students.</p>
          </div>
        )}

      </div>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      {(user) => <AttendancePage user={user} />}
    </AuthGuard>
  );
}
