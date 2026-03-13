'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';

// ── Reference types ────────────────────────────────────────────────────────────
interface ExamRef    { id: string; name: string; }
interface SubjectRef { id: string; name: string; code: string; }

// ── Data types ─────────────────────────────────────────────────────────────────
interface ExamSubject {
  id: string;
  examId: string;
  subjectId: string;
  maxMarks: number;
  weightage?: number;
}

interface ExamSubjectCreateForm {
  examId: string;
  subjectId: string;
  maxMarks: string;
  weightage: string;
}

interface ExamSubjectUpdateForm {
  maxMarks: string;
  weightage: string;
}

type CreateErrors = Partial<Record<keyof ExamSubjectCreateForm, string>>;

const EMPTY_CREATE: ExamSubjectCreateForm = { examId: '', subjectId: '', maxMarks: '', weightage: '' };

function validateCreate(f: ExamSubjectCreateForm): CreateErrors {
  const e: CreateErrors = {};
  if (!f.examId)     e.examId    = 'Exam is required.';
  if (!f.subjectId)  e.subjectId = 'Subject is required.';
  const marks = parseFloat(f.maxMarks);
  if (f.maxMarks === '' || isNaN(marks) || marks < 0) e.maxMarks = 'Enter a valid non-negative number.';
  if (f.weightage && (isNaN(parseFloat(f.weightage)) || parseFloat(f.weightage) < 0))
    e.weightage = 'Enter a valid non-negative number.';
  return e;
}

// ── Slide-over panel ───────────────────────────────────────────────────────────
function ExamSubjectPanel({
  open, editing, exams, subjects, onClose, onSave, saving,
}: {
  open: boolean;
  editing: ExamSubject | null;
  exams: ExamRef[];
  subjects: SubjectRef[];
  onClose: () => void;
  onSave: (data: ExamSubjectCreateForm | ExamSubjectUpdateForm) => void;
  saving: boolean;
}) {
  const isEdit = editing !== null;

  const [createForm, setCreateForm] = useState<ExamSubjectCreateForm>(EMPTY_CREATE);
  const [updateForm, setUpdateForm] = useState<ExamSubjectUpdateForm>({ maxMarks: '', weightage: '' });
  const [errors, setErrors]         = useState<CreateErrors>({});

  useEffect(() => {
    if (open) {
      if (editing) {
        setUpdateForm({
          maxMarks: String(editing.maxMarks),
          weightage: editing.weightage != null ? String(editing.weightage) : '',
        });
      } else {
        setCreateForm(EMPTY_CREATE);
      }
      setErrors({});
    }
  }, [open, editing]);

  function setCreate<K extends keyof ExamSubjectCreateForm>(k: K, v: string) {
    setCreateForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit) {
      const errs: CreateErrors = {};
      const marks = parseFloat(updateForm.maxMarks);
      if (updateForm.maxMarks === '' || isNaN(marks) || marks < 0) errs.maxMarks = 'Enter a valid non-negative number.';
      if (updateForm.weightage && (isNaN(parseFloat(updateForm.weightage)) || parseFloat(updateForm.weightage) < 0))
        errs.weightage = 'Enter a valid non-negative number.';
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
        role="dialog" aria-label={isEdit ? 'Edit Exam Subject' : 'Add Exam Subject'} aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">{isEdit ? 'Edit Exam Subject' : 'Add Exam Subject'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update marks and weightage.' : 'Assign a subject to an exam with marks.'}
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
          {!isEdit && (
            <>
              {/* Exam */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Exam <span className="text-red-500">*</span>
                </label>
                <select className={inputCls(errors.examId)} value={createForm.examId}
                  onChange={(e) => setCreate('examId', e.target.value)}>
                  <option value="">— select exam —</option>
                  {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
                {errors.examId && <p className="mt-1 text-xs text-red-600">{errors.examId}</p>}
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Subject <span className="text-red-500">*</span>
                </label>
                <select className={inputCls(errors.subjectId)} value={createForm.subjectId}
                  onChange={(e) => setCreate('subjectId', e.target.value)}>
                  <option value="">— select subject —</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
                {errors.subjectId && <p className="mt-1 text-xs text-red-600">{errors.subjectId}</p>}
              </div>
            </>
          )}

          {/* Max Marks */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Max Marks <span className="text-red-500">*</span>
            </label>
            <input type="number" min={0} step={0.5} className={inputCls(errors.maxMarks)}
              value={isEdit ? updateForm.maxMarks : createForm.maxMarks}
              onChange={(e) => isEdit ? setUpdateForm((p) => ({ ...p, maxMarks: e.target.value })) : setCreate('maxMarks', e.target.value)}
              placeholder="e.g. 100" />
            {errors.maxMarks && <p className="mt-1 text-xs text-red-600">{errors.maxMarks}</p>}
          </div>

          {/* Weightage */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Weightage (%)</label>
            <input type="number" min={0} step={0.01} className={inputCls(errors.weightage)}
              value={isEdit ? updateForm.weightage : createForm.weightage}
              onChange={(e) => isEdit ? setUpdateForm((p) => ({ ...p, weightage: e.target.value })) : setCreate('weightage', e.target.value)}
              placeholder="e.g. 30 (optional)" />
            {errors.weightage && <p className="mt-1 text-xs text-red-600">{errors.weightage}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Exam Subject'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function ExamSubjectsPage({ user: _user }: { user: UserClaims }) {
  const [rows, setRows]           = useState<ExamSubject[]>([]);
  const [exams, setExams]         = useState<ExamRef[]>([]);
  const [subjects, setSubjects]   = useState<SubjectRef[]>([]);
  const [loading, setLoading]     = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing]     = useState<ExamSubject | null>(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [banner, setBanner]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showBanner(type: 'success' | 'error', msg: string) {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 4000);
  }

  function examName(id: string): string { return exams.find((e) => e.id === id)?.name ?? '—'; }
  function subjectLabel(id: string): string {
    const s = subjects.find((s) => s.id === id);
    return s ? `${s.name} (${s.code})` : '—';
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [data, ex, sub] = await Promise.all([
        bffFetch<ExamSubject[]>('/api/academic/exam-subjects'),
        bffFetch<ExamRef[]>('/api/academic/exams'),
        bffFetch<SubjectRef[]>('/api/academic-setup/subjects'),
      ]);
      setRows(data);
      setExams(ex);
      setSubjects(sub);
    } catch {
      showBanner('error', 'Failed to load exam subjects.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  function openCreate() { setEditing(null); setPanelOpen(true); }
  function openEdit(r: ExamSubject) { setEditing(r); setPanelOpen(true); }
  function closePanel() { setPanelOpen(false); setEditing(null); }

  async function handleSave(form: ExamSubjectCreateForm | ExamSubjectUpdateForm) {
    setSaving(true);
    try {
      if (editing) {
        const f = form as ExamSubjectUpdateForm;
        const payload: Record<string, unknown> = { maxMarks: parseFloat(f.maxMarks) };
        if (f.weightage) payload.weightage = parseFloat(f.weightage);
        await bffFetch(`/api/academic/exam-subjects/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showBanner('success', 'Exam subject updated.');
      } else {
        const f = form as ExamSubjectCreateForm;
        const payload: Record<string, unknown> = {
          examId: f.examId,
          subjectId: f.subjectId,
          maxMarks: parseFloat(f.maxMarks),
        };
        if (f.weightage) payload.weightage = parseFloat(f.weightage);
        await bffFetch('/api/academic/exam-subjects', { method: 'POST', body: JSON.stringify(payload) });
        showBanner('success', 'Exam subject added.');
      }
      closePanel();
      await loadAll();
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this subject from the exam? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await bffFetch(`/api/academic/exam-subjects/${id}`, { method: 'DELETE' });
      showBanner('success', 'Exam subject removed.');
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
            <h1 className="text-2xl font-bold text-slate-900">Exam Subjects</h1>
            <p className="text-sm text-slate-500 mt-1">Assign subjects to exams and configure marks.</p>
          </div>
          <button onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Exam Subject
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-400 text-sm">No exam subjects yet. Click <strong>Add Exam Subject</strong> to create one.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="grand-table w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Exam</th>
                    <th className="px-4 py-3 text-left">Subject</th>
                    <th className="px-4 py-3 text-right">Max Marks</th>
                    <th className="px-4 py-3 text-right">Weightage</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{examName(r.examId)}</td>
                      <td className="px-4 py-3 text-slate-600">{subjectLabel(r.subjectId)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.maxMarks}</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {r.weightage != null ? `${r.weightage}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEdit(r)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                            Edit
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
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden flex flex-col gap-3">
              {rows.map((r) => (
                <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="font-semibold text-slate-900 text-sm">{examName(r.examId)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{subjectLabel(r.subjectId)}</p>
                  <div className="flex gap-4 mt-1 text-xs text-slate-500">
                    <span>Max: <strong>{r.maxMarks}</strong></span>
                    {r.weightage != null && <span>Weight: <strong>{r.weightage}%</strong></span>}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => openEdit(r)}
                      className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                      Edit
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

      <ExamSubjectPanel
        open={panelOpen}
        editing={editing}
        exams={exams}
        subjects={subjects}
        onClose={closePanel}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}

export default function Page() {
  return <AuthGuard>{(user) => <ExamSubjectsPage user={user} />}</AuthGuard>;
}
