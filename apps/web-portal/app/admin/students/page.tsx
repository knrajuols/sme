'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PremiumCard } from '../../../components/ui/PremiumCard';
import { StatusPill } from '../../../components/ui/StatusPill';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  status: string;
}

interface Parent {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone?: string;
}

interface StudentForm {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  status: string;
  parentIds: string[];
}

type FormErrors = Partial<Record<keyof Omit<StudentForm, 'parentIds'>, string>>;

const EMPTY_FORM: StudentForm = {
  admissionNumber: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'MALE',
  status: 'ACTIVE',
  parentIds: [],
};

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm(form: StudentForm): FormErrors {
  const e: FormErrors = {};
  if (!form.admissionNumber.trim()) e.admissionNumber = 'Admission number is required.';
  else if (form.admissionNumber.trim().length < 3) e.admissionNumber = 'Min 3 characters.';
  if (!form.firstName.trim()) e.firstName = 'First name is required.';
  if (!form.lastName.trim()) e.lastName = 'Last name is required.';
  if (!form.dateOfBirth) e.dateOfBirth = 'Date of birth is required.';
  return e;
}

// ── Slide-over panel ──────────────────────────────────────────────────────────
function StudentPanel({
  open,
  editing,
  parents,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  editing: Student | null;
  parents: Parent[];
  onClose: () => void;
  onSave: (form: StudentForm) => void;
  saving: boolean;
}) {
  const isEdit = editing !== null;
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              admissionNumber: editing.admissionNumber,
              firstName: editing.firstName,
              lastName: editing.lastName,
              dateOfBirth: '',
              gender: editing.gender,
              status: editing.status,
              parentIds: [],
            }
          : EMPTY_FORM,
      );
      setErrors({});
    }
  }, [open, editing]);

  function setField<K extends keyof StudentForm>(field: K, value: StudentForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field in errors) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function toggleParent(id: string) {
    setForm((prev) => ({
      ...prev,
      parentIds: prev.parentIds.includes(id)
        ? prev.parentIds.filter((p) => p !== id)
        : [...prev.parentIds, id],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
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
        aria-label={isEdit ? 'Edit Student' : 'Add Student'}
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? `Edit: ${editing!.firstName} ${editing!.lastName}` : 'Add Student'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update this student record.' : 'Register a new student.'}
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
          {/* Admission Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Admission Number <span className="text-red-500">*</span>
            </label>
            <input type="text" className={inputCls(errors.admissionNumber)}
              value={form.admissionNumber} onChange={(e) => setField('admissionNumber', e.target.value)}
              placeholder="e.g. ADM-2026-001" maxLength={50} autoFocus disabled={isEdit} />
            {errors.admissionNumber && <p className="mt-1 text-xs text-red-600">{errors.admissionNumber}</p>}
          </div>

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input type="text" className={inputCls(errors.firstName)}
                value={form.firstName} onChange={(e) => setField('firstName', e.target.value)}
                placeholder="Aarav" maxLength={100} />
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

          {/* Date of Birth */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input type="date" className={inputCls(errors.dateOfBirth)}
                value={form.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} />
              {errors.dateOfBirth && <p className="mt-1 text-xs text-red-600">{errors.dateOfBirth}</p>}
            </div>
          )}

          {/* Gender & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gender</label>
              <select className={inputCls()} value={form.gender} onChange={(e) => setField('gender', e.target.value)}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Not specified</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
              <select className={inputCls()} value={form.status} onChange={(e) => setField('status', e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TRANSFERRED">Transferred</option>
                <option value="GRADUATED">Graduated</option>
                <option value="DROPPED_OUT">Dropped Out</option>
              </select>
            </div>
          </div>

          {/* Parent assignment */}
          {parents.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Assign Parents
                <span className="ml-2 font-normal text-slate-400">(optional — select all that apply)</span>
              </label>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {parents.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-blue-600"
                      checked={form.parentIds.includes(p.id)}
                      onChange={() => toggleParent(p.id)}
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-800">
                        {p.firstName} {p.lastName}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">{p.relation}</span>
                    </div>
                  </label>
                ))}
              </div>
              {form.parentIds.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">{form.parentIds.length} parent(s) selected.</p>
              )}
            </div>
          )}

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
              ) : (isEdit ? 'Update Student' : 'Add Student')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Delete dialog ──────────────────────────────────────────────────────────────
function DeleteDialog({ open, label, onCancel, onConfirm, deleting }: {
  open: boolean; label: string; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Student</h3>
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <span className="font-semibold">&ldquo;{label}&rdquo;</span>? This cannot be undone.
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
function StudentsContent({ claims: _claims }: { claims: UserClaims }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([
      bffFetch<Student[]>('/api/academic/students'),
      bffFetch<Parent[]>('/api/academic/parents'),
    ])
      .then(([studs, pars]) => {
        setStudents(Array.isArray(studs) ? studs : []);
        setParents(Array.isArray(pars) ? pars : []);
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Failed to load data');
      })
      .finally(() => setLoading(false));
  }, []);

  function openAdd() { setEditing(null); setPanelOpen(true); }
  function openEdit(s: Student) { setEditing(s); setPanelOpen(true); }
  function handleClose() { setPanelOpen(false); setSaveError(''); setTimeout(() => setEditing(null), 300); }

  async function handleSave(form: StudentForm) {
    setSaving(true);
    setSaveError('');
    try {
      if (editing) {
        await bffFetch<unknown>(`/api/academic/students/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            gender: form.gender,
            status: form.status,
            ...(form.parentIds.length > 0 && { parentIds: form.parentIds }),
          }),
        });
        setStudents((prev) =>
          prev.map((s) =>
            s.id === editing.id
              ? { ...s, firstName: form.firstName.trim(), lastName: form.lastName.trim(), gender: form.gender, status: form.status }
              : s,
          ),
        );
        setSuccessMsg(`Student "${form.firstName} ${form.lastName}" updated.`);
      } else {
        const result = await bffFetch<{ id: string }>('/api/academic/students', {
          method: 'POST',
          body: JSON.stringify({
            admissionNumber: form.admissionNumber.trim(),
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            dateOfBirth: new Date(form.dateOfBirth).toISOString(),
            gender: form.gender,
            status: form.status,
            ...(form.parentIds.length > 0 && { parentIds: form.parentIds }),
          }),
        });
        const newStudent: Student = {
          id: result.id,
          admissionNumber: form.admissionNumber.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          gender: form.gender,
          status: form.status,
        };
        setStudents((prev) => [...prev, newStudent]);
        setSuccessMsg(`Student "${newStudent.firstName} ${newStudent.lastName}" registered.`);
      }
      setSaving(false);
      setPanelOpen(false);
      setTimeout(() => setEditing(null), 300);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save student');
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bffFetch<unknown>(`/api/academic/students/${deleteTarget.id}`, { method: 'DELETE' });
      setStudents((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setSuccessMsg(`Student "${deleteTarget.firstName} ${deleteTarget.lastName}" deleted.`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to delete student');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage student records for your school.</p>
        </div>
        <button type="button" onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Student
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

      {loading && <div className="py-12 text-center text-sm text-slate-400">Loading students…</div>}

      {!loading && (
        <>
          {/* Table — desktop */}
          <PremiumCard accentColor="blue" className="hidden sm:block overflow-hidden">
            <table className="grand-table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Admission No.</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Gender</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">{s.admissionNumber}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{s.firstName} {s.lastName}</td>
                    <td className="px-5 py-4 text-slate-600 capitalize">{s.gender.toLowerCase().replace('_', ' ')}</td>
                    <td className="px-5 py-4">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => openEdit(s)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(s)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center text-sm text-slate-400">
                      No students yet. Click &quot;Add Student&quot; to register one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </PremiumCard>

          {/* Card stack — mobile */}
          <div className="sm:hidden space-y-3">
            {students.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-bold text-slate-900">{s.firstName} {s.lastName}</p>
                  <StatusPill status={s.status} />
                </div>
                <p className="font-mono text-xs text-slate-400 mb-3">{s.admissionNumber}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(s)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Edit
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(s)}
                    className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {students.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">No students yet.</div>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-400">{students.length} student{students.length !== 1 ? 's' : ''} registered.</p>
        </>
      )}

      <StudentPanel
        open={panelOpen}
        editing={editing}
        parents={parents}
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
export default function StudentsPage() {
  return (
    <AuthGuard>
      {(claims) => <StudentsContent claims={claims} />}
    </AuthGuard>
  );
}
