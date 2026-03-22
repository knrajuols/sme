'use client';

/**
 * TeacherForm — Reusable teacher form with validation + API submission.
 * Used by: Faculty page (standalone slide-over) and HR Onboard Wizard (wizard mode).
 *
 * When `initialValues` is provided (wizard mode), identity fields are rendered
 * as a read-only summary and domain-specific fields remain editable.
 */
import { useEffect, useState } from 'react';
import { bffFetch } from '../../lib/api';
import { formatDateForInput } from '../../lib/date-utils';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DeptRef  { id: string; name: string; code: string }
interface RoleRef  { id: string; name: string; code: string }
interface SubjectRef { id: string; name: string; code: string }

export interface TeacherRecord {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  contactPhone: string | null;
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  employeeCode: string;
  designation: string;
  isActive: boolean;
  subjects: SubjectRef[];
}

/** Pre-filled identity from wizard Step 1 — renders identity fields readOnly */
export interface IdentityInitialValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  dateOfJoining: string;
  departmentId: string;
  roleId: string;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  dateOfJoining: string;
  employeeCode: string;
  designation: string;
  departmentId: string;
  roleId: string;
  isActive: boolean;
  subjectIds: string[];
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = {
  firstName: '', lastName: '', email: '', phone: '',
  dateOfBirth: '', dateOfJoining: '',
  employeeCode: '', designation: '', departmentId: '', roleId: '',
  isActive: true, subjectIds: [],
};

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm(f: FormState, skipIdentity: boolean): FormErrors {
  const e: FormErrors = {};
  if (!skipIdentity) {
    if (!f.firstName.trim()) e.firstName = 'First name is required.';
    else if (f.firstName.trim().length < 2) e.firstName = 'First name must be at least 2 characters.';
    if (f.lastName.trim() && f.lastName.trim().length < 2) e.lastName = 'Last name must be at least 2 characters.';
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
    if (!f.departmentId) e.departmentId = 'Department is required.';
    if (!f.roleId) e.roleId = 'Role is required.';
  }
  if (!f.employeeCode.trim()) e.employeeCode = 'Employee ID is required.';
  else if (f.employeeCode.trim().length < 3) e.employeeCode = 'Employee ID must be at least 3 characters.';
  if (!f.designation.trim()) e.designation = 'Designation is required.';
  return e;
}

const inputCls = (err?: string) =>
  `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`;

// ── Props ─────────────────────────────────────────────────────────────────────
export interface TeacherFormProps {
  initialValues?: IdentityInitialValues;
  editing?: TeacherRecord | null;
  allSubjects: SubjectRef[];
  allDepts: DeptRef[];
  allRoles: RoleRef[];
  onSuccess: (info: { name: string; action: 'created' | 'updated' }) => void;
  onError?: (msg: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TeacherForm({
  initialValues, editing, allSubjects, allDepts, allRoles,
  onSuccess, onError, onCancel, submitLabel, cancelLabel,
}: TeacherFormProps) {
  const isEdit = !!editing;
  const isWizard = !!initialValues;

  const [form, setForm] = useState<FormState>(() => {
    if (editing) return {
      firstName: editing.firstName ?? '', lastName: editing.lastName ?? '',
      email: editing.email ?? '', phone: editing.contactPhone ?? '',
      dateOfBirth: formatDateForInput(editing.dateOfBirth), dateOfJoining: formatDateForInput(editing.dateOfJoining),
      employeeCode: editing.employeeCode, designation: editing.designation,
      isActive: editing.isActive, departmentId: '', roleId: '',
      subjectIds: editing.subjects?.map(s => s.id) ?? [],
    };
    if (initialValues) return {
      ...EMPTY,
      firstName: initialValues.firstName, lastName: initialValues.lastName,
      email: initialValues.email, phone: initialValues.phone,
      dateOfBirth: initialValues.dateOfBirth, dateOfJoining: initialValues.dateOfJoining,
      departmentId: initialValues.departmentId, roleId: initialValues.roleId,
    };
    return EMPTY;
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Reset when editing target changes (panel reopen with different teacher)
  useEffect(() => {
    if (editing) {
      setForm({
        firstName: editing.firstName ?? '', lastName: editing.lastName ?? '',
        email: editing.email ?? '', phone: editing.contactPhone ?? '',
        dateOfBirth: formatDateForInput(editing.dateOfBirth), dateOfJoining: formatDateForInput(editing.dateOfJoining),
        employeeCode: editing.employeeCode, designation: editing.designation,
        isActive: editing.isActive, departmentId: '', roleId: '',
        subjectIds: editing.subjects?.map(s => s.id) ?? [],
      });
    } else if (!initialValues) {
      setForm(EMPTY);
    }
    setErrors({});
  }, [editing, initialValues]);

  function setField(k: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(p => ({ ...p, [k]: e.target.value }));
      if (errors[k]) setErrors(p => ({ ...p, [k]: undefined }));
    };
  }

  function setSelect(k: keyof FormState, v: string) {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: undefined }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!isEdit) {
      const errs = validateForm(form, isWizard);
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    }
    setSaving(true);
    try {
      if (isEdit) {
        await bffFetch<unknown>(`/api/faculty/${editing!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim() || undefined,
            email: form.email.trim().toLowerCase() || undefined,
            phone: form.phone.trim() || undefined,
            dateOfBirth: form.dateOfBirth || undefined,
            dateOfJoining: form.dateOfJoining || undefined,
            employeeCode: form.employeeCode.trim(),
            designation: form.designation.trim(),
            isActive: form.isActive,
            subjectIds: form.subjectIds,
          }),
        });
        onSuccess({ name: form.firstName.trim(), action: 'updated' });
      } else {
        await bffFetch<{ id: string }>('/api/faculty', {
          method: 'POST',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim() || undefined,
            email: form.email.trim().toLowerCase() || undefined,
            phone: form.phone.trim() || undefined,
            dateOfBirth: form.dateOfBirth || undefined,
            dateOfJoining: form.dateOfJoining || undefined,
            employeeCode: form.employeeCode.trim(),
            designation: form.designation.trim(),
            departmentId: form.departmentId,
            roleId: form.roleId,
            isActive: form.isActive,
            subjectIds: form.subjectIds,
          }),
        });
        onSuccess({ name: form.firstName.trim(), action: 'created' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save teacher';
      onError?.(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Read-only identity summary (wizard mode) */}
      {isWizard && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-slate-400 text-xs">Name</span><p className="font-medium text-slate-700">{form.firstName} {form.lastName}</p></div>
          <div><span className="text-slate-400 text-xs">Phone</span><p className="font-medium text-slate-700">{form.phone}</p></div>
          {form.email && <div><span className="text-slate-400 text-xs">Email</span><p className="font-medium text-slate-700">{form.email}</p></div>}
        </div>
      )}

      {/* Editable identity fields (standalone / edit mode) */}
      {!isWizard && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input type="text" className={inputCls(errors.firstName)} value={form.firstName}
                onChange={setField('firstName')} placeholder="e.g. Priya" maxLength={100} autoFocus />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Last Name <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input type="text" className={inputCls(errors.lastName)} value={form.lastName}
                onChange={setField('lastName')} placeholder="e.g. Sharma" maxLength={100} />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Email <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input type="email" className={inputCls(errors.email)} value={form.email}
              onChange={setField('email')} placeholder="e.g. priya.sharma@school.edu" maxLength={200} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
            <input type="text" className={inputCls(errors.phone)} value={form.phone}
              onChange={setField('phone')} placeholder="e.g. +91-9876543210" maxLength={20} />
          </div>

          {/* Date of Birth & Date of Joining */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of Birth</label>
              <input type="date" className={inputCls()} value={form.dateOfBirth}
                onChange={setField('dateOfBirth')} max={formatDateForInput(new Date())} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of Joining</label>
              <input type="date" className={inputCls()} value={form.dateOfJoining}
                onChange={setField('dateOfJoining')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors
                  ${errors.departmentId ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`}
                value={form.departmentId}
                onChange={e => setSelect('departmentId', e.target.value)}
              >
                <option value="">Select department…</option>
                {allDepts.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
              </select>
              {errors.departmentId && <p className="mt-1 text-xs text-red-600">{errors.departmentId}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors
                  ${errors.roleId ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`}
                value={form.roleId}
                onChange={e => setSelect('roleId', e.target.value)}
              >
                <option value="">Select role…</option>
                {allRoles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
              </select>
              {errors.roleId && <p className="mt-1 text-xs text-red-600">{errors.roleId}</p>}
            </div>
          </div>
        </>
      )}

      {/* Employee Code + Designation */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Employee ID <span className="text-red-500">*</span>
          </label>
          <input type="text" className={`${inputCls(errors.employeeCode)} font-mono`}
            value={form.employeeCode} onChange={setField('employeeCode')}
            placeholder="EMP-1001" maxLength={50} />
          {errors.employeeCode && <p className="mt-1 text-xs text-red-600">{errors.employeeCode}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Designation <span className="text-red-500">*</span>
          </label>
          <input type="text" className={inputCls(errors.designation)}
            value={form.designation} onChange={setField('designation')}
            placeholder="e.g. Senior Teacher" maxLength={100} />
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

      {/* Active toggle — not shown in wizard mode */}
      {!isWizard && (
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
          <span className="text-sm text-slate-700">{form.isActive ? 'Active' : 'Inactive'}</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
            {cancelLabel ?? 'Cancel'}
          </button>
        )}
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
          ) : (submitLabel ?? (isEdit ? 'Update Teacher' : 'Save Teacher'))}
        </button>
      </div>
    </form>
  );
}
