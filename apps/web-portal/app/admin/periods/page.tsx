'use client';

import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';

// ── Reference types ────────────────────────────────────────────────────────
interface YearRef { id: string; name: string; }

// ── Domain types ───────────────────────────────────────────────────────────
interface Period {
  id:             string;
  name:           string;
  startTime:      string;       // stored as 24-hr "HH:MM"
  endTime:        string;       // stored as 24-hr "HH:MM"
  orderIndex:     number;       // daily schedule position (1-based for seeded rows)
  academicYearId: string | null;
  duration?:      string;       // e.g. "45 min" — computed by backend
}

interface PeriodForm {
  name:           string;
  startTime:      string;
  endTime:        string;
  orderIndex:     number;
  academicYearId: string;
  cascadeUpdates?: boolean;
}

type FormErrors = Partial<Record<keyof PeriodForm, string>>;

const EMPTY_FORM: PeriodForm = {
  name:           '',
  startTime:      '',
  endTime:        '',
  orderIndex:     0,
  academicYearId: '',
  cascadeUpdates: true,
};

// ── Time-math utilities ────────────────────────────────────────────────────

/** Convert 24-hr "HH:MM" to 12-hr "h:MM AM/PM" for display. */
function fmt12(hhmm: string): string {
  if (!hhmm) return '';
  const [hStr, mStr = '00'] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12    = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${suffix}`;
}

/** Total minutes from a 24-hr "HH:MM" string. Returns NaN on bad input. */
function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return isNaN(h) || isNaN(m) ? NaN : h * 60 + m;
}

/** Human-readable duration. Returns '' for invalid or non-positive input. */
function calcDuration(start: string, end: string): string {
  const diff = toMins(end) - toMins(start);
  if (!isFinite(diff) || diff <= 0) return '';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

// ── Form validation ────────────────────────────────────────────────────────
function validateForm(f: PeriodForm): FormErrors {
  const e: FormErrors = {};
  if (!f.name.trim()) e.name      = 'Period name is required.';
  if (!f.startTime)   e.startTime = 'Start time is required.';
  if (!f.endTime)     e.endTime   = 'End time is required.';
  if (f.startTime && f.endTime && f.startTime >= f.endTime)
    e.endTime = 'End time must be after start time.';
  return e;
}

// ── PeriodPanel ────────────────────────────────────────────────────────────
function PeriodPanel({
  open, editing, years, nextPeriod,
  onClose, onSave, saving,
}: {
  open:       boolean;
  editing:    Period | null;
  years:      YearRef[];
  /** The period immediately after `editing` in orderIndex sequence — for cascade-count preview. */
  nextPeriod: Period | null;
  onClose:    () => void;
  onSave:     (form: Partial<PeriodForm>) => void;
  saving:     boolean;
}) {
  const isEdit = editing !== null;
  const [form, setForm]     = useState<PeriodForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [cascadeUpdates, setCascadeUpdates] = useState(true);

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              name:           editing.name,
              startTime:      editing.startTime      ?? '',
              endTime:        editing.endTime        ?? '',
              orderIndex:     editing.orderIndex     ?? 0,
              academicYearId: editing.academicYearId ?? '',
              cascadeUpdates: true,
            }
          : EMPTY_FORM,
      );
      setCascadeUpdates(true);
      setErrors({});
    }
  }, [open, editing]);

  function setField<K extends keyof PeriodForm>(k: K, v: PeriodForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(
      isEdit
        ? { name: form.name, startTime: form.startTime, endTime: form.endTime,
            orderIndex: form.orderIndex, academicYearId: form.academicYearId,
            cascadeUpdates }
        : form,
    );
  }

  const durationPreview = calcDuration(form.startTime, form.endTime);

  // Show cascade controls when editing and endTime has changed
  const endTimeChanged = isEdit && editing && form.endTime !== '' && form.endTime !== editing.endTime;

  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
     ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300
          ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose} aria-hidden="true"
      />
      <div
        role="dialog" aria-label={isEdit ? 'Edit Period' : 'Add Period'} aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">{isEdit ? 'Edit Period' : 'Add Period'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update timing, name, or order. Cascade will prompt for adjacent period.' : 'Define a new timetable slot.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Period Name <span className="text-red-500">*</span>
            </label>
            <input type="text" className={inputCls(errors.name)}
              value={form.name} onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Period 1" maxLength={50} autoFocus />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Start / End time — native time pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input type="time" className={inputCls(errors.startTime)}
                value={form.startTime}
                onChange={(e) => setField('startTime', e.target.value)} />
              {errors.startTime && <p className="mt-1 text-xs text-red-600">{errors.startTime}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                End Time <span className="text-red-500">*</span>
              </label>
              <input type="time" className={inputCls(errors.endTime)}
                value={form.endTime}
                onChange={(e) => setField('endTime', e.target.value)} />
              {errors.endTime && <p className="mt-1 text-xs text-red-600">{errors.endTime}</p>}
            </div>
          </div>

          {/* Live duration badge */}
          {durationPreview && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-blue-700">Duration: {durationPreview}</span>
            </div>
          )}

          {/* Cascade toggle — shown whenever endTime is being changed on an edit */}
          {endTimeChanged && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cascadeUpdates}
                  onChange={(e) => setCascadeUpdates(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-amber-800">
                  <span className="font-semibold block mb-0.5">Shift all subsequent periods automatically</span>
                  {cascadeUpdates && nextPeriod
                    ? `Every period after this one will shift by the same delta to keep the schedule gapless.`
                    : `Only this period will be updated; subsequent periods stay unchanged.`
                  }
                </span>
              </label>
            </div>
          )}

          {/* Order index */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Order <span className="text-slate-400 font-normal">(position in daily schedule)</span>
            </label>
            <input type="number" min={0} max={999} className={inputCls()}
              value={form.orderIndex}
              onChange={(e) => setField('orderIndex', parseInt(e.target.value, 10) || 0)} />
          </div>

          {/* Academic Year — editable dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Academic Year <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select className={inputCls()} value={form.academicYearId}
              onChange={(e) => setField('academicYearId', e.target.value)}>
              <option value="">— All years —</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          {/* Footer buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold
                text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white
                hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving&hellip;
                </>
              ) : (isEdit ? 'Update Period' : 'Create Period')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── CascadeDialog ──────────────────────────────────────────────────────────
function CascadeDialog({
  open, nextPeriod, newStartTime,
  onConfirm, onCancel, applying,
}: {
  open:         boolean;
  nextPeriod:   Period | null;
  newStartTime: string;
  onConfirm:    () => void;
  onCancel:     () => void;
  applying:     boolean;
}) {
  if (!open || !nextPeriod) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-full bg-amber-100 p-2.5 flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Update subsequent start time?</h3>
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{nextPeriod.name}</span> currently starts at{' '}
              <span className="font-mono">{fmt12(nextPeriod.startTime)}</span>.{' '}
              Update its start to{' '}
              <span className="font-mono font-semibold text-blue-700">{fmt12(newStartTime)}</span>{' '}
              to keep the schedule gapless?
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={applying}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold
              text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
            Keep current
          </button>
          <button type="button" onClick={onConfirm} disabled={applying}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white
              hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {applying ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Updating&hellip;
              </>
            ) : `Update ${nextPeriod.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DeleteDialog ───────────────────────────────────────────────────────────
function DeleteDialog({ open, label, onCancel, onConfirm, deleting }: {
  open: boolean; label: string; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Period</h3>
        <p className="text-sm text-slate-600 mb-6">
          Delete period <span className="font-semibold">&ldquo;{label}&rdquo;</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={deleting}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold
              text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white
              hover:bg-red-700 disabled:opacity-60 transition-colors">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page content ──────────────────────────────────────────────────────
function PeriodsContent({ claims: _claims }: { claims: UserClaims }) {
  const [periods,      setPeriods]      = useState<Period[]>([]);
  const [years,        setYears]        = useState<YearRef[]>([]);

  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState('');
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [editing,      setEditing]      = useState<Period | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Period | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [seeding,      setSeeding]      = useState(false);

  // Load on mount
  useEffect(() => {
    Promise.all([
      bffFetch<Period[]>('/api/academic/periods'),
      bffFetch<YearRef[]>('/api/academic-setup/years'),
    ])
      .then(([pers, yrs]) => {
        setPeriods(Array.isArray(pers) ? pers : []);
        setYears(  Array.isArray(yrs)  ? yrs  : []);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  // Always sorted by orderIndex for display and cascade look-up
  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => a.orderIndex - b.orderIndex),
    [periods],
  );

  const yearMap = useMemo(() => new Map(years.map((y) => [y.id, y.name])), [years]);

  // The period immediately after the one currently being edited
  const nextPeriod = useMemo(() => {
    if (!editing) return null;
    return sortedPeriods.find((p) => p.orderIndex === editing.orderIndex + 1) ?? null;
  }, [editing, sortedPeriods]);

  function openAdd()           { setEditing(null); setPanelOpen(true); }
  function openEdit(p: Period) { setEditing(p);    setPanelOpen(true); }
  function handleClose()       { setPanelOpen(false); setSaveError(''); setTimeout(() => setEditing(null), 300); }
  function flash(msg: string)  { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); }

  // ── Seed handler ──────────────────────────────────────────────────────────
  async function handleSeed() {
    setSeeding(true); setSaveError('');
    try {
      const result = await bffFetch<{ seeded: number }>('/api/academic/periods/seed-from-master', {
        method: 'POST',
        body: '{}',
      });
      // Reload to get the newly seeded rows with their server-generated IDs
      const fresh = await bffFetch<Period[]>('/api/academic/periods');
      setPeriods(Array.isArray(fresh) ? fresh : []);
      flash(`${result.seeded} periods generated from master template.`);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Seeding failed');
    } finally {
      setSeeding(false);
    }
  }

  // ── Save (create / update) ────────────────────────────────────────────────
  async function handleSave(data: Partial<PeriodForm>) {
    setSaving(true); setSaveError('');
    try {
      if (editing) {
        const result = await bffFetch<{ updated: boolean; cascaded: number }>(
          `/api/academic/periods/${editing.id}`,
          { method: 'PATCH', body: JSON.stringify(data) },
        );

        // Always do a full refetch so the list reflects any cascade shifts
        const fresh = await bffFetch<Period[]>('/api/academic/periods');
        setPeriods(Array.isArray(fresh) ? fresh : []);

        const cascadeMsg = (result.cascaded ?? 0) > 0
          ? ` (${result.cascaded} subsequent period${result.cascaded !== 1 ? 's' : ''} shifted)`
          : '';
        flash(`Period "${data.name ?? editing.name}" updated.${cascadeMsg}`);
      } else {
        const result = await bffFetch<{ id: string }>('/api/academic/periods', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        const full = data as PeriodForm;
        setPeriods((prev) => [...prev, {
          id:             result.id,
          name:           full.name,
          startTime:      full.startTime,
          endTime:        full.endTime,
          orderIndex:     full.orderIndex ?? 0,
          academicYearId: full.academicYearId || null,
          duration:       calcDuration(full.startTime, full.endTime),
        }]);
        flash(`Period "${full.name}" created.`);
      }

      setSaving(false);
      setPanelOpen(false);
      setTimeout(() => setEditing(null), 300);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  }

  // ── Delete confirm ────────────────────────────────────────────────────────
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bffFetch<unknown>(`/api/academic/periods/${deleteTarget.id}`, { method: 'DELETE' });
      setPeriods((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      flash(`Period "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Periods</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Independent timetable slots — shared across all classes, sorted by schedule order.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Seed button: only visible when list is empty */}
          {sortedPeriods.length === 0 && (
            <button type="button" onClick={handleSeed} disabled={seeding}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5
                text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 transition-colors">
              {seeding ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Seeding…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Generate from Master
                </>
              )}
            </button>
          )}
          <button type="button" onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold
              text-white hover:bg-blue-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Period
          </button>
        </div>
      </div>

      {/* Alerts */}
      {loadError  && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}
      {saveError  && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-sm text-slate-400">Loading periods…</div>
      )}

      {!loading && (
        <>
          {/* ── Desktop table ────────────────────────────────────────────── */}
          <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="grand-table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 w-12">#</th>
                  <th className="px-5 py-3.5 text-left   text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                  <th className="px-5 py-3.5 text-left   text-xs font-semibold uppercase tracking-wide text-slate-500">Start</th>
                  <th className="px-5 py-3.5 text-left   text-xs font-semibold uppercase tracking-wide text-slate-500">End</th>
                  <th className="px-5 py-3.5 text-left   text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</th>
                  <th className="px-5 py-3.5 text-left   text-xs font-semibold uppercase tracking-wide text-slate-500">Academic Year</th>
                  <th className="px-5 py-3.5 text-right  text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedPeriods.map((p) => {
                  const dur = p.duration ?? calcDuration(p.startTime, p.endTime);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 text-center text-xs font-mono text-slate-400">{p.orderIndex}</td>
                      <td className="px-5 py-4 font-semibold text-slate-900">{p.name}</td>
                      <td className="px-5 py-4 font-mono text-sm text-slate-700">{fmt12(p.startTime)}</td>
                      <td className="px-5 py-4 font-mono text-sm text-slate-700">{fmt12(p.endTime)}</td>
                      <td className="px-5 py-4">
                        {dur ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50
                            px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {dur}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {p.academicYearId
                          ? (yearMap.get(p.academicYearId) ?? '—')
                          : <span className="text-slate-400 italic text-xs">All years</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => openEdit(p)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium
                              text-slate-600 hover:bg-slate-50 transition-colors">
                            Edit
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(p)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium
                              text-red-600 hover:bg-red-100 transition-colors">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedPeriods.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-sm text-slate-400">
                      No periods yet. Click &ldquo;Generate from Master&rdquo; to copy the system template,
                      or &ldquo;Add Period&rdquo; to create one manually.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ─────────────────────────────────────────────── */}
          <div className="sm:hidden space-y-3">
            {sortedPeriods.map((p) => {
              const dur = p.duration ?? calcDuration(p.startTime, p.endTime);
              return (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">#{p.orderIndex}</span>
                      <span className="font-bold text-slate-900">{p.name}</span>
                    </div>
                    {dur && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold
                        text-blue-700 border border-blue-100">
                        {dur}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-slate-600 mb-1">
                    {fmt12(p.startTime)}&nbsp;→&nbsp;{fmt12(p.endTime)}
                  </p>
                  <p className="text-xs text-slate-500 mb-3">
                    {p.academicYearId ? (yearMap.get(p.academicYearId) ?? '—') : 'All years'}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(p)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium
                        text-slate-600 hover:bg-slate-50 transition-colors">
                      Edit
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(p)}
                      className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium
                        text-red-600 hover:bg-red-100 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
            {sortedPeriods.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">No periods yet.</div>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-400">
            {sortedPeriods.length} period{sortedPeriods.length !== 1 ? 's' : ''}.
          </p>
        </>
      )}

      {/* Slide-over edit / add panel */}
      <PeriodPanel
        open={panelOpen}
        editing={editing}
        years={years}
        nextPeriod={nextPeriod}
        onClose={handleClose}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete confirmation dialog */}
      <DeleteDialog
        open={deleteTarget !== null}
        label={deleteTarget?.name ?? ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}

export default function PeriodsPage() {
  return (
    <AuthGuard>
      {(claims) => <PeriodsContent claims={claims} />}
    </AuthGuard>
  );
}

