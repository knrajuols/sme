'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { PremiumCard } from '../../../components/ui/PremiumCard';
import { StatusPill } from '../../../components/ui/StatusPill';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Enrollment {
  id: string;
  rollNumber: string;
  class:        { id: string; name: string };
  section:      { id: string; name: string };
  academicYear: { id: string; name: string; isActive: boolean };
}

interface FeeInvoice {
  id: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  feeStructure: { feeCategory: { name: string } };
}

interface ChildProfile {
  studentId:       string;
  firstName:       string;
  lastName:        string;
  admissionNumber: string;
  enrollment:      Enrollment | null;
  feeInvoices:     FeeInvoice[];
}

interface UpcomingExam {
  id:        string;
  name:      string;
  classId:   string;
  startDate: string;
  endDate:   string;
  status:    string;
}

interface FamilySummary {
  parent: {
    id: string;
    firstName: string;
    lastName:  string;
    relation:  string;
  };
  children:      ChildProfile[];
  upcomingExams: UpcomingExam[];
}

interface TimetableEntry {
  id:        string;
  dayOfWeek: string;
  period:    { id: string; name: string; startTime: string; endTime: string };
  subject:   { id: string; name: string; code: string };
  class:     { id: string; name: string; code: string };
  section:   { id: string; name: string };
  teacher:   { id: string; firstName: string | null; lastName: string | null; employeeCode: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const t = iso.includes('T') ? new Date(iso) : new Date(`1970-01-01T${iso}`);
  return t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function teacherDisplayName(t: TimetableEntry['teacher']): string {
  const parts = [t.firstName, t.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : t.employeeCode;
}

const DAY_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];
const DAY_LABELS: Record<string,string> = {
  MONDAY:'Monday', TUESDAY:'Tuesday', WEDNESDAY:'Wednesday',
  THURSDAY:'Thursday', FRIDAY:'Friday', SATURDAY:'Saturday', SUNDAY:'Sunday',
};

// Compute which DayOfWeek enum value corresponds to today (evaluated once at module load)
const _daysMap = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'] as const;
const TODAY_ENUM: string = _daysMap[new Date().getDay()];

function groupByDay(entries: TimetableEntry[]): Record<string, TimetableEntry[]> {
  return entries.reduce<Record<string, TimetableEntry[]>>((acc, entry) => {
    if (!acc[entry.dayOfWeek]) acc[entry.dayOfWeek] = [];
    acc[entry.dayOfWeek].push(entry);
    return acc;
  }, {});
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const INVOICE_STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-800 border border-yellow-300' },
  PARTIAL:  { label: 'Partial',  cls: 'bg-blue-100   text-blue-800   border border-blue-300'   },
  PAID:     { label: 'Paid',     cls: 'bg-green-100  text-green-800  border border-green-300'  },
  OVERDUE:  { label: 'Overdue',  cls: 'bg-red-100    text-red-800    border border-red-300'    },
  WAIVED:   { label: 'Waived',   cls: 'bg-slate-100  text-slate-600  border border-slate-300'  },
};

function InvoiceStatusPill({ status }: { status: string }) {
  const m = INVOICE_STATUS_META[status] ?? INVOICE_STATUS_META.PENDING;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl bg-white shadow-xl shadow-slate-200/50 border-t-4 border-t-slate-200 p-8 animate-pulse">
          <div className="h-5 bg-slate-200 rounded w-2/5 mb-4" />
          <div className="space-y-2">
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-4/5" />
            <div className="h-3 bg-slate-100 rounded w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page content ──────────────────────────────────────────────────────────────

function FamilyPortal({ user }: { user: UserClaims }) {
  const [data, setData]           = useState<FamilySummary | null>(null);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [summary, tt] = await Promise.all([
          bffFetch<FamilySummary>('/api/portal/family/summary'),
          bffFetch<TimetableEntry[]>('/api/portal/family/timetable').catch(() => [] as TimetableEntry[]),
        ]);
        if (!cancelled) { setData(summary); setTimetable(tt); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load family summary.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const parentName = data
    ? `${data.parent.firstName} ${data.parent.lastName}`
    : '';

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Family Portal</h1>
        <p className="text-sm text-slate-500 mt-1">
          {parentName
            ? `Welcome, ${parentName} \u00b7 ${data?.parent.relation}`
            : "Track your child's progress and stay connected with the school."}
        </p>
      </div>

      {loading && <Skeleton />}

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          <p className="font-semibold">Unable to load your family portal</p>
          <p className="mt-1 text-amber-700">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* My Children */}
          <PremiumCard accentColor="purple">
            <h2 className="text-lg font-bold text-slate-900 mb-1">My Children</h2>
            <p className="text-xs text-slate-400 mb-4 uppercase tracking-wide font-semibold">
              {data.children.length} student{data.children.length !== 1 ? 's' : ''} linked
            </p>
            {data.children.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-xs text-slate-400">No students linked yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.children.map((child) => (
                  <li key={child.studentId} className="py-4">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-semibold text-slate-900 text-sm">
                        {child.firstName} {child.lastName}
                      </p>
                      <StatusPill status={child.enrollment ? 'ACTIVE' : 'PENDING'} />
                    </div>
                    <p className="text-xs text-slate-500">Adm&nbsp;{child.admissionNumber}</p>
                    {child.enrollment ? (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {child.enrollment.class.name}&nbsp;&middot;&nbsp;Section&nbsp;
                        {child.enrollment.section.name}&nbsp;&middot;&nbsp;
                        Roll&nbsp;{child.enrollment.rollNumber}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 mt-0.5">Not yet enrolled</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </PremiumCard>

          {/* Upcoming Exams */}
          <PremiumCard accentColor="yellow">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Upcoming Exams</h2>
            <p className="text-xs text-slate-400 mb-4 uppercase tracking-wide font-semibold">
              {data.upcomingExams.length} exam{data.upcomingExams.length !== 1 ? 's' : ''} scheduled
            </p>
            {data.upcomingExams.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-xs text-slate-400">No upcoming exams scheduled.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.upcomingExams.map((exam) => (
                  <li key={exam.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{exam.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(exam.startDate)}&nbsp;&ndash;&nbsp;{formatDate(exam.endDate)}
                      </p>
                    </div>
                    <StatusPill status={exam.status} />
                  </li>
                ))}
              </ul>
            )}
          </PremiumCard>

        </div>

        {/* Fee Invoices & Dues — full-width below the grid */}
        {data.children.some((c) => c.feeInvoices.length > 0) && (
          <div className="mt-6">
            <PremiumCard accentColor="red">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Fee Invoices &amp; Dues</h2>
              <p className="text-xs text-slate-400 mb-4 uppercase tracking-wide font-semibold">
                Outstanding &amp; recent fee invoices for your children
              </p>
              <div className="space-y-6">
                {data.children.map((child) =>
                  child.feeInvoices.length === 0 ? null : (
                    <div key={child.studentId}>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">
                        {child.firstName} {child.lastName}
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          Adm&nbsp;{child.admissionNumber}
                        </span>
                      </h3>
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="grand-table w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              {['Fee Category', 'Amount Due', 'Amount Paid', 'Balance', 'Status', 'Due Date'].map((h) => (
                                <th
                                  key={h}
                                  className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {child.feeInvoices.map((inv) => {
                              const balance = inv.amountDue - inv.amountPaid;
                              return (
                                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3 font-medium text-slate-800">
                                    {inv.feeStructure.feeCategory.name}
                                  </td>
                                  <td className="px-4 py-3 tabular-nums text-slate-700">{formatCurrency(inv.amountDue)}</td>
                                  <td className="px-4 py-3 tabular-nums text-slate-700">{formatCurrency(inv.amountPaid)}</td>
                                  <td className={`px-4 py-3 tabular-nums font-medium ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(balance)}
                                  </td>
                                  <td className="px-4 py-3"><InvoiceStatusPill status={inv.status} /></td>
                                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(inv.dueDate)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </PremiumCard>
          </div>
        )}

        {/* Class Timetable — grouped by day */}
        {timetable.length > 0 && (
          <div className="mt-6">
            <PremiumCard accentColor="blue">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Class Timetable</h2>
              <p className="text-xs text-slate-400 mb-5 uppercase tracking-wide font-semibold">
                Weekly schedule for your child{data && data.children.length !== 1 ? "ren's classes" : "'s class"}
              </p>

              {/* Group timetable entries by child class/section */}
              {data && (() => {
                // Build per-child timetable sub-sections (strict visibility: each child's classId + sectionId)
                const childSlots = data.children
                  .filter(c => c.enrollment)
                  .map(c => ({
                    child: c,
                    entries: timetable.filter(
                      e => e.class.id === c.enrollment!.class.id && e.section.id === c.enrollment!.section.id,
                    ),
                  }))
                  .filter(cs => cs.entries.length > 0);

                if (childSlots.length === 0) {
                  return (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                      <p className="text-sm text-slate-400">No timetable entries found for your children&apos;s classes.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-8">
                    {childSlots.map(({ child, entries }) => (
                      <div key={child.studentId}>
                        {/* Child header — only shown when multiple children */}
                        {data.children.length > 1 && (
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                              {child.firstName[0]}
                            </div>
                            <span className="text-sm font-semibold text-slate-700">
                              {child.firstName} {child.lastName}
                            </span>
                            <span className="text-xs text-slate-400">
                              {child.enrollment!.class.name} · Section {child.enrollment!.section.name}
                            </span>
                          </div>
                        )}

                        {/* Day-grouped schedule */}
                        <div className="space-y-5">
                          {DAY_ORDER.filter(day => groupByDay(entries)[day]?.length).map(day => {
                            const dayEntries = groupByDay(entries)[day]!;
                            const isToday = day === TODAY_ENUM;
                            return (
                              <div
                                key={day}
                                className={isToday
                                  ? 'rounded-xl border-2 border-blue-500 bg-blue-50/50 p-4 shadow-md shadow-blue-100'
                                  : ''}
                              >
                                <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                                  <span className="inline-block h-1 w-5 rounded bg-blue-400" />
                                  {DAY_LABELS[day]}
                                  {isToday && (
                                    <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white tracking-wide">TODAY</span>
                                  )}
                                  <span className="text-xs font-normal text-slate-400 normal-case">
                                    ({dayEntries.length} period{dayEntries.length !== 1 ? 's' : ''})
                                  </span>
                                </h3>
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                  <table className="grand-table w-full text-sm">
                                    <thead className="bg-blue-50">
                                      <tr>
                                        {['Period', 'Time', 'Subject', 'Teacher'].map(h => (
                                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {dayEntries.map(entry => (
                                        <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                                          <td className="px-4 py-3 font-medium text-slate-800">{entry.period.name}</td>
                                          <td className="px-4 py-3 tabular-nums text-slate-600 whitespace-nowrap">
                                            {formatTime(entry.period.startTime)}&nbsp;&ndash;&nbsp;{formatTime(entry.period.endTime)}
                                          </td>
                                          <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-800">{entry.subject.name}</p>
                                            <p className="text-xs text-slate-400">{entry.subject.code}</p>
                                          </td>
                                          <td className="px-4 py-3 text-slate-700">{teacherDisplayName(entry.teacher)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </PremiumCard>
          </div>
        )}
        </>
      )}
    </div>
  );
}

export default function Page() {
  return <AuthGuard>{(user) => <FamilyPortal user={user} />}</AuthGuard>;
}
