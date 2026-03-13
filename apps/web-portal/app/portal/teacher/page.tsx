'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { PremiumCard } from '../../../components/ui/PremiumCard';
import { StatusPill } from '../../../components/ui/StatusPill';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClassAssignment {
  id: string;
  class:   { id: string; name: string; code: string };
  section: { id: string; name: string };
}

interface SubjectAssignment {
  id: string;
  subject: { id: string; name: string; code: string; type: string };
}

interface TeacherSummary {
  teacher: {
    id: string;
    firstName: string | null;
    lastName:  string | null;
    designation: string;
    employeeCode: string;
  };
  assignments: ClassAssignment[];
  subjects:    SubjectAssignment[];
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

// ── Timetable helpers ─────────────────────────────────────────────────────────────

const DAY_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];
const DAY_LABELS: Record<string,string> = {
  MONDAY:'Monday', TUESDAY:'Tuesday', WEDNESDAY:'Wednesday',
  THURSDAY:'Thursday', FRIDAY:'Friday', SATURDAY:'Saturday', SUNDAY:'Sunday',
};

// Compute which DayOfWeek enum value corresponds to today (evaluated once at module load)
const _daysMap = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'] as const;
const TODAY_ENUM: string = _daysMap[new Date().getDay()];

function formatTime(iso: string): string {
  if (!iso) return '';
  const t = iso.includes('T') ? new Date(iso) : new Date(`1970-01-01T${iso}`);
  return t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function groupByDay(entries: TimetableEntry[]): Record<string, TimetableEntry[]> {
  return entries.reduce<Record<string, TimetableEntry[]>>((acc, entry) => {
    if (!acc[entry.dayOfWeek]) acc[entry.dayOfWeek] = [];
    acc[entry.dayOfWeek].push(entry);
    return acc;
  }, {});
}

// ── Page content ──────────────────────────────────────────────────────────────

function TeacherWorkspace({ user }: { user: UserClaims }) {
  const [data, setData]             = useState<TeacherSummary | null>(null);
  const [timetable, setTimetable]   = useState<TimetableEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [summary, tt] = await Promise.all([
          bffFetch<TeacherSummary>('/api/portal/teacher/summary'),
          bffFetch<TimetableEntry[]>('/api/portal/teacher/timetable').catch(() => [] as TimetableEntry[]),
        ]);
        if (!cancelled) { setData(summary); setTimetable(tt); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load teacher workspace.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fullName = data
    ? [data.teacher.firstName, data.teacher.lastName].filter(Boolean).join(' ')
    : '';

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Teacher Workspace</h1>
        <p className="text-sm text-slate-500 mt-1">
          {fullName
            ? `Welcome, ${fullName} \u00b7 ${data?.teacher.designation}`
            : 'Your workspace at a glance.'}
        </p>
      </div>

      {loading && <Skeleton />}

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          <p className="font-semibold">Unable to load your workspace</p>
          <p className="mt-1 text-amber-700">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* My Assigned Classes */}
          <PremiumCard accentColor="blue">
            <h2 className="text-lg font-bold text-slate-900 mb-1">My Assigned Classes</h2>
            <p className="text-xs text-slate-400 mb-4 uppercase tracking-wide font-semibold">
              {data.assignments.length} class assignment{data.assignments.length !== 1 ? 's' : ''}
            </p>
            {data.assignments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-xs text-slate-400">No class assignments yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.assignments.map((a) => (
                  <li key={a.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{a.class.name}</p>
                      <p className="text-xs text-slate-500">
                        Code&nbsp;{a.class.code}&nbsp;&middot;&nbsp;Section&nbsp;{a.section.name}
                      </p>
                    </div>
                    <StatusPill status="ACTIVE" />
                  </li>
                ))}
              </ul>
            )}
          </PremiumCard>

          {/* My Subjects */}
          <PremiumCard accentColor="green">
            <h2 className="text-lg font-bold text-slate-900 mb-1">My Subjects</h2>
            <p className="text-xs text-slate-400 mb-4 uppercase tracking-wide font-semibold">
              {data.subjects.length} subject{data.subjects.length !== 1 ? 's' : ''} assigned
            </p>
            {data.subjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-xs text-slate-400">No subjects assigned yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.subjects.map((s) => (
                  <li key={s.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{s.subject.name}</p>
                      <p className="text-xs text-slate-500">Code&nbsp;{s.subject.code}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      {s.subject.type}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PremiumCard>

        </div>

        {/* My Weekly Schedule — full-width below the grid */}
        <div className="mt-6">
          <PremiumCard accentColor="orange">
            <h2 className="text-lg font-bold text-slate-900 mb-1">My Weekly Schedule</h2>
            <p className="text-xs text-slate-400 mb-5 uppercase tracking-wide font-semibold">
              {timetable.length} period{timetable.length !== 1 ? 's' : ''} assigned
            </p>

            {timetable.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <p className="text-sm text-slate-400">No timetable entries assigned yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {DAY_ORDER.filter(day => groupByDay(timetable)[day]?.length).map(day => {
                  const dayEntries = groupByDay(timetable)[day]!;
                  const isToday = day === TODAY_ENUM;
                  return (
                    <div
                      key={day}
                      className={isToday
                        ? 'rounded-xl border-2 border-blue-500 bg-blue-50/50 p-4 shadow-md shadow-blue-100'
                        : ''}
                    >
                      <h3 className="text-sm font-bold text-orange-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <span className="inline-block h-1 w-5 rounded bg-orange-400" />
                        {DAY_LABELS[day]}
                        {isToday && (
                          <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white tracking-wide">TODAY</span>
                        )}
                        <span className="text-xs font-normal text-slate-400 normal-case">({dayEntries.length} period{dayEntries.length !== 1 ? 's' : ''})</span>
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="grand-table w-full text-sm">
                          <thead className="bg-orange-50">
                            <tr>
                              {['Period', 'Time', 'Subject', 'Class / Section'].map(h => (
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
                                <td className="px-4 py-3 text-slate-700">
                                  {entry.class.name}&nbsp;&middot;&nbsp;Sec&nbsp;{entry.section.name}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PremiumCard>
        </div>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return <AuthGuard>{(user) => <TeacherWorkspace user={user} />}</AuthGuard>;
}
