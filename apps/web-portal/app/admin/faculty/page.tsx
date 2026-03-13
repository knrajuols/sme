'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PremiumCard } from '../../../components/ui/PremiumCard';
import { StatusPill } from '../../../components/ui/StatusPill';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SubjectRef { id: string; name: string; code: string; }
interface Teacher {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  contactPhone: string | null;
  employeeCode: string;
  designation: string;
  isActive: boolean;
  subjects: SubjectRef[];
}

interface TeacherForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeCode: string;
  designation: string;
  isActive: boolean;
  subjectIds: string[];
}

type FormErrors = Partial<Record<keyof TeacherForm, string>>;

const EMPTY_FORM: TeacherForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  employeeCode: '',
  designation: '',
  isActive: true,
  subjectIds: [],
};

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm(form: TeacherForm): FormErrors {
  const e: FormErrors = {};
  if (!form.firstName.trim()) e.firstName = 'First name is required.';
  else if (form.firstName.trim().length < 2) e.firstName = 'First name must be at least 2 characters.';
  // lastName is optional — only validate length if provided
  if (form.lastName.trim() && form.lastName.trim().length < 2) e.lastName = 'Last name must be at least 2 characters.';
  if (!form.email.trim()) e.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
  if (!form.employeeCode.trim()) e.employeeCode = 'Employee ID is required.';
  else if (form.employeeCode.trim().length < 3) e.employeeCode = 'Employee ID must be at least 3 characters.';
  if (!form.designation.trim()) e.designation = 'Designation is required.';
  return e;
}

function fullName(t: Teacher): string {
  return [t.firstName, t.lastName].filter(Boolean).join(' ') || t.employeeCode;
}

// ── Slide-over panel ──────────────────────────────────────────────────────────
function TeacherPanel({
  open,
  editingTeacher,
  allSubjects,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  editingTeacher: Teacher | null;
  allSubjects: SubjectRef[];
  onClose: () => void;
  onSave: (form: TeacherForm) => void;
  saving: boolean;
}) {
  const isEdit = editingTeacher !== null;
  const [form, setForm] = useState<TeacherForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(
        editingTeacher
          ? {
              firstName: editingTeacher.firstName ?? '',
              lastName: editingTeacher.lastName ?? '',
              email: editingTeacher.email ?? '',
              phone: editingTeacher.contactPhone ?? '',
              employeeCode: editingTeacher.employeeCode,
              designation: editingTeacher.designation,
              isActive: editingTeacher.isActive,
              subjectIds: editingTeacher.subjects?.map(s => s.id) ?? [],
            }
          : EMPTY_FORM
      );
      setErrors({});
    }
  }, [open, editingTeacher]);

  function setField(field: keyof TeacherForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(form);
  }

  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors
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
        aria-label={isEdit ? 'Edit Teacher' : 'Add Teacher'}
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? `Edit: ${fullName(editingTeacher!)}` : 'Add Faculty Member'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update this teacher record.' : 'Register a new faculty member.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={inputCls(errors.firstName)}
                value={form.firstName}
                onChange={setField('firstName')}
                placeholder="e.g. Priya"
                maxLength={100}
                autoFocus
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Last Name <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                className={inputCls(errors.lastName)}
                value={form.lastName}
                onChange={setField('lastName')}
                placeholder="e.g. Sharma"
                maxLength={100}
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className={inputCls(errors.email)}
              value={form.email}
              onChange={setField('email')}
              placeholder="e.g. priya.sharma@school.edu"
              maxLength={200}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
            <input
              type="text"
              className={inputCls(errors.phone)}
              value={form.phone}
              onChange={setField('phone')}
              placeholder="e.g. +91-9876543210"
              maxLength={20}
            />
          </div>

          {/* Employee ID + Designation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Employee ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`${inputCls(errors.employeeCode)} font-mono`}
                value={form.employeeCode}
                onChange={setField('employeeCode')}
                placeholder="EMP-1001"
                maxLength={50}
              />
              {errors.employeeCode && <p className="mt-1 text-xs text-red-600">{errors.employeeCode}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Designation <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={inputCls(errors.designation)}
                value={form.designation}
                onChange={setField('designation')}
                placeholder="e.g. Senior Teacher"
                maxLength={100}
              />
              {errors.designation && <p className="mt-1 text-xs text-red-600">{errors.designation}</p>}
            </div>
          </div>

          {/* Subjects multi-select */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Subjects <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            {allSubjects.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No subjects configured yet.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-300 bg-white divide-y divide-slate-100">
                {allSubjects.map(s => {
                  const checked = form.subjectIds.includes(s.id);
                  return (
                    <label key={s.id}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setForm(prev => ({
                            ...prev,
                            subjectIds: checked
                              ? prev.subjectIds.filter(id => id !== s.id)
                              : [...prev.subjectIds, s.id],
                          }));
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">{s.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-slate-400">{s.code}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.isActive}
              onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                  ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
            <span className="text-sm text-slate-700">
              {form.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving&hellip;
                </>
              ) : (isEdit ? 'Update Teacher' : 'Save Teacher')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Delete confirmation dialog ─────────────────────────────────────────────────
function DeleteDialog({
  open,
  label,
  onCancel,
  onConfirm,
  deleting,
}: {
  open: boolean;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">Remove Faculty Member</h3>
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to remove <span className="font-semibold">&ldquo;{label}&rdquo;</span>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={deleting}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
            {deleting ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main content ───────────────────────────────────────────────────────────────
function FacultyContent({ claims: _claims }: { claims: UserClaims }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      bffFetch<Teacher[]>('/api/faculty'),
      bffFetch<SubjectRef[]>('/api/academic/subjects').catch(() => [] as SubjectRef[]),
    ])
      .then(([data, subs]) => {
        setTeachers(Array.isArray(data) ? data : []);
        setAllSubjects(Array.isArray(subs) ? subs : []);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load faculty'))
      .finally(() => setLoading(false));
  }, []);

  function openAdd() {
    setEditingTeacher(null);
    setPanelOpen(true);
  }

  function openEdit(t: Teacher) {
    setEditingTeacher(t);
    setPanelOpen(true);
  }

  function handleClose() {
    setPanelOpen(false);
    setSaveError('');
    setTimeout(() => setEditingTeacher(null), 300);
  }

  async function handleSave(form: TeacherForm) {
    setSaving(true);
    setSaveError('');
    try {
      if (editingTeacher) {
        await bffFetch<unknown>(`/api/faculty/${editingTeacher.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim() || undefined,
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim() || undefined,
            employeeCode: form.employeeCode.trim(),
            designation: form.designation.trim(),
            isActive: form.isActive,
            subjectIds: form.subjectIds,
          }),
        });
        const updatedSubjects = allSubjects.filter(s => form.subjectIds.includes(s.id));
        setTeachers((prev) =>
          prev.map((t) =>
            t.id === editingTeacher.id
              ? {
                  ...t,
                  firstName: form.firstName.trim(),
                  lastName: form.lastName.trim() || null,
                  email: form.email.trim().toLowerCase(),
                  contactPhone: form.phone.trim() || null,
                  employeeCode: form.employeeCode.trim(),
                  designation: form.designation.trim(),
                  isActive: form.isActive,
                  subjects: updatedSubjects,
                }
              : t
          )
        );
        setSuccessMsg(`Teacher "${form.firstName.trim()}" updated successfully.`);
      } else {
        const result = await bffFetch<{ id: string }>('/api/faculty', {
          method: 'POST',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim() || undefined,
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim() || undefined,
            employeeCode: form.employeeCode.trim(),
            designation: form.designation.trim(),
            isActive: form.isActive,
            subjectIds: form.subjectIds,
          }),
        });
        const newSubjects = allSubjects.filter(s => form.subjectIds.includes(s.id));
        const newTeacher: Teacher = {
          id: result.id,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || null,
          email: form.email.trim().toLowerCase(),
          contactPhone: form.phone.trim() || null,
          employeeCode: form.employeeCode.trim(),
          designation: form.designation.trim(),
          isActive: form.isActive,
          subjects: newSubjects,
        };
        setTeachers((prev) => [...prev, newTeacher]);
        setSuccessMsg(`Teacher "${form.firstName.trim()}" added successfully.`);
      }
      setSaving(false);
      setPanelOpen(false);
      setTimeout(() => setEditingTeacher(null), 300);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save teacher');
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bffFetch<unknown>(`/api/faculty/${deleteTarget.id}`, { method: 'DELETE' });
      setTeachers((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setSuccessMsg(`Teacher "${fullName(deleteTarget)}" removed.`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to remove teacher');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Faculty</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage teachers and staff for your school.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Teacher
        </button>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{loadError}</p>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{saveError}</p>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-sm text-slate-400">Loading faculty…</div>
      )}

      {!loading && (<>
        {/* Table — desktop */}
        <PremiumCard accentColor="orange" className="hidden sm:block overflow-hidden">
          <table className="grand-table w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Emp. ID</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Designation</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Subjects</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-slate-900">{fullName(t)}</td>
                  <td className="px-5 py-4 text-slate-600">{t.email ?? '—'}</td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{t.employeeCode}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{t.designation}</td>
                  <td className="px-5 py-4">
                    {t.subjects && t.subjects.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.subjects.map(s => (
                          <span key={s.id} className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill status={t.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(t)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                        Edit
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(t)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-slate-400">
                    No faculty members yet. Click &quot;Add Teacher&quot; to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </PremiumCard>

        {/* Card stack — mobile */}
        <div className="sm:hidden space-y-3">
          {teachers.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between mb-1">
                <p className="font-bold text-slate-900 text-base">{fullName(t)}</p>
                <StatusPill status={t.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </div>
              <p className="text-xs text-slate-500">{t.email ?? '—'}</p>
              <p className="text-xs text-slate-500">{t.designation}</p>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => openEdit(t)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  Edit
                </button>
                <button type="button" onClick={() => setDeleteTarget(t)}
                  className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                  Remove
                </button>
              </div>
            </div>
          ))}
          {teachers.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">No faculty members yet.</div>
          )}
        </div>
      </>)}

      <p className="mt-4 text-xs text-slate-400">{teachers.length} faculty member{teachers.length !== 1 ? 's' : ''} registered.</p>

      <TeacherPanel
        open={panelOpen}
        editingTeacher={editingTeacher}
        allSubjects={allSubjects}
        onClose={handleClose}
        onSave={handleSave}
        saving={saving}
      />

      <DeleteDialog
        open={deleteTarget !== null}
        label={deleteTarget ? fullName(deleteTarget) : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}

// ── Page export ────────────────────────────────────────────────────────────────
export default function FacultyPage() {
  return (
    <AuthGuard>
      {(claims) => <FacultyContent claims={claims} />}
    </AuthGuard>
  );
}
