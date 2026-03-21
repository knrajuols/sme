'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { fetchProfile } from '../../../lib/profileApi';
import { PremiumCard } from '../../../components/ui/PremiumCard';
import type { AccentColor } from '../../../components/ui/PremiumCard';
import { StatusPill } from '../../../components/ui/StatusPill';

// ── Types ─────────────────────────────────────────────────────────────────────
interface UpcomingExam {
  id: string;
  name: string;
  startDate: string;
  status: string;
}

interface AdminSummary {
  totalStudents: number;
  totalTeachers: number;
  attendance: {
    presentToday: number;
    totalToday: number;
    percentage: number;
  };
  upcomingExams: UpcomingExam[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}


// ── Internal content component ────────────────────────────────────────────────
function AdminDashboardContent({ claims }: { claims: UserClaims }) {
  const [summary, setSummary]         = useState<AdminSummary | null>(null);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(true);
  const [seeding, setSeeding]         = useState(false);
  const [seedError, setSeedError]     = useState('');
  const [schoolName, setSchoolName]   = useState<string | null>(null);
  const [tenantCode, setTenantCode]   = useState<string | null>(null);

  const fetchSummary = async (cancelled: { value: boolean }) => {
    try {
      const data = await bffFetch<AdminSummary>('/api/dashboard/summary');
      if (!cancelled.value) setSummary(data);
    } catch (e) {
      if (!cancelled.value) setError(e instanceof Error ? e.message : '[ERR-DASH-5001] Could not load dashboard');
    } finally {
      if (!cancelled.value) setLoading(false);
    }
  };

  useEffect(() => {
    const cancelled = { value: false };
    fetchSummary(cancelled);
    return () => { cancelled.value = true; };
  }, []);

  useEffect(() => {
    fetchProfile<{ schoolName?: string; tenantCode?: string }>()
      .then((p) => {
        setSchoolName(p.schoolName ?? null);
        setTenantCode(p.tenantCode ?? null);
      })
      .catch(() => { /* display falls back to tenantId */ });
  }, []);

  const handleSeedDefaults = async () => {
    setSeeding(true);
    setSeedError('');
    try {
      await bffFetch('/api/academic/seed-defaults', { method: 'POST' });
      // Refresh dashboard so the welcome card disappears
      setLoading(true);
      const cancelled = { value: false };
      fetchSummary(cancelled);
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : 'Quick Setup failed. Please try again.');
    } finally {
      setSeeding(false);
    }
  };

  const isBlankWorkspace =
    !loading && summary !== null &&
    summary.totalStudents === 0 &&
    summary.totalTeachers === 0;

  const attendancePct = summary?.attendance.percentage ?? 0;
  const attendanceColor = attendancePct >= 75 ? 'text-green-600' : 'text-red-500';

  const kpiCards: Array<{
    label: string;
    value: string | number | undefined;
    sub?: string;
    icon: string;
    accentColor: AccentColor;
    valueClass: string;
  }> = [
    {
      label: 'Total Students',
      value: summary?.totalStudents,
      icon: '🎒',
      accentColor: 'blue',
      valueClass: 'text-blue-700',
    },
    {
      label: 'Total Teachers',
      value: summary?.totalTeachers,
      icon: '👩‍🏫',
      accentColor: 'purple',
      valueClass: 'text-purple-700',
    },
    {
      label: "Today's Attendance",
      value: summary ? `${attendancePct}%` : undefined,
      sub: summary ? `${summary.attendance.presentToday} / ${summary.attendance.totalToday} present` : undefined,
      icon: '📋',
      accentColor: 'green',
      valueClass: attendanceColor,
    },
  ];

  const quickActions = [
    { href: '/admin/attendance', icon: '📋', label: 'Attendance',  desc: 'Mark and review daily attendance' },
    { href: '/admin/marks',      icon: '✏️',  label: 'Marks Entry', desc: 'Enter bulk exam marks' },
    { href: '/admin/students',   icon: '🎒', label: 'Students',    desc: 'Manage student enrolments' },
  ];

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">School Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-medium text-slate-700">
              {schoolName ?? tenantCode ?? 'Your School'}
            </span>
            {tenantCode && schoolName && (
              <>&ensp;<span className="text-slate-400">({tenantCode})</span></>
            )}
            {claims.email && (
              <>&ensp;&bull;&ensp;<span className="font-medium text-slate-700">{claims.email}</span></>
            )}
          </p>
        </div>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          SCHOOL ADMIN
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── PAN-India Quick Setup welcome card (shown only for blank workspaces) ── */}
      {isBlankWorkspace && (
        <PremiumCard
          accentColor="purple"
          className="mb-8 p-8 flex flex-col items-center text-center gap-6 ring-2 ring-purple-400 shadow-xl shadow-purple-100 animate-pulse-once"
        >
          <div className="text-6xl">🏫</div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Welcome to Your New School ERP!
            </h2>
            <p className="max-w-xl text-sm text-slate-500 leading-relaxed">
              Your workspace is currently empty. Click the button below to generate your school’s
              Academic Years, Classes, Sections, and Subjects directly from the platform master template.
            </p>
          </div>

          {seedError && (
            <div className="w-full max-w-md rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {seedError}
            </div>
          )}

          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-8 py-3 text-base font-bold text-white shadow-lg shadow-purple-200 transition-all hover:bg-purple-700 hover:shadow-purple-300 hover:scale-105 active:scale-100 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {seeding ? (
              <>
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Setting up…
              </>
            ) : (
              <>✅ Generate from Master Data</>
            )}
          </button>

          <p className="text-xs text-slate-400">
            Copies master template data into your school. Safe to run once.
          </p>
        </PremiumCard>
      )}

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpiCards.map((card) => (
          <PremiumCard key={card.label} accentColor={card.accentColor} className="p-6 flex items-center gap-4">
            <span className="text-4xl">{card.icon}</span>
            <div>
              <p className="text-xs text-slate-500">{card.label}</p>
              {loading ? (
                <div className="mt-1 h-7 w-20 animate-pulse rounded bg-slate-200" />
              ) : (
                <>
                  <p className={`text-2xl font-bold ${card.valueClass}`}>
                    {card.value ?? '—'}
                  </p>
                  {card.sub && <p className="mt-0.5 text-xs text-slate-500">{card.sub}</p>}
                </>
              )}
            </div>
          </PremiumCard>
        ))}
      </div>

      {/* Bottom split: Upcoming Exams + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Upcoming Exams */}
        <PremiumCard accentColor="purple" className="p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Upcoming Exams
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-10 w-full animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : summary && summary.upcomingExams.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {summary.upcomingExams.map((exam) => (
                <li key={exam.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{exam.name}</p>
                    <p className="text-xs text-slate-400">{fmtDate(exam.startDate)}</p>
                  </div>
                  <StatusPill status={exam.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No upcoming exams scheduled.</p>
          )}
        </PremiumCard>

        {/* Quick Actions */}
        <PremiumCard accentColor="blue" className="p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Quick Actions
          </h2>
          <div className="space-y-3">
            {quickActions.map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="flex items-center gap-4 rounded-lg border border-slate-100 p-4 transition-shadow hover:shadow-md"
              >
                <span className="text-2xl">{action.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{action.label}</p>
                  <p className="text-xs text-slate-500">{action.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </PremiumCard>
      </div>
    </>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  return (
    <AuthGuard>
      {(claims) => <AdminDashboardContent claims={claims} />}
    </AuthGuard>
  );
}
