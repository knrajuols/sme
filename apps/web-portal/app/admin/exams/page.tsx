'use client';

import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { DateInput } from '../../../components/ui/DateInput';
import { PremiumCard } from '../../../components/ui/PremiumCard';
import { StatusPill } from '../../../components/ui/StatusPill';

// ── Reference types ────────────────────────────────────────────────────────────
interface YearRef  { id: string; name: string; }
interface ClassRef { id: string; name: string; code: string; academicYearId: string; }

// ── Exam types ─────────────────────────────────────────────────────────────────
type ExamStatus = 'DRAFT' | 'VERIFIED' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

const EXAM_STATUSES: ExamStatus[] = ['DRAFT', 'VERIFIED', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED'];

const STATUS_COLORS: Record<ExamStatus, string> = {
  DRAFT:     'bg-slate-100 text-slate-700 border-slate-300',
  VERIFIED:  'bg-blue-100  text-blue-700  border-blue-300',
  PUBLISHED: 'bg-green-100 text-green-700 border-green-300',
  ONGOING:   'bg-yellow-100 text-yellow-700 border-yellow-300',
  COMPLETED: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  CANCELLED: 'bg-red-100   text-red-700   border-red-300',
};

interface Exam {
  id: string;
  name: string;
  academicYearId: string;
  classId: string;
  status: ExamStatus;
  startDate: string;
  endDate: string;
  totalMarks?: number;
}

interface ExamCreateForm {
  name: string;
  academicYearId: string;
  classId: string;
  startDate: string;
  endDate: string;
  totalMarks: string;
  status: ExamStatus;
}

interface ExamUpdateForm {
  name: string;
  startDate: string;
  endDate: string;
  status: ExamStatus;
}

type CreateErrors = Partial<Record<keyof ExamCreateForm, string>>;

const EMPTY_CREATE: ExamCreateForm = {
  name: '', academicYearId: '', classId: '', startDate: '', endDate: '', totalMarks: '', status: 'DRAFT',
};

function validateCreate(f: ExamCreateForm): CreateErrors {
  const e: CreateErrors = {};
  if (!f.name.trim())         e.name           = 'Name is required.';
  if (!f.academicYearId)      e.academicYearId = 'Academic year is required.';
  if (!f.classId)             e.classId        = 'Class is required.';
  if (!f.startDate)           e.startDate      = 'Start date is required.';
  if (!f.endDate)             e.endDate        = 'End date is required.';
  if (f.startDate && f.endDate && f.startDate > f.endDate) e.endDate = 'End date must be after start date.';
  if (f.totalMarks && isNaN(parseFloat(f.totalMarks))) e.totalMarks = 'Must be a valid number.';
  return e;
}

// ── Slide-over panel ───────────────────────────────────────────────────────────
function ExamPanel({
  open, editing, years, classes, onClose, onSave, saving,
}: {
  open: boolean;
  editing: Exam | null;
  years: YearRef[];
  classes: ClassRef[];
  onClose: () => void;
  onSave: (data: ExamCreateForm | ExamUpdateForm) => void;
  saving: boolean;
}) {
  const isEdit = editing !== null;

  const [createForm, setCreateForm] = useState<ExamCreateForm>(EMPTY_CREATE);
  const [updateForm, setUpdateForm] = useState<ExamUpdateForm>({ name: '', startDate: '', endDate: '', status: 'DRAFT' });
  const [errors, setErrors]         = useState<CreateErrors>({});

  useEffect(() => {
    if (open) {
      if (editing) {
        setUpdateForm({
          name: editing.name,
          startDate: editing.startDate?.slice(0, 10) ?? '',
          endDate: editing.endDate?.slice(0, 10) ?? '',
          status: editing.status,
        });
      } else {
        setCreateForm(EMPTY_CREATE);
      }
      setErrors({});
    }
  }, [open, editing]);

  const filteredClasses = useMemo(
    () => classes.filter((c) => !createForm.academicYearId || c.academicYearId === createForm.academicYearId),
    [classes, createForm.academicYearId],
  );

  function setCreate<K extends keyof ExamCreateForm>(k: K, v: ExamCreateForm[K]) {
    setCreateForm((p) => ({ ...p, [k]: v, ...(k === 'academicYearId' ? { classId: '' } : {}) }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit) {
      const errs: CreateErrors = {};
      if (!updateForm.name.trim())  errs.name      = 'Name is required.';
      if (!updateForm.startDate)    errs.startDate  = 'Start date is required.';
      if (!updateForm.endDate)      errs.endDate    = 'End date is required.';
      if (updateForm.startDate && updateForm.endDate && updateForm.startDate > updateForm.endDate)
        errs.endDate = 'End date must be after start date.';
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
      onSave(updateForm);
      return;
    }
    const errs = validateCreate(createForm);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(createForm);
  }

  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
      err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'
    }`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose} aria-hidden="true"
      />
      <div
        role="dialog" aria-label={isEdit ? 'Edit Exam' : 'Add Exam'} aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">{isEdit ? 'Edit Exam' : 'New Exam'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update exam details and status.' : 'Create a new exam for a class.'}
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
          {/* Name (both create + edit) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Exam Name <span className="text-red-500">*</span>
            </label>
            <input type="text" className={inputCls(errors.name)}
              value={isEdit ? updateForm.name : createForm.name}
              onChange={(e) => isEdit ? setUpdateForm((p) => ({ ...p, name: e.target.value })) : setCreate('name', e.target.value)}
              placeholder="e.g. Mid-Term Examination 2024" maxLength={200} autoFocus />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {!isEdit && (
            <>
              {/* Academic Year */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Academic Year <span className="text-red-500">*</span>
                </label>
                <select className={inputCls(errors.academicYearId)} value={createForm.academicYearId}
                  onChange={(e) => setCreate('academicYearId', e.target.value)}>
                  <option value="">— select year —</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
                {errors.academicYearId && <p className="mt-1 text-xs text-red-600">{errors.academicYearId}</p>}
              </div>

              {/* Class */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Class <span className="text-red-500">*</span>
                </label>
                <select className={inputCls(errors.classId)} value={createForm.classId}
                  onChange={(e) => setCreate('classId', e.target.value)}
                  disabled={!createForm.academicYearId}>
                  <option value="">— select class —</option>
                  {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
                {errors.classId && <p className="mt-1 text-xs text-red-600">{errors.classId}</p>}
              </div>

              {/* Total Marks (optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Total Marks</label>
                <input type="number" min={0} step={0.5} className={inputCls(errors.totalMarks)}
                  value={createForm.totalMarks}
                  onChange={(e) => setCreate('totalMarks', e.target.value)}
                  placeholder="e.g. 100 (optional)" />
                {errors.totalMarks && <p className="mt-1 text-xs text-red-600">{errors.totalMarks}</p>}
              </div>
            </>
          )}

          {/* Start Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Start Date <span className="text-red-500">*</span>
            </label>
            <DateInput
              value={isEdit ? updateForm.startDate : createForm.startDate}
              onValueChange={(v) => isEdit ? setUpdateForm((p) => ({ ...p, startDate: v })) : setCreate('startDate', v)}
              className={inputCls(errors.startDate)}
            />
            {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              End Date <span className="text-red-500">*</span>
            </label>
            <DateInput
              value={isEdit ? updateForm.endDate : createForm.endDate}
              onValueChange={(v) => isEdit ? setUpdateForm((p) => ({ ...p, endDate: v })) : setCreate('endDate', v)}
              className={inputCls(errors.endDate)}
            />
            {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>}
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
            <select className={inputCls()}
              value={isEdit ? updateForm.status : createForm.status}
              onChange={(e) => {
                const v = e.target.value as ExamStatus;
                isEdit ? setUpdateForm((p) => ({ ...p, status: v })) : setCreate('status', v);
              }}>
              {EXAM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Exam'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function ExamsPage({ user: _user }: { user: UserClaims }) {
  const [rows, setRows]           = useState<Exam[]>([]);
  const [years, setYears]         = useState<YearRef[]>([]);
  const [classes, setClasses]     = useState<ClassRef[]>([]);
  const [loading, setLoading]     = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing]     = useState<Exam | null>(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [banner, setBanner]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showBanner(type: 'success' | 'error', msg: string) {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 4000);
  }

  function yearName(id: string): string {
    return years.find((y) => y.id === id)?.name ?? '—';
  }
  function className(id: string): string {
    const c = classes.find((c) => c.id === id);
    return c ? `${c.name} (${c.code})` : '—';
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [data, y, c] = await Promise.all([
        bffFetch<Exam[]>('/api/academic/exams'),
        bffFetch<YearRef[]>('/api/academic-setup/years'),
        bffFetch<ClassRef[]>('/api/academic-setup/classes'),
      ]);
      setRows(data);
      setYears(y);
      setClasses(c);
    } catch {
      showBanner('error', 'Failed to load exams.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  function openCreate() { setEditing(null); setPanelOpen(true); }
  function openEdit(r: Exam) { setEditing(r); setPanelOpen(true); }
  function closePanel() { setPanelOpen(false); setEditing(null); }

  function formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function handleSave(form: ExamCreateForm | ExamUpdateForm) {
    setSaving(true);
    try {
      if (editing) {
        const f = form as ExamUpdateForm;
        const payload: Record<string, unknown> = {
          name: f.name.trim(),
          startDate: f.startDate,
          endDate: f.endDate,
          status: f.status,
        };
        await bffFetch(`/api/academic/exams/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showBanner('success', 'Exam updated.');
      } else {
        const f = form as ExamCreateForm;
        const payload: Record<string, unknown> = {
          name: f.name.trim(),
          academicYearId: f.academicYearId,
          classId: f.classId,
          startDate: f.startDate,
          endDate: f.endDate,
          status: f.status,
        };
        if (f.totalMarks) payload.totalMarks = parseFloat(f.totalMarks);
        await bffFetch('/api/academic/exams', { method: 'POST', body: JSON.stringify(payload) });
        showBanner('success', 'Exam created.');
      }
      closePanel();
      await loadAll();
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleProcess(exam: Exam) {
    if (!window.confirm(`Process results for "${exam.name}"? Existing results for this class will be recalculated.`)) return;
    setProcessing(exam.id);
    try {
      const res = await bffFetch<{ processed: number }>(
        `/api/academic/exams/${exam.id}/classes/${exam.classId}/process`,
        { method: 'POST' },
      );
      showBanner('success', `Results processed for ${res.processed} student(s).`);
    } catch (e: unknown) {
      showBanner('error', e instanceof Error ? e.message : 'Processing failed.');
    } finally {
      setProcessing(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this exam? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await bffFetch(`/api/academic/exams/${id}`, { method: 'DELETE' });
      showBanner('success', 'Exam deleted.');
      await loadAll();
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      {banner && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-lg text-white ${banner.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {banner.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Exams</h1>
            <p className="text-sm text-slate-500 mt-1">Manage examinations for each class and academic year.</p>
          </div>
          <button onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Exam
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-400 text-sm">No exams yet. Click <strong>Add Exam</strong> to create one.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <PremiumCard accentColor="purple" className="hidden sm:block overflow-x-auto">
              <table className="grand-table w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Year</th>
                    <th className="px-4 py-3 text-left">Class</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Start</th>
                    <th className="px-4 py-3 text-left">End</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                      <td className="px-4 py-3 text-slate-600">{yearName(r.academicYearId)}</td>
                      <td className="px-4 py-3 text-slate-600">{className(r.classId)}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(r.startDate)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(r.endDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEdit(r)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                            Edit
                          </button>
                          <button onClick={() => handleProcess(r)} disabled={processing === r.id}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                            {processing === r.id ? '…' : 'Process'}
                          </button>
                          <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors">
                            {deleting === r.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PremiumCard>

            {/* Mobile cards */}
            <div className="sm:hidden flex flex-col gap-3">
              {rows.map((r) => (
                <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-semibold text-slate-900 text-sm">{r.name}</p>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="text-xs text-slate-500">{className(r.classId)} · {yearName(r.academicYearId)}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatDate(r.startDate)} – {formatDate(r.endDate)}</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => openEdit(r)}
                      className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                      Edit
                    </button>
                    <button onClick={() => handleProcess(r)} disabled={processing === r.id}
                      className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                      {processing === r.id ? '…' : 'Process'}
                    </button>
                    <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                      className="flex-1 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors">
                      {deleting === r.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ExamPanel
        open={panelOpen}
        editing={editing}
        years={years}
        classes={classes}
        onClose={closePanel}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}

export default function Page() {
  return <AuthGuard>{(user) => <ExamsPage user={user} />}</AuthGuard>;
}
