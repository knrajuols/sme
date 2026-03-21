'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AcademicYear {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
}

interface ValidationError {
  row: number;
  column: number;
  columnName: string;
  value: string;
  expected: string;
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
export default function AcademicCalendarPage() {
  // State
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedYearName, setSelectedYearName] = useState('');
  const [selectedYearRange, setSelectedYearRange] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // CSV review state
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [reviewDone, setReviewDone] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Calendar entries (already uploaded)
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [search, setSearch] = useState('');

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
        const data = await bffFetch<AcademicYear[]>('/api/web-admin/academic-years');
        setYears(data);
      } catch (e) {
        console.error('Failed to load academic years:', e);
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
          `/api/web-admin/academic-calendar?academicYearId=${selectedYearId}`,
        );
        setEntries(data);
      } catch {
        setEntries([]);
      } finally {
        setLoadingEntries(false);
      }
    })();
  }, [selectedYearId]);

  // Year selection handler
  function handleYearChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedYearId(id);
    const year = years.find((y) => y.id === id);
    setSelectedYearName(year?.name ?? '');
    if (year?.startDate && year?.endDate) {
      const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      setSelectedYearRange({ start: fmt(year.startDate), end: fmt(year.endDate) });
    } else {
      setSelectedYearRange(null);
    }
    // Reset review state when year changes
    setCsvContent('');
    setFileName('');
    setValidationErrors([]);
    setReviewDone(false);
  }

  // ── Button 1: Download Template ──────────────────────────────────────────
  async function handleDownloadTemplate() {
    setLoading(true);
    try {
      const data = await bffFetch<{ content: string }>(
        '/api/web-admin/academic-calendar/template',
      );
      const blob = new Blob([data.content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Academic_Calendar_Template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMsg({ type: 'success', text: 'Template downloaded successfully' });
    } catch (e) {
      setToastMsg({ type: 'error', text: e instanceof Error ? e.message : 'Failed to download template' });
    } finally {
      setLoading(false);
    }
  }

  // ── File picker handler ──────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input value so selecting the same file again always fires onChange
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setValidationErrors([]);
    setReviewDone(false);
    setCsvContent('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  }

  // ── Button 2: Upload for Review ─────────────────────────────────────────
  async function handleReview() {
    if (!csvContent || !selectedYearName) {
      setToastMsg({ type: 'error', text: 'Please select an academic year and upload a CSV file' });
      return;
    }
    setReviewing(true);
    setReviewDone(false);
    try {
      const result = await bffFetch<{ errors: ValidationError[] }>(
        '/api/web-admin/academic-calendar/validate',
        {
          method: 'POST',
          body: JSON.stringify({
            csvContent,
            academicYearName: selectedYearName,
            academicYearId: selectedYearId,
          }),
        },
      );
      setValidationErrors(result.errors);
      setReviewDone(true);
      if (result.errors.length === 0) {
        setToastMsg({ type: 'success', text: 'CSV validation passed — no mismatches found' });
      } else {
        setToastMsg({ type: 'error', text: `Found ${result.errors.length} mismatch(es) — review the table below` });
      }
    } catch (e) {
      setToastMsg({ type: 'error', text: e instanceof Error ? e.message : 'Validation request failed' });
    } finally {
      setReviewing(false);
    }
  }

  // ── Button 3: Upload to Portal ──────────────────────────────────────────
  async function handleUpload() {
    if (!csvContent || !selectedYearId) return;
    setUploading(true);
    try {
      const result = await bffFetch<{ uploaded: number }>(
        '/api/web-admin/academic-calendar/upload',
        {
          method: 'POST',
          body: JSON.stringify({
            csvContent,
            academicYearId: selectedYearId,
          }),
        },
      );
      setToastMsg({ type: 'success', text: `Successfully uploaded ${result.uploaded} calendar entries` });
      // Reset review state
      setCsvContent('');
      setFileName('');
      setValidationErrors([]);
      setReviewDone(false);
      // Reload entries
      const data = await bffFetch<CalendarEntry[]>(
        `/api/web-admin/academic-calendar?academicYearId=${selectedYearId}`,
      );
      setEntries(data);
    } catch (e) {
      setToastMsg({ type: 'error', text: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }

  const canUpload = reviewDone && validationErrors.length === 0 && csvContent.length > 0;

  return (
    <AuthGuard>
      {() => (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Academic Calendar</h1>
            <p className="mt-1 text-sm text-gray-500">
              Download the template, fill it in, upload for review, then push to the portal.
            </p>
          </div>

          {/* ── Toast ──────────────────────────────────────────────────── */}
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

          {/* ── Academic Year Selector ──────────────────────────────────── */}
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <label htmlFor="yearSelect" className="mb-2 block text-sm font-semibold text-gray-700">
              Select Academic Year
            </label>
            <select
              id="yearSelect"
              value={selectedYearId}
              onChange={handleYearChange}
              className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">— Choose an academic year —</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
            {selectedYearRange && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm">
                <span className="font-semibold text-indigo-700">Date Range:</span>
                <span className="text-indigo-900 font-medium">{selectedYearRange.start}</span>
                <span className="text-indigo-400">→</span>
                <span className="text-indigo-900 font-medium">{selectedYearRange.end}</span>
                <span className="ml-2 text-xs text-indigo-600 font-medium">All CSV dates must fall within this range</span>
              </div>
            )}
          </div>

          {/* ── 3-Button Workflow ───────────────────────────────────────── */}
          {selectedYearId && (
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">
                Calendar Upload Workflow
              </h2>
              <div className="flex flex-wrap items-start gap-4">
                {/* Button 1: Download Template */}
                <div className="flex flex-col items-start gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                    1
                  </span>
                  <button
                    onClick={handleDownloadTemplate}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                      </svg>
                    )}
                    Download CSV Template
                  </button>
                </div>

                {/* Button 2: Upload for Review */}
                <div className="flex flex-col items-start gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-600">
                    2
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6h.1a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      {reviewDone ? 'Upload CSV File for Review' : fileName ? fileName : 'Upload CSV File for Review'}
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                        className="hidden"
                      />
                    </label>
                    {csvContent && !reviewDone && (
                      <button
                        onClick={handleReview}
                        disabled={reviewing}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
                      >
                        {reviewing ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        Review for Mismatches
                      </button>
                    )}
                  </div>
                </div>

                {/* Button 3: Upload to Portal */}
                <div className="flex flex-col items-start gap-2">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      canUpload
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    3
                  </span>
                  <button
                    onClick={handleUpload}
                    disabled={!canUpload || uploading}
                    className={`inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed ${
                      canUpload
                        ? 'border-emerald-400 bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'border-gray-200 bg-gray-100 text-gray-400'
                    }`}
                  >
                    {uploading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                    Upload to Portal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Validation Mismatches Table ─────────────────────────────── */}
          {reviewDone && validationErrors.length > 0 && (
            <div className="mb-6 rounded-xl border border-red-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-red-700">
                Data Mismatches Found ({validationErrors.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-red-100 bg-red-50/50">
                      <th className="px-4 py-3 font-semibold text-red-800">Row</th>
                      <th className="px-4 py-3 font-semibold text-red-800">Column</th>
                      <th className="px-4 py-3 font-semibold text-red-800">Column Name</th>
                      <th className="px-4 py-3 font-semibold text-red-800">Value Found</th>
                      <th className="px-4 py-3 font-semibold text-red-800">Expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationErrors.map((err, idx) => (
                      <tr key={idx} className="border-b border-red-50 hover:bg-red-50/30">
                        <td className="px-4 py-2.5 font-mono text-red-600">{err.row}</td>
                        <td className="px-4 py-2.5 font-mono text-red-600">{err.column}</td>
                        <td className="px-4 py-2.5 text-gray-700">{err.columnName}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-900">
                          {err.value || <span className="italic text-gray-400">(empty)</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{err.expected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reviewDone && validationErrors.length === 0 && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <svg className="h-6 w-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-emerald-700">
                All rows passed validation — ready to upload to the portal.
              </span>
            </div>
          )}

          {/* ── Uploaded Calendar Entries Table ─────────────────────────── */}
          {selectedYearId && (() => {
            const filtered = search.trim()
              ? entries.filter((e) =>
                  e.title.toLowerCase().includes(search.toLowerCase()) ||
                  e.type.toLowerCase().includes(search.toLowerCase()),
                )
              : entries;
            return (
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
                  No calendar entries uploaded for this academic year yet.
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
                      ) : filtered.map((entry) => (
                        <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/40">
                          <td className="px-4 py-2.5 font-mono text-gray-500">{entry.slNo}</td>
                          <td className="px-4 py-2.5 text-gray-900">{fmtDate(entry.date)}</td>
                          <td className="px-4 py-2.5 text-gray-800">{entry.title}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${typeBadge(
                                entry.type,
                              )}`}
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
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            );
          })()}
        </div>
      </div>
      )}
    </AuthGuard>
  );
}
