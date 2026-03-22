'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import type { UserClaims } from '../../../../lib/auth';
import { PremiumCard } from '../../../../components/ui/PremiumCard';

// ── Types ─────────────────────────────────────────────────────────────────────
const SYSTEM_CATEGORIES = ['TEACHER', 'DRIVER', 'ATTENDANT', 'STANDARD_STAFF'] as const;
type SystemRoleCategory = (typeof SYSTEM_CATEGORIES)[number];
const CATEGORY_LABELS: Record<SystemRoleCategory, string> = {
  TEACHER: 'Teacher',
  DRIVER: 'Driver',
  ATTENDANT: 'Attendant',
  STANDARD_STAFF: 'Standard Staff',
};

interface DeptRef { id: string; name: string; code: string }
interface EmployeeRole {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  departmentId: string;
  systemCategory: SystemRoleCategory;
  department?: DeptRef;
}

interface RoleForm { name: string; code: string; departmentId: string; systemCategory: SystemRoleCategory }
type FormErrors = Partial<Record<keyof RoleForm, string>>;
const EMPTY: RoleForm = { name: '', code: '', departmentId: '', systemCategory: 'STANDARD_STAFF' };

function validate(f: RoleForm): FormErrors {
  const e: FormErrors = {};
  if (!f.name.trim()) e.name = 'Name is required.';
  if (!f.code.trim()) e.code = 'Code is required.';
  else if (!/^[A-Z0-9_]{2,20}$/.test(f.code.trim())) e.code = 'Code: 2-20 chars, uppercase letters/digits/underscores.';
  if (!f.departmentId) e.departmentId = 'Department is required.';
  return e;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function RoleModal({
  open, editing, departments, onClose, onSave, saving,
}: {
  open: boolean; editing: EmployeeRole | null; departments: DeptRef[];
  onClose: () => void; onSave: (f: RoleForm) => void; saving: boolean;
}) {
  const isEdit = editing !== null;
  const [form, setForm] = useState<RoleForm>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(editing ? { name: editing.name, code: editing.code, departmentId: editing.departmentId, systemCategory: editing.systemCategory ?? 'STANDARD_STAFF' } : EMPTY);
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-4">{isEdit ? 'Edit Role' : 'Add Role'}</h3>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Department <span className="text-red-500">*</span></label>
            <select className={inputCls(errors.departmentId)} value={form.departmentId}
              onChange={e => { setForm(p => ({ ...p, departmentId: e.target.value })); setErrors(p => ({ ...p, departmentId: undefined })); }}>
              <option value="">Select a department…</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
            {errors.departmentId && <p className="mt-1 text-xs text-red-600">{errors.departmentId}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name <span className="text-red-500">*</span></label>
            <input type="text" className={inputCls(errors.name)} value={form.name}
              onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: undefined })); }}
              placeholder="e.g. Senior Teacher" maxLength={100} autoFocus />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Code <span className="text-red-500">*</span></label>
            <input type="text" className={`${inputCls(errors.code)} font-mono uppercase`} value={form.code}
              onChange={e => { setForm(p => ({ ...p, code: e.target.value.toUpperCase() })); setErrors(p => ({ ...p, code: undefined })); }}
              placeholder="e.g. SR_TCHR" maxLength={20} disabled={isEdit} />
            {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code}</p>}
            {isEdit && <p className="mt-1 text-xs text-slate-400">Code cannot be changed after creation.</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">System Category <span className="text-red-500">*</span></label>
            <select className={inputCls(errors.systemCategory)} value={form.systemCategory}
              onChange={e => { setForm(p => ({ ...p, systemCategory: e.target.value as SystemRoleCategory })); setErrors(p => ({ ...p, systemCategory: undefined })); }}>
              {SYSTEM_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            {errors.systemCategory && <p className="mt-1 text-xs text-red-600">{errors.systemCategory}</p>}
            <p className="mt-1 text-xs text-slate-400">Tells the system which specialised onboarding form (e.g. Driver&apos;s License, Teaching Subjects) to use for this role.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 transition-colors">{saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}</button>
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
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Role</h3>
        <p className="text-sm text-slate-600 mb-6">
          Remove role <span className="font-semibold">&ldquo;{label}&rdquo;</span>? Employees with this role may need reassignment.
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

// ── Content ───────────────────────────────────────────────────────────────────
function RolesContent({ claims: _claims }: { claims: UserClaims }) {
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [departments, setDepartments] = useState<DeptRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      bffFetch<EmployeeRole[]>('/api/hr/roles'),
      bffFetch<DeptRef[]>('/api/hr/departments'),
    ])
      .then(([rolesData, deptsData]) => {
        setRoles(Array.isArray(rolesData) ? rolesData : []);
        setDepartments(Array.isArray(deptsData) ? deptsData : []);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  function openAdd() { setEditing(null); setModalOpen(true); }
  function openEdit(r: EmployeeRole) { setEditing(r); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setTimeout(() => setEditing(null), 200); }

  async function handleSave(form: RoleForm) {
    setSaving(true); setError('');
    try {
      if (editing) {
        const payload = { name: form.name.trim(), departmentId: form.departmentId, systemCategory: form.systemCategory };
        await bffFetch<unknown>(`/api/hr/roles/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        const dept = departments.find(d => d.id === form.departmentId);
        setRoles(prev => prev.map(r => r.id === editing.id ? { ...r, name: payload.name, departmentId: form.departmentId, systemCategory: form.systemCategory, department: dept } : r));
        setSuccessMsg(`Role "${payload.name}" updated.`);
      } else {
        const payload = { name: form.name.trim(), code: form.code.trim(), departmentId: form.departmentId, systemCategory: form.systemCategory };
        const res = await bffFetch<{ id: string }>('/api/hr/roles', { method: 'POST', body: JSON.stringify(payload) });
        const dept = departments.find(d => d.id === form.departmentId);
        setRoles(prev => [...prev, { id: res.id, name: payload.name, code: payload.code, departmentId: form.departmentId, systemCategory: form.systemCategory, department: dept, isActive: true }]);
        setSuccessMsg(`Role "${payload.name}" created.`);
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
      await bffFetch<unknown>(`/api/hr/roles/${deleteTarget.id}`, { method: 'DELETE' });
      setRoles(prev => prev.filter(r => r.id !== deleteTarget.id));
      setSuccessMsg(`Role "${deleteTarget.name}" removed.`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Employee Roles</h1>
          <p className="text-sm text-slate-500 mt-0.5">Define job roles for your school staff.</p>
        </div>
        <button type="button" onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Role
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3"><p className="text-sm text-red-700">{error}</p></div>}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {loading && <div className="py-12 text-center text-sm text-slate-400">Loading roles…</div>}

      {!loading && (
        <PremiumCard accentColor="purple" className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role Name</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Code</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Department</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{r.name}</td>
                  <td className="px-5 py-3.5"><span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{r.code}</span></td>
                  <td className="px-5 py-3.5 text-slate-700">{r.department?.name ?? '—'}</td>
                  <td className="px-5 py-3.5"><span className="text-xs font-medium text-slate-600">{CATEGORY_LABELS[r.systemCategory] ?? r.systemCategory}</span></td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${r.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(r)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">Edit</button>
                      <button type="button" onClick={() => setDeleteTarget(r)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-400">No employee roles configured yet.</td></tr>
              )}
            </tbody>
          </table>
        </PremiumCard>
      )}

      <p className="mt-4 text-xs text-slate-400">{roles.length} role{roles.length !== 1 ? 's' : ''} registered.</p>

      <RoleModal open={modalOpen} editing={editing} departments={departments} onClose={closeModal} onSave={handleSave} saving={saving} />
      <DeleteDialog open={deleteTarget !== null} label={deleteTarget?.name ?? ''} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} deleting={deleting} />
    </div>
  );
}

export default function RolesPage() {
  return <AuthGuard>{(claims) => <RolesContent claims={claims} />}</AuthGuard>;
}
