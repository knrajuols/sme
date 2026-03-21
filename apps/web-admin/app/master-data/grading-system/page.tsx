'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';

// ── Domain types ───────────────────────────────────────────────────────────
interface GradeEntry {
  id:                   string;
  name:                 string;
  grade:                string;
  minPercentage:        number;
  maxPercentage:        number;
  gradePoint:           number;
  performanceIndicator: string;
  createdAt:            string;
  updatedAt:            string;
}

interface GradeForm {
  grade:                string;
  minPercentage:        number;
  maxPercentage:        number;
  gradePoint:           number;
  performanceIndicator: string;
}

type FormErrors = Partial<Record<keyof GradeForm, string>>;

const EMPTY_FORM: GradeForm = {
  grade: '', minPercentage: 0, maxPercentage: 100, gradePoint: 0, performanceIndicator: '',
};

// ── Form validation ────────────────────────────────────────────────────────
function validateForm(f: GradeForm): FormErrors {
  const e: FormErrors = {};
  if (!f.grade.trim()) e.grade = 'Grade is required.';
  if (f.minPercentage < 0 || f.minPercentage > 100) e.minPercentage = 'Must be 0–100.';
  if (f.maxPercentage < 0 || f.maxPercentage > 100) e.maxPercentage = 'Must be 0–100.';
  if (f.minPercentage >= f.maxPercentage) e.maxPercentage = 'Max must be greater than Min.';
  if (f.gradePoint < 0 || f.gradePoint > 10) e.gradePoint = 'Must be 0–10.';
  if (!f.performanceIndicator.trim()) e.performanceIndicator = 'Performance indicator is required.';
  return e;
}

// ── GradePanel (slide-over) ────────────────────────────────────────────────
function GradePanel({
  open, editing, onClose, onSave, saving,
}: {
  open:    boolean;
  editing: GradeEntry | null;
  onClose: () => void;
  onSave:  (form: GradeForm) => void;
  saving:  boolean;
}) {
  const isEdit = editing !== null;
  const [form, setForm]     = useState<GradeForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              grade:                editing.grade,
              minPercentage:        editing.minPercentage,
              maxPercentage:        editing.maxPercentage,
              gradePoint:           editing.gradePoint,
              performanceIndicator: editing.performanceIndicator,
            }
          : EMPTY_FORM,
      );
      setErrors({});
    }
  }, [open, editing]);

  function setField<K extends keyof GradeForm>(k: K, v: GradeForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(form);
  }

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
        role="dialog" aria-label={isEdit ? 'Edit Grade' : 'Add Grade'} aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? 'Edit Grade' : 'Add Grade'}
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
          {/* Grade */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Grade <span className="text-red-500">*</span>
            </label>
            <input type="text" className={inputCls(errors.grade)}
              value={form.grade} onChange={(e) => setField('grade', e.target.value)}
              placeholder="e.g. A1" maxLength={10} autoFocus />
            {errors.grade && <p className="mt-1 text-xs text-red-600">{errors.grade}</p>}
          </div>

          {/* Min / Max percentage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Min (%) <span className="text-red-500">*</span>
              </label>
              <input type="number" min={0} max={100} step={1} className={inputCls(errors.minPercentage)}
                value={form.minPercentage}
                onChange={(e) => setField('minPercentage', parseFloat(e.target.value) || 0)} />
              {errors.minPercentage && <p className="mt-1 text-xs text-red-600">{errors.minPercentage}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Max (%) <span className="text-red-500">*</span>
              </label>
              <input type="number" min={0} max={100} step={1} className={inputCls(errors.maxPercentage)}
                value={form.maxPercentage}
                onChange={(e) => setField('maxPercentage', parseFloat(e.target.value) || 0)} />
              {errors.maxPercentage && <p className="mt-1 text-xs text-red-600">{errors.maxPercentage}</p>}
            </div>
          </div>

          {/* Grade Point */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Grade Point <span className="text-red-500">*</span>
            </label>
            <input type="number" min={0} max={10} step={0.1} className={inputCls(errors.gradePoint)}
              value={form.gradePoint}
              onChange={(e) => setField('gradePoint', parseFloat(e.target.value) || 0)} />
            {errors.gradePoint && <p className="mt-1 text-xs text-red-600">{errors.gradePoint}</p>}
          </div>

          {/* Performance Indicator */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Performance Indicator <span className="text-red-500">*</span>
            </label>
            <input type="text" className={inputCls(errors.performanceIndicator)}
              value={form.performanceIndicator}
              onChange={(e) => setField('performanceIndicator', e.target.value)}
              placeholder="e.g. Outstanding" maxLength={100} />
            {errors.performanceIndicator && <p className="mt-1 text-xs text-red-600">{errors.performanceIndicator}</p>}
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
              ) : (isEdit ? 'Update Grade' : 'Create Grade')}
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
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Grade</h3>
        <p className="text-sm text-slate-600 mb-6">
          Delete grade <span className="font-semibold">&ldquo;{label}&rdquo;</span> from the master template? This cannot be undone.
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
            {deleting ? 'Deleting\u2026' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Seed data: CBSE 9-point grading system ─────────────────────────────────
const CBSE_SEED: GradeForm[] = [
  { grade: 'A1', minPercentage: 91,  maxPercentage: 100, gradePoint: 10.0, performanceIndicator: 'Outstanding' },
  { grade: 'A2', minPercentage: 81,  maxPercentage: 90,  gradePoint: 9.0,  performanceIndicator: 'Excellent' },
  { grade: 'B1', minPercentage: 71,  maxPercentage: 80,  gradePoint: 8.0,  performanceIndicator: 'Very Good' },
  { grade: 'B2', minPercentage: 61,  maxPercentage: 70,  gradePoint: 7.0,  performanceIndicator: 'Good' },
  { grade: 'C1', minPercentage: 51,  maxPercentage: 60,  gradePoint: 6.0,  performanceIndicator: 'Above Average' },
  { grade: 'C2', minPercentage: 41,  maxPercentage: 50,  gradePoint: 5.0,  performanceIndicator: 'Average' },
  { grade: 'D',  minPercentage: 33,  maxPercentage: 40,  gradePoint: 4.0,  performanceIndicator: 'Fair (Pass)' },
  { grade: 'E',  minPercentage: 0,   maxPercentage: 32,  gradePoint: 0.0,  performanceIndicator: 'Needs Improvement / Fail' },
];

// ── Inner page content ─────────────────────────────────────────────────────
function GradingSystemContent() {
  const [grades,       setGrades]       = useState<GradeEntry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState('');
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [editing,      setEditing]      = useState<GradeEntry | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');
  const [deleteTarget, setDeleteTarget] = useState<GradeEntry | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [seeding,      setSeeding]      = useState(false);

  async function loadGrades() {
    const rows = await bffFetch<GradeEntry[]>('/api/web-admin/grading-system');
    setGrades(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    loadGrades()
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load grading system'))
      .finally(() => setLoading(false));
  }, []);

  const sortedGrades = [...grades].sort((a, b) => b.minPercentage - a.minPercentage);

  function openAdd()                { setEditing(null); setPanelOpen(true); }
  function openEdit(g: GradeEntry)  { setEditing(g);    setPanelOpen(true); }
  function handleClose()            { setPanelOpen(false); setSaveError(''); setTimeout(() => setEditing(null), 300); }
  function flash(msg: string)       { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); }

  async function handleSeedCBSE() {
    setSeeding(true); setSaveError('');
    try {
      for (const entry of CBSE_SEED) {
        await bffFetch<{ id: string }>('/api/web-admin/grading-system', {
          method: 'POST',
          body: JSON.stringify({ name: entry.grade, ...entry }),
        });
      }
      await loadGrades();
      flash(`${CBSE_SEED.length} CBSE grades seeded into master template.`);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Seeding failed');
    } finally {
      setSeeding(false);
    }
  }

  async function handleSave(form: GradeForm) {
    setSaving(true); setSaveError('');
    try {
      const payload = { name: form.grade, ...form };
      if (editing) {
        await bffFetch<unknown>(`/api/web-admin/grading-system/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        await loadGrades();
        flash(`Grade "${form.grade}" updated.`);
      } else {
        await bffFetch<{ id: string }>('/api/web-admin/grading-system', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await loadGrades();
        flash(`Grade "${form.grade}" created.`);
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
      await bffFetch<unknown>(`/api/web-admin/grading-system/${deleteTarget.id}`, { method: 'DELETE' });
      setGrades((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      flash(`Grade "${deleteTarget.grade}" deleted.`);
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
          <h1 className="text-2xl font-bold text-slate-900">Grading System</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define the CBSE grading scale. Schools inherit this template when they are onboarded.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sortedGrades.length === 0 && (
            <button type="button" onClick={handleSeedCBSE} disabled={seeding}
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
                  Seed CBSE Grades
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
            Add Grade
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

      {loading && <div className="py-12 text-center text-sm text-slate-400">Loading grading system&hellip;</div>}

      {!loading && (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Grade</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Min (%)</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Max (%)</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Grade Point</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Performance Indicator</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedGrades.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-sm font-bold text-violet-700 border border-violet-100">
                        {g.grade}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center font-mono text-slate-700">{g.minPercentage}</td>
                    <td className="px-5 py-4 text-center font-mono text-slate-700">{g.maxPercentage}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 border border-teal-100">
                        {g.gradePoint.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{g.performanceIndicator}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => openEdit(g)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium
                            text-slate-600 hover:bg-slate-50 transition-colors">
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(g)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium
                            text-red-600 hover:bg-red-100 transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedGrades.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-400">
                      No grades in the master template yet.
                      Click &ldquo;Seed CBSE Grades&rdquo; to load the standard grading scale,
                      or &ldquo;Add Grade&rdquo; to create one manually.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {sortedGrades.map((g) => (
              <div key={g.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-sm font-bold text-violet-700 border border-violet-100">
                      {g.grade}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 border border-teal-100">
                      GP: {g.gradePoint.toFixed(1)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mb-1">
                  <span className="font-semibold">Range:</span> {g.minPercentage}% &ndash; {g.maxPercentage}%
                </p>
                <p className="text-xs text-slate-600 mb-3">
                  <span className="font-semibold">Indicator:</span> {g.performanceIndicator}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(g)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium
                      text-slate-600 hover:bg-slate-50 transition-colors">
                    Edit
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(g)}
                    className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium
                      text-red-600 hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {sortedGrades.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">No grading system entries yet.</div>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-400">
            {sortedGrades.length} grade{sortedGrades.length !== 1 ? 's' : ''} in master template.
            Schools inherit this grading scale during onboarding.
          </p>
        </>
      )}

      <GradePanel
        open={panelOpen}
        editing={editing}
        onClose={handleClose}
        onSave={handleSave}
        saving={saving}
      />

      <DeleteDialog
        open={deleteTarget !== null}
        label={deleteTarget?.grade ?? ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}

// ── Page export ────────────────────────────────────────────────────────────
export default function GradingSystemPage() {
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
        return <GradingSystemContent />;
      }}
    </AuthGuard>
  );
}
