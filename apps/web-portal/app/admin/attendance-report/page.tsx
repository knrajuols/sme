'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PremiumCard } from '../../../components/ui/PremiumCard';

// ── Reference types ────────────────────────────────────────────────────────────
interface YearRef  { id: string; name: string; startDate: string; endDate: string; isActive: boolean; }
interface ClassRef { id: string; name: string; code: string; academicYearId: string; }
interface SectionRef { id: string; name: string; classId: string; className: string; sectionId: string; sectionName: string; }

// ── Report response types ──────────────────────────────────────────────────────
interface StudentReportRow {
  studentId: string;
  rollNumber: string;
  studentName: string;
  P: number; OD: number; SL: number; CL: number; HL: number; A: number;
  attendancePct: number;
  dayStatus?: string;
}
interface TeacherReportRow {
  teacherId: string;
  employeeCode: string;
  teacherName: string;
  P: number; OD: number; SL: number; CL: number; A: number;
  avgSwipeIn: string;
  avgSwipeOut: string;
  dayStatus?: string;
  swipeIn?: string;
  swipeOut?: string;
}
interface ReportResponse {
  totalWorkingDays: number;
  className: string;
  sectionName: string;
  academicYearName: string;
  isDraft?: boolean;
  rows?: StudentReportRow[];
  teacherRows?: TeacherReportRow[];
}

type ReviewType = 'day' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';
type ViewType = 'students' | 'teachers';

const STORAGE_KEY = 'sme_attendance_report_filters';
interface SavedFilters {
  classId: string;
  sectionId: string;
  reviewType: ReviewType;
  viewType: ViewType;
  month: string;      // YYYY-MM
  startMonth: string; // YYYY-MM
  endMonth: string;   // YYYY-MM
  dayDate: string;    // YYYY-MM-DD
}

function saveFilters(f: SavedFilters) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* noop */ }
}
function loadFilters(): SavedFilters | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// ── Helper: month string to date range ─────────────────────────────────────────
function monthStart(ym: string): string {
  return `${ym}-01`;
}
function monthEnd(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate(); // last day of the month
  return `${ym}-${String(last).padStart(2, '0')}`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthDiff(start: string, end: string): number {
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}

// ── Main component ─────────────────────────────────────────────────────────────
function AttendanceReportPage({ user: _user }: { user: UserClaims }) {
  // Reference data
  const [years,    setYears]    = useState<YearRef[]>([]);
  const [classes,  setClasses]  = useState<ClassRef[]>([]);
  const [sections, setSections] = useState<SectionRef[]>([]);

  // Filter state
  const [classId,    setClassId]    = useState('');
  const [sectionId,  setSectionId]  = useState('');
  const [reviewType, setReviewType] = useState<ReviewType>('monthly');
  const [viewType,   setViewType]   = useState<ViewType>('students');
  const [month,      setMonth]      = useState(currentMonth());
  const [startMonth, setStartMonth] = useState(currentMonth());
  const [endMonth,   setEndMonth]   = useState(currentMonth());
  const [dayDate,    setDayDate]    = useState(todayDate());

  // Report data
  const [report, setReport]       = useState<ReportResponse | null>(null);
  const [loading, setLoading]     = useState(false);
  const [loadingRef, setLoadingRef] = useState(true);
  const [banner, setBanner]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const restoredRef = useRef(false);

  function showBanner(type: 'success' | 'error', msg: string) {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 6000);
  }

  // ── Load reference data ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      bffFetch<YearRef[]>('/api/academic-setup/years'),
      bffFetch<ClassRef[]>('/api/academic-setup/classes'),
    ])
      .then(([yr, cls]) => {
        setYears(yr);
        setClasses(cls);

        const saved = loadFilters();
        if (saved) {
          if (saved.classId && cls.some((c) => c.id === saved.classId)) {
            setClassId(saved.classId);
            restoredRef.current = true;
          }
          if (saved.reviewType) setReviewType(saved.reviewType);
          if (saved.viewType) setViewType(saved.viewType as ViewType);
          if (saved.month) setMonth(saved.month);
          if (saved.startMonth) setStartMonth(saved.startMonth);
          if (saved.endMonth) setEndMonth(saved.endMonth);
          if (saved.dayDate) setDayDate(saved.dayDate);
        }
      })
      .catch(() => showBanner('error', 'Failed to load reference data.'))
      .finally(() => setLoadingRef(false));
  }, []);

  // ── When class changes → load class-sections ────────────────────────────
  useEffect(() => {
    setSectionId('');
    setReport(null);
    if (!classId) { setSections([]); return; }

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
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist filters ──────────────────────────────────────────────────────
  useEffect(() => {
    if (classId) saveFilters({ classId, sectionId, reviewType, viewType, month, startMonth, endMonth, dayDate });
  }, [classId, sectionId, reviewType, viewType, month, startMonth, endMonth, dayDate]);

  // ── Compute date range from review type ──────────────────────────────────
  const dateRange = useMemo((): { start: string; end: string; valid: boolean; error?: string } => {
    if (reviewType === 'day') {
      if (!dayDate) return { start: '', end: '', valid: false, error: 'Select a date.' };
      return { start: dayDate, end: dayDate, valid: true };
    }
    if (reviewType === 'monthly') {
      return { start: monthStart(month), end: monthEnd(month), valid: true };
    }
    if (reviewType === 'yearly') {
      const activeYear = years.find((y) => y.isActive);
      if (!activeYear) return { start: '', end: '', valid: false, error: 'No active academic year found.' };
      return {
        start: activeYear.startDate.slice(0, 10),
        end: activeYear.endDate.slice(0, 10),
        valid: true,
      };
    }
    // quarterly or half-yearly
    if (!startMonth || !endMonth) return { start: '', end: '', valid: false, error: 'Select start and end months.' };
    const diff = monthDiff(startMonth, endMonth);
    if (reviewType === 'quarterly' && diff !== 3) {
      return { start: '', end: '', valid: false, error: `Quarterly requires exactly 3 months (currently ${diff}).` };
    }
    if (reviewType === 'half-yearly' && diff !== 6) {
      return { start: '', end: '', valid: false, error: `Half-Yearly requires exactly 6 months (currently ${diff}).` };
    }
    if (startMonth > endMonth) return { start: '', end: '', valid: false, error: 'Start month must be before end month.' };
    return { start: monthStart(startMonth), end: monthEnd(endMonth), valid: true };
  }, [reviewType, month, startMonth, endMonth, dayDate, years]);

  // ── Generate report ──────────────────────────────────────────────────────
  const generateReport = useCallback(async () => {
    if (!classId || !sectionId) { showBanner('error', 'Select a class and section.'); return; }
    if (!dateRange.valid) { showBanner('error', dateRange.error ?? 'Invalid date range.'); return; }

    setLoading(true);
    setBanner(null);
    setReport(null);

    try {
      const qs = `classId=${encodeURIComponent(classId)}&sectionId=${encodeURIComponent(sectionId)}&startDate=${dateRange.start}&endDate=${dateRange.end}&viewType=${viewType}`;
      const data = await bffFetch<ReportResponse>(`/api/academic/attendance/report?${qs}`);
      setReport(data);
      const hasData = viewType === 'teachers' ? (data.teacherRows?.length ?? 0) > 0 : (data.rows?.length ?? 0) > 0;
      if (!hasData) {
        showBanner('error', 'No data found for the selected filters. Ensure attendance has been locked for the period.');
      }
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  }, [classId, sectionId, dateRange, viewType]);

  const canGenerate = !!(classId && sectionId && dateRange.valid);
  const isDayView = reviewType === 'day';

  // ── Render ───────────────────────────────────────────────────────────────
  if (loadingRef) {
    return <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>;
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Attendance Report</h1>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
          REVIEW
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

      {/* Student / Teacher toggle */}
      <div className="mb-4 flex border-b border-slate-200">
        <button
          onClick={() => { setViewType('students'); setReport(null); }}
          className={`px-6 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            viewType === 'students'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Students
        </button>
        <button
          onClick={() => { setViewType('teachers'); setReport(null); }}
          className={`px-6 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            viewType === 'teachers'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Teachers
        </button>
      </div>

      {/* Filters */}
      <PremiumCard accentColor="blue" className="p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Class */}
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Class</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">— Select Class —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Section */}
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Section</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={sectionId}
              onChange={(e) => { setSectionId(e.target.value); setReport(null); }}
              disabled={sections.length === 0}
            >
              <option value="">— Select Section —</option>
              {sections.map((s) => <option key={s.sectionId} value={s.sectionId}>{s.sectionName}</option>)}
            </select>
          </div>

          {/* Review Type */}
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Review Period</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={reviewType}
              onChange={(e) => { setReviewType(e.target.value as ReviewType); setReport(null); }}
            >
              <option value="day">Day (Single Date)</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly (3 months)</option>
              <option value="half-yearly">Half-Yearly (6 months)</option>
              <option value="yearly">Yearly (Full Academic Year)</option>
            </select>
          </div>

          {/* Day date picker */}
          {reviewType === 'day' && (
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
              <input
                type="date"
                value={dayDate}
                max={todayDate()}
                onChange={(e) => { setDayDate(e.target.value); setReport(null); }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Month selector — shown for Monthly */}
          {reviewType === 'monthly' && (
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => { setMonth(e.target.value); setReport(null); }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Start/End Month selectors — shown for quarterly & half-yearly */}
          {(reviewType === 'quarterly' || reviewType === 'half-yearly') && (
            <>
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">Start Month</label>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(e) => { setStartMonth(e.target.value); setReport(null); }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">End Month</label>
                <input
                  type="month"
                  value={endMonth}
                  onChange={(e) => { setEndMonth(e.target.value); setReport(null); }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Yearly info */}
          {reviewType === 'yearly' && (
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Academic Year</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {years.find((y) => y.isActive)
                  ? `${years.find((y) => y.isActive)!.name} (${years.find((y) => y.isActive)!.startDate.slice(0, 10)} to ${years.find((y) => y.isActive)!.endDate.slice(0, 10)})`
                  : 'No active academic year'}
              </div>
            </div>
          )}

          {/* Validation error for date range */}
          {!dateRange.valid && dateRange.error && (
            <div className="w-full text-xs text-red-500 mt-1">{dateRange.error}</div>
          )}

          {/* Generate button */}
          <div className="flex items-end">
            <button
              onClick={generateReport}
              disabled={!canGenerate || loading}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </div>
      </PremiumCard>

      {/* Report Table */}
      {report && (
        <PremiumCard accentColor="purple" className="p-0 overflow-hidden">
          {/* Report header */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div><span className="text-slate-500">Academic Year:</span> <strong className="text-slate-800">{report.academicYearName}</strong></div>
              <div><span className="text-slate-500">Class:</span> <strong className="text-slate-800">{report.className}</strong></div>
              <div><span className="text-slate-500">Section:</span> <strong className="text-slate-800">{report.sectionName}</strong></div>
              <div><span className="text-slate-500">Period:</span> <strong className="text-slate-800">{dateRange.start}{dateRange.start !== dateRange.end ? ` to ${dateRange.end}` : ''}</strong></div>
              <div>
                <span className="text-slate-500">Total Working Days:</span>{' '}
                <strong className="rounded bg-teal-100 px-2 py-0.5 text-teal-800">{report.totalWorkingDays}</strong>
              </div>
              {report.isDraft && (
                <div>
                  <span className="rounded bg-amber-100 border border-amber-400 px-3 py-0.5 text-xs font-bold text-amber-800 uppercase tracking-wider">Draft — Not Locked</span>
                </div>
              )}
            </div>
          </div>

          {/* Student Table */}
          {viewType === 'students' && report.rows && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/60">
                  <tr>
                    <th className="px-3 py-3 font-semibold text-slate-700 text-center w-14">#</th>
                    <th className="px-3 py-3 font-semibold text-slate-700 w-48">Student Name</th>
                    <th className="px-3 py-3 font-semibold text-slate-700 text-center w-12">Roll</th>
                    {isDayView ? (
                      <th className="px-3 py-3 font-semibold text-center text-slate-700 w-20">Status</th>
                    ) : (
                      <>
                        <th className="px-3 py-3 font-semibold text-center text-green-700 w-12">P</th>
                        <th className="px-3 py-3 font-semibold text-center text-indigo-700 w-12">OD</th>
                        <th className="px-3 py-3 font-semibold text-center text-orange-700 w-12">SL</th>
                        <th className="px-3 py-3 font-semibold text-center text-purple-700 w-12">CL</th>
                        <th className="px-3 py-3 font-semibold text-center text-cyan-700 w-12">HL</th>
                        <th className="px-3 py-3 font-semibold text-center text-red-700 w-12">A</th>
                        <th className="px-3 py-3 font-semibold text-center text-slate-700 w-20">Att %</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, idx) => (
                    <tr key={row.studentId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="px-3 py-2 text-center text-slate-500 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800 text-sm whitespace-nowrap">{row.studentName}</td>
                      <td className="px-3 py-2 text-center text-slate-600 text-xs">{row.rollNumber}</td>
                      {isDayView ? (
                        <td className="px-3 py-2 text-center"><StatusBadge status={row.dayStatus ?? '--'} /></td>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-center font-medium text-green-700">{row.P}</td>
                          <td className="px-3 py-2 text-center font-medium text-indigo-700">{row.OD}</td>
                          <td className="px-3 py-2 text-center font-medium text-orange-700">{row.SL}</td>
                          <td className="px-3 py-2 text-center font-medium text-purple-700">{row.CL}</td>
                          <td className="px-3 py-2 text-center font-medium text-cyan-700">{row.HL}</td>
                          <td className="px-3 py-2 text-center font-medium text-red-700">{row.A}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                              row.attendancePct >= 90 ? 'bg-green-100 text-green-800' :
                              row.attendancePct >= 75 ? 'bg-yellow-100 text-yellow-800' :
                              row.attendancePct >= 50 ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {row.attendancePct}%
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {report.rows.length === 0 && (
                    <tr>
                      <td colSpan={isDayView ? 4 : 10} className="px-4 py-8 text-center text-slate-400 text-sm">
                        No attendance data found for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Teacher Table */}
          {viewType === 'teachers' && report.teacherRows && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/60">
                  <tr>
                    <th className="px-3 py-3 font-semibold text-slate-700 text-center w-14">#</th>
                    <th className="px-3 py-3 font-semibold text-slate-700 w-24">Emp ID</th>
                    <th className="px-3 py-3 font-semibold text-slate-700 w-48">Name</th>
                    {isDayView ? (
                      <>
                        <th className="px-3 py-3 font-semibold text-center text-slate-700 w-20">Status</th>
                        <th className="px-3 py-3 font-semibold text-center text-slate-700 w-24">Swipe In</th>
                        <th className="px-3 py-3 font-semibold text-center text-slate-700 w-24">Swipe Out</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-3 font-semibold text-center text-green-700 w-12">P</th>
                        <th className="px-3 py-3 font-semibold text-center text-indigo-700 w-12">OD</th>
                        <th className="px-3 py-3 font-semibold text-center text-orange-700 w-12">SL</th>
                        <th className="px-3 py-3 font-semibold text-center text-purple-700 w-12">CL</th>
                        <th className="px-3 py-3 font-semibold text-center text-red-700 w-12">A</th>
                        <th className="px-3 py-3 font-semibold text-center text-slate-700 w-24">Avg Swipe-In</th>
                        <th className="px-3 py-3 font-semibold text-center text-slate-700 w-24">Avg Swipe-Out</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.teacherRows.map((row, idx) => (
                    <tr key={row.teacherId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="px-3 py-2 text-center text-slate-500 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs font-mono">{row.employeeCode}</td>
                      <td className="px-3 py-2 font-medium text-slate-800 text-sm whitespace-nowrap">{row.teacherName}</td>
                      {isDayView ? (
                        <>
                          <td className="px-3 py-2 text-center"><StatusBadge status={row.dayStatus ?? '--'} /></td>
                          <td className="px-3 py-2 text-center text-slate-700 text-xs font-mono">{row.swipeIn ?? '--'}</td>
                          <td className="px-3 py-2 text-center text-slate-700 text-xs font-mono">{row.swipeOut ?? '--'}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-center font-medium text-green-700">{row.P}</td>
                          <td className="px-3 py-2 text-center font-medium text-indigo-700">{row.OD}</td>
                          <td className="px-3 py-2 text-center font-medium text-orange-700">{row.SL}</td>
                          <td className="px-3 py-2 text-center font-medium text-purple-700">{row.CL}</td>
                          <td className="px-3 py-2 text-center font-medium text-red-700">{row.A}</td>
                          <td className="px-3 py-2 text-center text-slate-700 text-xs font-mono">{row.avgSwipeIn}</td>
                          <td className="px-3 py-2 text-center text-slate-700 text-xs font-mono">{row.avgSwipeOut}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  {report.teacherRows.length === 0 && (
                    <tr>
                      <td colSpan={isDayView ? 6 : 10} className="px-4 py-8 text-center text-slate-400 text-sm">
                        No teacher attendance data found for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </PremiumCard>
      )}

      {/* Empty state */}
      {!report && !loading && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          Select Class, Section, and Review Period, then click <strong>Generate Report</strong>.
        </div>
      )}
    </>
  );
}

// ── Status badge helper ────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  P:  'bg-green-100 text-green-800',
  OD: 'bg-indigo-100 text-indigo-800',
  SL: 'bg-orange-100 text-orange-800',
  CL: 'bg-purple-100 text-purple-800',
  HL: 'bg-cyan-100 text-cyan-800',
  A:  'bg-red-100 text-red-800',
};
function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-600';
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${cls}`}>{status}</span>;
}

export default function Page() {
  return (
    <AuthGuard>
      {(user) => <AttendanceReportPage user={user} />}
    </AuthGuard>
  );
}
