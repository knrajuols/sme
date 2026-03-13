'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PremiumCard } from '../../../components/ui/PremiumCard';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Parent {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  gender: string;
  phone?: string;
  email?: string;
}

interface ParentForm {
  userId: string;
  firstName: string;
  lastName: string;
  relation: string;
  gender: string;
  phone: string;
  email: string;
}

type FormErrors = Partial<Record<keyof ParentForm, string>>;

const EMPTY_FORM: ParentForm = {
  userId: '',
  firstName: '',
  lastName: '',
  relation: 'FATHER',
  gender: 'MALE',
  phone: '',
  email: '',
};

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm(form: ParentForm, isEdit: boolean): FormErrors {
  const e: FormErrors = {};
  if (!isEdit && !form.userId.trim()) e.userId = 'User ID is required.';
  if (!form.firstName.trim()) e.firstName = 'First name is required.';
  if (!form.lastName.trim()) e.lastName = 'Last name is required.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    e.email = 'Enter a valid email address.';
  }
  return e;
}

// ── Slide-over panel ──────────────────────────────────────────────────────────
function ParentPanel({
  open,
  editing,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  editing: Parent | null;
  onClose: () => void;
  onSave: (form: ParentForm) => void;
  saving: boolean;
}) {
  const isEdit = editing !== null;
  const [form, setForm] = useState<ParentForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              userId: '',
              firstName: editing.firstName,
              lastName: editing.lastName,
              relation: editing.relation,
              gender: editing.gender,
              phone: editing.phone ?? '',
              email: editing.email ?? '',
            }
          : EMPTY_FORM,
      );
      setErrors({});
    }
  }, [open, editing]);

  function setField<K extends keyof ParentForm>(field: K, value: ParentForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field in errors) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form, isEdit);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(form);
  }

  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
     ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={isEdit ? 'Edit Parent' : 'Add Parent'}
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? `Edit: ${editing!.firstName} ${editing!.lastName}` : 'Add Parent / Guardian'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update this parent record.' : 'Register a new parent or guardian.'}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          {/* User ID — only on create */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                User ID (IAM) <span className="text-red-500">*</span>
              </label>
              <input type="text" className={inputCls(errors.userId)}
                value={form.userId} onChange={(e) => setField('userId', e.target.value)}
                placeholder="UUID of the user account" maxLength={36} autoFocus />
              {errors.userId && <p className="mt-1 text-xs text-red-600">{errors.userId}</p>}
              <p className="mt-1.5 text-xs text-slate-400">Must match a valid user in the IAM service.</p>
            </div>
          )}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input type="text" className={inputCls(errors.firstName)}
                value={form.firstName} onChange={(e) => setField('firstName', e.target.value)}
                placeholder="Ramesh" maxLength={100} autoFocus={isEdit} />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input type="text" className={inputCls(errors.lastName)}
                value={form.lastName} onChange={(e) => setField('lastName', e.target.value)}
                placeholder="Sharma" maxLength={100} />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
            </div>
          </div>

          {/* Relation & Gender */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Relation</label>
              <select className={inputCls()} value={form.relation} onChange={(e) => setField('relation', e.target.value)}>
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="GUARDIAN">Guardian</option>
                <option value="GRANDPARENT">Grandparent</option>
                <option value="SIBLING">Sibling</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gender</label>
              <select className={inputCls()} value={form.gender} onChange={(e) => setField('gender', e.target.value)}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Not specified</option>
              </select>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
            <input type="tel" className={inputCls(errors.phone)}
              value={form.phone} onChange={(e) => setField('phone', e.target.value)}
              placeholder="+91 98765 43210" maxLength={20} />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
            <input type="email" className={inputCls(errors.email)}
              value={form.email} onChange={(e) => setField('email', e.target.value)}
              placeholder="ramesh.sharma@example.com" maxLength={200} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div className="flex-1" />

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving&hellip;
                </>
              ) : (isEdit ? 'Update Parent' : 'Add Parent')}
            </button>
          </div>
        </form>
      </div>
    </>
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
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Parent</h3>
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <span className="font-semibold">&ldquo;{label}&rdquo;</span>?
          Any student&ndash;parent links for this person will also be removed.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={deleting}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function ParentsContent({ claims: _claims }: { claims: UserClaims }) {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Parent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Parent | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    bffFetch<Parent[]>('/api/academic/parents')
      .then((data) => setParents(Array.isArray(data) ? data : []))
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load parents'))
      .finally(() => setLoading(false));
  }, []);

  function openAdd() { setEditing(null); setPanelOpen(true); }
  function openEdit(p: Parent) { setEditing(p); setPanelOpen(true); }
  function handleClose() { setPanelOpen(false); setSaveError(''); setTimeout(() => setEditing(null), 300); }

  async function handleSave(form: ParentForm) {
    setSaving(true);
    setSaveError('');
    try {
      if (editing) {
        await bffFetch<unknown>(`/api/academic/parents/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            relation: form.relation,
            gender: form.gender,
            ...(form.phone.trim() && { phone: form.phone.trim() }),
            ...(form.email.trim() && { email: form.email.trim() }),
          }),
        });
        setParents((prev) =>
          prev.map((p) =>
            p.id === editing.id
              ? { ...p, firstName: form.firstName.trim(), lastName: form.lastName.trim(), relation: form.relation, gender: form.gender, phone: form.phone.trim() || undefined, email: form.email.trim() || undefined }
              : p,
          ),
        );
        setSuccessMsg(`Parent "${form.firstName} ${form.lastName}" updated.`);
      } else {
        const result = await bffFetch<{ id: string }>('/api/academic/parents', {
          method: 'POST',
          body: JSON.stringify({
            userId: form.userId.trim(),
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            relation: form.relation,
            gender: form.gender,
            ...(form.phone.trim() && { phone: form.phone.trim() }),
            ...(form.email.trim() && { email: form.email.trim() }),
          }),
        });
        const newParent: Parent = {
          id: result.id,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          relation: form.relation,
          gender: form.gender,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
        };
        setParents((prev) => [...prev, newParent]);
        setSuccessMsg(`Parent "${newParent.firstName} ${newParent.lastName}" registered.`);
      }
      setSaving(false);
      setPanelOpen(false);
      setTimeout(() => setEditing(null), 300);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save parent');
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bffFetch<unknown>(`/api/academic/parents/${deleteTarget.id}`, { method: 'DELETE' });
      setParents((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setSuccessMsg(`Parent "${deleteTarget.firstName} ${deleteTarget.lastName}" deleted.`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to delete parent');
    } finally {
      setDeleting(false);
    }
  }

  const relationLabel = (rel: string) => {
    const map: Record<string, string> = {
      FATHER: 'Father', MOTHER: 'Mother', GUARDIAN: 'Guardian',
      GRANDPARENT: 'Grandparent', SIBLING: 'Sibling', OTHER: 'Other',
    };
    return map[rel] ?? rel;
  };

  const relationColor = (rel: string) => {
    const map: Record<string, string> = {
      FATHER: 'bg-blue-50 text-blue-700',
      MOTHER: 'bg-pink-50 text-pink-700',
      GUARDIAN: 'bg-amber-50 text-amber-700',
      GRANDPARENT: 'bg-purple-50 text-purple-700',
      SIBLING: 'bg-emerald-50 text-emerald-700',
      OTHER: 'bg-slate-100 text-slate-600',
    };
    return map[rel] ?? 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Parents &amp; Guardians</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage parent and guardian records for your school.</p>
        </div>
        <button type="button" onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Parent
        </button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{loadError}</p>
        </div>
      )}
      {saveError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{saveError}</p>
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

      {loading && <div className="py-12 text-center text-sm text-slate-400">Loading parents…</div>}

      {!loading && (
        <>
          {/* Table — desktop */}
          <PremiumCard accentColor="green" className="hidden sm:block overflow-hidden">
            <table className="grand-table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Relation</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Gender</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parents.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-900">{p.firstName} {p.lastName}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${relationColor(p.relation)}`}>
                        {relationLabel(p.relation)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 capitalize">{p.gender.toLowerCase().replace('_', ' ')}</td>
                    <td className="px-5 py-4 text-slate-500 text-xs">
                      {p.phone && <span>{p.phone}</span>}
                      {p.phone && p.email && <span className="mx-1.5">·</span>}
                      {p.email && <span>{p.email}</span>}
                      {!p.phone && !p.email && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => openEdit(p)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(p)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {parents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center text-sm text-slate-400">
                      No parents yet. Click &quot;Add Parent&quot; to register one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </PremiumCard>

          {/* Card stack — mobile */}
          <div className="sm:hidden space-y-3">
            {parents.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-bold text-slate-900">{p.firstName} {p.lastName}</p>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${relationColor(p.relation)}`}>
                    {relationLabel(p.relation)}
                  </span>
                </div>
                {(p.phone || p.email) && (
                  <p className="text-xs text-slate-400 mb-3">
                    {p.phone}{p.phone && p.email ? '  ·  ' : ''}{p.email}
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(p)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Edit
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(p)}
                    className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {parents.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">No parents yet.</div>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-400">{parents.length} parent{parents.length !== 1 ? 's' : ''} registered.</p>
        </>
      )}

      <ParentPanel
        open={panelOpen}
        editing={editing}
        onClose={handleClose}
        onSave={handleSave}
        saving={saving}
      />

      <DeleteDialog
        open={deleteTarget !== null}
        label={deleteTarget ? `${deleteTarget.firstName} ${deleteTarget.lastName}` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function ParentsPage() {
  return (
    <AuthGuard>
      {(claims) => <ParentsContent claims={claims} />}
    </AuthGuard>
  );
}
