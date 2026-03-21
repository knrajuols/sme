'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PremiumCard } from '../../../components/ui/PremiumCard';

// ── Reference types ────────────────────────────────────────────────────────────
interface ExamRef          { id: string; name: string; classId: string; academicYearId: string; }
interface ClassRef         { id: string; name: string; }
interface ClassSectionRef  { id: string; name: string; classId: string; className: string; sectionId: string; sectionName: string; }

// ── Grade distribution entry ───────────────────────────────────────────────────
interface GradeCount { grade: string; count: number; }

// ── Analytics response shape (enhanced) ────────────────────────────────────────
interface SubjectAnalytics {
  subjectId: string;
  subjectName: string;
  maxMarks: number;
  totalStudents: number;
  markedStudents: number;
  highestMark: number | null;
  highestCount?: number;
  secondHighest: number | null;
  secondHighestCount?: number;
  thirdHighest: number | null;
  thirdHighestCount?: number;
  lowestMark: number | null;
  averageMark: number | null;
  passPercentage?: number | null;
  gradeDistribution?: GradeCount[];
}

interface GradeScaleRef { grade: string; minPercentage: number; maxPercentage: number; }

interface AnalyticsResponse {
  subjects: SubjectAnalytics[];
  gradeScales?: GradeScaleRef[];
  passThreshold?: number;
}

// ── State persistence helpers ──────────────────────────────────────────────────
const STORAGE_KEY = 'sme_analytics_filters';
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
function AnalyticsContent({ user: _user }: { user: UserClaims }) {
  // Reference data
  const [exams,   setExams]   = useState<ExamRef[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [classSections, setClassSections] = useState<ClassSectionRef[]>([]);

  // Filter state
  const [examId,    setExamId]    = useState('');
  const [classId,   setClassId]   = useState('');
  const [sectionId, setSectionId] = useState('');

  // Result data
  const [analytics, setAnalytics] = useState<SubjectAnalytics[]>([]);
  const [passThreshold, setPassThreshold] = useState<number>(33);

  // Grade matrix view toggle
  const [showGradeTable, setShowGradeTable] = useState(false);

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
        // Restore persisted filter state
        const saved = loadFilters();
        if (saved?.examId && ex.some((e) => e.id === saved.examId)) {
          setExamId(saved.examId);
          setRestoredFilters(true);
        }
      })
      .catch(() => showBanner('error', 'Failed to load reference data.'))
      .finally(() => setLoadingRef(false));
  }, []);

  // Derived: class name for display
  const selectedClassName = useMemo(
    () => classes.find((c) => c.id === classId)?.name ?? '',
    [classes, classId],
  );

  // When exam changes: auto-set classId, load ClassSections
  useEffect(() => {
    setClassSections([]);
    setSectionId('');
    setAnalytics([]);

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

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    if (examId) saveFilters(examId, sectionId);
  }, [examId, sectionId]);

  // Reset analytics when section changes
  useEffect(() => { setAnalytics([]); setShowGradeTable(false); }, [sectionId]);

  // ── Load analytics ───────────────────────────────────────────────────────────
  const loadAnalytics = useCallback(async () => {
    if (!examId || !sectionId) return;
    setLoadingData(true);
    setBanner(null);
    try {
      const data = await bffFetch<AnalyticsResponse>(
        `/api/academic/marks/analytics?examId=${examId}&sectionId=${sectionId}`,
      );
      setAnalytics(data.subjects);
      if (data.passThreshold != null) setPassThreshold(data.passThreshold);
      if (data.subjects.length === 0) {
        showBanner('error', 'No marks data found for this selection.');
      }
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : '[ERR-ANLY-5001] Failed to load analytics.');
    } finally {
      setLoadingData(false);
    }
  }, [examId, sectionId]);

  // ── Derived: can load? ───────────────────────────────────────────────────────
  const canLoad = !!(examId && sectionId);

  // ── Derived: section label for summary ───────────────────────────────────────
  const sectionLabel = useMemo(() => {
    const cs = classSections.find((c) => c.sectionId === sectionId);
    return cs ? cs.sectionName : '';
  }, [classSections, sectionId]);

  // ── Derived: all unique grades sorted by CBSE scale order ────────────────────
  const allGrades = useMemo(() => {
    const CBSE_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D', 'E'];
    const gradeSet = new Set<string>();
    for (const subj of analytics) {
      if (subj.gradeDistribution) {
        for (const gd of subj.gradeDistribution) gradeSet.add(gd.grade);
      }
    }
    const grades = Array.from(gradeSet);
    grades.sort((a, b) => {
      const ia = CBSE_ORDER.indexOf(a);
      const ib = CBSE_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    return grades;
  }, [analytics]);

  // ── Helper: format rank with count ───────────────────────────────────────────
  function fmtRank(mark: number | null, count?: number) {
    if (mark == null) return '—';
    if (count != null && count > 1) return `${mark} (${count})`;
    return String(mark);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loadingRef) {
    return <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>;
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Marks Analytics</h1>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
          ANALYTICS
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

          {/* Load button + View Grades */}
          <div className="flex items-end gap-2">
            <button
              onClick={loadAnalytics}
              disabled={!canLoad || loadingData}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingData ? 'Loading…' : 'Load Analytics'}
            </button>
            <button
              onClick={() => setShowGradeTable((v) => !v)}
              disabled={analytics.length === 0 || allGrades.length === 0}
              className={`rounded-lg px-5 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                showGradeTable
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'border border-indigo-500 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              {showGradeTable ? 'Hide Grades' : 'View Grades'}
            </button>
          </div>
        </div>
      </PremiumCard>

      {/* Analytics table */}
      {analytics.length > 0 && (
        <>
          <PremiumCard accentColor="purple" className="p-0 overflow-hidden mb-6">
            {/* Summary bar */}
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="font-medium text-slate-800">
                {exams.find((e) => e.id === examId)?.name} — {selectedClassName} {sectionLabel}
              </span>
              <span>|</span>
              <span>{analytics[0]?.totalStudents ?? 0} Students</span>
              <span>|</span>
              <span>{analytics.length} Subjects</span>
              <span>|</span>
              <span className="text-amber-700">Pass threshold: {passThreshold}%</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/60">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-700">Subject</th>
                    <th className="px-3 py-3 font-semibold text-slate-700 text-center">Max</th>
                    <th className="px-3 py-3 font-semibold text-slate-700 text-center">
                      <span className="block text-xs">1st</span>
                      <span className="block text-[10px] font-normal text-slate-400">(count)</span>
                    </th>
                    <th className="px-3 py-3 font-semibold text-slate-700 text-center">
                      <span className="block text-xs">2nd</span>
                      <span className="block text-[10px] font-normal text-slate-400">(count)</span>
                    </th>
                    <th className="px-3 py-3 font-semibold text-slate-700 text-center">
                      <span className="block text-xs">3rd</span>
                      <span className="block text-[10px] font-normal text-slate-400">(count)</span>
                    </th>
                    <th className="px-3 py-3 font-semibold text-slate-700 text-center">Lowest</th>
                    <th className="px-3 py-3 font-semibold text-slate-700 text-center">Average</th>
                    <th className="px-3 py-3 font-semibold text-slate-700 text-center">Appeared</th>
                    <th className="px-3 py-3 font-semibold text-slate-700 text-center">Pass %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.map((row) => {
                    return (
                        <tr key={row.subjectId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{row.subjectName}</td>
                          <td className="px-3 py-3 text-center text-slate-500">{row.maxMarks}</td>
                          <td className="px-3 py-3 text-center font-semibold text-green-700">
                            {fmtRank(row.highestMark, row.highestCount)}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-700">
                            {fmtRank(row.secondHighest, row.secondHighestCount)}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-700">
                            {fmtRank(row.thirdHighest, row.thirdHighestCount)}
                          </td>
                          <td className="px-3 py-3 text-center font-semibold text-red-600">
                            {row.lowestMark ?? '—'}
                          </td>
                          <td className="px-3 py-3 text-center font-semibold text-blue-700">
                            {row.averageMark != null ? row.averageMark.toFixed(1) : '—'}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-500">
                            {row.markedStudents} / {row.totalStudents}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {row.passPercentage != null ? (
                              <span className={`font-semibold ${row.passPercentage >= 80 ? 'text-green-700' : row.passPercentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                {row.passPercentage.toFixed(1)}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PremiumCard>

          {/* Grade Distribution Matrix — Subject rows × Grade columns */}
          {showGradeTable && allGrades.length > 0 && (
            <PremiumCard accentColor="yellow" className="p-0 overflow-hidden">
              <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-200 flex items-center justify-between">
                <h2 className="text-sm font-bold text-indigo-900">Grade Distribution — Subject × Grade</h2>
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">
                  {allGrades.length} Grades
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/60">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-700 sticky left-0 bg-slate-50/90 z-10">Subject</th>
                      {allGrades.map((g) => (
                        <th key={g} className="px-3 py-3 font-semibold text-indigo-700 text-center min-w-[56px]">{g}</th>
                      ))}
                      <th className="px-3 py-3 font-semibold text-slate-700 text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics
                      .filter((s) => s.gradeDistribution && s.gradeDistribution.length > 0)
                      .map((row) => {
                        const gdMap: Record<string, number> = {};
                        let rowTotal = 0;
                        for (const gd of row.gradeDistribution!) { gdMap[gd.grade] = gd.count; rowTotal += gd.count; }
                        return (
                          <tr key={row.subjectId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-slate-800 sticky left-0 bg-white z-10">{row.subjectName}</td>
                            {allGrades.map((g) => {
                              const cnt = gdMap[g] ?? 0;
                              return (
                                <td key={g} className={`px-3 py-2.5 text-center tabular-nums ${cnt > 0 ? 'font-semibold text-slate-800' : 'text-slate-300'}`}>
                                  {cnt}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2.5 text-center font-bold text-slate-700">{rowTotal}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </PremiumCard>
          )}
        </>
      )}

      {/* Empty state when no data loaded yet */}
      {analytics.length === 0 && !loadingData && (
        <div className="mt-8 text-center text-slate-400 text-sm">
          Select an Exam and Section, then click <strong>Load Analytics</strong> to view subject-wise statistics.
        </div>
      )}
    </>
  );
}

// ── Page export ────────────────────────────────────────────────────────────────
export default function AdminAnalyticsPage() {
  return (
    <AuthGuard>
      {(user) => <AnalyticsContent user={user} />}
    </AuthGuard>
  );
}
