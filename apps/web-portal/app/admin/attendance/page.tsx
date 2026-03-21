'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { DateInput } from '../../../components/ui/DateInput';
import { PremiumCard } from '../../../components/ui/PremiumCard';

// ── Reference types ────────────────────────────────────────────────────────────
interface YearRef      { id: string; name: string; }
interface ClassRef     { id: string; name: string; code: string; academicYearId: string; }
interface SectionRef   { id: string; name: string; classId: string; className: string; sectionId: string; sectionName: string; }
interface StudentRef   { id: string; admissionNumber: string; firstName: string; lastName: string; }
interface EnrollRef    { id: string; studentId: string; classId: string; sectionId: string; rollNumber: string; }
interface TeacherRef   { id: string; firstName: string | null; lastName: string | null; employeeCode: string; designation: string; }

// ── Blob types ─────────────────────────────────────────────────────────────────
// H = Holiday (system-assigned, school closed)  HL = Half-Day Leave (student-initiated)
type AttendanceStatus = 'P' | 'OD' | 'SL' | 'CL' | 'HL' | 'H' | 'A';
interface StudentBlobEntry { s: AttendanceStatus; r?: string; }
interface TeacherBlobEntry { s: AttendanceStatus; in?: string; out?: string; }

interface BlobData {
  students: Record<string, StudentBlobEntry>;
  teachers: Record<string, TeacherBlobEntry>;
}

// ── Attendance Log response ────────────────────────────────────────────────────
interface AttendanceLogRow {
  id: string; date: string; classId: string; sectionId: string;
  academicYearId: string; attendanceBlob: string; status: number;
  holidayInfo?: HolidayInfo | null;
}

// ── Holiday info (returned alongside log) ──────────────────────────────────────
interface HolidayInfo {
  isHoliday: boolean;
  isFullDay: boolean;
  isFirstHalf: boolean;
  isSecondHalf: boolean;
  occasion: string;
  type: string;
  source: string;
}

// ── Status labels & colours ────────────────────────────────────────────────────
// Clickable statuses (buttons in the grid).
// "H" (Holiday) is system-assigned and never shown as a clickable button.
const ALL_STATUSES: AttendanceStatus[] = ['P', 'OD', 'SL', 'CL', 'HL', 'A'];
const STATUS_LABELS: Record<AttendanceStatus, string> = {
  P: 'Present', OD: 'On Duty', SL: 'Sick Leave', CL: 'Casual Leave',
  HL: 'Half-Day Leave', H: 'Holiday', A: 'Absent',
};
const STATUS_COLORS: Record<AttendanceStatus, string> = {
  P:  'bg-green-500 text-white',
  OD: 'bg-indigo-500 text-white',
  SL: 'bg-orange-500 text-white',
  CL: 'bg-purple-500 text-white',
  HL: 'bg-cyan-600 text-white',
  H:  'bg-amber-500 text-white',
  A:  'bg-red-500 text-white',
};
const STATUS_IDLE: Record<AttendanceStatus, string> = {
  P:  'border-green-300 text-green-700 hover:bg-green-50',
  OD: 'border-indigo-300 text-indigo-700 hover:bg-indigo-50',
  SL: 'border-orange-300 text-orange-700 hover:bg-orange-50',
  CL: 'border-purple-300 text-purple-700 hover:bg-purple-50',
  HL: 'border-cyan-300 text-cyan-700 hover:bg-cyan-50',
  H:  'border-amber-300 text-amber-700 hover:bg-amber-50',
  A:  'border-red-300 text-red-700 hover:bg-red-50',
};

function todayDate(): string { return new Date().toISOString().slice(0, 10); }

// ── State persistence ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'sme_attendance_log_filters';
function saveFilters(date: string, classId: string, sectionId: string) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ date, classId, sectionId })); } catch { /* noop */ }
}
function loadFilters(): { date: string; classId: string; sectionId: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// ── Main component ─────────────────────────────────────────────────────────────
function AttendancePage({ user: _user }: { user: UserClaims }) {
  // Reference data
  const [years,    setYears]    = useState<YearRef[]>([]);
  const [classes,  setClasses]  = useState<ClassRef[]>([]);
  const [sections, setSections] = useState<SectionRef[]>([]);
  const [students, setStudents] = useState<StudentRef[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollRef[]>([]);
  const [teachers, setTeachers] = useState<TeacherRef[]>([]);

  // Filter state
  const [date,           setDate]           = useState(todayDate());
  const [classId,        setClassId]        = useState('');
  const [sectionId,      setSectionId]      = useState('');
  const [academicYearId, setAcademicYearId] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState<'students' | 'teachers'>('students');

  // Blob state
  const [studentBlob, setStudentBlob] = useState<Record<string, StudentBlobEntry>>({});
  const [teacherBlob, setTeacherBlob] = useState<Record<string, TeacherBlobEntry>>({});
  const [logId,  setLogId]  = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [holidayInfo, setHolidayInfo] = useState<HolidayInfo | null>(null);

  // UI
  const [loadingRef, setLoadingRef] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [banner,  setBanner]  = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const restoredRef = useRef(false);

  function showBanner(type: 'success' | 'error', msg: string) {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 5000);
  }

  // ── Load reference data once ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      bffFetch<YearRef[]>('/api/academic-setup/years'),
      bffFetch<ClassRef[]>('/api/academic-setup/classes'),
      bffFetch<TeacherRef[]>('/api/academic/teachers'),
    ])
      .then(([yr, cls, tch]) => {
        setYears(yr);
        setClasses(cls);
        setTeachers(tch.filter((t) => t.firstName)); // only named teachers

        // Restore persisted filters
        const saved = loadFilters();
        if (saved) {
          if (saved.date) setDate(saved.date);
          if (saved.classId && cls.some((c) => c.id === saved.classId)) {
            setClassId(saved.classId);
            restoredRef.current = true;
          }
        }
      })
      .catch(() => showBanner('error', 'Failed to load reference data.'))
      .finally(() => setLoadingRef(false));
  }, []);

  // Sections are already filtered by classId from the API
  const filteredSections = sections;

  // ── When class changes → load sections ───────────────────────────────────
  useEffect(() => {
    setSectionId('');
    setStudents([]);
    setEnrollments([]);
    resetGrid();

    if (!classId) return;

    // Derive academicYearId from class
    const cls = classes.find((c) => c.id === classId);
    if (cls) setAcademicYearId(cls.academicYearId);

    bffFetch<SectionRef[]>(`/api/academic/class-sections?classId=${classId}`)
      .then((secs) => {
        setSections(secs);
        if (restoredRef.current) {
          const saved = loadFilters();
          if (saved?.sectionId && secs.some((s) => s.sectionId === saved.sectionId)) {
            setSectionId(saved.sectionId);
          }
          restoredRef.current = false;
        }
      })
      .catch(() => showBanner('error', 'Failed to load sections.'));
  }, [classId, classes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist filters ──────────────────────────────────────────────────────
  useEffect(() => {
    if (date || classId) saveFilters(date, classId, sectionId);
  }, [date, classId, sectionId]);

  // ── Reset grid ───────────────────────────────────────────────────────────
  function resetGrid() {
    setStudentBlob({});
    setTeacherBlob({});
    setLogId(null);
    setLocked(false);
    setHolidayInfo(null);
  }

  // ── Load students + existing blob ────────────────────────────────────────
  const loadGrid = useCallback(async () => {
    if (!date || !classId || !sectionId) return;
    setLoadingGrid(true);
    setBanner(null);
    resetGrid();

    try {
      // Parallel: enrollments + existing log
      const [enrollRows, logRow] = await Promise.all([
        bffFetch<EnrollRef[]>(`/api/academic/enrollments?classId=${classId}&sectionId=${sectionId}`),
        bffFetch<AttendanceLogRow | null>(`/api/academic/attendance/log?date=${date}&classId=${classId}&sectionId=${sectionId}`),
      ]);

      setEnrollments(enrollRows);

      // Extract holiday info from the log response
      const holInfo = logRow?.holidayInfo ?? null;
      setHolidayInfo(holInfo);

      // Fetch student details
      const studentIds = enrollRows.map((e) => e.studentId);
      if (studentIds.length > 0) {
        const stuRows = await bffFetch<StudentRef[]>('/api/academic/students');
        setStudents(stuRows.filter((s) => studentIds.includes(s.id)));
      }

      // If it's a full-day holiday and no log exists yet, auto-set students to H (Holiday)
      const isFullHoliday = holInfo?.isHoliday && holInfo?.isFullDay;

      // Hydrate blob if existing log found
      if (logRow && logRow.attendanceBlob) {
        const blob = JSON.parse(logRow.attendanceBlob) as BlobData;
        setStudentBlob(blob.students ?? {});
        setTeacherBlob(blob.teachers ?? {});
        setLogId(logRow.id);
        setLocked(logRow.status === 1);
      } else if (isFullHoliday) {
        // Full Holiday: auto-mark all students as H (Holiday — school closed)
        const defaultBlob: Record<string, StudentBlobEntry> = {};
        for (const e of enrollRows) {
          defaultBlob[e.studentId] = { s: 'H' };
        }
        setStudentBlob(defaultBlob);

        // Teachers default to P — they may be called for admin/training work
        const defaultTeacherBlob: Record<string, TeacherBlobEntry> = {};
        for (const t of teachers) {
          defaultTeacherBlob[t.id] = { s: 'P', in: '', out: '' };
        }
        setTeacherBlob(defaultTeacherBlob);
      } else {
        // Default: mark all students as Present
        const defaultBlob: Record<string, StudentBlobEntry> = {};
        for (const e of enrollRows) {
          defaultBlob[e.studentId] = { s: 'P' };
        }
        setStudentBlob(defaultBlob);

        // Default: mark all teachers as Present
        const defaultTeacherBlob: Record<string, TeacherBlobEntry> = {};
        for (const t of teachers) {
          defaultTeacherBlob[t.id] = { s: 'P', in: '', out: '' };
        }
        setTeacherBlob(defaultTeacherBlob);
      }
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Failed to load attendance grid.');
    } finally {
      setLoadingGrid(false);
    }
  }, [date, classId, sectionId, teachers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Student status toggle ────────────────────────────────────────────────
  function toggleStudentStatus(studentId: string, status: AttendanceStatus) {
    if (locked || isFullHoliday) return;
    setStudentBlob((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], s: status },
    }));
  }

  // ── Teacher status toggle ────────────────────────────────────────────────
  function toggleTeacherStatus(teacherId: string, status: AttendanceStatus) {
    if (locked) return; // Teachers can Swipe-In on holidays (admin work / training)
    setTeacherBlob((prev) => {
      const existing = prev[teacherId] ?? { s: 'A' as AttendanceStatus };
      const updated = { ...existing, s: status };
      // Send AUTO sentinel — server will inject authoritative timestamp
      if (status === 'P' && !existing.in) {
        updated.in = 'AUTO';
      }
      // Clear swipe data when marking Absent
      if (status === 'A') {
        delete updated.in;
        delete updated.out;
      }
      return { ...prev, [teacherId]: updated };
    });
  }

  // ── Teacher swipe time update ────────────────────────────────────────────
  function setTeacherSwipe(teacherId: string, field: 'in' | 'out', value: string) {
    if (locked) return; // Teachers can Swipe-In on holidays
    setTeacherBlob((prev) => ({
      ...prev,
      [teacherId]: { ...prev[teacherId], [field]: value },
    }));
  }

  // ── Mark All Present ─────────────────────────────────────────────────────
  function markAllStudentsPresent() {
    if (locked || isFullHoliday) return;
    const newBlob: Record<string, StudentBlobEntry> = {};
    for (const e of enrollments) {
      newBlob[e.studentId] = { ...(studentBlob[e.studentId] ?? {}), s: 'P' as AttendanceStatus };
    }
    setStudentBlob(newBlob);
  }

  function markAllTeachersPresent() {
    if (locked) return; // Teachers can mark present on holidays
    const newBlob: Record<string, TeacherBlobEntry> = {};
    for (const t of teachers) {
      newBlob[t.id] = { ...(teacherBlob[t.id] ?? {}), s: 'P' as AttendanceStatus };
    }
    setTeacherBlob(newBlob);
  }

  // ── Save blob ────────────────────────────────────────────────────────────
  const saveBlob = useCallback(async () => {
    if (!date || !classId || !sectionId || !academicYearId) return;
    setSaving(true);
    setBanner(null);

    const blob: BlobData = { students: studentBlob, teachers: teacherBlob };

    try {
      const result = await bffFetch<{ id: string; created: boolean }>('/api/academic/attendance/log', {
        method: 'POST',
        body: JSON.stringify({
          date,
          classId,
          sectionId,
          academicYearId,
          attendanceBlob: JSON.stringify(blob),
        }),
      });
      setLogId(result.id);
      showBanner('success', result.created ? 'Attendance saved successfully.' : 'Attendance updated successfully.');
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  }, [date, classId, sectionId, academicYearId, studentBlob, teacherBlob]);

  // ── Lock / Unlock ────────────────────────────────────────────────────────
  const toggleLock = useCallback(async () => {
    if (!logId) {
      showBanner('error', 'Save attendance first before locking.');
      return;
    }
    setSaving(true);
    try {
      const newLockState = !locked;
      await bffFetch<{ id: string; status: number }>(`/api/academic/attendance/log/${logId}/lock?lock=${newLockState}`, {
        method: 'POST',
      });
      setLocked(newLockState);
      showBanner('success', newLockState ? 'Attendance locked — read-only mode.' : 'Attendance unlocked — editable.');
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Failed to update lock.');
    } finally {
      setSaving(false);
    }
  }, [logId, locked]);

  // ── Derived: student enrollment lookup ───────────────────────────────────
  const enrollMap = useMemo(() => {
    const m = new Map<string, EnrollRef>();
    for (const e of enrollments) m.set(e.studentId, e);
    return m;
  }, [enrollments]);

  // ── Derived: sorted students by roll number ──────────────────────────────
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const ra = enrollMap.get(a.id)?.rollNumber ?? '';
      const rb = enrollMap.get(b.id)?.rollNumber ?? '';
      const na = parseInt(ra, 10);
      const nb = parseInt(rb, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return ra.localeCompare(rb);
    });
  }, [students, enrollMap]);

  // ── Derived: summary counts ──────────────────────────────────────────────
  const studentCounts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { P: 0, OD: 0, SL: 0, CL: 0, HL: 0, H: 0, A: 0 };
    for (const entry of Object.values(studentBlob)) {
      if (entry.s in c) c[entry.s]++;
    }
    return c;
  }, [studentBlob]);

  const canLoad = !!(date && classId && sectionId);
  const hasGrid = enrollments.length > 0;
  const isFullHoliday = !!(holidayInfo?.isHoliday && holidayInfo?.isFullDay);
  const isHalfHoliday = !!(holidayInfo?.isHoliday && !holidayInfo?.isFullDay && (holidayInfo?.isFirstHalf || holidayInfo?.isSecondHalf));
  const halfHolidayLabel = holidayInfo?.isFirstHalf ? 'First Half Off' : 'Second Half Off';
  // Student controls: locked OR full holiday
  // Teacher controls: locked only (staff may be called for admin/training on holidays)
  const studentControlsDisabled = locked || isFullHoliday;
  const teacherControlsDisabled = locked;

  // ── Render ───────────────────────────────────────────────────────────────
  if (loadingRef) {
    return <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>;
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Daily Attendance</h1>
        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
          EVENT-BLOB
        </span>
      </div>

      {/* Banner */}
      {banner && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
          banner.type === 'success'
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {banner.msg}
        </div>
      )}

      {/* Full-Day Holiday Banner */}
      {isFullHoliday && (
        <div className="mb-4 rounded-lg border-2 border-amber-400 bg-amber-50 px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">🏖️</span>
          <div>
            <p className="text-sm font-bold text-amber-800">
              Full Holiday — {holidayInfo?.occasion}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Today is a full-day holiday ({holidayInfo?.type}). Student attendance is auto-marked as <strong>H</strong> (Holiday).
              Teacher attendance is still active for admin work or training.
            </p>
          </div>
        </div>
      )}

      {/* Half-Day Holiday Banner */}
      {isHalfHoliday && (
        <div className="mb-4 rounded-lg border-2 border-sky-300 bg-sky-50 px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">⏰</span>
          <div>
            <p className="text-sm font-bold text-sky-800">
              Half Holiday — {holidayInfo?.occasion} ({halfHolidayLabel})
            </p>
            <p className="text-xs text-sky-600 mt-0.5">
              Attendance can still be marked for the working half of the day.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <PremiumCard accentColor="blue" className="p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Date */}
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
            <DateInput
              value={date}
              onValueChange={(v) => { setDate(v); resetGrid(); }}
              maxDate={todayDate()}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Class */}
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Class</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">— Select Class —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Section</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={sectionId}
              onChange={(e) => { setSectionId(e.target.value); resetGrid(); }}
              disabled={filteredSections.length === 0}
            >
              <option value="">— Select Section —</option>
              {filteredSections.map((s) => (
                <option key={s.sectionId} value={s.sectionId}>{s.sectionName}</option>
              ))}
            </select>
          </div>

          {/* Load button */}
          <div className="flex items-end gap-2">
            <button
              onClick={loadGrid}
              disabled={!canLoad || loadingGrid}
              className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingGrid ? 'Loading…' : 'Load Attendance'}
            </button>
          </div>
        </div>
      </PremiumCard>

      {/* Grid area */}
      {hasGrid && (
        <>
          {/* Summary bar + actions */}
          <PremiumCard accentColor="yellow" className="p-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Counts */}
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded bg-green-100 px-2 py-1 text-green-800">P: {studentCounts.P}</span>
                <span className="rounded bg-indigo-100 px-2 py-1 text-indigo-800">OD: {studentCounts.OD}</span>
                <span className="rounded bg-orange-100 px-2 py-1 text-orange-800">SL: {studentCounts.SL}</span>
                <span className="rounded bg-purple-100 px-2 py-1 text-purple-800">CL: {studentCounts.CL}</span>
                <span className="rounded bg-cyan-100 px-2 py-1 text-cyan-800">HL: {studentCounts.HL}</span>
                {studentCounts.H > 0 && (
                  <span className="rounded bg-amber-100 px-2 py-1 text-amber-800">H: {studentCounts.H}</span>
                )}
                <span className="rounded bg-red-100 px-2 py-1 text-red-800">A: {studentCounts.A}</span>
                <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">Total: {enrollments.length}</span>
              </div>

              <div className="ml-auto flex gap-2">
                {/* Mark All Present — hidden when locked; hidden for students on full holiday */}
                {!locked && !(isFullHoliday && activeTab === 'students') && (
                  <button
                    onClick={activeTab === 'students' ? markAllStudentsPresent : markAllTeachersPresent}
                    className="rounded-lg border border-green-400 bg-green-50 px-4 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                  >
                    Mark All Present
                  </button>
                )}

                {/* Save — hidden when locked; visible on holidays for teacher attendance */}
                {!locked && !(isFullHoliday && activeTab === 'students') && (
                  <button
                    onClick={saveBlob}
                    disabled={saving}
                    className="rounded-lg bg-teal-600 px-5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                )}

                {/* Lock / Unlock — hidden when viewing students on full holiday */}
                {!(isFullHoliday && activeTab === 'students') && (
                <button
                  onClick={locked ? undefined : toggleLock}
                  disabled={saving || locked}
                  className={`rounded-lg px-4 py-1.5 text-xs font-medium shadow-sm transition disabled:cursor-not-allowed ${
                    locked
                      ? 'bg-slate-400 text-white cursor-not-allowed'
                      : 'border border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100'
                  } ${saving ? 'opacity-50' : ''}`}
                >
                  {locked ? '🔒 Attendance Locked' : '🔓 Lock Attendance'}
                </button>
                )}
              </div>
            </div>
          </PremiumCard>

          {/* Tabs */}
          <div className="mb-4 flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('students')}
              className={`px-6 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === 'students'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Students ({enrollments.length})
            </button>
            <button
              onClick={() => setActiveTab('teachers')}
              className={`px-6 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === 'teachers'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Teachers ({teachers.length})
            </button>
          </div>

          {/* Locked banner */}
          {locked && !isFullHoliday && (
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-700 flex items-center gap-2">
              <span>🔒</span>
              <span>Attendance is <strong>locked</strong>. Unlock to make changes.</span>
            </div>
          )}

          {/* ── Student Grid ────────────────────────────────────────────── */}
          {activeTab === 'students' && (
            <PremiumCard accentColor="purple" className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/60">
                    <tr>
                      <th className="px-3 py-3 font-semibold text-slate-700 text-center w-12">#</th>
                      <th className="px-3 py-3 font-semibold text-slate-700 w-48">Student</th>
                      <th className="px-3 py-3 font-semibold text-slate-700 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((stu, idx) => {
                      const entry = studentBlob[stu.id] ?? { s: 'P' as AttendanceStatus };
                      const roll = enrollMap.get(stu.id)?.rollNumber ?? '';
                      return (
                        <tr key={stu.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                          <td className="px-3 py-2 text-center text-slate-500 text-xs">{roll || idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-800 text-sm whitespace-nowrap">
                            {stu.firstName} {stu.lastName}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-center gap-1.5">
                              {/* Show "H" badge if student is marked Holiday (system-assigned) */}
                              {entry.s === 'H' ? (
                                <span className={`min-w-[2rem] px-2 h-8 rounded-md text-[10px] font-bold flex items-center justify-center ${STATUS_COLORS.H}`}
                                  title="Holiday (School Closed)">H</span>
                              ) : (
                                ALL_STATUSES.map((st) => (
                                  <button
                                    key={st}
                                    onClick={() => toggleStudentStatus(stu.id, st)}
                                    disabled={studentControlsDisabled}
                                    className={`min-w-[2rem] px-1.5 h-8 rounded-md text-[10px] font-bold border transition-all duration-100 ${
                                      entry.s === st
                                        ? STATUS_COLORS[st]
                                        : STATUS_IDLE[st]
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                    title={STATUS_LABELS[st]}
                                  >
                                    {st}
                                  </button>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </PremiumCard>
          )}

          {/* ── Teacher Grid ────────────────────────────────────────────── */}
          {activeTab === 'teachers' && (
            <PremiumCard accentColor="purple" className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/60">
                    <tr>
                      <th className="px-3 py-3 font-semibold text-slate-700 w-12 text-center">#</th>
                      <th className="px-3 py-3 font-semibold text-slate-700 w-48">Teacher</th>
                      <th className="px-3 py-3 font-semibold text-slate-700 text-center">Status</th>
                      <th className="px-3 py-3 font-semibold text-slate-700 text-center w-32">Swipe In</th>
                      <th className="px-3 py-3 font-semibold text-slate-700 text-center w-32">Swipe Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((tch, idx) => {
                      const entry = teacherBlob[tch.id] ?? { s: 'P' as AttendanceStatus, in: '', out: '' };
                      return (
                        <tr key={tch.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                          <td className="px-3 py-2 text-center text-slate-500 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="font-medium text-slate-800 text-sm">{tch.firstName} {tch.lastName ?? ''}</div>
                            <div className="text-[10px] text-slate-400">{tch.employeeCode} · {tch.designation}</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-center gap-1.5">
                              {ALL_STATUSES.map((st) => (
                                <button
                                  key={st}
                                  onClick={() => toggleTeacherStatus(tch.id, st)}
                                  disabled={teacherControlsDisabled}
                                  className={`min-w-[2rem] px-1.5 h-8 rounded-md text-[10px] font-bold border transition-all duration-100 ${
                                    entry.s === st
                                      ? STATUS_COLORS[st]
                                      : STATUS_IDLE[st]
                                  } disabled:cursor-not-allowed disabled:opacity-60`}
                                  title={STATUS_LABELS[st]}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {entry.s === 'A' ? (
                              <span className="text-xs text-slate-400">--</span>
                            ) : (
                            <input
                              type="time"
                              value={entry.in === 'AUTO' ? '' : (entry.in ?? '')}
                              onChange={(e) => setTeacherSwipe(tch.id, 'in', e.target.value)}
                              disabled={teacherControlsDisabled}
                              className="w-28 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {entry.s === 'A' ? (
                              <span className="text-xs text-slate-400">--</span>
                            ) : entry.out && entry.out !== 'AUTO' ? (
                              <span className="inline-block w-28 rounded bg-slate-100 border border-slate-300 px-2 py-1 text-xs text-slate-700 text-center font-medium">{entry.out}</span>
                            ) : (
                              <button
                                onClick={() => {
                                  setTeacherSwipe(tch.id, 'out', 'AUTO');
                                }}
                                disabled={teacherControlsDisabled || entry.s !== 'P'}
                                className="w-28 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
                              >
                                Swipe Out
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </PremiumCard>
          )}

          {/* Mobile sticky save bar — hidden when locked; hidden for students on full holiday */}
          {!locked && !(isFullHoliday && activeTab === 'students') && (
            <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex gap-2 z-20">
              <button
                onClick={saveBlob}
                disabled={saving}
                className="flex-1 rounded-lg bg-teal-600 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={toggleLock}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-orange-50 text-orange-700 border border-orange-400 disabled:opacity-50"
              >
                🔓
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!hasGrid && !loadingGrid && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          Select a Date, Class, and Section, then click <strong>Load Attendance</strong>.
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      {(user) => <AttendancePage user={user} />}
    </AuthGuard>
  );
}
