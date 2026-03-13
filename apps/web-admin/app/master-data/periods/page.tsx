'use client';

import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';

// ── Domain types ───────────────────────────────────────────────────────────
interface Period {
  id:         string;
  name:       string;
  startTime:  string;
  endTime:    string;
  orderIndex: number;
  duration?:  string;
}

interface PeriodForm {
  name:       string;
  startTime:  string;
  endTime:    string;
  orderIndex: number;
}

type FormErrors = Partial<Record<keyof PeriodForm, string>>;

const EMPTY_FORM: PeriodForm = { name: '', startTime: '', endTime: '', orderIndex: 0 };

// ── Time helpers ───────────────────────────────────────────────────────────
function fmt12(hhmm: string): string {
  if (!hhmm) return '';
  const [hStr, mStr = '00'] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12    = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${suffix}`;
}

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return isNaN(h) || isNaN(m) ? NaN : h * 60 + m;
}

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

// ── PeriodPanel (slide-over) ───────────────────────────────────────────────
function PeriodPanel({
  open, editing, onClose, onSave, saving,
}: {
  open:    boolean;
  editing: Period | null;
  onClose: () => void;
  onSave:  (form: Partial<PeriodForm>) => void;
  saving:  boolean;
}) {
  const isEdit = editing !== null;
  const [form, setForm]     = useState<PeriodForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? { name: editing.name, startTime: editing.startTime ?? '', endTime: editing.endTime ?? '',
              orderIndex: editing.orderIndex ?? 0 }
          : EMPTY_FORM,
      );
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
        ? { name: form.name, startTime: form.startTime, endTime: form.endTime, orderIndex: form.orderIndex }
        : form,
    );
  }

  const durationPreview = calcDuration(form.startTime, form.endTime);
  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors
     ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300
          ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose} aria-hidden="true"
      />
      <div
        role="dialog" aria-label={isEdit ? 'Edit Template Period' : 'Add Template Period'} aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? 'Edit Template Period' : 'Add Template Period'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Changes apply to the <span className="font-semibold text-violet-700">MASTER TEMPLATE</span> only.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input type="time" className={inputCls(errors.startTime)}
                value={form.startTime} onChange={(e) => setField('startTime', e.target.value)} />
              {errors.startTime && <p className="mt-1 text-xs text-red-600">{errors.startTime}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                End Time <span className="text-red-500">*</span>
              </label>
              <input type="time" className={inputCls(errors.endTime)}
                value={form.endTime} onChange={(e) => setField('endTime', e.target.value)} />
              {errors.endTime && <p className="mt-1 text-xs text-red-600">{errors.endTime}</p>}
            </div>
          </div>

          {/* Live duration badge */}
          {durationPreview && (
            <div className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-200 px-4 py-2.5">
              <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-violet-700">Duration: {durationPreview}</span>
            </div>
          )}

          {/* Order index */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Order <span className="text-slate-400 font-normal">(position in daily schedule)</span>
            </label>
            <input type="number" min={0} max={999}
              className={inputCls()}
              value={form.orderIndex}
              onChange={(e) => setField('orderIndex', parseInt(e.target.value, 10) || 0)} />
          </div>

          <div className="flex-1" />

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold
                text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white
                hover:bg-violet-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
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

// ── DeleteDialog ───────────────────────────────────────────────────────────
function DeleteDialog({ open, label, onCancel, onConfirm, deleting }: {
  open: boolean; label: string; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Template Period</h3>
        <p className="text-sm text-slate-600 mb-6">
          Delete <span className="font-semibold">&ldquo;{label}&rdquo;</span> from the master template? This cannot be undone.
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

// ── Inner page content ─────────────────────────────────────────────────────
function MasterPeriodsContent() {
  const [periods,      setPeriods]      = useState<Period[]>([]);
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

  async function loadPeriods() {
    const rows = await bffFetch<Period[]>('/api/web-admin/periods');
    setPeriods(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    loadPeriods()
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load master periods'))
      .finally(() => setLoading(false));
  }, []);

  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => a.orderIndex - b.orderIndex),
    [periods],
  );

  function openAdd()           { setEditing(null); setPanelOpen(true); }
  function openEdit(p: Period) { setEditing(p);    setPanelOpen(true); }
  function handleClose()       { setPanelOpen(false); setSaveError(''); setTimeout(() => setEditing(null), 300); }
  function flash(msg: string)  { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); }

  async function handleSeed() {
    setSeeding(true); setSaveError('');
    try {
      const result = await bffFetch<{ seeded: number }>('/api/web-admin/periods/seed', {
        method: 'POST',
        body: '{}',
      });
      await loadPeriods();
      flash(`${result.seeded} standard periods seeded into master template.`);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Seeding failed');
    } finally {
      setSeeding(false);
    }
  }

  async function handleSave(data: Partial<PeriodForm>) {
    setSaving(true); setSaveError('');
    try {
      if (editing) {
        await bffFetch<unknown>(`/api/web-admin/periods/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        await loadPeriods();
        flash(`Template period "${data.name ?? editing.name}" updated.`);
      } else {
        await bffFetch<{ id: string }>('/api/web-admin/periods', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        await loadPeriods();
        flash(`Template period "${(data as PeriodForm).name}" created.`);
      }
      setSaving(false);
      setPanelOpen(false);
      setTimeout(() => setEditing(null), 300);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bffFetch<unknown>(`/api/web-admin/periods/${deleteTarget.id}`, { method: 'DELETE' });
      setPeriods((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      flash(`Template period "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 border border-violet-200">
              MASTER TEMPLATE
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Period Templates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define the canonical daily schedule. Schools copy this template when they initialise their timetable.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sortedPeriods.length === 0 && (
            <button type="button" onClick={handleSeed} disabled={seeding}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold
                text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors">
              {seeding ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Seeding&hellip;
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Seed Master Template
                </>
              )}
            </button>
          )}
          <button type="button" onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold
              text-white hover:bg-violet-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Period
          </button>
        </div>
      </div>

      {/* Alerts */}
      {loadError  && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      )}
      {saveError  && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
      )}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {loading && <div className="py-12 text-center text-sm text-slate-400">Loading master template…</div>}

      {!loading && (
        <>
          <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 w-12">#</th>
                  <th className="px-5 py-3.5 text-left   text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                  <th className="px-5 py-3.5 text-left   text-xs font-semibold uppercase tracking-wide text-slate-500">Start</th>
                  <th className="px-5 py-3.5 text-left   text-xs font-semibold uppercase tracking-wide text-slate-500">End</th>
                  <th className="px-5 py-3.5 text-left   text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</th>
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
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50
                            px-2.5 py-0.5 text-xs font-semibold text-violet-700 border border-violet-100">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {dur}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
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
                    <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-400">
                      No periods in the master template yet.
                      Click &ldquo;Seed Master Template&rdquo; to load the standard 10-slot schedule,
                      or &ldquo;Add Period&rdquo; to create one manually.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
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
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold
                        text-violet-700 border border-violet-100">
                        {dur}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-slate-600 mb-3">
                    {fmt12(p.startTime)}&nbsp;→&nbsp;{fmt12(p.endTime)}
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
              <div className="py-12 text-center text-sm text-slate-400">No master template periods yet.</div>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-400">
            {sortedPeriods.length} period{sortedPeriods.length !== 1 ? 's' : ''} in master template.
            Schools copy this template when they click &ldquo;Generate from Master&rdquo;.
          </p>
        </>
      )}

      <PeriodPanel
        open={panelOpen}
        editing={editing}
        onClose={handleClose}
        onSave={handleSave}
        saving={saving}
      />

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

// ── Page export ────────────────────────────────────────────────────────────
export default function MasterPeriodsPage() {
  return (
    <AuthGuard>
      {(claims) => {
        if (!claims.roles.includes('PLATFORM_ADMIN')) {
          return (
            <div className="py-16 text-center text-sm text-slate-400">
              Access restricted to Platform Admins.
            </div>
          );
        }
        return <MasterPeriodsContent />;
      }}
    </AuthGuard>
  );
}
