'use client';

import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../components/AuthGuard';
import { bffFetch } from '../../lib/api';

// ── Domain types ───────────────────────────────────────────────────────────
interface AcademicYear {
  id:       string;
  name:     string;
  isActive: boolean;
}

interface ExamSchedule {
  id:             string;
  name:           string;
  startDate:      string;
  endDate:        string;
  targetClasses:  string;
  academicYearId: string | null;
}

interface ExamForm {
  name:           string;
  startDate:      string;
  endDate:        string;
  targetClasses:  string;
  academicYearId: string;
}

type FormErrors = Partial<Record<keyof ExamForm, string>>;

const EMPTY_FORM: ExamForm = { name: '', startDate: '', endDate: '', targetClasses: 'ALL', academicYearId: '' };

// ── Validation ─────────────────────────────────────────────────────────────
function validateForm(f: ExamForm): FormErrors {
  const e: FormErrors = {};
  if (!f.name.trim())  e.name      = 'Exam name is required.';
  if (!f.startDate)    e.startDate = 'Start date is required.';
  if (!f.endDate)      e.endDate   = 'End date is required.';
  if (f.startDate && f.endDate && f.startDate >= f.endDate)
    e.endDate = 'End date must be after start date.';
  return e;
}

// ── ExamPanel (slide-over) ─────────────────────────────────────────────────
function ExamPanel({
  open, editing, academicYears, onClose, onSave, saving,
}: {
  open:          boolean;
  editing:       ExamSchedule | null;
  academicYears: AcademicYear[];
  onClose:       () => void;
  onSave:        (form: ExamForm) => void;
  saving:        boolean;
}) {
  const isEdit = editing !== null;
  const [form, setForm]     = useState<ExamForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              name:           editing.name,
              startDate:      editing.startDate.slice(0, 10),
              endDate:        editing.endDate.slice(0, 10),
              targetClasses:  editing.targetClasses,
              academicYearId: editing.academicYearId ?? '',
            }
          : EMPTY_FORM,
      );
      setErrors({});
    }
  }, [open, editing]);

  function setField<K extends keyof ExamForm>(k: K, v: ExamForm[K]) {
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
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors
     ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300
          ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose} aria-hidden="true"
      />
      <div
        role="dialog" aria-label={isEdit ? 'Edit Exam Schedule' : 'Add Exam Schedule'} aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? 'Edit Exam Schedule' : 'Add Exam Schedule'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Changes apply to the <span className="font-semibold text-indigo-700">MASTER TEMPLATE</span> only.
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
          {/* Academic Year */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Academic Year
              <span className="ml-1 text-slate-400 font-normal">(optional — links template to a year)</span>
            </label>
            {academicYears.length > 0 ? (
              <select
                className={inputCls()}
                value={form.academicYearId}
                onChange={(e) => setField('academicYearId', e.target.value)}
              >
                <option value="">— None (year-agnostic template) —</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}{y.isActive ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-400 italic">
                No academic years in master template — templates are year-agnostic.
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Exam Name <span className="text-red-500">*</span>
            </label>
            <input type="text" className={inputCls(errors.name)}
              value={form.name} onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Mid-Term Examination" maxLength={200} autoFocus />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Start / End date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input type="date" className={inputCls(errors.startDate)}
                value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
              {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                End Date <span className="text-red-500">*</span>
              </label>
              <input type="date" className={inputCls(errors.endDate)}
                value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} />
              {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>}
            </div>
          </div>

          {/* Target Classes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Target Classes
              <span className="ml-1 text-slate-400 font-normal">(comma-separated or &ldquo;ALL&rdquo;)</span>
            </label>
            <input type="text" className={inputCls()}
              value={form.targetClasses} onChange={(e) => setField('targetClasses', e.target.value)}
              placeholder="ALL" maxLength={200} />
          </div>

          <div className="flex-1" />

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold
                text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white
                hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving&hellip;
                </>
              ) : (isEdit ? 'Update Exam' : 'Create Exam')}
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
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Exam Schedule</h3>
        <p className="text-sm text-slate-600 mb-6">
          Delete <span className="font-semibold">&ldquo;{label}&rdquo;</span>{' '}
          from the master template? This cannot be undone.
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
function ExamsContent() {
  const [exams,         setExams]         = useState<ExamSchedule[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState('');
  const [panelOpen,     setPanelOpen]     = useState(false);
  const [editing,       setEditing]       = useState<ExamSchedule | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState('');
  const [successMsg,    setSuccessMsg]    = useState('');
  const [deleteTarget,  setDeleteTarget]  = useState<ExamSchedule | null>(null);
  const [deleting,      setDeleting]      = useState(false);

  async function loadExams() {
    const [rows, years] = await Promise.all([
      bffFetch<ExamSchedule[]>('/api/web-admin/exam-schedules'),
      bffFetch<AcademicYear[]>('/api/web-admin/academic-years').catch(() => [] as AcademicYear[]),
    ]);
    setExams(Array.isArray(rows) ? rows : []);
    setAcademicYears(Array.isArray(years) ? years : []);
  }

  useEffect(() => {
    loadExams()
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load exam schedules'))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(
    () => [...exams].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [exams],
  );

  function openAdd()                      { setEditing(null); setPanelOpen(true); }
  function openEdit(ex: ExamSchedule)     { setEditing(ex);   setPanelOpen(true); }
  function handleClose()                  { setPanelOpen(false); setSaveError(''); setTimeout(() => setEditing(null), 300); }
  function flash(msg: string)             { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); }
  function fmtDate(iso: string): string   { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

  async function handleSave(data: ExamForm) {
    setSaving(true); setSaveError('');
    try {
      const payload = {
        name:          data.name,
        startDate:     data.startDate,
        endDate:       data.endDate,
        targetClasses: data.targetClasses || 'ALL',
        ...(data.academicYearId && { academicYearId: data.academicYearId }),
      };
      if (editing) {
        await bffFetch<unknown>(`/api/web-admin/exam-schedules/${editing.id}`, {
          method: 'PATCH', body: JSON.stringify(payload),
        });
        await loadExams();
        flash(`Exam template "${data.name}" updated.`);
      } else {
        await bffFetch<{ id: string }>('/api/web-admin/exam-schedules', {
          method: 'POST', body: JSON.stringify(payload),
        });
        await loadExams();
        flash(`Exam template "${data.name}" created.`);
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
      await bffFetch<unknown>(`/api/web-admin/exam-schedules/${deleteTarget.id}`, { method: 'DELETE' });
      setExams((prev) => prev.filter((ex) => ex.id !== deleteTarget.id));
      flash(`Exam template "${deleteTarget.name}" deleted.`);
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
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
              MASTER TEMPLATE
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Exam Templates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define the canonical exam calendar. Schools copy these when they set up their academic year.
          </p>
        </div>
        <button type="button" onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Exam Schedule
        </button>
      </div>

      {/* Feedback */}
      {successMsg && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      )}
      {(saveError || loadError) && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {saveError || loadError}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading…</div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-400 text-sm">
          No exam templates yet. Click <strong>Add Exam</strong> to create the first one.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Exam Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Start Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">End Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Target Classes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{ex.name}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(ex.startDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(ex.endDate)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200">
                      {ex.targetClasses || 'ALL'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(ex)}
                        className="rounded px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors">
                        Edit
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(ex)}
                        className="rounded px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ExamPanel
        open={panelOpen} editing={editing} academicYears={academicYears}
        onClose={handleClose} onSave={handleSave} saving={saving}
      />

      {saveError && panelOpen && (
        <div className="fixed bottom-4 right-4 z-[60] rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 shadow-lg max-w-xs">
          {saveError}
        </div>
      )}

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

// ── Page ───────────────────────────────────────────────────────────────────
export default function ExamsPage() {
  return (
    <AuthGuard>
      {() => (
        <main className="mx-auto max-w-5xl p-6">
          <ExamsContent />
        </main>
      )}
    </AuthGuard>
  );
}

