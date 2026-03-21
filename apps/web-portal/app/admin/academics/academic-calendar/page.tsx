'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AcademicYear {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
}

interface CalendarEntry {
  id: string;
  slNo: number;
  date: string;
  title: string;
  type: string;
  isWorkingDay: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function typeBadge(type: string) {
  const colors: Record<string, string> = {
    Academic: 'bg-blue-50 text-blue-700 border-blue-200',
    Holiday: 'bg-red-50 text-red-700 border-red-200',
    Vacation_Start: 'bg-amber-50 text-amber-700 border-amber-200',
    Vacation_End: 'bg-amber-50 text-amber-700 border-amber-200',
    Exam: 'bg-purple-50 text-purple-700 border-purple-200',
    Exam_Start: 'bg-purple-50 text-purple-700 border-purple-200',
    Exam_End: 'bg-purple-50 text-purple-700 border-purple-200',
    Event: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Celebration: 'bg-pink-50 text-pink-700 border-pink-200',
  };
  return colors[type] ?? 'bg-slate-50 text-slate-700 border-slate-200';
}

// ── Main Page Component ──────────────────────────────────────────────────────
export default function PortalAcademicCalendarPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Calendar entries
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [search, setSearch] = useState('');

  // Generate from Master Data
  const [cloning, setCloning] = useState(false);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 5000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Load academic years on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await bffFetch<AcademicYear[]>('/api/academic/years');
        setYears(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) setSelectedYearId(data[0].id);
      } catch {
        setToastMsg({ type: 'error', text: 'Failed to load academic years' });
      }
    })();
  }, []);

  // Load calendar entries when year changes
  useEffect(() => {
    if (!selectedYearId) {
      setEntries([]);
      return;
    }
    (async () => {
      setLoadingEntries(true);
      try {
        const data = await bffFetch<CalendarEntry[]>(
          `/api/academic/academic-calendar?academicYearId=${selectedYearId}`,
        );
        setEntries(Array.isArray(data) ? data : []);
      } catch {
        setEntries([]);
      } finally {
        setLoadingEntries(false);
      }
    })();
  }, [selectedYearId]);

  // ── Generate from Master Data ────────────────────────────────────────────
  async function handleCloneFromMaster() {
    if (!selectedYearId) return;
    setCloning(true);
    try {
      const result = await bffFetch<{ cloned: number }>(
        '/api/academic/clone/academic-calendar',
        {
          method: 'POST',
          body: JSON.stringify({ academicYearId: selectedYearId }),
        },
      );
      setToastMsg({
        type: 'success',
        text: `Successfully generated ${result.cloned} calendar entries from Master Template`,
      });
      // Refresh entries
      const data = await bffFetch<CalendarEntry[]>(
        `/api/academic/academic-calendar?academicYearId=${selectedYearId}`,
      );
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      setToastMsg({
        type: 'error',
        text: e instanceof Error ? e.message : 'Failed to generate from master data',
      });
    } finally {
      setCloning(false);
    }
  }

  const filtered = search.trim()
    ? entries.filter(
        (e) =>
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          e.type.toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  return (
    <AuthGuard>
      {() => (
        <div className="min-h-screen bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Academic Calendar</h1>
                <p className="mt-1 text-sm text-gray-500">
                  View the academic calendar for your school. Use &quot;Generate from Master Data&quot; to populate from the platform template.
                </p>
              </div>
              {selectedYearId && (
                <button
                  onClick={handleCloneFromMaster}
                  disabled={cloning}
                  className="inline-flex items-center gap-2 rounded-lg border border-teal-400 bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cloning ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                    </svg>
                  )}
                  {cloning ? 'Generating...' : 'Generate from Master Data'}
                </button>
              )}
            </div>

            {/* ── Toast ──────────────────────────────────────────────── */}
            {toastMsg && (
              <div
                className={`mb-6 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-sm ${
                  toastMsg.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <span>{toastMsg.type === 'success' ? '✓' : '✗'}</span>
                <span className="flex-1">{toastMsg.text}</span>
                <button onClick={() => setToastMsg(null)} className="text-current opacity-60 hover:opacity-100">
                  ×
                </button>
              </div>
            )}

            {/* ── Academic Year Selector ─────────────────────────────── */}
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <label htmlFor="yearSelect" className="mb-2 block text-sm font-semibold text-gray-700">
                Select Academic Year
              </label>
              <select
                id="yearSelect"
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">— Choose an academic year —</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Calendar Entries Table ─────────────────────────────── */}
            {selectedYearId && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Calendar Entries
                    {entries.length > 0 && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {filtered.length}{filtered.length !== entries.length && `/${entries.length}`}
                      </span>
                    )}
                  </h2>
                  {entries.length > 0 && (
                    <div className="relative">
                      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search Holiday, Exam…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                      {search && (
                        <button
                          onClick={() => setSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {loadingEntries ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
                  </div>
                ) : entries.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400">
                    No calendar entries for this academic year. Click &quot;Generate from Master Data&quot; to populate.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/60">
                          <th className="px-4 py-3 font-semibold text-gray-600">Sl No</th>
                          <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                          <th className="px-4 py-3 font-semibold text-gray-600">Occasion / Milestone</th>
                          <th className="px-4 py-3 font-semibold text-gray-600">Type</th>
                          <th className="px-4 py-3 font-semibold text-gray-600">Working Day</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                              No entries match &ldquo;{search}&rdquo;
                            </td>
                          </tr>
                        ) : (
                          filtered.map((entry) => (
                            <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/40">
                              <td className="px-4 py-2.5 font-mono text-gray-500">{entry.slNo}</td>
                              <td className="px-4 py-2.5 text-gray-900">{fmtDate(entry.date)}</td>
                              <td className="px-4 py-2.5 text-gray-800">{entry.title}</td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${typeBadge(entry.type)}`}
                                >
                                  {entry.type.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                {entry.isWorkingDay ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    Yes
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-gray-400">
                                    <span className="h-2 w-2 rounded-full bg-gray-300" />
                                    No
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
