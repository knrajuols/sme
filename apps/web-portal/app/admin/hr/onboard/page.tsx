'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import { PremiumCard } from '../../../../components/ui/PremiumCard';
import { TeacherForm } from '../../../../components/forms/TeacherForm';
import { DriverForm } from '../../../../components/forms/DriverForm';
import { AttendantForm } from '../../../../components/forms/AttendantForm';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DeptRef { id: string; name: string; code: string }
interface RoleRef { id: string; name: string; code: string; departmentId: string; systemCategory: SystemRoleCategory }
interface SubjectRef { id: string; name: string; code: string }

/** System category from the DB enum — drives Step 2 form routing. */
type SystemRoleCategory = 'TEACHER' | 'DRIVER' | 'ATTENDANT' | 'STANDARD_STAFF';

interface CoreIdentity {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  dateOfJoining: string;
  departmentId: string;
  roleId: string;
}

type CoreErrors = Partial<Record<keyof CoreIdentity, string>>;

const EMPTY_CORE: CoreIdentity = {
  firstName: '', lastName: '', email: '', phone: '',
  dateOfBirth: '', dateOfJoining: '',
  departmentId: '', roleId: '',
};

// ── Category metadata (styling for role cards) ───────────────────────────────
const CATEGORY_META: Record<SystemRoleCategory, { icon: string; border: string; bg: string; text: string; ring: string }> = {
  TEACHER:        { icon: '📚', border: 'border-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700',   ring: 'ring-blue-200' },
  DRIVER:         { icon: '🚐', border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200' },
  ATTENDANT:      { icon: '🛡️', border: 'border-teal-500',   bg: 'bg-teal-50',   text: 'text-teal-700',   ring: 'ring-teal-200' },
  STANDARD_STAFF: { icon: '💼', border: 'border-slate-500',  bg: 'bg-slate-50',  text: 'text-slate-700',  ring: 'ring-slate-200' },
};

// ── Validation ────────────────────────────────────────────────────────────────
function validateCore(f: CoreIdentity): CoreErrors {
  const e: CoreErrors = {};
  if (!f.firstName.trim()) e.firstName = 'First name is required.';
  if (!f.phone.trim()) e.phone = 'Phone is required.';
  else if (!/^\d{10,15}$/.test(f.phone.trim())) e.phone = 'Enter a valid phone (10-15 digits).';
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email.';
  if (!f.dateOfBirth) e.dateOfBirth = 'Date of birth is required.';
  if (!f.dateOfJoining) e.dateOfJoining = 'Date of joining is required.';
  if (!f.departmentId) e.departmentId = 'Department is required.';
  if (!f.roleId) e.roleId = 'Please select a role.';
  return e;
}

function inputCls(err?: string): string {
  return `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`;
}

// ── Step Indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  const labels = ['Core Identity', 'Details & Submit'];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {labels.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors ${
              done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : 'bg-slate-200 text-slate-500'
            }`}>
              {done ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : step}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${active ? 'text-indigo-700' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
              {label}
            </span>
            {i < labels.length - 1 && <div className={`w-8 h-0.5 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ═══  STEP 1 — Core Identity (Department → cascading Role cards)  ═══════════
// ═════════════════════════════════════════════════════════════════════════════
function Step1Core({
  form, errors, allDepts, deptRoles, rolesLoading, onChange, onSelectRole, onNext,
}: {
  form: CoreIdentity;
  errors: CoreErrors;
  allDepts: DeptRef[];
  deptRoles: RoleRef[];
  rolesLoading: boolean;
  onChange: (k: keyof CoreIdentity, v: string) => void;
  onSelectRole: (roleId: string) => void;
  onNext: () => void;
}) {
  return (
    <form onSubmit={ev => { ev.preventDefault(); onNext(); }} className="space-y-5">
      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">1</span>
        Core Identity
      </h2>
      <p className="text-sm text-slate-500 -mt-3">Enter the employee&apos;s basic information, then choose department &amp; role.</p>

      {/* Name row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">First Name <span className="text-red-500">*</span></label>
          <input className={inputCls(errors.firstName)} value={form.firstName} onChange={e => onChange('firstName', e.target.value)} placeholder="e.g. Priya" maxLength={100} autoFocus />
          {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Last Name <span className="text-slate-400 font-normal">(optional)</span></label>
          <input className={inputCls()} value={form.lastName} onChange={e => onChange('lastName', e.target.value)} placeholder="e.g. Sharma" maxLength={100} />
        </div>
      </div>

      {/* Contact row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone <span className="text-red-500">*</span></label>
          <input className={inputCls(errors.phone)} value={form.phone} onChange={e => onChange('phone', e.target.value)} placeholder="10-15 digits" maxLength={15} />
          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email <span className="text-slate-400 font-normal">(optional)</span></label>
          <input type="email" className={inputCls(errors.email)} value={form.email} onChange={e => onChange('email', e.target.value)} placeholder="priya@school.edu" maxLength={200} />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>
      </div>

      {/* Date row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of Birth <span className="text-red-500">*</span></label>
          <input type="date" className={inputCls(errors.dateOfBirth)} value={form.dateOfBirth} onChange={e => onChange('dateOfBirth', e.target.value)} max={new Date().toISOString().split('T')[0]} />
          {errors.dateOfBirth && <p className="text-xs text-red-500 mt-1">{errors.dateOfBirth}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of Joining <span className="text-red-500">*</span></label>
          <input type="date" className={inputCls(errors.dateOfJoining)} value={form.dateOfJoining} onChange={e => onChange('dateOfJoining', e.target.value)} />
          {errors.dateOfJoining && <p className="text-xs text-red-500 mt-1">{errors.dateOfJoining}</p>}
        </div>
      </div>

      {/* Department dropdown — cascading trigger */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Department <span className="text-red-500">*</span></label>
        <select className={inputCls(errors.departmentId)} value={form.departmentId} onChange={e => onChange('departmentId', e.target.value)}>
          <option value="">Select department…</option>
          {allDepts.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
        </select>
        {errors.departmentId && <p className="text-xs text-red-500 mt-1">{errors.departmentId}</p>}
      </div>

      {/* Role cards — appear once a department is selected */}
      {form.departmentId && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role <span className="text-red-500">*</span></label>
          {rolesLoading ? (
            <p className="text-xs text-slate-400 py-3">Loading roles…</p>
          ) : deptRoles.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">No roles found for this department. Create roles first on the Roles page.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {deptRoles.map(r => {
                const cat: SystemRoleCategory = r.systemCategory ?? 'STANDARD_STAFF';
                const meta = CATEGORY_META[cat];
                const selected = form.roleId === r.id;
                return (
                  <button key={r.id} type="button"
                    onClick={() => onSelectRole(r.id)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      selected ? `${meta.border} ${meta.bg} ${meta.text} ring-2 ${meta.ring}` : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xl">{meta.icon}</span>
                    <span className="text-center leading-tight">{r.name}</span>
                    <span className="text-[10px] font-mono opacity-60">{r.code}</span>
                  </button>
                );
              })}
            </div>
          )}
          {errors.roleId && <p className="text-xs text-red-500 mt-1">{errors.roleId}</p>}
        </div>
      )}

      {/* Next */}
      <div className="flex justify-end pt-2">
        <button type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
          Next: {form.roleId ? ((deptRoles.find(r => r.id === form.roleId)?.systemCategory ?? 'STANDARD_STAFF') === 'STANDARD_STAFF' ? 'Confirm' : 'Specialization') : 'Details'}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ═══  STEP 2 — Admin Confirm & Submit  ══════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════
function AdminConfirmStep({
  core, allDepts, roleName, onBack, onSubmit, submitting, submitError,
}: {
  core: CoreIdentity;
  allDepts: DeptRef[];
  roleName: string;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string;
}) {
  const deptName = allDepts.find(d => d.id === core.departmentId)?.name ?? '—';

  function ReviewRow({ label, value }: { label: string; value: string }) {
    if (!value) return null;
    return (
      <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-sm font-medium text-slate-800 text-right">{value}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
        <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">2</span>
        Confirm &amp; Submit
      </h2>
      <p className="text-sm text-slate-500 -mt-3">Review the staff details and confirm onboarding.</p>

      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-gray-50 p-5">
        <ReviewRow label="Full Name" value={[core.firstName, core.lastName].filter(Boolean).join(' ')} />
        <ReviewRow label="Phone" value={core.phone} />
        <ReviewRow label="Email" value={core.email} />
        <ReviewRow label="Date of Birth" value={core.dateOfBirth ? new Date(core.dateOfBirth + 'T00:00:00').toLocaleDateString() : '—'} />
        <ReviewRow label="Date of Joining" value={core.dateOfJoining ? new Date(core.dateOfJoining + 'T00:00:00').toLocaleDateString() : '—'} />
        <ReviewRow label="Department" value={deptName} />
        <ReviewRow label="Role" value={roleName} />
      </div>

      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <button type="button" onClick={onSubmit} disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Creating…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Onboard Employee
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ═══  SUCCESS  ═══════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════
function SuccessScreen({ roleName, name, onAnother, onDirectory }: {
  roleName: string;
  name: string;
  onAnother: () => void;
  onDirectory: () => void;
}) {
  return (
    <div className="text-center py-12 space-y-6">
      <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-800">Employee Onboarded!</h2>
        <p className="text-sm text-slate-500 mt-2">
          <span className="font-semibold text-slate-700">{name}</span> has been successfully registered as <span className="font-semibold text-slate-700">{roleName}</span>.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button type="button" onClick={onAnother}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Onboard Another
        </button>
        <button type="button" onClick={onDirectory}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
          View Employee Directory
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ═══  WIZARD ORCHESTRATOR  ═══════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════
function OnboardWizardContent() {
  const router = useRouter();

  // Reference data
  const [allDepts, setAllDepts] = useState<DeptRef[]>([]);
  const [allRoles, setAllRoles] = useState<RoleRef[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectRef[]>([]);
  const [refLoading, setRefLoading] = useState(true);

  // Department-filtered roles (cascading)
  const [deptRoles, setDeptRoles] = useState<RoleRef[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  // Wizard state
  const [step, setStep] = useState(1);
  const [core, setCore] = useState<CoreIdentity>(EMPTY_CORE);
  const [coreErrors, setCoreErrors] = useState<CoreErrors>({});

  // Admin-only submit state (domain forms handle their own)
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  // ── Load base reference data ──────────────────────────────────────────────
  useEffect(() => {
    setRefLoading(true);
    Promise.all([
      bffFetch<DeptRef[]>('/api/hr/departments').catch(() => []),
      bffFetch<RoleRef[]>('/api/hr/roles').catch(() => []),
      bffFetch<SubjectRef[]>('/api/academic/subjects').catch(() => []),
    ]).then(([d, r, s]) => {
      setAllDepts(Array.isArray(d) ? d : []);
      setAllRoles(Array.isArray(r) ? r : []);
      setAllSubjects(Array.isArray(s) ? s : []);
    }).finally(() => setRefLoading(false));
  }, []);

  // ── Cascade: fetch roles when department changes ──────────────────────────
  useEffect(() => {
    if (!core.departmentId) { setDeptRoles([]); return; }
    setRolesLoading(true);
    bffFetch<RoleRef[]>(`/api/hr/roles?departmentId=${encodeURIComponent(core.departmentId)}`)
      .then(data => setDeptRoles(Array.isArray(data) ? data : []))
      .catch(() => setDeptRoles([]))
      .finally(() => setRolesLoading(false));
  }, [core.departmentId]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const selectedRole = deptRoles.find(r => r.id === core.roleId) ?? allRoles.find(r => r.id === core.roleId);
  const category: SystemRoleCategory = selectedRole?.systemCategory ?? 'STANDARD_STAFF';
  const roleName = selectedRole?.name ?? '—';

  // ── Core field handler ────────────────────────────────────────────────────
  const handleCoreChange = useCallback((k: keyof CoreIdentity, v: string) => {
    setCore(p => {
      const next = { ...p, [k]: v };
      // Reset roleId when department changes (role cards will refresh)
      if (k === 'departmentId') next.roleId = '';
      return next;
    });
    setCoreErrors(p => ({ ...p, [k]: undefined }));
  }, []);

  const handleSelectRole = useCallback((roleId: string) => {
    setCore(p => ({ ...p, roleId }));
    setCoreErrors(p => ({ ...p, roleId: undefined }));
  }, []);

  // ── Step 1 → Next ─────────────────────────────────────────────────────────
  const handleStep1Next = useCallback(() => {
    const errs = validateCore(core);
    if (Object.keys(errs).length) { setCoreErrors(errs); return; }
    setStep(2);
  }, [core]);

  // ── Domain form success (Teacher/Driver/Attendant) ────────────────────────
  const handleDomainSuccess = useCallback(() => {
    setSuccess(true);
  }, []);

  // ── Admin submit (no domain form — just create employee directly) ─────────
  const handleAdminSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      await bffFetch<{ id: string }>('/api/hr/employees', {
        method: 'POST',
        body: JSON.stringify({
          firstName: core.firstName.trim(),
          lastName: core.lastName.trim() || undefined,
          contactPhone: core.phone.trim() || undefined,
          email: core.email.trim().toLowerCase() || undefined,
          dateOfBirth: core.dateOfBirth || undefined,
          dateOfJoining: core.dateOfJoining || undefined,
          departmentId: core.departmentId,
          roleId: core.roleId,
          isActive: true,
        }),
      });
      setSuccess(true);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to onboard employee. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [core]);

  // ── Reset wizard for another onboarding ───────────────────────────────────
  const handleOnboardAnother = useCallback(() => {
    setStep(1);
    setCore(EMPTY_CORE);
    setCoreErrors({});
    setSubmitError('');
    setSuccess(false);
    setDeptRoles([]);
  }, []);

  // ── Build initialValues for domain forms from Step 1 core data ────────────
  const initialValues = {
    firstName: core.firstName,
    lastName: core.lastName,
    email: core.email,
    phone: core.phone,
    dateOfBirth: core.dateOfBirth,
    dateOfJoining: core.dateOfJoining,
    departmentId: core.departmentId,
    roleId: core.roleId,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (refLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="py-16 text-center text-sm text-slate-400">Loading reference data…</div>
      </div>
    );
  }

  if (success) {
    const name = [core.firstName, core.lastName].filter(Boolean).join(' ');
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <PremiumCard accentColor="green">
          <SuccessScreen
            roleName={roleName}
            name={name}
            onAnother={handleOnboardAnother}
            onDirectory={() => router.push('/admin/hr/employees')}
          />
        </PremiumCard>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Onboard Employee</h1>
        <p className="text-sm text-slate-500 mt-1">
          Select a department, pick a role, and fill in the employee&apos;s details.
        </p>
      </div>

      <StepIndicator current={step} />

      <PremiumCard accentColor="blue">
        <div className="p-6">
          {/* Step 1 — Core Identity with cascading Dept → Role cards */}
          {step === 1 && (
            <Step1Core
              form={core}
              errors={coreErrors}
              allDepts={allDepts}
              deptRoles={deptRoles}
              rolesLoading={rolesLoading}
              onChange={handleCoreChange}
              onSelectRole={handleSelectRole}
              onNext={handleStep1Next}
            />
          )}

          {/* Step 2 — Teacher domain form */}
          {step === 2 && category === 'TEACHER' && (
            <TeacherForm
              initialValues={initialValues}
              allSubjects={allSubjects}
              allDepts={allDepts}
              allRoles={allRoles}
              onSuccess={handleDomainSuccess}
              onError={(msg) => setSubmitError(msg)}
              onCancel={() => setStep(1)}
              submitLabel="Onboard Employee"
              cancelLabel="Back"
            />
          )}

          {/* Step 2 — Driver domain form */}
          {step === 2 && category === 'DRIVER' && (
            <DriverForm
              initialValues={initialValues}
              allDepts={allDepts}
              allRoles={allRoles}
              onSuccess={handleDomainSuccess}
              onError={(msg) => setSubmitError(msg)}
              onCancel={() => setStep(1)}
              submitLabel="Onboard Employee"
              cancelLabel="Back"
            />
          )}

          {/* Step 2 — Attendant domain form */}
          {step === 2 && category === 'ATTENDANT' && (
            <AttendantForm
              initialValues={initialValues}
              allDepts={allDepts}
              allRoles={allRoles}
              onSuccess={handleDomainSuccess}
              onError={(msg) => setSubmitError(msg)}
              onCancel={() => setStep(1)}
              submitLabel="Onboard Employee"
              cancelLabel="Back"
            />
          )}

          {/* Step 2 — Admin Confirm (no domain form: just review + submit) */}
          {step === 2 && category === 'STANDARD_STAFF' && (
            <AdminConfirmStep
              core={core}
              allDepts={allDepts}
              roleName={roleName}
              onBack={() => setStep(1)}
              onSubmit={handleAdminSubmit}
              submitting={submitting}
              submitError={submitError}
            />
          )}

          {/* Submission error for domain forms (shown below the form) */}
          {step === 2 && category !== 'STANDARD_STAFF' && submitError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}
        </div>
      </PremiumCard>
    </div>
  );
}

// ── Page wrapper with AuthGuard ─────────────────────────────────────────────
export default function OnboardEmployeePage() {
  return (
    <AuthGuard>
      {() => <OnboardWizardContent />}
    </AuthGuard>
  );
}
