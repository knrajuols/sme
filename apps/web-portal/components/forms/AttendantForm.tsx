'use client';

/**
 * AttendantForm — Reusable attendant form with validation + API submission.
 * Used by: Transport Staff page (standalone slide-over) and HR Onboard Wizard (wizard mode).
 *
 * When `initialValues` is provided (wizard mode), identity fields are rendered
 * as a read-only summary and attendant-specific fields remain editable.
 */
import { useEffect, useState } from 'react';
import { bffFetch } from '../../lib/api';
import { formatDateForInput } from '../../lib/date-utils';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DeptRef { id: string; name: string; code: string }
interface RoleRef { id: string; name: string; code: string }

export interface AttendantRecord {
  id: string;
  policeVerificationStatus: string | null;
  isActive: boolean;
  employee: { id: string; firstName: string; lastName: string | null; contactPhone: string; email: string | null; dateOfBirth: string | null; dateOfJoining: string | null };
}

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
  phone: string;
  email: string;
  dateOfBirth: string;
  dateOfJoining: string;
  departmentId: string;
  roleId: string;
  policeVerificationStatus: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = {
  firstName: '', lastName: '', phone: '', email: '',
  dateOfBirth: '', dateOfJoining: '',
  departmentId: '', roleId: '', policeVerificationStatus: '',
};

const POLICE_STATUSES = ['Verified', 'Pending', 'Not Applied'] as const;

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm(f: FormState): FormErrors {
  const e: FormErrors = {};
  if (!f.firstName.trim()) e.firstName = 'First name is required.';
  if (!f.phone.trim()) e.phone = 'Phone is required.';
  else if (!/^\d{10,15}$/.test(f.phone.trim())) e.phone = 'Enter a valid phone number (10-15 digits).';
  if (!f.departmentId) e.departmentId = 'Department is required.';
  if (!f.roleId) e.roleId = 'Role is required.';
  return e;
}

const inputCls = (err?: string) =>
  `w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400 ${err ? 'border-red-400 bg-red-50' : ''}`;

// ── Props ─────────────────────────────────────────────────────────────────────
export interface AttendantFormProps {
  initialValues?: IdentityInitialValues;
  editing?: AttendantRecord | null;
  allDepts: DeptRef[];
  allRoles: RoleRef[];
  onSuccess: (info: { name: string; action: 'created' | 'updated' }) => void;
  onError?: (msg: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AttendantForm({
  initialValues, editing, allDepts, allRoles,
  onSuccess, onError, onCancel, submitLabel, cancelLabel,
}: AttendantFormProps) {
  const isEdit = !!editing;
  const isWizard = !!initialValues;

  const [form, setForm] = useState<FormState>(() => {
    if (editing) return {
      firstName: editing.employee.firstName,
      lastName: editing.employee.lastName ?? '',
      phone: editing.employee.contactPhone ?? '',
      email: editing.employee.email ?? '',
      dateOfBirth: formatDateForInput(editing.employee.dateOfBirth), dateOfJoining: formatDateForInput(editing.employee.dateOfJoining),
      departmentId: '', roleId: '',
      policeVerificationStatus: editing.policeVerificationStatus ?? '',
    };
    if (initialValues) return {
      ...EMPTY,
      firstName: initialValues.firstName, lastName: initialValues.lastName,
      phone: initialValues.phone, email: initialValues.email,
      dateOfBirth: initialValues.dateOfBirth, dateOfJoining: initialValues.dateOfJoining,
      departmentId: initialValues.departmentId, roleId: initialValues.roleId,
    };
    return EMPTY;
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        firstName: editing.employee.firstName,
        lastName: editing.employee.lastName ?? '',
        phone: editing.employee.contactPhone ?? '',
        email: editing.employee.email ?? '',
        dateOfBirth: formatDateForInput(editing.employee.dateOfBirth), dateOfJoining: formatDateForInput(editing.employee.dateOfJoining),
        departmentId: '', roleId: '',
        policeVerificationStatus: editing.policeVerificationStatus ?? '',
      });
    } else if (!initialValues) {
      setForm(EMPTY);
    }
    setErrors({});
  }, [editing, initialValues]);

  const set = (k: keyof FormState, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  };

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!isEdit) {
      const errs = isWizard ? ({} as FormErrors) : validateForm(form);
      if (Object.keys(errs).length) { setErrors(errs); return; }
    }
    setSaving(true);
    try {
      if (isEdit) {
        await bffFetch<{ updated: boolean }>(`/api/transport/attendants/${editing!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim() || undefined,
            phone: form.phone.trim(),
            email: form.email.trim() || undefined,
            dateOfBirth: form.dateOfBirth || undefined,
            dateOfJoining: form.dateOfJoining || undefined,
            policeVerificationStatus: form.policeVerificationStatus || undefined,
          }),
        });
        onSuccess({ name: form.firstName.trim(), action: 'updated' });
      } else {
        await bffFetch<{ id: string }>('/api/transport/attendants', {
          method: 'POST',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim() || undefined,
            phone: form.phone.trim(),
            email: form.email.trim() || undefined,
            dateOfBirth: form.dateOfBirth || undefined,
            dateOfJoining: form.dateOfJoining || undefined,
            departmentId: form.departmentId,
            roleId: form.roleId,
            policeVerificationStatus: form.policeVerificationStatus || undefined,
          }),
        });
        onSuccess({ name: form.firstName.trim(), action: 'created' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save attendant';
      onError?.(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Wizard mode: readOnly identity summary */}
      {isWizard && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-slate-400 text-xs">Name</span><p className="font-medium text-slate-700">{form.firstName} {form.lastName}</p></div>
          <div><span className="text-slate-400 text-xs">Phone</span><p className="font-medium text-slate-700">{form.phone}</p></div>
          {form.email && <div><span className="text-slate-400 text-xs">Email</span><p className="font-medium text-slate-700">{form.email}</p></div>}
        </div>
      )}

      {/* Standalone: identity fields */}
      {!isWizard && (
        <>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">First Name <span className="text-red-500">*</span></label>
            <input value={form.firstName} onChange={e => set('firstName', e.target.value)}
              className={inputCls(errors.firstName)} placeholder="First name" />
            {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Last Name <span className="text-slate-400 font-normal">(optional)</span></label>
            <input value={form.lastName} onChange={e => set('lastName', e.target.value)}
              className={inputCls()} placeholder="Last name" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone <span className="text-red-500">*</span></label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)}
              className={inputCls(errors.phone)} placeholder="10-15 digits" />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email <span className="text-slate-400 font-normal">(optional)</span></label>
            <input value={form.email} onChange={e => set('email', e.target.value)}
              className={inputCls()} placeholder="attendant@school.edu" />
          </div>
          {/* Date of Birth & Date of Joining */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of Birth</label>
              <input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)}
                className={inputCls()} max={formatDateForInput(new Date())} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of Joining</label>
              <input type="date" value={form.dateOfJoining} onChange={e => set('dateOfJoining', e.target.value)}
                className={inputCls()} />
            </div>
          </div>
          {!isEdit && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Department <span className="text-red-500">*</span></label>
                <select value={form.departmentId} onChange={e => set('departmentId', e.target.value)}
                  className={`${inputCls(errors.departmentId)} bg-white`}>
                  <option value="">Select department…</option>
                  {allDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.departmentId && <p className="text-xs text-red-500 mt-1">{errors.departmentId}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role <span className="text-red-500">*</span></label>
                <select value={form.roleId} onChange={e => set('roleId', e.target.value)}
                  className={`${inputCls(errors.roleId)} bg-white`}>
                  <option value="">Select role…</option>
                  {allRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                {errors.roleId && <p className="text-xs text-red-500 mt-1">{errors.roleId}</p>}
              </div>
            </>
          )}
        </>
      )}

      {/* Police Verification */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Police Verification <span className="text-slate-400 font-normal">(optional)</span></label>
        <select value={form.policeVerificationStatus} onChange={e => set('policeVerificationStatus', e.target.value)}
          className={`${inputCls()} bg-white`}>
          <option value="">Not set</option>
          {POLICE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Actions */}
      <div className="pt-2 flex gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
            {cancelLabel ?? 'Cancel'}
          </button>
        )}
        <button type="submit" disabled={saving}
          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 text-sm">
          {saving ? 'Saving…' : (submitLabel ?? (isEdit ? 'Update Attendant' : 'Create Attendant'))}
        </button>
      </div>
    </form>
  );
}
