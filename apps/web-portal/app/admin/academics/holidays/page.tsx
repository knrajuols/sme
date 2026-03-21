'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';

import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AcademicYear { id: string; name: string }

interface WeekendDay {
  dayOfWeek: string;
  isFullHoliday: boolean;
  firstHalfOff: boolean;
  secondHalfOff: boolean;
}

interface MatrixRule {
  dayOfWeek: string;
  occurrence: number;
  firstHalfOff: boolean;
  secondHalfOff: boolean;
}

interface HolidayRow {
  id?: string;
  date: string;
  occasion: string;
  type: string;
  isFullDay: boolean;
  isFirstHalf: boolean;
  isSecondHalf: boolean;
  source: string;
  isManual?: boolean;
  remarks?: string;
}

interface CalendarEntry {
  id: string;
  slNo: number;
  date: string;
  title: string;
  type: string;
  isWorkingDay: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
  FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
};
const OCCURRENCES = [1, 2, 3, 4, 5] as const;

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function fmtDate(iso: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dayName(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short' });
}

// ── Badge helpers ─────────────────────────────────────────────────────────────
function typeBadge(type: string): string {
  const colors: Record<string, string> = {
    Holiday: 'bg-red-50 text-red-700 border-red-200',
    Vacation: 'bg-amber-50 text-amber-700 border-amber-200',
    Weekend: 'bg-slate-50 text-slate-700 border-slate-200',
    'Half-Day': 'bg-blue-50 text-blue-700 border-blue-200',
    Manual: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return colors[type] ?? 'bg-gray-50 text-gray-700 border-gray-200';
}

function sourceBadge(source: string): string {
  const colors: Record<string, string> = {
    CALENDAR: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    WEEKEND: 'bg-slate-50 text-slate-700 border-slate-200',
    MATRIX: 'bg-purple-50 text-purple-700 border-purple-200',
    MANUAL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return colors[source] ?? 'bg-gray-50 text-gray-700 border-gray-200';
}

function halfLabel(h: HolidayRow): string {
  if (h.isFullDay) return 'Full Day';
  if (h.isFirstHalf) return 'First Half';
  if (h.isSecondHalf) return 'Second Half';
  return 'Full Day';
}

// ── Payload strippers ─────────────────────────────────────────────────────────
function cleanWeekend(d: WeekendDay): WeekendDay {
  return { dayOfWeek: d.dayOfWeek, isFullHoliday: d.isFullHoliday, firstHalfOff: d.firstHalfOff, secondHalfOff: d.secondHalfOff };
}
function cleanMatrix(r: MatrixRule): MatrixRule {
  return { dayOfWeek: r.dayOfWeek, occurrence: r.occurrence, firstHalfOff: r.firstHalfOff, secondHalfOff: r.secondHalfOff };
}

function toDateKey(d: string): string {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// ── BFF base path (portal uses /api/academic/...) ─────────────────────────────
const BFF = '/api/academic';

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PortalHolidayManagementPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Weekend config state
  const [weekendDays, setWeekendDays] = useState<WeekendDay[]>(
    DAYS.map((d) => ({ dayOfWeek: d, isFullHoliday: false, firstHalfOff: false, secondHalfOff: false })),
  );
  const [savingWeekend, setSavingWeekend] = useState(false);

  // Matrix rules state
  const [matrixRules, setMatrixRules] = useState<MatrixRule[]>([]);
  const [savingMatrix, setSavingMatrix] = useState(false);

  // Preview / Generated holidays
  const [previewHolidays, setPreviewHolidays] = useState<HolidayRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Holiday entries (committed to DB)
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [search, setSearch] = useState('');

  // Calendar entries from Academic Calendar (for reference awareness)
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);

  // Add manual holiday modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    date: '', occasion: '', type: 'Holiday', isFullDay: true, isFirstHalf: false, isSecondHalf: false, remarks: '',
  });
  const [addingHoliday, setAddingHoliday] = useState(false);

  // Edit modal
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    occasion: '', type: '', isFullDay: true, isFirstHalf: false, isSecondHalf: false, remarks: '',
  });
  const [updatingHoliday, setUpdatingHoliday] = useState(false);

  // Generate from Master Data
  const [cloningMaster, setCloningMaster] = useState(false);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Initialize matrix rules state
  useEffect(() => {
    const rules: MatrixRule[] = [];
    for (const d of DAYS) {
      for (const o of OCCURRENCES) {
        rules.push({ dayOfWeek: d, occurrence: o, firstHalfOff: false, secondHalfOff: false });
      }
    }
    setMatrixRules(rules);
  }, []);

  // Weekend → Matrix auto-sync
  const weekendLockedMatrix = useMemo(() => {
    const locked = new Map<string, { firstHalf: boolean; secondHalf: boolean }>();
    for (const wd of weekendDays) {
      if (wd.isFullHoliday || wd.firstHalfOff || wd.secondHalfOff) {
        for (const occ of OCCURRENCES) {
          const key = `${wd.dayOfWeek}_${occ}`;
          locked.set(key, {
            firstHalf: wd.isFullHoliday || wd.firstHalfOff,
            secondHalf: wd.isFullHoliday || wd.secondHalfOff,
          });
        }
      }
    }
    return locked;
  }, [weekendDays]);

  useEffect(() => {
    if (weekendLockedMatrix.size === 0) return;
    setMatrixRules((prev) =>
      prev.map((r) => {
        const key = `${r.dayOfWeek}_${r.occurrence}`;
        const lock = weekendLockedMatrix.get(key);
        if (!lock) return r;
        return {
          ...r,
          firstHalfOff: lock.firstHalf ? true : r.firstHalfOff,
          secondHalfOff: lock.secondHalf ? true : r.secondHalfOff,
        };
      }),
    );
  }, [weekendLockedMatrix]);

  // Fetch academic years on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await bffFetch<AcademicYear[]>(`${BFF}/years`);
        setYears(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) setSelectedYearId(data[0].id);
      } catch { /* no-op */ }
    })();
  }, []);

  // Fetch configs + holidays when year changes
  const loadConfigs = useCallback(async (yearId: string) => {
    if (!yearId) return;
    setLoading(true);
    try {
      const wk = await bffFetch<WeekendDay[]>(`${BFF}/holidays/weekend-config?academicYearId=${yearId}`);
      if (Array.isArray(wk) && wk.length > 0) {
        setWeekendDays(
          DAYS.map((d) => {
            const found = wk.find((w) => w.dayOfWeek === d);
            return found ? cleanWeekend(found) : { dayOfWeek: d, isFullHoliday: false, firstHalfOff: false, secondHalfOff: false };
          }),
        );
      } else {
        setWeekendDays(DAYS.map((d) => ({ dayOfWeek: d, isFullHoliday: false, firstHalfOff: false, secondHalfOff: false })));
      }

      const mr = await bffFetch<MatrixRule[]>(`${BFF}/holidays/matrix-rules?academicYearId=${yearId}`);
      const base: MatrixRule[] = [];
      for (const d of DAYS) {
        for (const o of OCCURRENCES) {
          const found = Array.isArray(mr) ? mr.find((r) => r.dayOfWeek === d && r.occurrence === o) : undefined;
          base.push(found ? cleanMatrix(found) : { dayOfWeek: d, occurrence: o, firstHalfOff: false, secondHalfOff: false });
        }
      }
      setMatrixRules(base);

      setLoadingHolidays(true);
      const hols = await bffFetch<HolidayRow[]>(`${BFF}/holidays?academicYearId=${yearId}`);
      setHolidays(Array.isArray(hols) ? hols : []);

      try {
        const cal = await bffFetch<CalendarEntry[]>(`${BFF}/academic-calendar?academicYearId=${yearId}`);
        setCalendarEntries(Array.isArray(cal) ? cal : []);
      } catch { setCalendarEntries([]); }
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Failed to load configs' });
    } finally {
      setLoading(false);
      setLoadingHolidays(false);
    }
  }, []);

  useEffect(() => {
    if (selectedYearId) {
      loadConfigs(selectedYearId);
      setShowPreview(false);
      setPreviewHolidays([]);
    }
  }, [selectedYearId, loadConfigs]);

  // ── Generate from Master Data ──────────────────────────────────────────────
  const handleCloneFromMaster = async () => {
    if (!selectedYearId) return;
    setCloningMaster(true);
    try {
      const result = await bffFetch<{ weekendConfigs: number; matrixRules: number; holidayEntries: number }>(
        `${BFF}/clone/holidays`,
        { method: 'POST', body: JSON.stringify({ academicYearId: selectedYearId }) },
      );
      const total = result.weekendConfigs + result.matrixRules + result.holidayEntries;
      setToast({
        type: 'success',
        text: `Successfully generated ${total} holidays from Master Template (${result.weekendConfigs} weekend configs, ${result.matrixRules} matrix rules, ${result.holidayEntries} entries)`,
      });
      // Refresh all configs
      await loadConfigs(selectedYearId);
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Failed to generate from master data' });
    } finally {
      setCloningMaster(false);
    }
  };

  // ── Weekend config handlers ────────────────────────────────────────────────
  const toggleWeekend = (dayOfWeek: string, field: 'isFullHoliday' | 'firstHalfOff' | 'secondHalfOff') => {
    setWeekendDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        const updated = { ...d, [field]: !d[field] };
        if (field === 'isFullHoliday' && updated.isFullHoliday) {
          updated.firstHalfOff = false;
          updated.secondHalfOff = false;
        }
        if ((field === 'firstHalfOff' || field === 'secondHalfOff') && (updated.firstHalfOff || updated.secondHalfOff)) {
          updated.isFullHoliday = false;
        }
        return updated;
      }),
    );
  };

  const saveWeekendConfig = async () => {
    setSavingWeekend(true);
    try {
      await bffFetch(`${BFF}/holidays/weekend-config`, {
        method: 'POST',
        body: JSON.stringify({ academicYearId: selectedYearId, days: weekendDays.map(cleanWeekend) }),
      });
      setToast({ type: 'success', text: 'Weekend configuration saved' });
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save' });
    } finally {
      setSavingWeekend(false);
    }
  };

  // ── Matrix rules handlers ──────────────────────────────────────────────────
  const toggleMatrix = (dayOfWeek: string, occurrence: number, field: 'firstHalfOff' | 'secondHalfOff') => {
    const key = `${dayOfWeek}_${occurrence}`;
    const lock = weekendLockedMatrix.get(key);
    if (lock) {
      if (field === 'firstHalfOff' && lock.firstHalf) return;
      if (field === 'secondHalfOff' && lock.secondHalf) return;
    }
    setMatrixRules((prev) =>
      prev.map((r) => {
        if (r.dayOfWeek !== dayOfWeek || r.occurrence !== occurrence) return r;
        return { ...r, [field]: !r[field] };
      }),
    );
  };

  const clearMatrix = () => {
    setMatrixRules((prev) =>
      prev.map((r) => {
        const k = `${r.dayOfWeek}_${r.occurrence}`;
        const lock = weekendLockedMatrix.get(k);
        return {
          ...r,
          firstHalfOff: lock?.firstHalf ?? false,
          secondHalfOff: lock?.secondHalf ?? false,
        };
      }),
    );
    setToast({ type: 'success', text: 'Matrix reset to weekend defaults' });
  };

  const saveMatrixRules = async () => {
    const active = matrixRules.filter((r) => r.firstHalfOff || r.secondHalfOff);
    setSavingMatrix(true);
    try {
      await bffFetch(`${BFF}/holidays/matrix-rules`, {
        method: 'POST',
        body: JSON.stringify({ academicYearId: selectedYearId, rules: active.map(cleanMatrix) }),
      });
      setToast({ type: 'success', text: 'Matrix rules saved' });
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save' });
    } finally {
      setSavingMatrix(false);
    }
  };

  // ── Generate / Preview ─────────────────────────────────────────────────────
  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const activeMatrix = matrixRules.filter((r) => r.firstHalfOff || r.secondHalfOff);
      const res = await bffFetch<{ holidays: HolidayRow[]; yearName?: string }>(`${BFF}/holidays/preview`, {
        method: 'POST',
        body: JSON.stringify({
          academicYearId: selectedYearId,
          weekendDays: weekendDays.map(cleanWeekend),
          matrixRules: activeMatrix.map(cleanMatrix),
        }),
      });
      setPreviewHolidays(res.holidays ?? []);
      setShowPreview(true);
      setToast({ type: 'success', text: `Preview: ${res.holidays?.length ?? 0} holiday entries` });
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Preview failed' });
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await bffFetch<{ holidays: HolidayRow[]; saved: number }>(`${BFF}/holidays/generate`, {
        method: 'POST',
        body: JSON.stringify({ academicYearId: selectedYearId }),
      });
      setToast({ type: 'success', text: `Generated & saved ${res.saved ?? 0} holiday entries` });
      setShowPreview(false);
      setPreviewHolidays([]);
      const hols = await bffFetch<HolidayRow[]>(`${BFF}/holidays?academicYearId=${selectedYearId}`);
      setHolidays(Array.isArray(hols) ? hols : []);
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Generation failed' });
    } finally {
      setGenerating(false);
    }
  };

  // ── Manual holiday CRUD ────────────────────────────────────────────────────
  const handleAddHoliday = async () => {
    if (!addForm.date || !addForm.occasion) return;
    setAddingHoliday(true);
    try {
      await bffFetch(`${BFF}/holidays`, {
        method: 'POST',
        body: JSON.stringify({ academicYearId: selectedYearId, ...addForm }),
      });
      setToast({ type: 'success', text: 'Holiday added' });
      setShowAddModal(false);
      setAddForm({ date: '', occasion: '', type: 'Holiday', isFullDay: true, isFirstHalf: false, isSecondHalf: false, remarks: '' });
      const hols = await bffFetch<HolidayRow[]>(`${BFF}/holidays?academicYearId=${selectedYearId}`);
      setHolidays(Array.isArray(hols) ? hols : []);
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Failed to add' });
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleUpdateHoliday = async () => {
    if (!editId) return;
    setUpdatingHoliday(true);
    try {
      await bffFetch(`${BFF}/holidays/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      setToast({ type: 'success', text: 'Holiday updated' });
      setEditId(null);
      const hols = await bffFetch<HolidayRow[]>(`${BFF}/holidays?academicYearId=${selectedYearId}`);
      setHolidays(Array.isArray(hols) ? hols : []);
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Failed to update' });
    } finally {
      setUpdatingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('Delete this holiday entry?')) return;
    try {
      await bffFetch(`${BFF}/holidays/${id}`, { method: 'DELETE' });
      setToast({ type: 'success', text: 'Holiday deleted' });
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Failed to delete' });
    }
  };

  // ── Calendar reference rows ────────────────────────────────────────────────
  const calendarRefRows = useMemo(() => {
    const committedDates = new Set(holidays.map((h) => toDateKey(h.date)));
    const refs: HolidayRow[] = [];
    let vacStart: string | null = null;
    let vacTitle = '';
    const sorted = [...calendarEntries].sort((a, b) => a.slNo - b.slNo);
    for (const entry of sorted) {
      const dateStr = toDateKey(entry.date);
      if (entry.type === 'Vacation_Start') {
        vacStart = dateStr;
        vacTitle = entry.title;
      } else if (entry.type === 'Vacation_End' && vacStart) {
        const [sy, sm, sd] = vacStart.split('-').map(Number);
        const [ey, em, ed] = dateStr.split('-').map(Number);
        const cursor = new Date(Date.UTC(sy, sm - 1, sd));
        const end = new Date(Date.UTC(ey, em - 1, ed));
        while (cursor <= end) {
          const ds = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
          if (!committedDates.has(ds)) {
            refs.push({
              date: ds, occasion: vacTitle, type: 'Vacation',
              isFullDay: true, isFirstHalf: false, isSecondHalf: false,
              source: 'CALENDAR', remarks: 'From Academic Calendar (not yet generated)',
            });
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        vacStart = null;
        vacTitle = '';
      } else if (entry.type === 'Holiday') {
        if (!committedDates.has(dateStr)) {
          refs.push({
            date: dateStr, occasion: entry.title, type: 'Holiday',
            isFullDay: true, isFirstHalf: false, isSecondHalf: false,
            source: 'CALENDAR', remarks: 'From Academic Calendar (not yet generated)',
          });
        }
      }
    }
    return refs;
  }, [calendarEntries, holidays]);

  const mergedHolidays = useMemo(() => {
    return [...holidays, ...calendarRefRows].sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, calendarRefRows]);

  const filtered = mergedHolidays.filter((h) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return h.occasion.toLowerCase().includes(s) || h.type.toLowerCase().includes(s) || h.date.includes(s);
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AuthGuard>
      {() => (
        <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
          {/* Toast */}
          {toast && (
            <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium
              ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
              {toast.text}
            </div>
          )}

          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h1 className="text-2xl font-bold text-slate-800">Holiday Management</h1>
              <div className="flex items-center gap-3">
                {selectedYearId && (
                  <button
                    onClick={handleCloneFromMaster}
                    disabled={cloningMaster}
                    className="px-4 py-2 text-sm font-medium text-white bg-teal-500 border border-teal-400 rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {cloningMaster ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                      </svg>
                    )}
                    {cloningMaster ? 'Generating...' : 'Generate from Master Data'}
                  </button>
                )}
                {selectedYearId && calendarEntries.length === 0 && !loading && (
                  <span className="text-xs text-amber-600 font-medium" title="Academic Calendar must be generated first">
                    Calendar required
                  </span>
                )}
                <label className="text-sm font-medium text-slate-600">Academic Year</label>
                <select
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-300"
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                >
                  <option value="">Select Year</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedYearId && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
                Select an Academic Year to configure holidays.
              </div>
            )}

            {selectedYearId && loading && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
                Loading configuration...
              </div>
            )}

            {selectedYearId && !loading && (
              <>
                {/* ── Section 1: Weekend Holidays Configuration ──────────────── */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-700">Weekend Holidays Configuration</h2>
                    <button
                      onClick={saveWeekendConfig}
                      disabled={savingWeekend}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingWeekend ? 'Saving...' : 'Save Weekend Config'}
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    Mark days that are recurring weekend holidays. Full Holiday = entire day off. Half-day = only one half is off.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Day</th>
                          <th className="text-center px-3 py-2 font-medium text-slate-600">Full Holiday</th>
                          <th className="text-center px-3 py-2 font-medium text-slate-600">First Half Off</th>
                          <th className="text-center px-3 py-2 font-medium text-slate-600">Second Half Off</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekendDays.map((d) => (
                          <tr key={d.dayOfWeek} className="border-t border-slate-100 hover:bg-slate-50/50">
                            <td className="px-3 py-2 font-medium text-slate-700">{d.dayOfWeek.charAt(0) + d.dayOfWeek.slice(1).toLowerCase()}</td>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={d.isFullHoliday} onChange={() => toggleWeekend(d.dayOfWeek, 'isFullHoliday')} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={d.firstHalfOff} onChange={() => toggleWeekend(d.dayOfWeek, 'firstHalfOff')} disabled={d.isFullHoliday} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-30" />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={d.secondHalfOff} onChange={() => toggleWeekend(d.dayOfWeek, 'secondHalfOff')} disabled={d.isFullHoliday} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-30" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Section 2: Monthly Holiday Matrix ───────────────────────── */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-700">Monthly Holiday Matrix</h2>
                    <div className="flex gap-2">
                      <button onClick={clearMatrix} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200">
                        Clear Matrix
                      </button>
                      <button onClick={saveMatrixRules} disabled={savingMatrix} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                        {savingMatrix ? 'Saving...' : 'Save Matrix Rules'}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    Configure the &quot;Nth occurrence&quot; policy. E.g., &quot;2nd &amp; 4th Saturday = Full Holiday&quot;.
                    Check both First Half and Second Half for a full holiday.
                    <span className="ml-1 text-indigo-600 font-medium">Checkboxes locked by Weekend Config are shown in indigo.</span>
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left px-2 py-2 font-medium text-slate-600 min-w-[80px]">Day</th>
                          {OCCURRENCES.map((o) => (
                            <th key={o} colSpan={2} className="text-center px-1 py-2 font-medium text-slate-600">{ordinal(o)}</th>
                          ))}
                        </tr>
                        <tr className="bg-slate-50/50">
                          <th></th>
                          {OCCURRENCES.map((o) => (
                            <React.Fragment key={o}>
                              <th className="text-center px-1 py-1 text-xs text-slate-500">1st H</th>
                              <th className="text-center px-1 py-1 text-xs text-slate-500">2nd H</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map((d) => (
                          <tr key={d} className="border-t border-slate-100 hover:bg-slate-50/50">
                            <td className="px-2 py-2 font-medium text-slate-700">{DAY_LABELS[d]}</td>
                            {OCCURRENCES.map((o) => {
                              const rule = matrixRules.find((r) => r.dayOfWeek === d && r.occurrence === o);
                              const lockKey = `${d}_${o}`;
                              const lock = weekendLockedMatrix.get(lockKey);
                              const firstLocked = !!lock?.firstHalf;
                              const secondLocked = !!lock?.secondHalf;
                              return (
                                <React.Fragment key={o}>
                                  <td className="px-1 py-2 text-center">
                                    <input type="checkbox" checked={rule?.firstHalfOff ?? false} onChange={() => toggleMatrix(d, o, 'firstHalfOff')} disabled={firstLocked}
                                      className={`w-3.5 h-3.5 rounded focus:ring-purple-500 ${firstLocked ? 'text-indigo-600 opacity-70 cursor-not-allowed' : 'text-purple-600'}`}
                                    />
                                  </td>
                                  <td className="px-1 py-2 text-center">
                                    <input type="checkbox" checked={rule?.secondHalfOff ?? false} onChange={() => toggleMatrix(d, o, 'secondHalfOff')} disabled={secondLocked}
                                      className={`w-3.5 h-3.5 rounded focus:ring-purple-500 ${secondLocked ? 'text-indigo-600 opacity-70 cursor-not-allowed' : 'text-purple-600'}`}
                                    />
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Dependency Warning: Calendar Required ──────────────────── */}
                {calendarEntries.length === 0 && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
                    <svg className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Academic Calendar Required</p>
                      <p className="text-sm text-amber-700 mt-0.5">
                        Please generate the Academic Calendar for this Academic Year before generating holidays.
                        Go to <span className="font-medium">Academic Calendar</span> and click &quot;Generate from Master Data&quot; first.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Section 3: Generate / Preview Actions ───────────────────── */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <h2 className="text-lg font-semibold text-slate-700">Generate Holidays</h2>
                    <div className="flex gap-3 ml-auto">
                      <button onClick={handlePreview} disabled={previewing || calendarEntries.length === 0} className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed">
                        {previewing ? 'Loading Preview...' : 'Preview Holidays'}
                      </button>
                      <button onClick={handleGenerate} disabled={generating || calendarEntries.length === 0} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        {generating ? 'Generating...' : 'Generate & Save'}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    Save your Weekend &amp; Matrix configs first, then preview or generate. Generation expands Calendar vacation ranges
                    and applies weekend + matrix patterns. Manual holidays are never overwritten.
                  </p>
                </div>

                {/* ── Section 4: Preview Table ────────────────────────────────── */}
                {showPreview && previewHolidays.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-amber-700">Preview ({previewHolidays.length} entries)</h2>
                      <button onClick={() => setShowPreview(false)} className="text-sm text-slate-500 hover:text-slate-700">Dismiss</button>
                    </div>
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr className="bg-amber-50">
                            <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Academic Year</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Date</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Day</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Occasion</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Session</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Source</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewHolidays.map((h, i) => (
                            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                              <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                              <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{years.find((y) => y.id === selectedYearId)?.name ?? '-'}</td>
                              <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{fmtDate(h.date)}</td>
                              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{dayName(h.date)}</td>
                              <td className="px-3 py-2 text-slate-700">{h.occasion}</td>
                              <td className="px-3 py-2"><span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${typeBadge(h.type)}`}>{h.type}</span></td>
                              <td className="px-3 py-2 text-slate-600">{halfLabel(h)}</td>
                              <td className="px-3 py-2"><span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${sourceBadge(h.source)}`}>{h.source}</span></td>
                              <td className="px-3 py-2 text-slate-500 text-xs">{h.remarks ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Section 5: Holiday Entries List (DB) ────────────────────── */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-slate-700">Holiday Entries</h2>
                      {calendarRefRows.length > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                          {calendarRefRows.length} from Calendar (unsaved)
                        </span>
                      )}
                      {filtered.length !== mergedHolidays.length && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-full">
                          {filtered.length} of {mergedHolidays.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input type="text" placeholder="Search holidays..." value={search} onChange={(e) => setSearch(e.target.value)}
                          className="border border-slate-300 rounded-lg pl-8 pr-8 py-2 text-sm w-56 focus:ring-2 focus:ring-indigo-300"
                        />
                        <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {search && (
                          <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <button onClick={() => setShowAddModal(true)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                        + Add Holiday
                      </button>
                    </div>
                  </div>

                  {loadingHolidays && <p className="text-sm text-slate-500 py-4 text-center">Loading holidays...</p>}

                  {!loadingHolidays && mergedHolidays.length === 0 && (
                    <p className="text-sm text-slate-500 py-8 text-center">
                      No holiday entries yet. Use &quot;Generate from Master Data&quot; or configure weekends &amp; matrix rules above, then click &quot;Generate &amp; Save&quot;.
                    </p>
                  )}

                  {!loadingHolidays && mergedHolidays.length > 0 && filtered.length === 0 && (
                    <p className="text-sm text-slate-500 py-4 text-center">No holidays match &quot;{search}&quot;</p>
                  )}

                  {!loadingHolidays && filtered.length > 0 && (
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr className="bg-slate-50">
                            <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Date</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Day</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Occasion</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Session</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Source</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Remarks</th>
                            <th className="text-center px-3 py-2 font-medium text-slate-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((h, i) => {
                            const isCalendarRef = !h.id && h.remarks?.includes('not yet generated');
                            return (
                              <tr key={h.id ?? `ref-${i}`} className={`border-t border-slate-100 hover:bg-slate-50/50 ${isCalendarRef ? 'bg-amber-50/50' : ''}`}>
                                <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{fmtDate(h.date)}</td>
                                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{dayName(h.date)}</td>
                                <td className="px-3 py-2 text-slate-700">{h.occasion}</td>
                                <td className="px-3 py-2"><span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${typeBadge(h.type)}`}>{h.type}</span></td>
                                <td className="px-3 py-2 text-slate-600">{halfLabel(h)}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${sourceBadge(h.source)}`}>{h.source}</span>
                                  {isCalendarRef && (
                                    <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded border border-amber-300">Unsaved</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-slate-500 text-xs">{h.remarks ?? '-'}</td>
                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                  {h.id ? (
                                    <>
                                      <button
                                        onClick={() => { setEditId(h.id!); setEditForm({ occasion: h.occasion, type: h.type, isFullDay: h.isFullDay, isFirstHalf: h.isFirstHalf, isSecondHalf: h.isSecondHalf, remarks: h.remarks ?? '' }); }}
                                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium mr-2"
                                      >Edit</button>
                                      <button onClick={() => handleDeleteHoliday(h.id!)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">Calendar Ref</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Add Holiday Modal ──────────────────────────────────────────── */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Add Manual Holiday</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
                    <input type="date" value={addForm.date} onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Occasion</label>
                    <input type="text" value={addForm.occasion} onChange={(e) => setAddForm((f) => ({ ...f, occasion: e.target.value }))} placeholder="e.g. Rainy Day Holiday" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Type</label>
                    <select value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-300">
                      <option value="Holiday">Holiday</option>
                      <option value="Half-Day">Half-Day</option>
                      <option value="Vacation">Vacation</option>
                      <option value="Special">Special</option>
                    </select>
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="radio" name="addHalf" checked={addForm.isFullDay} onChange={() => setAddForm((f) => ({ ...f, isFullDay: true, isFirstHalf: false, isSecondHalf: false }))} className="text-indigo-600" /> Full Day
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="radio" name="addHalf" checked={addForm.isFirstHalf} onChange={() => setAddForm((f) => ({ ...f, isFullDay: false, isFirstHalf: true, isSecondHalf: false }))} className="text-indigo-600" /> First Half
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="radio" name="addHalf" checked={addForm.isSecondHalf} onChange={() => setAddForm((f) => ({ ...f, isFullDay: false, isFirstHalf: false, isSecondHalf: true }))} className="text-indigo-600" /> Second Half
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Remarks</label>
                    <input type="text" value={addForm.remarks} onChange={(e) => setAddForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Optional" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                  <button onClick={handleAddHoliday} disabled={addingHoliday || !addForm.date || !addForm.occasion} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {addingHoliday ? 'Adding...' : 'Add Holiday'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Edit Holiday Modal ─────────────────────────────────────────── */}
          {editId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Edit Holiday</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Occasion</label>
                    <input type="text" value={editForm.occasion} onChange={(e) => setEditForm((f) => ({ ...f, occasion: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Type</label>
                    <select value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-300">
                      <option value="Holiday">Holiday</option>
                      <option value="Half-Day">Half-Day</option>
                      <option value="Vacation">Vacation</option>
                      <option value="Weekend">Weekend</option>
                      <option value="Special">Special</option>
                    </select>
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="radio" name="editHalf" checked={editForm.isFullDay} onChange={() => setEditForm((f) => ({ ...f, isFullDay: true, isFirstHalf: false, isSecondHalf: false }))} className="text-indigo-600" /> Full Day
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="radio" name="editHalf" checked={editForm.isFirstHalf} onChange={() => setEditForm((f) => ({ ...f, isFullDay: false, isFirstHalf: true, isSecondHalf: false }))} className="text-indigo-600" /> First Half
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="radio" name="editHalf" checked={editForm.isSecondHalf} onChange={() => setEditForm((f) => ({ ...f, isFullDay: false, isFirstHalf: false, isSecondHalf: true }))} className="text-indigo-600" /> Second Half
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Remarks</label>
                    <input type="text" value={editForm.remarks} onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Optional" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setEditId(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                  <button onClick={handleUpdateHoliday} disabled={updatingHoliday} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {updatingHoliday ? 'Updating...' : 'Update Holiday'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AuthGuard>
  );
}
