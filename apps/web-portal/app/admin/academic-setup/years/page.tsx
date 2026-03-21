'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { AuthGuard, } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import { type UserClaims } from '../../../../lib/auth';
import { DateInput } from '../../../../components/ui/DateInput';

// ── Types ─────────────────────────────────────────────────────────────────────
type YearStatus = 'ACTIVE' | 'UPCOMING' | 'CLOSED';

interface AcademicYear {
  id: string;
  name: string;
  startDate: string; // ISO date string from API
  endDate: string;
  isActive: boolean;
}

function deriveStatus(year: AcademicYear): YearStatus {
  if (year.isActive) return 'ACTIVE';
  const now = new Date();
  if (new Date(year.startDate) > now) return 'UPCOMING';
  return 'CLOSED';
}

interface YearForm {
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

type FormErrors = Partial<Record<keyof YearForm, string>>;

const EMPTY_FORM: YearForm = { name: '', startDate: '', endDate: '', isActive: false };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isoToDateInput(iso: string): string {
  // Convert "2025-04-01T00:00:00.000Z" → "2025-04-01"
  return iso ? iso.slice(0, 10) : '';
}

const YEAR_NAME_REGEX = /^\d{4}-\d{4}$/;

function validateForm(form: YearForm): FormErrors {
  const e: FormErrors = {};
  if (!form.name.trim()) e.name = 'Year name is required.';
  else if (!YEAR_NAME_REGEX.test(form.name.trim())) e.name = 'Format must be YYYY-YYYY, e.g., 2026-2027.';
  if (!form.startDate) e.startDate = 'Start date is required.';
  if (!form.endDate) e.endDate = 'End date is required.';
  if (form.startDate && form.endDate && form.endDate <= form.startDate) {
    e.endDate = 'End date must be after start date.';
  }
  return e;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: YearStatus }) {
  const cfg: Record<YearStatus, { bg: string; text: string; dot: string; label: string }> = {
    ACTIVE:   { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Active' },
    UPCOMING: { bg: 'bg-blue-50 border-blue-200',       text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'Upcoming' },
    CLOSED:   { bg: 'bg-slate-100 border-slate-200',    text: 'text-slate-500',   dot: 'bg-slate-400',   label: 'Closed' },
  };
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ── Slide-over panel (Add & Edit) ────────────────────────────────────────────
function YearPanel({
  open,
  editingYear,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  editingYear: AcademicYear | null;  // null = Add mode, non-null = Edit mode
  onClose: () => void;
  onSave: (form: YearForm) => void;
  saving: boolean;
}) {
  const isEdit = editingYear !== null;

  const [form, setForm] = useState<YearForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  // Seed form data when panel opens — convert ISO timestamps to YYYY-MM-DD for <input type="date">
  useEffect(() => {
    if (open) {
      setForm(
        editingYear
          ? { name: editingYear.name, startDate: isoToDateInput(editingYear.startDate), endDate: isoToDateInput(editingYear.endDate), isActive: editingYear.isActive }
          : EMPTY_FORM
      );
      setErrors({});
    }
  }, [open, editingYear]);

  function set(field: keyof Omit<YearForm, 'isActive'>) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  // Issue-238: Variant of set() for DateInput which emits a plain string value.
  function setDate(field: 'startDate' | 'endDate') {
    return (v: string) => {
      setForm((prev) => ({ ...prev, [field]: v }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function setActive(val: boolean) {
    setForm((prev) => ({ ...prev, isActive: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(form);
  }

  function handleClose() {
    setErrors({});
    onClose();
  }

  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors
     ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label={isEdit ? 'Edit Academic Year' : 'Add Academic Year'}
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? `Edit: ${editingYear!.name}` : 'Add Academic Year'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update the details for this academic session.' : 'Define a new academic session for your school.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — useEffect above seeds form with editingYear data or EMPTY_FORM on open */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5"
        >
          {/* Hidden effect: seed controlled form on mount via initialiser */}
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Year Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputCls(errors.name)}
              value={form.name}
              onChange={set('name')}
              placeholder="e.g., 2026-2027"
              maxLength={9}
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <span aria-hidden="true">&#x26A0;</span>{errors.name}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">Required format: YYYY-YYYY (e.g., 2026-2027).</p>
          </div>

          {/* Date row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <DateInput
                className={inputCls(errors.startDate)}
                value={form.startDate}
                onValueChange={setDate('startDate')}
              />
              {errors.startDate && (
                <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                End Date <span className="text-red-500">*</span>
              </label>
              <DateInput
                className={inputCls(errors.endDate)}
                value={form.endDate}
                onValueChange={setDate('endDate')}
                minDate={form.startDate || undefined}
              />
              {errors.endDate && (
                <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>
              )}
            </div>
          </div>

          {/* Status toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Status
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setActive(false)}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors
                  ${!form.isActive
                    ? 'border-slate-500 bg-slate-100 text-slate-700'
                    : 'border-slate-300 bg-white text-slate-400 hover:border-slate-400'}`}
              >
                Inactive
              </button>
              <button
                type="button"
                onClick={() => setActive(true)}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors
                  ${form.isActive
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-300 bg-white text-slate-400 hover:border-slate-400'}`}
              >
                Active
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Only one academic year should be Active at a time.</p>
          </div>

          {/* Warning shown when marking Active */}
          {form.isActive && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-700">
                Setting this year as <strong>Active</strong> will affect attendance, timetable, and exam workflows.
                Ensure no other year is already active.
              </p>
            </div>
          )}

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving&hellip;
                </>
              ) : (isEdit ? 'Update Academic Year' : 'Save Academic Year')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function AcademicYearsContent({ claims: _claims }: { claims: UserClaims }) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredYears = useMemo(() => {
    if (!searchTerm.trim()) return Array.isArray(years) ? years : [];
    const q = searchTerm.toLowerCase();
    return (Array.isArray(years) ? years : []).filter(
      (y) =>
        y.name.toLowerCase().includes(q) ||
        (y.isActive ? 'active' : 'inactive').includes(q)
    );
  }, [years, searchTerm]);

  useEffect(() => {
    void fetchYears();
  }, []);

  async function fetchYears() {
    try {
      setLoading(true);
      setLoadError('');
      const data = await bffFetch<AcademicYear[]>('/api/academic-setup/years');
      setYears(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load academic years');
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingYear(null);
    setPanelOpen(true);
  }

  function openEdit(year: AcademicYear) {
    setEditingYear(year);
    setPanelOpen(true);
  }

  function handleClose() {
    setPanelOpen(false);
    setTimeout(() => setEditingYear(null), 300);
  }

  async function handleSave(form: YearForm) {
    setSaving(true);
    setErrorMsg('');
    try {
      if (editingYear) {
        await bffFetch(`/api/academic-setup/years/${editingYear.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name.trim(),
            startDate: form.startDate,
            endDate: form.endDate,
            isActive: form.isActive,
          }),
        });
        setSuccessMsg(`Academic year "${form.name.trim()}" updated successfully.`);
      } else {
        await bffFetch('/api/academic-setup/years', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            startDate: form.startDate,
            endDate: form.endDate,
            isActive: form.isActive,
          }),
        });
        setSuccessMsg(`Academic year "${form.name.trim()}" created successfully.`);
      }
      setPanelOpen(false);
      setTimeout(() => setEditingYear(null), 300);
      await fetchYears();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to save academic year');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setErrorMsg('');
    try {
      await bffFetch<{ seeded: number }>('/api/academic-setup/years/seed-from-master', { method: 'POST' });
      setSuccessMsg('✅ Academic years generated from master template.');
      await fetchYears();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to generate academic years from master template');
    } finally {
      setSeeding(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  }

  async function handleDelete(year: AcademicYear) {
    if (year.isActive) return; // Guard: never delete active year
    if (!window.confirm(`Delete "${year.name}"? This cannot be undone.`)) return;
    setDeleting(year.id);
    setErrorMsg('');
    try {
      await bffFetch(`/api/academic-setup/years/${year.id}`, { method: 'DELETE' });
      setSuccessMsg(`Academic year "${year.name}" deleted.`);
      await fetchYears();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to delete academic year');
    } finally {
      setDeleting(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  }

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-400 mb-6" aria-label="Breadcrumb">
        <Link href="/admin/academic-setup" className="hover:text-slate-600 transition-colors">
          Academic Setup
        </Link>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-600 font-medium">Academic Years</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Academic Years</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your school&apos;s academic sessions and term dates.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {years.length === 0 && !loading && (
            <button
              type="button"
              disabled={seeding}
              onClick={() => void handleSeed()}
              className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-white px-4 py-2 text-sm font-medium text-teal-700 shadow-sm hover:bg-teal-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {seeding ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <span aria-hidden="true">✨</span>
              )}
              {seeding ? 'Generating…' : 'Generate from Master Data'}
            </button>
          )}
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Academic Year
          </button>
        </div>
      </div>

      {/* Search bar */}
      {!loading && !loadError && years.length > 0 && (
        <div className="mb-4 relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search academic years…"
            className="w-full border border-slate-200 rounded-lg pl-9 pr-9 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-8 text-center text-sm text-slate-400">
          Loading academic years…
        </div>
      )}

      {/* Load error */}
      {!loading && loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-600">
          {loadError} &mdash;{' '}
          <button type="button" onClick={() => void fetchYears()} className="underline">Retry</button>
        </div>
      )}

      {/* Table — desktop */}
      {!loading && !loadError && (
        <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="grand-table w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Year Name</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">End Date</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredYears.map((year) => (
              <tr key={year.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-4 font-semibold text-slate-900">{year.name}</td>
                <td className="px-5 py-4 text-slate-600">{fmtDate(year.startDate)}</td>
                <td className="px-5 py-4 text-slate-600">{fmtDate(year.endDate)}</td>
                <td className="px-5 py-4"><StatusBadge status={deriveStatus(year)} /></td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(year)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      title="Edit academic year"
                    >
                      Edit
                    </button>
                    {!year.isActive && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(year)}
                        disabled={deleting === year.id}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-60 transition-colors"
                        title="Delete academic year"
                      >
                        {deleting === year.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                    {deriveStatus(year) === 'UPCOMING' && (
                      <button
                        type="button"
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                        title="Activate this year"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredYears.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-sm text-slate-400">
                  {searchTerm
                    ? `No results for "${searchTerm}".`
                    : 'No academic years yet. Click \u201cAdd Academic Year\u201d to get started.'}
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      )}

      {/* Card stack — mobile */}
      {!loading && !loadError && (
        <div className="sm:hidden space-y-3">
          {filteredYears.map((year) => (
            <div key={year.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <p className="font-bold text-slate-900 text-base">{year.name}</p>
              <StatusBadge status={deriveStatus(year)} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-4">
              <div>
                <p className="font-semibold text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Start</p>
                <p>{fmtDate(year.startDate)}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">End</p>
                <p>{fmtDate(year.endDate)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openEdit(year)}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Edit
              </button>
              {deriveStatus(year) === 'UPCOMING' && (
                <button type="button" className="flex-1 rounded-lg border border-blue-200 bg-blue-50 py-2 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors">
                  Activate
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredYears.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            {searchTerm ? `No results for "${searchTerm}".` : 'No academic years yet.'}
          </div>
        )}
      </div>
      )}

      {/* Row count */}
      <p className="mt-4 text-xs text-slate-400">
        {searchTerm
          ? `${filteredYears.length} of ${years.length} academic year${years.length !== 1 ? 's' : ''} shown.`
          : `${years.length} academic year${years.length !== 1 ? 's' : ''} configured.`}
      </p>

      {/* Slide-over — editingYear=null → Add mode; editingYear set → Edit mode */}
      <YearPanel
        open={panelOpen}
        editingYear={editingYear}
        onClose={handleClose}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function AcademicYearsPage() {
  return (
    <AuthGuard>
      {(claims) => <AcademicYearsContent claims={claims} />}
    </AuthGuard>
  );
}
