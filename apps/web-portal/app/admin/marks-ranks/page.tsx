'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PremiumCard } from '../../../components/ui/PremiumCard';

// ── Reference types ────────────────────────────────────────────────────────────
interface ExamRef         { id: string; name: string; classId: string; academicYearId: string; }
interface ClassRef        { id: string; name: string; }
interface ClassSectionRef { id: string; name: string; classId: string; className: string; sectionId: string; sectionName: string; }

// ── API response types ─────────────────────────────────────────────────────────
interface SubjectMeta {
  subjectId: string;
  examSubjectId: string;
  name: string;
  code: string;
  maxMarks: number;
}

interface SubjectData {
  marks: number;
  isAbsent: boolean;
  grade: string;
  rank: number;
}

interface StudentRow {
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  subjectData: Record<string, SubjectData>;
  totalMarks: number;
  totalMaxMarks: number;
  overallGrade: string;
  sectionRank: number;
  classRank: number;
}

interface MarksRanksResponse {
  examName: string;
  classId: string;
  sectionId: string;
  totalClassStudents: number;
  totalSectionStudents: number;
  subjects: SubjectMeta[];
  students: StudentRow[];
}

// ── State persistence helpers ──────────────────────────────────────────────────
const STORAGE_KEY = 'sme_marks_ranks_filters';
function saveFilters(examId: string, sectionId: string) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ examId, sectionId })); } catch { /* noop */ }
}
function loadFilters(): { examId: string; sectionId: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// ── Main component ─────────────────────────────────────────────────────────────
function MarksRanksContent({ user: _user }: { user: UserClaims }) {
  // Reference data
  const [exams,   setExams]   = useState<ExamRef[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [classSections, setClassSections] = useState<ClassSectionRef[]>([]);

  // Filter state
  const [examId,    setExamId]    = useState('');
  const [classId,   setClassId]   = useState('');
  const [sectionId, setSectionId] = useState('');

  // Result data
  const [data, setData] = useState<MarksRanksResponse | null>(null);

  // UI state
  const [loadingRef,  setLoadingRef]  = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [restoredFilters, setRestoredFilters] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showBanner(type: 'success' | 'error', msg: string) {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 5000);
  }

  // Load reference data once
  useEffect(() => {
    Promise.all([
      bffFetch<ExamRef[]>('/api/academic/exams'),
      bffFetch<ClassRef[]>('/api/academic-setup/classes'),
    ])
      .then(([ex, cls]) => {
        setExams(ex);
        setClasses(cls);
        const saved = loadFilters();
        if (saved?.examId && ex.some((e) => e.id === saved.examId)) {
          setExamId(saved.examId);
          setRestoredFilters(true);
        }
      })
      .catch(() => showBanner('error', 'Failed to load reference data.'))
      .finally(() => setLoadingRef(false));
  }, []);

  // Derived: class name
  const selectedClassName = useMemo(
    () => classes.find((c) => c.id === classId)?.name ?? '',
    [classes, classId],
  );

  // When exam changes: auto-set classId, load ClassSections
  useEffect(() => {
    setClassSections([]);
    setSectionId('');
    setData(null);

    if (!examId) { setClassId(''); return; }

    const exam = exams.find((e) => e.id === examId);
    if (!exam) { setClassId(''); return; }

    setClassId(exam.classId);

    bffFetch<ClassSectionRef[]>(`/api/academic/class-sections?classId=${exam.classId}`)
      .then((cs) => {
        setClassSections(cs);
        if (restoredFilters) {
          const saved = loadFilters();
          if (saved?.sectionId && cs.some((c) => c.sectionId === saved.sectionId)) {
            setSectionId(saved.sectionId);
          }
          setRestoredFilters(false);
        }
      })
      .catch(() => showBanner('error', 'Failed to load sections.'));
  }, [examId, exams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist filters
  useEffect(() => {
    if (examId) saveFilters(examId, sectionId);
  }, [examId, sectionId]);

  // Reset data when section changes
  useEffect(() => { setData(null); }, [sectionId]);

  // ── Load marks-ranks ────────────────────────────────────────────────────────
  const loadMarksRanks = useCallback(async () => {
    if (!examId || !sectionId) return;
    setLoadingData(true);
    setBanner(null);
    try {
      const resp = await bffFetch<MarksRanksResponse>(
        `/api/academic/marks/ranks?examId=${examId}&sectionId=${sectionId}`,
      );
      setData(resp);
      if (resp.students.length === 0) {
        showBanner('error', 'No students or marks data found for this selection.');
      }
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : '[ERR-RANK-5001] Failed to load marks & ranks.');
    } finally {
      setLoadingData(false);
    }
  }, [examId, sectionId]);

  const canLoad = !!(examId && sectionId);

  // Derived: section label
  const sectionLabel = useMemo(() => {
    const cs = classSections.find((c) => c.sectionId === sectionId);
    return cs ? cs.sectionName : '';
  }, [classSections, sectionId]);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loadingRef) {
    return <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>;
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Marks, Grades &amp; Ranks</h1>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          MARKS &amp; RANKS
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

      {/* Filters */}
      <PremiumCard accentColor="blue" className="p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Exam */}
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Exam</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
            >
              <option value="">— Select Exam —</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>

          {/* Class (auto from exam, read-only) */}
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Class</label>
            <input
              type="text"
              readOnly
              value={selectedClassName}
              placeholder="Auto from Exam"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
          </div>

          {/* Section */}
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Section</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={classSections.length === 0}
            >
              <option value="">— Select Section —</option>
              {classSections.map((cs) => (
                <option key={cs.id} value={cs.sectionId}>{cs.sectionName}</option>
              ))}
            </select>
          </div>

          {/* Load button */}
          <div className="flex items-end gap-2">
            <button
              onClick={loadMarksRanks}
              disabled={!canLoad || loadingData}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingData ? 'Loading…' : 'Load Marks & Ranks'}
            </button>
          </div>
        </div>
      </PremiumCard>

      {/* Data table */}
      {data && data.students.length > 0 && (
        <PremiumCard accentColor="purple" className="p-0 overflow-hidden">
          {/* Summary bar */}
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <span className="font-medium text-slate-800">
              {data.examName} — {selectedClassName} {sectionLabel}
            </span>
            <span>|</span>
            <span>{data.totalSectionStudents} Students (Section)</span>
            <span>|</span>
            <span>{data.totalClassStudents} Students (Class)</span>
            <span>|</span>
            <span>{data.subjects.length} Subjects</span>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/60">
                <tr>
                  <th className="px-3 py-3 font-semibold text-slate-700 text-center whitespace-nowrap sticky left-0 bg-slate-50/60 z-10">#</th>
                  <th className="px-3 py-3 font-semibold text-slate-700 whitespace-nowrap sticky left-[40px] bg-slate-50/60 z-10">Student</th>
                  {data.subjects.map((sub) => (
                    <th key={sub.subjectId} className="px-3 py-3 font-semibold text-slate-700 text-center whitespace-nowrap">
                      <span className="block text-xs">{sub.code || sub.name}</span>
                      <span className="block text-[10px] font-normal text-slate-400">({sub.maxMarks})</span>
                    </th>
                  ))}
                  <th className="px-3 py-3 font-semibold text-slate-700 text-center whitespace-nowrap bg-emerald-50">
                    <span className="block text-xs">Total</span>
                    <span className="block text-[10px] font-normal text-slate-400">
                      ({data.subjects.reduce((s, sub) => s + sub.maxMarks, 0)})
                    </span>
                  </th>
                  <th className="px-3 py-3 font-semibold text-slate-700 text-center whitespace-nowrap bg-emerald-50">Grade</th>
                  <th className="px-3 py-3 font-semibold text-slate-700 text-center whitespace-nowrap bg-blue-50">
                    <span className="block text-xs">Sec</span>
                    <span className="block text-[10px] font-normal text-slate-400">Rank</span>
                  </th>
                  <th className="px-3 py-3 font-semibold text-slate-700 text-center whitespace-nowrap bg-indigo-50">
                    <span className="block text-xs">Class</span>
                    <span className="block text-[10px] font-normal text-slate-400">Rank</span>
                  </th>
                  {data.subjects.map((sub) => (
                    <th key={`rk-${sub.subjectId}`} className="px-3 py-3 font-semibold text-slate-700 text-center whitespace-nowrap bg-amber-50/50">
                      <span className="block text-xs">{sub.code || sub.name}</span>
                      <span className="block text-[10px] font-normal text-slate-400">Rank</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.students.map((stu, idx) => (
                  <tr key={stu.studentId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="px-3 py-2 text-center text-slate-500 whitespace-nowrap sticky left-0 z-10" style={{ background: 'inherit' }}>
                      {stu.rollNumber || idx + 1}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap sticky left-[40px] z-10" style={{ background: 'inherit' }}>
                      {stu.firstName} {stu.lastName}
                    </td>
                    {data.subjects.map((sub) => {
                      const sd = stu.subjectData[sub.subjectId];
                      return (
                        <td key={sub.subjectId} className="px-3 py-2 text-center whitespace-nowrap">
                          {sd?.isAbsent ? (
                            <span className="text-red-500 font-medium text-xs">AB</span>
                          ) : (
                            <span>
                              <span className="text-slate-800">{sd?.marks ?? '—'}</span>
                              <span className="ml-1 text-[10px] text-slate-400">{sd?.grade ?? ''}</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-semibold whitespace-nowrap bg-emerald-50/40">
                      {stu.totalMarks}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold whitespace-nowrap bg-emerald-50/40">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${
                        stu.overallGrade === 'A1' ? 'bg-green-100 text-green-800' :
                        stu.overallGrade === 'A2' ? 'bg-green-50 text-green-700' :
                        stu.overallGrade === 'E' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {stu.overallGrade}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-semibold whitespace-nowrap bg-blue-50/40">
                      {stu.sectionRank}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold whitespace-nowrap bg-indigo-50/40">
                      {stu.classRank}
                    </td>
                    {data.subjects.map((sub) => {
                      const sd = stu.subjectData[sub.subjectId];
                      return (
                        <td key={`rk-${sub.subjectId}`} className="px-3 py-2 text-center text-slate-600 whitespace-nowrap bg-amber-50/20">
                          {sd?.rank ?? '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-slate-100">
            {data.students.map((stu) => (
              <div key={stu.studentId} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-800">{stu.firstName} {stu.lastName}</span>
                  <span className="text-xs text-slate-400">Roll: {stu.rollNumber || '—'}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {data.subjects.map((sub) => {
                    const sd = stu.subjectData[sub.subjectId];
                    return (
                      <div key={sub.subjectId} className="flex justify-between">
                        <span className="text-slate-500">{sub.code || sub.name}</span>
                        <span className="font-medium text-slate-700">
                          {sd?.isAbsent ? 'AB' : `${sd?.marks ?? '—'} (${sd?.grade ?? '-'})`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-3 text-xs">
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 font-medium">
                    Total: {stu.totalMarks} ({stu.overallGrade})
                  </span>
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700 font-medium">
                    Sec Rank: {stu.sectionRank}
                  </span>
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-indigo-700 font-medium">
                    Class Rank: {stu.classRank}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </PremiumCard>
      )}

      {/* Empty state */}
      {!data && !loadingData && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          Select an Exam and Section, then click <strong>Load Marks &amp; Ranks</strong>.
        </div>
      )}
      {data && data.students.length === 0 && !loadingData && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          No students or marks data found for this selection.
        </div>
      )}
    </>
  );
}

export default function MarksRanksPage() {
  return (
    <AuthGuard>
      {(user) => <MarksRanksContent user={user} />}
    </AuthGuard>
  );
}
