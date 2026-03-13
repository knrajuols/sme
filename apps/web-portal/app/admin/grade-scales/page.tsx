'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────────
interface GradeScale {
  id: string;
  name: string;
  grade: string;
  minPercentage: number;
  maxPercentage: number;
}

interface GradeScaleForm {
  name: string;
  grade: string;
  minPercentage: string;
  maxPercentage: string;
}

type FormErrors = Partial<Record<keyof GradeScaleForm, string>>;

const EMPTY_FORM: GradeScaleForm = { name: '', grade: '', minPercentage: '', maxPercentage: '' };

function validateForm(f: GradeScaleForm): FormErrors {
  const e: FormErrors = {};
  if (!f.name.trim())                                       e.name           = 'Name is required.';
  if (!f.grade.trim())                                      e.grade          = 'Grade is required.';
  const min = parseFloat(f.minPercentage);
  const max = parseFloat(f.maxPercentage);
  if (f.minPercentage === '' || isNaN(min) || min < 0 || min > 100) e.minPercentage  = 'Enter a valid percentage (0–100).';
  if (f.maxPercentage === '' || isNaN(max) || max < 0 || max > 100) e.maxPercentage  = 'Enter a valid percentage (0–100).';
  if (!e.minPercentage && !e.maxPercentage && min >= max)  e.maxPercentage  = 'Max % must be greater than Min %.';
  return e;
}

// ── Slide-over panel ───────────────────────────────────────────────────────────
function GradeScalePanel({
  open, editing, onClose, onSave, saving,
}: {
  open: boolean;
  editing: GradeScale | null;
  onClose: () => void;
  onSave: (data: GradeScaleForm) => void;
  saving: boolean;
}) {
  const [form, setForm]       = useState<GradeScaleForm>(EMPTY_FORM);
  const [errors, setErrors]   = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              name: editing.name,
              grade: editing.grade,
              minPercentage: String(editing.minPercentage),
              maxPercentage: String(editing.maxPercentage),
            }
          : EMPTY_FORM,
      );
      setErrors({});
    }
  }, [open, editing]);

  function setField(k: keyof GradeScaleForm, v: string) {
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
        role="dialog" aria-label={editing ? 'Edit Grade Scale' : 'Add Grade Scale'} aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">{editing ? 'Edit Grade Scale' : 'New Grade Scale'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {editing ? 'Update the grade scale details.' : 'Define a grade band and its percentage range.'}
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
              Scale Name <span className="text-red-500">*</span>
            </label>
            <input type="text" className={inputCls(errors.name)} value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Primary Scale 2024" maxLength={100} autoFocus={!editing} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Grade */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Grade <span className="text-red-500">*</span>
            </label>
            <input type="text" className={inputCls(errors.grade)} value={form.grade}
              onChange={(e) => setField('grade', e.target.value)}
              placeholder="e.g. A+" maxLength={10} />
            {errors.grade && <p className="mt-1 text-xs text-red-600">{errors.grade}</p>}
          </div>

          {/* Min % */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Min Percentage <span className="text-red-500">*</span>
            </label>
            <input type="number" min={0} max={100} step={0.01} className={inputCls(errors.minPercentage)}
              value={form.minPercentage}
              onChange={(e) => setField('minPercentage', e.target.value)}
              placeholder="e.g. 90" />
            {errors.minPercentage && <p className="mt-1 text-xs text-red-600">{errors.minPercentage}</p>}
          </div>

          {/* Max % */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Max Percentage <span className="text-red-500">*</span>
            </label>
            <input type="number" min={0} max={100} step={0.01} className={inputCls(errors.maxPercentage)}
              value={form.maxPercentage}
              onChange={(e) => setField('maxPercentage', e.target.value)}
              placeholder="e.g. 100" />
            {errors.maxPercentage && <p className="mt-1 text-xs text-red-600">{errors.maxPercentage}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Grade Scale'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function GradeScalesPage({ user: _user }: { user: UserClaims }) {
  const [rows, setRows]           = useState<GradeScale[]>([]);
  const [loading, setLoading]     = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing]     = useState<GradeScale | null>(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [banner, setBanner]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showBanner(type: 'success' | 'error', msg: string) {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 4000);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const data = await bffFetch<GradeScale[]>('/api/academic/grade-scales');
      setRows(data);
    } catch {
      showBanner('error', 'Failed to load grade scales.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  function openCreate() { setEditing(null); setPanelOpen(true); }
  function openEdit(r: GradeScale) { setEditing(r); setPanelOpen(true); }
  function closePanel() { setPanelOpen(false); setEditing(null); }

  async function handleSave(form: GradeScaleForm) {
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      grade: form.grade.trim(),
      minPercentage: parseFloat(form.minPercentage),
      maxPercentage: parseFloat(form.maxPercentage),
    };
    try {
      if (editing) {
        await bffFetch(`/api/academic/grade-scales/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showBanner('success', 'Grade scale updated.');
      } else {
        await bffFetch('/api/academic/grade-scales', { method: 'POST', body: JSON.stringify(payload) });
        showBanner('success', 'Grade scale created.');
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
    if (!window.confirm('Delete this grade scale? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await bffFetch(`/api/academic/grade-scales/${id}`, { method: 'DELETE' });
      showBanner('success', 'Grade scale deleted.');
      await loadAll();
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      {/* Banner */}
      {banner && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-lg text-white ${banner.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {banner.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Grade Scales</h1>
            <p className="text-sm text-slate-500 mt-1">Manage grading bands and percentage ranges.</p>
          </div>
          <button onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Grade Scale
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-400 text-sm">No grade scales yet. Click <strong>Add Grade Scale</strong> to create one.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="grand-table w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Scale Name</th>
                    <th className="px-4 py-3 text-left">Grade</th>
                    <th className="px-4 py-3 text-right">Min %</th>
                    <th className="px-4 py-3 text-right">Max %</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                          {r.grade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.minPercentage}%</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.maxPercentage}%</td>
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
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{r.name}</p>
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 mt-1">
                        {r.grade}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{r.minPercentage}% – {r.maxPercentage}%</p>
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

      <GradeScalePanel
        open={panelOpen}
        editing={editing}
        onClose={closePanel}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}

export default function Page() {
  return <AuthGuard>{(user) => <GradeScalesPage user={user} />}</AuthGuard>;
}
