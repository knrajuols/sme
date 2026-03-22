'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import type { UserClaims } from '../../../../lib/auth';
import { PremiumCard } from '../../../../components/ui/PremiumCard';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Department {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  parentId: string | null;
  children?: Department[];
}

interface DeptForm { name: string; code: string; parentId: string }
type FormErrors = Partial<Record<keyof DeptForm, string>>;
const EMPTY: DeptForm = { name: '', code: '', parentId: '' };

function validate(f: DeptForm): FormErrors {
  const e: FormErrors = {};
  if (!f.name.trim()) e.name = 'Name is required.';
  if (!f.code.trim()) e.code = 'Code is required.';
  else if (!/^[A-Z0-9_]{2,20}$/.test(f.code.trim())) e.code = 'Code: 2-20 chars, uppercase letters/digits/underscores.';
  return e;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function DeptModal({
  open, editing, allDepts, onClose, onSave, saving,
}: {
  open: boolean; editing: Department | null; allDepts: Department[];
  onClose: () => void; onSave: (f: DeptForm) => void; saving: boolean;
}) {
  const isEdit = editing !== null;
  const [form, setForm] = useState<DeptForm>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(editing ? { name: editing.name, code: editing.code, parentId: editing.parentId ?? '' } : EMPTY);
      setErrors({});
    }
  }, [open, editing]);

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave(form);
  }

  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors
     ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`;

  if (!open) return null;

  // Flatten departments for parent dropdown, exclude self and own children when editing
  const parentOptions = allDepts.filter(d => !editing || d.id !== editing.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-4">{isEdit ? 'Edit Department' : 'Add Department'}</h3>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input type="text" className={inputCls(errors.name)} value={form.name}
              onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: undefined })); }}
              placeholder="e.g. Academics" maxLength={100} autoFocus />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Code <span className="text-red-500">*</span>
            </label>
            <input type="text" className={`${inputCls(errors.code)} font-mono uppercase`} value={form.code}
              onChange={e => { setForm(p => ({ ...p, code: e.target.value.toUpperCase() })); setErrors(p => ({ ...p, code: undefined })); }}
              placeholder="e.g. ACAD" maxLength={20} disabled={isEdit} />
            {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code}</p>}
            {isEdit && <p className="mt-1 text-xs text-slate-400">Code cannot be changed after creation.</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Parent Department <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={form.parentId} onChange={e => setForm(p => ({ ...p, parentId: e.target.value }))}>
              <option value="">— None (Top-level) —</option>
              {parentOptions.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete dialog ─────────────────────────────────────────────────────────────
function DeleteDialog({ open, label, onCancel, onConfirm, deleting }: {
  open: boolean; label: string; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Department</h3>
        <p className="text-sm text-slate-600 mb-6">
          Remove <span className="font-semibold">&ldquo;{label}&rdquo;</span>? Sub-departments may become orphaned.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={deleting}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors">{deleting ? 'Removing…' : 'Remove'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Tree row renderer ─────────────────────────────────────────────────────────
function flattenTree(depts: Department[]): { dept: Department; depth: number }[] {
  const byParent = new Map<string, Department[]>();
  for (const d of depts) {
    const key = d.parentId ?? '__root__';
    const list = byParent.get(key) ?? [];
    list.push(d);
    byParent.set(key, list);
  }
  const result: { dept: Department; depth: number }[] = [];
  function walk(parentKey: string, depth: number) {
    for (const d of byParent.get(parentKey) ?? []) {
      result.push({ dept: d, depth });
      walk(d.id, depth + 1);
    }
  }
  walk('__root__', 0);
  return result;
}

// ── Content ───────────────────────────────────────────────────────────────────
function DeptContent({ claims: _claims }: { claims: UserClaims }) {
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cloning, setCloning] = useState(false);

  function loadDepts() {
    setLoading(true);
    bffFetch<Department[]>('/api/hr/departments')
      .then(data => setDepts(Array.isArray(data) ? data : []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadDepts(); }, []);

  function openAdd() { setEditing(null); setModalOpen(true); }
  function openEdit(d: Department) { setEditing(d); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setTimeout(() => setEditing(null), 200); }

  async function handleSave(form: DeptForm) {
    setSaving(true);
    setError('');
    try {
      const payload = { name: form.name.trim(), code: form.code.trim(), parentId: form.parentId || undefined };
      if (editing) {
        await bffFetch<unknown>(`/api/hr/departments/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setDepts(prev => prev.map(d => d.id === editing.id ? { ...d, name: payload.name, parentId: form.parentId || null } : d));
        setSuccessMsg(`Department "${payload.name}" updated.`);
      } else {
        const res = await bffFetch<{ id: string }>('/api/hr/departments', { method: 'POST', body: JSON.stringify(payload) });
        setDepts(prev => [...prev, { id: res.id, name: payload.name, code: payload.code, isActive: true, parentId: form.parentId || null }]);
        setSuccessMsg(`Department "${payload.name}" created.`);
      }
      closeModal();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bffFetch<unknown>(`/api/hr/departments/${deleteTarget.id}`, { method: 'DELETE' });
      setDepts(prev => prev.filter(d => d.id !== deleteTarget.id));
      setSuccessMsg(`Department "${deleteTarget.name}" removed.`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function handleCloneFromMaster() {
    setCloning(true);
    setError('');
    try {
      const res = await bffFetch<{ departments: number; roles: number }>(
        '/api/hr/clone-org-from-master',
        { method: 'POST' },
      );
      setSuccessMsg(
        `Generated ${res.departments} department${res.departments !== 1 ? 's' : ''} and ${res.roles} role${res.roles !== 1 ? 's' : ''} from master data.`,
      );
      loadDepts();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setCloning(false);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  }

  const rows = flattenTree(depts);

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage organisational departments and sub-departments.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button type="button" onClick={handleCloneFromMaster} disabled={cloning}
            className="inline-flex items-center gap-2 rounded-lg border border-teal-600 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-60 transition-colors">
            {cloning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                Generating…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Generate from Master Data
              </>
            )}
          </button>
          <button type="button" onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Department
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3"><p className="text-sm text-red-700">{error}</p></div>}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {loading && <div className="py-12 text-center text-sm text-slate-400">Loading departments…</div>}

      {!loading && (
        <PremiumCard accentColor="green" className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Department</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Code</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ dept, depth }) => (
                <tr key={dept.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-slate-900 font-medium" style={{ paddingLeft: `${1.25 + depth * 1.5}rem` }}>
                    {depth > 0 && <span className="text-slate-300 mr-1.5">{'└'}</span>}
                    {dept.name}
                  </td>
                  <td className="px-5 py-3.5"><span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{dept.code}</span></td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${dept.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {dept.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(dept)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">Edit</button>
                      <button type="button" onClick={() => setDeleteTarget(dept)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-16 text-center text-sm text-slate-400">No departments configured yet.</td></tr>
              )}
            </tbody>
          </table>
        </PremiumCard>
      )}

      <p className="mt-4 text-xs text-slate-400">{depts.length} department{depts.length !== 1 ? 's' : ''} registered.</p>

      <DeptModal open={modalOpen} editing={editing} allDepts={depts} onClose={closeModal} onSave={handleSave} saving={saving} />
      <DeleteDialog open={deleteTarget !== null} label={deleteTarget?.name ?? ''} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} deleting={deleting} />
    </div>
  );
}

export default function DepartmentsPage() {
  return <AuthGuard>{(claims) => <DeptContent claims={claims} />}</AuthGuard>;
}
