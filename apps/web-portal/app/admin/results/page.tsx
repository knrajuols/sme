'use client';

import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PremiumCard } from '../../../components/ui/PremiumCard';
import { StatusPill } from '../../../components/ui/StatusPill';

// ── Reference types ────────────────────────────────────────────────────────────
interface ExamRef       { id: string; name: string; classId: string; }
interface ClassRef      { id: string; name: string; code: string; }
interface SectionRef    { id: string; name: string; classId: string; }
interface StudentRef    { id: string; firstName: string; lastName: string; admissionNumber: string; }
interface EnrollmentRef { id: string; studentId: string; classId: string; sectionId: string; }

// ── Report card shapes ─────────────────────────────────────────────────────────
interface SubjectMarkRow {
  subjectId:     string;
  subjectName:   string;
  subjectCode:   string;
  maxMarks:      number;
  marksObtained: number;
}

interface ReportCard {
  student:     { id: string; firstName: string; lastName: string; admissionNumber: string; };
  exam:        { id: string; name: string; };
  enrollment:  { className: string; classCode: string; sectionName: string; };
  aggregate:   { totalMarks: number; percentage: number; grade: string;
                 classRank: number | null; sectionRank: number | null; };
  subjectMarks: SubjectMarkRow[];
}

type ResultApiResponse = { processed: false } | ReportCard;

// ── Helpers ────────────────────────────────────────────────────────────────────
function passingMarks(maxMarks: number): number {
  return Math.ceil(maxMarks * 0.33); // 33% — standard Indian board threshold
}

function SubjectResult({ marksObtained, maxMarks }: { marksObtained: number; maxMarks: number }) {
  const pass = marksObtained >= passingMarks(maxMarks);
  return <StatusPill status={pass ? 'PASS' : 'FAIL'} />;
}

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400';

// ── Main component ──────────────────────────────────────────────────────────────
function ResultsPage({ user: _user }: { user: UserClaims }) {
  // Reference data
  const [exams,       setExams]       = useState<ExamRef[]>([]);
  const [classes,     setClasses]     = useState<ClassRef[]>([]);
  const [sections,    setSections]    = useState<SectionRef[]>([]);
  const [students,    setStudents]    = useState<StudentRef[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRef[]>([]);
  const [loadingRef,  setLoadingRef]  = useState(true);

  // Cascade filter state
  const [examId,    setExamId]    = useState('');
  const [sectionId, setSectionId] = useState('');
  const [studentId, setStudentId] = useState('');

  // Report card state
  const [card,         setCard]         = useState<ReportCard | null>(null);
  const [notProcessed, setNotProcessed] = useState(false);
  const [loadingCard,  setLoadingCard]  = useState(false);

  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  function showBanner(type: 'success' | 'error', msg: string) {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 4500);
  }

  // Load all reference data once on mount
  useEffect(() => {
    Promise.all([
      bffFetch<ExamRef[]>('/api/academic/exams'),
      bffFetch<ClassRef[]>('/api/academic-setup/classes'),
      bffFetch<SectionRef[]>('/api/academic-setup/sections'),
      bffFetch<StudentRef[]>('/api/academic/students'),
      bffFetch<EnrollmentRef[]>('/api/academic/enrollments'),
    ])
      .then(([ex, cl, sec, stu, enr]) => {
        setExams(ex);
        setClasses(cl);
        setSections(sec);
        setStudents(stu);
        setEnrollments(enr);
      })
      .catch(() => showBanner('error', 'Failed to load reference data.'))
      .finally(() => setLoadingRef(false));
  }, []);

  // Derived: selected exam's classId
  const selectedExam  = useMemo(() => exams.find((e) => e.id === examId) ?? null, [exams, examId]);
  const classId       = selectedExam?.classId ?? '';
  const selectedClass = useMemo(() => classes.find((c) => c.id === classId) ?? null, [classes, classId]);

  // Derived: sections for the exam's class
  const filteredSections = useMemo(
    () => (classId ? sections.filter((s) => s.classId === classId) : []),
    [sections, classId],
  );

  // Derived: students enrolled in the selected section
  const filteredStudents = useMemo(() => {
    if (!sectionId) return [];
    const enrolledIds = new Set(
      enrollments.filter((e) => e.sectionId === sectionId).map((e) => e.studentId),
    );
    return students
      .filter((s) => enrolledIds.has(s.id))
      .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
  }, [enrollments, students, sectionId]);

  // Cascade resets
  useEffect(() => { setSectionId(''); setStudentId(''); setCard(null); setNotProcessed(false); }, [examId]);
  useEffect(() => { setStudentId(''); setCard(null); setNotProcessed(false); }, [sectionId]);
  useEffect(() => { setCard(null); setNotProcessed(false); }, [studentId]);

  // Fetch report card when exam + student are both selected
  useEffect(() => {
    if (!examId || !studentId) return;
    setLoadingCard(true);
    setCard(null);
    setNotProcessed(false);
    bffFetch<ResultApiResponse>(`/api/academic/results/${examId}/students/${studentId}`)
      .then((res) => {
        if ('processed' in res && res.processed === false) {
          setNotProcessed(true);
        } else {
          setCard(res as ReportCard);
        }
      })
      .catch(() => showBanner('error', 'Failed to load report card.'))
      .finally(() => setLoadingCard(false));
  }, [examId, studentId]);

  const overallPass   = card ? card.aggregate.percentage >= 33.0 : false;
  const totalMaxMarks = card ? card.subjectMarks.reduce((sum, s) => sum + s.maxMarks, 0) : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      {banner && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-lg text-white ${banner.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {banner.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-slate-900">Report Cards</h1>
          <p className="text-sm text-slate-500 mt-1">
            View processed examination results for individual students.
          </p>
        </div>

        {/* ── Cascading filter bar ─────────────────────────────────────────── */}
        <PremiumCard accentColor="yellow" className="p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1 — Exam */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Exam</label>
              <select className={inputCls} value={examId}
                onChange={(e) => setExamId(e.target.value)} disabled={loadingRef}>
                <option value="">— Select Exam —</option>
                {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            {/* 2 — Class (auto-derived from selected exam) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Class</label>
              <select className={inputCls} value={classId} disabled>
                {!classId && <option value="">— Select an Exam first —</option>}
                {selectedClass && (
                  <option value={selectedClass.id}>
                    {selectedClass.name} ({selectedClass.code})
                  </option>
                )}
              </select>
            </div>

            {/* 3 — Section */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Section</label>
              <select className={inputCls} value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                disabled={!classId || loadingRef}>
                <option value="">— Select Section —</option>
                {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* 4 — Student */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Student</label>
              <select className={inputCls} value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={!sectionId || loadingRef}>
                <option value="">— Select Student —</option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.admissionNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </PremiumCard>

        {/* ── Report Card body ──────────────────────────────────────────────── */}
        {loadingCard ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Loading report card…
          </div>
        ) : notProcessed ? (
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-10 text-center">
            <p className="text-amber-700 font-semibold text-sm">
              Results not yet processed for this exam.
            </p>
            <p className="text-amber-600 text-xs mt-1">
              Use the <strong>Process Results</strong> action on the Exams page to generate this student&apos;s report card.
            </p>
          </div>
        ) : !card ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-400 text-sm">
              Select an Exam, Section and Student above to view the report card.
            </p>
          </div>
        ) : (
          <PremiumCard accentColor="blue" className="overflow-hidden">

            {/* ── Header ────────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-5 text-white">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">
                    {card.student.firstName} {card.student.lastName}
                  </h2>
                  <p className="text-blue-100 text-sm mt-0.5">
                    Admission No:{' '}
                    <span className="font-semibold text-white">{card.student.admissionNumber}</span>
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-blue-100 text-xs uppercase tracking-wide font-semibold">Examination</p>
                  <p className="text-white font-bold text-base">{card.exam.name}</p>
                  <p className="text-blue-100 text-sm mt-0.5">
                    {card.enrollment.className}
                    {card.enrollment.classCode ? ` (${card.enrollment.classCode})` : ''}
                    {card.enrollment.sectionName ? ` · Section ${card.enrollment.sectionName}` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Subject-wise marks table ───────────────────────────────────── */}
            <div className="overflow-x-auto">
              <table className="grand-table w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-5 py-3 text-left">Subject</th>
                    <th className="px-5 py-3 text-right">Max Marks</th>
                    <th className="px-5 py-3 text-right">Passing Marks</th>
                    <th className="px-5 py-3 text-right">Marks Obtained</th>
                    <th className="px-5 py-3 text-right">%</th>
                    <th className="px-5 py-3 text-center">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {card.subjectMarks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-slate-400 text-sm">
                        No subject marks recorded for this student.
                      </td>
                    </tr>
                  ) : (
                    card.subjectMarks.map((row) => {
                      const subPct = row.maxMarks > 0
                        ? parseFloat(((row.marksObtained / row.maxMarks) * 100).toFixed(1))
                        : 0;
                      const passes = row.marksObtained >= passingMarks(row.maxMarks);
                      return (
                        <tr key={row.subjectId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-900">{row.subjectName}</p>
                            <p className="text-xs text-slate-400">{row.subjectCode}</p>
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">{row.maxMarks}</td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {passingMarks(row.maxMarks)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className={`font-semibold ${passes ? 'text-slate-900' : 'text-red-600'}`}>
                              {row.marksObtained}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">{subPct}%</td>
                          <td className="px-5 py-3 text-center">
                            <SubjectResult marksObtained={row.marksObtained} maxMarks={row.maxMarks} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Summary footer ─────────────────────────────────────────────── */}
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Total Marks */}
                <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-center shadow-xs">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Marks</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {card.aggregate.totalMarks}
                    <span className="text-sm font-normal text-slate-400">/{totalMaxMarks}</span>
                  </p>
                </div>

                {/* Percentage */}
                <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-center shadow-xs">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Percentage</p>
                  <p className="text-lg font-bold text-blue-600 mt-1">
                    {card.aggregate.percentage.toFixed(2)}%
                  </p>
                </div>

                {/* Class Rank */}
                <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-center shadow-xs">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Class Rank</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {card.aggregate.classRank != null ? `#${card.aggregate.classRank}` : '—'}
                  </p>
                </div>

                {/* Section Rank */}
                <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-center shadow-xs">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Section Rank</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {card.aggregate.sectionRank != null ? `#${card.aggregate.sectionRank}` : '—'}
                  </p>
                </div>

                {/* Final Result */}
                <div className={`rounded-xl border px-4 py-3 text-center shadow-xs ${overallPass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Final Result</p>
                  <p className={`text-lg font-extrabold mt-1 ${overallPass ? 'text-green-700' : 'text-red-700'}`}>
                    {overallPass ? 'PASS' : 'FAIL'}
                    <span className="ml-1.5 text-sm font-normal text-slate-500">
                      Grade {card.aggregate.grade}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </PremiumCard>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <AuthGuard>{(user) => <ResultsPage user={user} />}</AuthGuard>;
}

