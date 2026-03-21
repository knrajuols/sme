'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PremiumCard } from '../../../components/ui/PremiumCard';

// ── Reference types ────────────────────────────────────────────────────────────
interface ExamRef       { id: string; name: string; classId: string; academicYearId: string; }
interface ClassRef      { id: string; name: string; }
interface ClassSectionRef { id: string; name: string; classId: string; className: string; sectionId: string; sectionName: string; }
interface SubjectRef    { id: string; name: string; code: string; }
interface ExamSubjectRef { id: string; examId: string; subjectId: string; maxMarks: number; }
interface EnrollmentRef { id: string; studentId: string; classId: string; sectionId: string; rollNumber: string; }
interface StudentRef    { id: string; admissionNumber: string; firstName: string; lastName: string; }

// ── Existing-mark response row ─────────────────────────────────────────────────
interface ExistingMark  { studentId: string; marksObtained: number; isAbsent?: boolean; remarks: string | null; }

// ── Per-student editable row ────────────────────────────────────────────────────
interface MarkRow {
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  obtainedMarks: string;  // string for controlled input
  isAbsent: boolean;
  remarks: string;
}

// ── State persistence helpers ──────────────────────────────────────────────────
const STORAGE_KEY = 'sme_marks_filters';
function saveFilters(examId: string, sectionId: string, examSubjectId: string) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ examId, sectionId, examSubjectId })); } catch { /* noop */ }
}
function loadFilters(): { examId: string; sectionId: string; examSubjectId: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// ── Main component ──────────────────────────────────────────────────────────────
function MarksPage({ user: _user }: { user: UserClaims }) {
  // Reference data (loaded once)
  const [exams,    setExams]    = useState<ExamRef[]>([]);
  const [classes,  setClasses]  = useState<ClassRef[]>([]);
  const [subjects, setSubjects] = useState<SubjectRef[]>([]);
  const [students, setStudents] = useState<StudentRef[]>([]);

  // Sections fetched per-class via ClassSection junction table
  const [classSections, setClassSections] = useState<ClassSectionRef[]>([]);

  // Filter state
  const [examId,        setExamId]        = useState('');
  const [classId,       setClassId]       = useState('');
  const [sectionId,     setSectionId]     = useState('');
  const [examSubjectId, setExamSubjectId] = useState('');

  // ExamSubjects for the selected exam
  const [examSubjects, setExamSubjects]   = useState<ExamSubjectRef[]>([]);

  // Grid data
  const [rows, setRows] = useState<MarkRow[]>([]);

  // Attendance lock state
  const [attendanceLocked, setAttendanceLocked] = useState(false);
  const [locking, setLocking] = useState(false);

  // UI state
  const [loadingRef,  setLoadingRef]  = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [restoredFilters, setRestoredFilters] = useState(false);

  function showBanner(type: 'success' | 'error', msg: string) {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 5000);
  }

  // Load reference data once on mount
  useEffect(() => {
    Promise.all([
      bffFetch<ExamRef[]>('/api/academic/exams'),
      bffFetch<ClassRef[]>('/api/academic-setup/classes'),
      bffFetch<SubjectRef[]>('/api/academic-setup/subjects'),
      bffFetch<StudentRef[]>('/api/academic/students'),
    ])
      .then(([ex, cls, sub, stu]) => {
        setExams(ex);
        setClasses(cls);
        setSubjects(sub);
        setStudents(stu);
        // Restore persisted filter state
        const saved = loadFilters();
        if (saved?.examId && ex.some((e) => e.id === saved.examId)) {
          setExamId(saved.examId);
          // sectionId and examSubjectId will be restored after exam-subjects load
          setRestoredFilters(true);
        }
      })
      .catch(() => showBanner('error', 'Failed to load reference data.'))
      .finally(() => setLoadingRef(false));
  }, []);

  // Derived: class name for display (auto-selected from exam)
  const selectedClassName = useMemo(
    () => classes.find((c) => c.id === classId)?.name ?? '',
    [classes, classId],
  );

  // Derived: selected ExamSubject object (to display maxMarks)
  const selectedExamSubject = useMemo(
    () => examSubjects.find((es) => es.id === examSubjectId) ?? null,
    [examSubjects, examSubjectId],
  );

  // When exam changes: auto-set classId, load ExamSubjects + ClassSections
  useEffect(() => {
    setExamSubjects([]);
    setExamSubjectId('');
    setClassSections([]);
    setSectionId('');
    setRows([]);
    setAttendanceLocked(false);

    if (!examId) { setClassId(''); return; }

    const exam = exams.find((e) => e.id === examId);
    if (!exam) { setClassId(''); return; }

    // Auto-select the class from the exam
    setClassId(exam.classId);

    // Fetch exam-subjects and class-sections in parallel
    Promise.all([
      bffFetch<ExamSubjectRef[]>(`/api/academic/exam-subjects?examId=${examId}`),
      bffFetch<ClassSectionRef[]>(`/api/academic/class-sections?classId=${exam.classId}`),
    ])
      .then(([es, cs]) => {
        setExamSubjects(es);
        setClassSections(cs);
        // Restore saved section and subject
        if (restoredFilters) {
          const saved = loadFilters();
          if (saved?.sectionId && cs.some((c) => c.sectionId === saved.sectionId)) {
            setSectionId(saved.sectionId);
          }
          if (saved?.examSubjectId && es.some((e) => e.id === saved.examSubjectId)) {
            setExamSubjectId(saved.examSubjectId);
          }
          setRestoredFilters(false);
        }
      })
      .catch(() => showBanner('error', 'Failed to load exam details.'));
  }, [examId, exams]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    if (examId) saveFilters(examId, sectionId, examSubjectId);
  }, [examId, sectionId, examSubjectId]);

  // Reset grid when filters change
  useEffect(() => {
    setRows([]);
    setAttendanceLocked(false);
  }, [classId, sectionId, examSubjectId]);

  // Fetch lock status when exam and section are selected
  const fetchLockStatus = useCallback(async () => {
    if (!examId || !sectionId) { setAttendanceLocked(false); return; }
    try {
      const data = await bffFetch<{ locked: boolean }>(`/api/academic/marks/attendance-lock?examId=${examId}&sectionId=${sectionId}`);
      setAttendanceLocked(data.locked);
    } catch {
      setAttendanceLocked(false);
    }
  }, [examId, sectionId]);

  useEffect(() => { fetchLockStatus(); }, [fetchLockStatus]);

  // Subject name lookup
  const subjectMap = useMemo(() => {
    const m: Record<string, SubjectRef> = {};
    for (const s of subjects) m[s.id] = s;
    return m;
  }, [subjects]);

  // Student lookup by id
  const studentMap = useMemo(() => {
    const m: Record<string, StudentRef> = {};
    for (const s of students) m[s.id] = s;
    return m;
  }, [students]);

  async function loadGrid() {
    if (!examId || !classId || !sectionId || !examSubjectId) return;
    setLoadingGrid(true);
    try {
      const [enrollments, marksData] = await Promise.all([
        bffFetch<EnrollmentRef[]>(`/api/academic/enrollments?classId=${classId}&sectionId=${sectionId}`),
        bffFetch<{ maxMarks: number; marks: ExistingMark[] }>(`/api/academic/marks?examSubjectId=${examSubjectId}&sectionId=${sectionId}`),
      ]);

      // Built a lookup from existing marks
      const markMap: Record<string, ExistingMark> = {};
      for (const m of marksData.marks) markMap[m.studentId] = m;

      const built: MarkRow[] = enrollments.map((enr) => {
        const stu = studentMap[enr.studentId];
        const existing = markMap[enr.studentId];

        // Detect absent from explicit isAbsent field or remark prefix (backward compat)
        const isAbsent = existing?.isAbsent ?? existing?.remarks?.startsWith('ABSENT') ?? false;

        return {
          studentId: enr.studentId,
          admissionNumber: stu?.admissionNumber ?? '—',
          firstName:        stu?.firstName ?? '—',
          lastName:         stu?.lastName  ?? '',
          rollNumber:       enr.rollNumber ?? '',
          obtainedMarks:    existing && !isAbsent ? String(existing.marksObtained) : '',
          isAbsent,
          remarks:          existing
            ? (isAbsent ? (existing.remarks ?? '').replace(/^ABSENT:?\s*/i, '') : (existing.remarks ?? ''))
            : '',
        };
      });

      // Sort by roll number (numeric if possible)
      built.sort((a, b) => {
        const na = parseInt(a.rollNumber, 10);
        const nb = parseInt(b.rollNumber, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.rollNumber.localeCompare(b.rollNumber);
      });

      setRows(built);
      // Also refresh lock status
      await fetchLockStatus();
    } catch (e: unknown) {
      showBanner('error', e instanceof Error ? e.message : 'Failed to load student data.');
    } finally {
      setLoadingGrid(false);
    }
  }

  // Update a single row field
  function updateRow(studentId: string, field: keyof MarkRow, value: string | boolean) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.studentId !== studentId) return r;
        const updated = { ...r, [field]: value };
        // When marking absent, clear the marks input
        if (field === 'isAbsent' && value === true) updated.obtainedMarks = '';
        return updated;
      }),
    );
  }

  async function handleSave() {
    if (!selectedExamSubject) return;
    const maxMarks = selectedExamSubject.maxMarks;

    // Only process rows where the teacher has entered something (marks or absent)
    const filledRows = rows.filter((r) => r.isAbsent || r.obtainedMarks !== '');

    if (filledRows.length === 0) {
      showBanner('error', 'Enter marks or mark at least one student as absent before saving.');
      return;
    }

    // Validate only the filled rows
    for (const row of filledRows) {
      if (!row.isAbsent) {
        if (isNaN(parseFloat(row.obtainedMarks))) {
          showBanner('error', `Invalid marks for ${row.firstName} ${row.lastName} (${row.admissionNumber}).`);
          return;
        }
        if (parseFloat(row.obtainedMarks) > maxMarks) {
          showBanner('error', `${row.firstName} ${row.lastName}: marks (${row.obtainedMarks}) exceed max (${maxMarks}).`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        examSubjectId,
        classId,
        sectionId,
        records: filledRows.map((r) => ({
          studentId:     r.studentId,
          obtainedMarks: r.isAbsent ? 0 : parseFloat(r.obtainedMarks),
          isAbsent:      r.isAbsent,
          remarks:       r.remarks.trim() || undefined,
        })),
      };

      await bffFetch('/api/academic/marks/bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      showBanner('success', `Marks saved for ${filledRows.length} of ${rows.length} students.`);
    } catch (e: unknown) {
      showBanner('error', e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLockAttendance() {
    if (!examId || !sectionId) return;
    setLocking(true);
    try {
      await bffFetch('/api/academic/marks/lock-attendance', {
        method: 'POST',
        body: JSON.stringify({ examId, sectionId }),
      });
      setAttendanceLocked(true);
      showBanner('success', 'Attendance locked. Absent checkboxes are now read-only.');
    } catch (e: unknown) {
      showBanner('error', e instanceof Error ? e.message : 'Failed to lock attendance.');
    } finally {
      setLocking(false);
    }
  }

  // Enable Save as soon as at least one row has data (marks entered or marked absent)
  const canSave = rows.some((r) => r.isAbsent || r.obtainedMarks !== '');
  const filledCount = rows.filter((r) => r.isAbsent || r.obtainedMarks !== '').length;
  const absentCount = rows.filter((r) => r.isAbsent).length;

  const inputCls = (hasError?: boolean) =>
    `rounded border px-2 py-1 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${hasError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      {/* Banner */}
      {banner && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-lg text-white ${banner.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {banner.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-slate-900">Marks Entry</h1>
          <p className="text-sm text-slate-500 mt-1">Enter and save student marks for an exam subject.</p>
        </div>

        {/* ── Filter bar ─────────────────────────────────────────────────────── */}
        <PremiumCard accentColor="yellow" className="p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Exam */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Exam</label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                disabled={loadingRef}
              >
                <option value="">— select exam —</option>
                {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </div>

            {/* Class (auto-selected from exam) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Class</label>
              <input
                type="text"
                readOnly
                value={selectedClassName || (examId ? 'Loading…' : '')}
                placeholder="— auto from exam —"
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 cursor-default"
              />
            </div>

            {/* Section (from ClassSection junction table) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Section</label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                value={sectionId}
                onChange={(e) => { setSectionId(e.target.value); setRows([]); }}
                disabled={!classId || classSections.length === 0}
              >
                <option value="">— select section —</option>
                {classSections.map((cs) => <option key={cs.sectionId} value={cs.sectionId}>{cs.sectionName}</option>)}
              </select>
            </div>

            {/* Subject (from ExamSubjects of the selected exam) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Subject</label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                value={examSubjectId}
                onChange={(e) => { setExamSubjectId(e.target.value); setRows([]); }}
                disabled={!examId || examSubjects.length === 0}
              >
                <option value="">— select subject —</option>
                {examSubjects.map((es) => {
                  const sub = subjectMap[es.subjectId];
                  return (
                    <option key={es.id} value={es.id}>
                      {sub ? `${sub.name} (${sub.code})` : es.subjectId}
                      {` — max: ${es.maxMarks}`}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Load button */}
            <div className="flex items-end">
              <button
                type="button"
                onClick={loadGrid}
                disabled={!examId || !classId || !sectionId || !examSubjectId || loadingGrid}
                className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                {loadingGrid ? 'Loading…' : 'Load Students'}
              </button>
            </div>
          </div>

          {/* Max marks reminder + Lock status */}
          <div className="mt-3 flex items-center justify-between">
            {selectedExamSubject && (
              <p className="text-xs text-slate-500">
                Max marks for this subject: <span className="font-semibold text-slate-700">{selectedExamSubject.maxMarks}</span>
              </p>
            )}
            {attendanceLocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                Attendance Locked
              </span>
            )}
          </div>
        </PremiumCard>

        {/* ── Grid ────────────────────────────────────────────────────────────── */}
        {rows.length === 0 && !loadingGrid && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-400 text-sm">
              {examId && classId && sectionId && examSubjectId
                ? 'No students enrolled in this section. Click Load Students to retry.'
                : 'Select all filters above and click Load Students.'}
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{rows.length}</span> students ·{' '}
                <span className="text-blue-700 font-semibold">{filledCount} filled</span> ·{' '}
                <span className="text-yellow-700 font-semibold">{absentCount}</span> absent
              </p>
              <div className="flex items-center gap-2">
                {/* Lock Attendance button — only show when not yet locked */}
                {!attendanceLocked && examId && sectionId && (
                  <button
                    type="button"
                    onClick={handleLockAttendance}
                    disabled={locking}
                    className="rounded-lg border border-amber-500 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-colors"
                  >
                    {locking ? 'Locking…' : 'Lock Attendance'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !canSave}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Marks'}
                </button>
              </div>
            </div>

            {/* Desktop table */}
            <PremiumCard accentColor="blue" className="hidden sm:block overflow-x-auto">
              <table className="grand-table w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left w-12">Roll</th>
                    <th className="px-4 py-3 text-left">Admission No.</th>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-center w-20">Absent</th>
                    <th className="px-4 py-3 text-left w-32">
                      Marks
                      {selectedExamSubject && (
                        <span className="ml-1 font-normal text-slate-400 normal-case">/ {selectedExamSubject.maxMarks}</span>
                      )}
                    </th>
                    <th className="px-4 py-3 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const marksNum = parseFloat(row.obtainedMarks);
                    const marksOver = !row.isAbsent && row.obtainedMarks !== '' && !isNaN(marksNum)
                      && selectedExamSubject
                      && marksNum > selectedExamSubject.maxMarks;

                    return (
                      <tr key={row.studentId} className={`transition-colors ${row.isAbsent ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-2.5 font-mono text-slate-500 text-xs">{row.rollNumber}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{row.admissionNumber}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          {row.firstName} {row.lastName}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.isAbsent}
                            onChange={(e) => updateRow(row.studentId, 'isAbsent', e.target.checked)}
                            disabled={attendanceLocked}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min={0}
                            max={selectedExamSubject?.maxMarks}
                            step={0.5}
                            disabled={row.isAbsent}
                            value={row.obtainedMarks}
                            onChange={(e) => updateRow(row.studentId, 'obtainedMarks', e.target.value)}
                            placeholder="—"
                            className={inputCls(!!marksOver)}
                          />
                          {marksOver && (
                            <p className="mt-0.5 text-xs text-red-600">Exceeds max</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={(e) => updateRow(row.studentId, 'remarks', e.target.value)}
                            placeholder="optional"
                            maxLength={500}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </PremiumCard>

            {/* Mobile cards */}
            <div className="sm:hidden flex flex-col gap-3">
              {rows.map((row) => {
                const marksNum = parseFloat(row.obtainedMarks);
                const marksOver = !row.isAbsent && row.obtainedMarks !== '' && !isNaN(marksNum)
                  && selectedExamSubject
                  && marksNum > selectedExamSubject.maxMarks;

                return (
                  <div key={row.studentId} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${row.isAbsent ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-slate-900">{row.firstName} {row.lastName}</p>
                        <p className="text-xs text-slate-500">{row.admissionNumber} · Roll {row.rollNumber}</p>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={row.isAbsent}
                          onChange={(e) => updateRow(row.studentId, 'isAbsent', e.target.checked)}
                          disabled={attendanceLocked}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        Absent
                      </label>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                          Marks{selectedExamSubject ? ` / ${selectedExamSubject.maxMarks}` : ''}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={selectedExamSubject?.maxMarks}
                          step={0.5}
                          disabled={row.isAbsent}
                          value={row.obtainedMarks}
                          onChange={(e) => updateRow(row.studentId, 'obtainedMarks', e.target.value)}
                          placeholder="—"
                          className={inputCls(!!marksOver)}
                        />
                        {marksOver && <p className="mt-0.5 text-xs text-red-600">Exceeds max</p>}
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Remarks</label>
                        <input
                          type="text"
                          value={row.remarks}
                          onChange={(e) => updateRow(row.studentId, 'remarks', e.target.value)}
                          placeholder="optional"
                          maxLength={500}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky save bar on mobile */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 z-30">
              <div className="flex gap-2">
                {!attendanceLocked && examId && sectionId && (
                  <button
                    type="button"
                    onClick={handleLockAttendance}
                    disabled={locking}
                    className="flex-1 rounded-lg border border-amber-500 bg-amber-50 py-3 text-sm font-semibold text-amber-700 disabled:opacity-40"
                  >
                    {locking ? 'Locking…' : 'Lock'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !canSave}
                  className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  {saving ? 'Saving…' : `Save Marks (${filledCount} / ${rows.length})`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <AuthGuard>{(user) => <MarksPage user={user} />}</AuthGuard>;
}
