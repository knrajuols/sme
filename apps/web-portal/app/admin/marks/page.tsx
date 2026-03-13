'use client';

import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PremiumCard } from '../../../components/ui/PremiumCard';

// ── Reference types ────────────────────────────────────────────────────────────
interface ExamRef       { id: string; name: string; classId: string; academicYearId: string; }
interface SectionRef    { id: string; name: string; classId: string; }
interface SubjectRef    { id: string; name: string; code: string; }
interface ExamSubjectRef { id: string; examId: string; subjectId: string; maxMarks: number; }
interface EnrollmentRef { id: string; studentId: string; classId: string; sectionId: string; rollNumber: string; }
interface StudentRef    { id: string; admissionNumber: string; firstName: string; lastName: string; }

// ── Existing-mark response row ─────────────────────────────────────────────────
interface ExistingMark  { studentId: string; marksObtained: number; remarks: string | null; }

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

// ── Main component ──────────────────────────────────────────────────────────────
function MarksPage({ user: _user }: { user: UserClaims }) {
  // Reference data (loaded once)
  const [exams,    setExams]    = useState<ExamRef[]>([]);
  const [sections, setSections] = useState<SectionRef[]>([]);
  const [subjects, setSubjects] = useState<SubjectRef[]>([]);
  const [students, setStudents] = useState<StudentRef[]>([]);

  // Filter state
  const [examId,        setExamId]        = useState('');
  const [sectionId,     setSectionId]     = useState('');
  const [examSubjectId, setExamSubjectId] = useState('');

  // ExamSubjects for the selected exam
  const [examSubjects, setExamSubjects]   = useState<ExamSubjectRef[]>([]);

  // Grid data
  const [rows, setRows] = useState<MarkRow[]>([]);

  // UI state
  const [loadingRef,  setLoadingRef]  = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showBanner(type: 'success' | 'error', msg: string) {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 5000);
  }

  // Load reference data once on mount
  useEffect(() => {
    Promise.all([
      bffFetch<ExamRef[]>('/api/academic/exams'),
      bffFetch<SectionRef[]>('/api/academic-setup/sections'),
      bffFetch<SubjectRef[]>('/api/academic-setup/subjects'),
      bffFetch<StudentRef[]>('/api/academic/students'),
    ])
      .then(([ex, sec, sub, stu]) => {
        setExams(ex);
        setSections(sec);
        setSubjects(sub);
        setStudents(stu);
      })
      .catch(() => showBanner('error', 'Failed to load reference data.'))
      .finally(() => setLoadingRef(false));
  }, []);

  // Derived: selected exam object
  const selectedExam = useMemo(() => exams.find((e) => e.id === examId) ?? null, [exams, examId]);

  // Derived: sections for the selected exam's class
  const filteredSections = useMemo(
    () => selectedExam ? sections.filter((s) => s.classId === selectedExam.classId) : [],
    [sections, selectedExam],
  );

  // Derived: selected ExamSubject object (to display maxMarks)
  const selectedExamSubject = useMemo(
    () => examSubjects.find((es) => es.id === examSubjectId) ?? null,
    [examSubjects, examSubjectId],
  );

  // Load ExamSubjects when exam changes
  useEffect(() => {
    setExamSubjects([]);
    setExamSubjectId('');
    setSectionId('');
    setRows([]);
    if (!examId) return;

    bffFetch<ExamSubjectRef[]>(`/api/academic/exam-subjects?examId=${examId}`)
      .then(setExamSubjects)
      .catch(() => showBanner('error', 'Failed to load exam subjects.'));
  }, [examId]);

  // Reset grid when filters change
  useEffect(() => {
    setRows([]);
  }, [sectionId, examSubjectId]);

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
    if (!examId || !sectionId || !examSubjectId) return;
    setLoadingGrid(true);
    try {
      const [enrollments, marksData] = await Promise.all([
        bffFetch<EnrollmentRef[]>(`/api/academic/enrollments?classId=${selectedExam!.classId}&sectionId=${sectionId}`),
        bffFetch<{ maxMarks: number; marks: ExistingMark[] }>(`/api/academic/marks?examSubjectId=${examSubjectId}&sectionId=${sectionId}`),
      ]);

      // Built a lookup from existing marks
      const markMap: Record<string, ExistingMark> = {};
      for (const m of marksData.marks) markMap[m.studentId] = m;

      const built: MarkRow[] = enrollments.map((enr) => {
        const stu = studentMap[enr.studentId];
        const existing = markMap[enr.studentId];

        // Detect absent from remark prefix saved during previous bulk-save
        const isAbsent = existing?.remarks?.startsWith('ABSENT') ?? false;

        return {
          studentId: enr.studentId,
          admissionNumber: stu?.admissionNumber ?? '—',
          firstName:        stu?.firstName ?? '—',
          lastName:         stu?.lastName  ?? '',
          rollNumber:       enr.rollNumber,
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

    // Client-side validation
    for (const row of rows) {
      if (!row.isAbsent) {
        if (row.obtainedMarks === '' || isNaN(parseFloat(row.obtainedMarks))) {
          showBanner('error', `Enter marks for ${row.firstName} ${row.lastName} (${row.admissionNumber}) or mark as absent.`);
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
        classId: selectedExam!.classId,
        sectionId,
        records: rows.map((r) => ({
          studentId:    r.studentId,
          obtainedMarks: r.isAbsent ? 0 : parseFloat(r.obtainedMarks),
          isAbsent:      r.isAbsent,
          remarks:       r.remarks.trim() || undefined,
        })),
      };

      await bffFetch('/api/academic/marks/bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      showBanner('success', `Marks saved for ${rows.length} students.`);
    } catch (e: unknown) {
      showBanner('error', e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const allFilled = rows.length > 0;
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Exam */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Exam</label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={examId}
                onChange={(e) => { setExamId(e.target.value); setSectionId(''); setExamSubjectId(''); setRows([]); }}
                disabled={loadingRef}
              >
                <option value="">— select exam —</option>
                {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </div>

            {/* Section (filtered by exam's class) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Section</label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                value={sectionId}
                onChange={(e) => { setSectionId(e.target.value); setRows([]); }}
                disabled={!examId}
              >
                <option value="">— select section —</option>
                {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                disabled={!examId || !sectionId || !examSubjectId || loadingGrid}
                className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                {loadingGrid ? 'Loading…' : 'Load Students'}
              </button>
            </div>
          </div>

          {/* Max marks reminder */}
          {selectedExamSubject && (
            <p className="mt-3 text-xs text-slate-500">
              Max marks for this subject: <span className="font-semibold text-slate-700">{selectedExamSubject.maxMarks}</span>
            </p>
          )}
        </PremiumCard>

        {/* ── Grid ────────────────────────────────────────────────────────────── */}
        {rows.length === 0 && !loadingGrid && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-400 text-sm">
              {examId && sectionId && examSubjectId
                ? 'No students enrolled in this section. Click Load Students to retry.'
                : 'Select all filters above and click Load Students.'}
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{rows.length}</span> students ·{' '}
                <span className="text-yellow-700 font-semibold">{absentCount}</span> absent
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !allFilled}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Marks'}
              </button>
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
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
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
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !allFilled}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : `Save Marks (${rows.length} students)`}
              </button>
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
