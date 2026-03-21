// Issue-217: Enterprise-grade Students Table — Phase 1 UI Architecture
// Implements: search, sort, sticky headers, horizontal scroll, all 13 columns,
// progress-bar placeholders (Bus Route / Fee Status / Attendance), mobile cards.
'use client';

import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { DateInput } from '../../../components/ui/DateInput';
import { PaginationBar } from '../../../components/ui/PaginationBar';
import { PremiumCard } from '../../../components/ui/PremiumCard';
import { StatusPill } from '../../../components/ui/StatusPill';

// ── Types ─────────────────────────────────────────────────────────────────────
interface StudentEnrollment {
  id: string;
  rollNumber?: string;
  class: { id: string; name: string; code: string };
  section?: { id: string; name: string };
  academicYear: { id: string; name: string; isActive: boolean };
}
interface ParentRef {
  relation: string;  // Issue-225: per-mapping relation override
  parent: { id: string; firstName: string; lastName: string | null; relation: string };
}
interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  gender: string;
  status: string;
  enrollments: StudentEnrollment[];
  parentMappings: ParentRef[];
}

// Issue-238b: Full student record — returned by GET /api/academic/students/:id.
// Extends the shallow list row with all scalar fields needed to hydrate the edit form.
interface StudentDetail extends Student {
  middleName: string | null;
  preferredName: string | null;
  dateOfJoining: string | null;
  dateOfBirth: string;
  preferredGender: string | null;
  bloodGroup: string;
  motherTongue: string;
  nationality: string;
  category: string;
  religion: string;
  caste: string | null;
  aadhaarMasked: string | null;
  apaarId: string | null;
  isRteAdmission: boolean;
  isCwsn: boolean;
  disabilityType: string | null;
  isBpl: boolean;
  isMinority: boolean;
  allergies: string | null;
  medicalConditions: string | null;
  emergencyContact: string | null;
  previousSchool: string | null;
  tcNumber: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  photoUrl: string | null;
  dateOfLeaving: string | null;
  leavingReason: string | null;
}

interface Parent {
  id: string;
  firstName: string;
  lastName: string | null;
  relation: string;
  phone?: string;
}

type SortField = 'rollNumber' | 'name' | 'academicYear' | 'class' | 'section' | 'gender' | 'status';
type SortDir = 'asc' | 'desc';
const DASH = '—';

// ── UI helpers ────────────────────────────────────────────────────────────────
function genderBadge(g: string) {
  const map: Record<string, [string, string]> = {
    MALE: ['Male', 'bg-sky-50 text-sky-700'],
    FEMALE: ['Female', 'bg-pink-50 text-pink-700'],
    OTHER: ['Other', 'bg-purple-50 text-purple-700'],
    PREFER_NOT_TO_SAY: ['N/S', 'bg-slate-100 text-slate-500'],
  };
  const [label, cls] = map[g] ?? [g, 'bg-slate-100 text-slate-500'];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function PlaceholderBar({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-[72px]">
      <div className="w-12 h-1.5 rounded-full bg-slate-100" />
      <span className="text-xs text-slate-300 whitespace-nowrap">{label}</span>
    </div>
  );
}

function SortBtn({
  field, active, dir, onClick, children,
}: {
  field: SortField; active: boolean; dir: SortDir;
  onClick: (f: SortField) => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(field)}
      className="group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 transition-colors"
    >
      {children}
      <span className={`text-[10px] ${active ? 'text-blue-500' : 'text-slate-200 group-hover:text-slate-400'}`}>
        {active && dir === 'asc' ? '↑' : active && dir === 'desc' ? '↓' : '⇅'}
      </span>
    </button>
  );
}

interface AcademicYearOption { id: string; name: string; isActive: boolean; }
interface ClassOption { id: string; name: string; code: string; }
interface SectionOption { id: string; name: string; sectionId: string; }

interface StudentForm {
  // Core Identity
  admissionNumber: string;
  dateOfJoining: string;
  firstName: string;
  middleName: string;
  lastName: string;
  preferredName: string;
  dateOfBirth: string;
  gender: string;
  preferredGender: string;
  bloodGroup: string;
  motherTongue: string;
  nationality: string;
  status: string;
  // Government & Compliance
  category: string;
  religion: string;
  caste: string;
  aadhaarMasked: string;
  apaarId: string;
  isRteAdmission: boolean;
  isCwsn: boolean;
  disabilityType: string;
  isBpl: boolean;
  isMinority: boolean;
  // Health & Emergency
  allergies: string;
  medicalConditions: string;
  emergencyContact: string;
  // Admission & Address
  previousSchool: string;
  tcNumber: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  photoUrl: string;
  // Lifecycle
  dateOfLeaving: string;
  leavingReason: string;
  // Relations
  parentId: string;       // Issue-225: single parent assignment
  parentRelation: string; // Issue-225: relation of parent to this student
  // Enrollment (optional — creates a StudentEnrollment on save)
  academicYearId: string;
  classId: string;
  sectionId: string;
  rollNumber: string;
}

type FormErrors = Partial<Record<keyof Omit<StudentForm, 'parentId' | 'parentRelation' | 'isRteAdmission' | 'isCwsn' | 'isBpl' | 'isMinority'>, string>>;

const EMPTY_FORM: StudentForm = {
  admissionNumber: '',
  dateOfJoining: '',
  firstName: '',
  middleName: '',
  lastName: '',
  preferredName: '',
  dateOfBirth: '',
  gender: 'PREFER_NOT_TO_SAY',
  preferredGender: '',
  bloodGroup: 'UNKNOWN',
  motherTongue: '',
  nationality: 'Indian',
  status: 'ACTIVE',
  category: 'GENERAL',
  religion: 'NOT_STATED',
  caste: '',
  aadhaarMasked: '',
  apaarId: '',
  isRteAdmission: false,
  isCwsn: false,
  disabilityType: '',
  isBpl: false,
  isMinority: false,
  allergies: '',
  medicalConditions: '',
  emergencyContact: '',
  previousSchool: '',
  tcNumber: '',
  addressLine: '',
  city: '',
  state: '',
  pincode: '',
  photoUrl: '',
  dateOfLeaving: '',
  leavingReason: '',
  parentId: '',
  parentRelation: '',
  academicYearId: '',
  classId: '',
  sectionId: '',
  rollNumber: '',
};

const BLOOD_GROUP_LABELS: Record<string, string> = {
  A_POS: 'A+', A_NEG: 'A−', B_POS: 'B+', B_NEG: 'B−',
  AB_POS: 'AB+', AB_NEG: 'AB−', O_POS: 'O+', O_NEG: 'O−', UNKNOWN: 'Unknown',
};

// Issue-225: Relation labels for parent-to-student mapping dropdown
const RELATION_LABELS: Record<string, string> = {
  FATHER: 'Father', MOTHER: 'Mother', GUARDIAN: 'Guardian',
  GRANDPARENT: 'Grandparent', SIBLING: 'Sibling', OTHER: 'Other',
};

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm(form: StudentForm, isEdit: boolean): FormErrors {
  const e: FormErrors = {};
  if (!isEdit) {
    if (!form.admissionNumber.trim()) e.admissionNumber = 'Admission number is required.';
    else if (form.admissionNumber.trim().length < 3) e.admissionNumber = 'Min 3 characters.';
    if (!form.dateOfJoining) e.dateOfJoining = 'Date of joining is required.';
    if (!form.dateOfBirth) e.dateOfBirth = 'Date of birth is required.';
  }
  if (!form.firstName.trim()) e.firstName = 'First name is required.';
  if (!form.motherTongue.trim()) e.motherTongue = 'Mother tongue is required.';
  // Issue-222: lastName is intentionally NOT validated as required (culturally optional)
  // Enrollment: academicYear + class are mandatory; section + rollNumber are optional
  const hasPartialEnrollment = form.academicYearId || form.classId;
  if (hasPartialEnrollment) {
    if (!form.academicYearId) e.academicYearId = 'Select an academic year.';
    if (!form.classId) e.classId = 'Select a class.';
  }
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
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  // Task-224-2C: field visibility filter — ALL | MANDATORY | OPTIONAL
  const [fieldFilter, setFieldFilter] = useState<'ALL' | 'MANDATORY' | 'OPTIONAL'>('ALL');
  // Issue-225: combobox search state for the parent picker
  const [parentSearch, setParentSearch] = useState('');
  const [parentDropOpen, setParentDropOpen] = useState(false);
  // Issue-238b: tracks deep-fetch of the full student record in edit mode
  const [deepFetching, setDeepFetching] = useState(false);
  const [deepError, setDeepError] = useState('');

  // Issue-238b: Panel open handler — deep-fetch in edit mode to hydrate ALL form fields.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFieldFilter('ALL');
    setParentSearch('');
    setParentDropOpen(false);
    setClasses([]);

    if (!editing) {
      // Add mode: seed empty form; fetch dropdown data only.
      setForm(EMPTY_FORM);
      setDeepFetching(false);
      setDeepError('');
      setLoadingYears(true);
      bffFetch<AcademicYearOption[]>('/api/academic/years')
        .then((years) => {
          setAcademicYears(Array.isArray(years) ? years : []);
        })
        .catch(() => { setAcademicYears([]); })
        .finally(() => { setLoadingYears(false); });
    } else {
      // Edit mode: deep-fetch full student record + dropdown options in parallel.
      // Issue-238b: The list row is a shallow projection — only a server round-trip gives
      // all fields (motherTongue, dateOfJoining, bloodGroup, etc.).
      // Issue-245: Reset form to EMPTY_FORM first so cascade useEffects (academicYearId → classes,
      // classId → sections) always fire when the deep-fetch hydrates the form — even if the
      // previous panel session had the same academicYearId/classId values.
      setForm(EMPTY_FORM);
      setSections([]);
      setDeepFetching(true);
      setDeepError('');
      setLoadingYears(true);
      Promise.all([
        bffFetch<StudentDetail>(`/api/academic/students/${editing.id}`),
        bffFetch<AcademicYearOption[]>('/api/academic/years'),
      ])
        .then(([detail, years]) => {
          const yearList = Array.isArray(years) ? years : [];
          setAcademicYears(yearList);

          // Issue-239: Use the most recent enrollment returned by the server (ordered by
          // createdAt desc, take 1) instead of searching by active-year ID. The active-year
          // lookup returned null whenever the enrollment was for any non-active year, leaving
          // academicYearId/classId/sectionId blank. Classes for this yearId are loaded
          // automatically by the cascade useEffect when form.academicYearId is set below.
          const latestEnrollment = (detail.enrollments ?? [])[0] ?? null;

          // Hydrate ALL form fields from the full server record — no blank defaults.
          setForm({
            admissionNumber: detail.admissionNumber,
            dateOfJoining:   detail.dateOfJoining   ? detail.dateOfJoining.slice(0, 10)   : '',
            firstName:       detail.firstName,
            middleName:      detail.middleName       ?? '',
            lastName:        detail.lastName         ?? '',
            preferredName:   detail.preferredName    ?? '',
            dateOfBirth:     detail.dateOfBirth      ? detail.dateOfBirth.slice(0, 10)     : '',
            gender:          detail.gender,
            preferredGender: detail.preferredGender  ?? '',
            bloodGroup:      detail.bloodGroup       ?? 'UNKNOWN',
            motherTongue:    detail.motherTongue     ?? '',
            nationality:     detail.nationality      ?? 'Indian',
            status:          detail.status,
            category:        detail.category         ?? 'GENERAL',
            religion:        detail.religion         ?? 'NOT_STATED',
            caste:           detail.caste            ?? '',
            aadhaarMasked:   detail.aadhaarMasked    ?? '',
            apaarId:         detail.apaarId          ?? '',
            isRteAdmission:  detail.isRteAdmission   ?? false,
            isCwsn:          detail.isCwsn           ?? false,
            disabilityType:  detail.disabilityType   ?? '',
            isBpl:           detail.isBpl            ?? false,
            isMinority:      detail.isMinority       ?? false,
            allergies:       detail.allergies        ?? '',
            medicalConditions: detail.medicalConditions ?? '',
            emergencyContact:  detail.emergencyContact  ?? '',
            previousSchool:  detail.previousSchool   ?? '',
            tcNumber:        detail.tcNumber         ?? '',
            addressLine:     detail.addressLine      ?? '',
            city:            detail.city             ?? '',
            state:           detail.state            ?? '',
            pincode:         detail.pincode          ?? '',
            photoUrl:        detail.photoUrl         ?? '',
            dateOfLeaving:   detail.dateOfLeaving    ? detail.dateOfLeaving.slice(0, 10)   : '',
            leavingReason:   detail.leavingReason    ?? '',
            parentId:        (detail.parentMappings ?? [])[0]?.parent.id ?? '',
            parentRelation:  (detail.parentMappings ?? [])[0]?.relation  ?? '',
            academicYearId:  latestEnrollment?.academicYear.id ?? '',
            classId:         latestEnrollment?.class.id        ?? '',
            sectionId:       latestEnrollment?.section?.id     ?? '',
            rollNumber:      latestEnrollment?.rollNumber      ?? '',
          });
        })
        .catch(() => setDeepError('Failed to load student details. Close the panel and try again.'))
        .finally(() => { setDeepFetching(false); setLoadingYears(false); });
    }
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Issue-222: Cascade academicYearId → classes only (Section is independent)
  useEffect(() => {
    if (!form.academicYearId) { setClasses([]); return; }
    setLoadingClasses(true);
    setClasses([]);
    bffFetch<ClassOption[]>(`/api/academic/classes?academicYearId=${form.academicYearId}`)
      .then((data) => setClasses(Array.isArray(data) ? data : []))
      .catch(() => setClasses([]))
      .finally(() => setLoadingClasses(false));
  }, [form.academicYearId]);

  // Issue-240: Cascade classId → class-sections (filtered section list)
  useEffect(() => {
    if (!form.classId) { setSections([]); return; }
    setLoadingSections(true);
    setSections([]);
    bffFetch<Array<{ id: string; name: string; sectionId: string; sectionName: string }>>(`/api/academic/class-sections?classId=${form.classId}`)
      .then((data) => setSections(Array.isArray(data) ? data.map((cs) => ({ id: cs.id, name: cs.sectionName, sectionId: cs.sectionId })) : []))
      .catch(() => setSections([]))
      .finally(() => setLoadingSections(false));
  }, [form.classId]);

  function setField<K extends keyof StudentForm>(field: K, value: StudentForm[K]) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Reset cascade dependents — academicYearId resets classId; classId resets sectionId
      if (field === 'academicYearId') { next.classId = ''; next.sectionId = ''; next.rollNumber = ''; }
      if (field === 'classId') { next.sectionId = ''; }
      return next;
    });
    if (field in errors) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form, isEdit);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(form);
  }

  // Task-226: Prompt #226 — left-border accent distinguishes required vs optional fields at a glance.
  // Error state always overrides with full red so validation feedback is never obscured.
  const inputCls = (err?: string, required = false) =>
    `w-full rounded-lg border border-l-4 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
     ${err
       ? 'border-red-400 border-l-red-500 bg-red-50'
       : required
       ? 'border-slate-300 border-l-indigo-600 bg-white hover:border-slate-400'
       : 'border-slate-300 border-l-slate-200 bg-white hover:border-slate-400'}`;

  // Task-224-2C: anyR/anyO drive per-field and per-section visibility
  const anyR = fieldFilter !== 'OPTIONAL';  // Required fields are visible
  const anyO = fieldFilter !== 'MANDATORY'; // Optional fields are visible

  // Inline section header component — sections are conditionally rendered by their parent block
  const SH = ({ label }: { label: string }) => (
    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1 mt-1">{label}</p>
  );

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
        className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? `Edit: ${editing!.firstName}${editing!.lastName ? ' ' + editing!.lastName : ''}` : 'Add Student'}
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

        {/* Task-224-2C: Field Filter — sticky segmented control just below panel header */}
        <div className="flex-shrink-0 px-6 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
            {(['ALL', 'MANDATORY', 'OPTIONAL'] as const).map((opt) => {
              let activeBg = '';
              if (fieldFilter === opt) {
                if (opt === 'ALL') activeBg = 'bg-blue-600 text-white';
                else if (opt === 'MANDATORY') activeBg = 'bg-red-600 text-white';
                else if (opt === 'OPTIONAL') activeBg = 'bg-green-600 text-white';
              } else {
                activeBg = 'text-slate-500 hover:bg-slate-50';
              }
              return (
                <button key={opt} type="button" onClick={() => setFieldFilter(opt)}
                  className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${activeBg}`}
                >
                  {opt === 'ALL' ? 'All Fields' : opt === 'MANDATORY' ? '★ Mandatory' : '○ Optional'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5 relative">
          {/* Issue-238b: Loading overlay while deep-fetching the full student record */}
          {deepFetching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
              <div className="flex flex-col items-center gap-3">
                <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <p className="text-xs text-slate-500">Loading student record…</p>
              </div>
            </div>
          )}
          {deepError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{deepError}</p>
            </div>
          )}

          {/* ── Section 1: Academic & Admission ── has both R and O fields, always shows */}
          <SH label="Academic & Admission" />

          {anyR && (
            <>
              {/* Academic Year — Required */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Academic Year <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputCls(errors.academicYearId, true)}
                  value={form.academicYearId}
                  onChange={(e) => setField('academicYearId', e.target.value)}
                  disabled={loadingYears}
                >
                  <option value="">{loadingYears ? 'Loading…' : 'Select academic year'}</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' ★' : ''}</option>
                  ))}
                </select>
                {errors.academicYearId && <p className="mt-1 text-xs text-red-600">{errors.academicYearId}</p>}
              </div>

              {/* Class — Required */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Class <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputCls(errors.classId, true)}
                  value={form.classId}
                  onChange={(e) => setField('classId', e.target.value)}
                  disabled={!form.academicYearId || loadingClasses}
                >
                  <option value="">{loadingClasses ? 'Loading…' : form.academicYearId ? 'Select class' : 'Select year first'}</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.classId && <p className="mt-1 text-xs text-red-600">{errors.classId}</p>}
              </div>

              {/* Admission Number — Required, create only */}
              {!isEdit && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Admission Number <span className="text-red-500">*</span>
                  </label>
                  <input type="text" className={inputCls(errors.admissionNumber, true)}
                    value={form.admissionNumber} onChange={(e) => setField('admissionNumber', e.target.value)}
                    placeholder="e.g. ADM-2026-001" maxLength={50} autoFocus />
                  {errors.admissionNumber && <p className="mt-1 text-xs text-red-600">{errors.admissionNumber}</p>}
                </div>
              )}

              {/* Date of Joining — Required on create */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Date of Joining {!isEdit && <span className="text-red-500">*</span>}
                </label>
                <DateInput
                  value={form.dateOfJoining}
                  onValueChange={(v) => setField('dateOfJoining', v)}
                  className={inputCls(errors.dateOfJoining, true)}
                />
                {errors.dateOfJoining && <p className="mt-1 text-xs text-red-600">{errors.dateOfJoining}</p>}
              </div>
            </>
          )}

          {/* Section + Roll Number — Optional */}
          {anyO && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                {/* Issue-240: Section cascades from Class via ClassSection assignments */}
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Section</label>
                <select
                  className={inputCls(errors.sectionId)}
                  value={form.sectionId}
                  onChange={(e) => setField('sectionId', e.target.value)}
                  disabled={loadingSections || !form.classId}
                >
                  <option value="">{loadingSections ? 'Loading\u2026' : !form.classId ? 'Select a class first' : 'Select section'}</option>
                  {sections.map((s) => <option key={s.sectionId} value={s.sectionId}>{s.name}</option>)}
                </select>
                {errors.sectionId && <p className="mt-1 text-xs text-red-600">{errors.sectionId}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Roll Number</label>
                <input type="text" className={inputCls(errors.rollNumber)}
                  value={form.rollNumber} onChange={(e) => setField('rollNumber', e.target.value)}
                  placeholder="e.g. 15" maxLength={20} />
                {errors.rollNumber && <p className="mt-1 text-xs text-red-600">{errors.rollNumber}</p>}
              </div>
            </div>
          )}

          {/* ── Section 2: Personal Identity ── has both R and O fields, always shows */}
          <SH label="Personal Identity" />

          {anyR && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input type="text" className={inputCls(errors.firstName, true)}
                value={form.firstName} onChange={(e) => setField('firstName', e.target.value)}
                placeholder="Aarav" maxLength={100} autoFocus={isEdit} />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
            </div>
          )}

          {anyO && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Middle Name</label>
                <input type="text" className={inputCls()}
                  value={form.middleName} onChange={(e) => setField('middleName', e.target.value)}
                  placeholder="Kumar" maxLength={100} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Last Name <span className="text-xs font-normal text-slate-400">(optional)</span>
                </label>
                <input type="text" className={inputCls()}
                  value={form.lastName} onChange={(e) => setField('lastName', e.target.value)}
                  placeholder="Sharma" maxLength={100} />
              </div>
            </div>
          )}

          {anyO && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Preferred Name</label>
              <input type="text" className={inputCls()}
                value={form.preferredName} onChange={(e) => setField('preferredName', e.target.value)}
                placeholder="Display name for report cards" maxLength={100} />
            </div>
          )}

          {/* Date of Birth — Required, create only */}
          {!isEdit && anyR && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <DateInput
                value={form.dateOfBirth}
                onValueChange={(v) => setField('dateOfBirth', v)}
                className={inputCls(errors.dateOfBirth, true)}
              />
              {errors.dateOfBirth && <p className="mt-1 text-xs text-red-600">{errors.dateOfBirth}</p>}
            </div>
          )}

          {/* Gender + Blood Group — Required */}
          {anyR && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select className={inputCls(undefined, true)} value={form.gender} onChange={(e) => setField('gender', e.target.value)}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Blood Group <span className="text-red-500">*</span>
                </label>
                <select className={inputCls(undefined, true)} value={form.bloodGroup} onChange={(e) => setField('bloodGroup', e.target.value)}>
                  {Object.entries(BLOOD_GROUP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Preferred Gender — Optional */}
          {anyO && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Preferred Gender Identity</label>
              <input type="text" className={inputCls()}
                value={form.preferredGender} onChange={(e) => setField('preferredGender', e.target.value)}
                placeholder="Free text (optional)" maxLength={50} />
            </div>
          )}

          {/* Mother Tongue + Nationality — Required — Issue-228: dropdowns for data normalisation */}
          {anyR && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Mother Tongue <span className="text-red-500">*</span>
                </label>
                {(() => {
                  const motherTongueOptions = [
                    "Assamese", "Bengali", "Gujarati", "Hindi", "Kannada", "Kashmiri", "Maithili", "Malayalam", "Marathi", "Nepali", "Odia", "Punjabi", "Santali", "Sindhi", "Tamil", "Telugu", "Urdu", "Other"
                  ].sort((a, b) => a.localeCompare(b));
                  return (
                    <select className={inputCls(errors.motherTongue, true)}
                      value={form.motherTongue} onChange={(e) => setField('motherTongue', e.target.value)}>
                      <option value="">— Select —</option>
                      {motherTongueOptions.map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  );
                })()}
                {errors.motherTongue && <p className="mt-1 text-xs text-red-600">{errors.motherTongue}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Nationality <span className="text-red-500">*</span>
                </label>
                <select className={inputCls(undefined, true)}
                  value={form.nationality} onChange={(e) => setField('nationality', e.target.value)}>
                  <option value="Indian">Indian</option>
                  <option value="Foreigner">Foreigner</option>
                </select>
              </div>
            </div>
          )}

          {/* ── Section 3: Family & Contact ── all optional; hidden when filter=MANDATORY */}
          {anyO && (
            <>
              <SH label="Family & Contact" />

              {/* Issue-225: Single parent assignment — searchable combobox + relation select */}
              <div className="grid grid-cols-2 gap-3">
                {/* ── Parent combobox ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Assign Parent <span className="text-xs font-normal text-slate-400">(optional)</span>
                  </label>
                  {parents.length === 0 ? (
                    <p className="text-sm italic text-slate-400 py-2 px-1">
                      No parents registered yet.{' '}
                      <a href="/admin/parents" className="underline text-blue-500 not-italic">Add a parent</a> first.
                    </p>
                  ) : (() => {
                    const sel = parents.find((p) => p.id === form.parentId) ?? null;
                    const filtered = parentSearch.trim()
                      ? parents.filter((p) =>
                          `${p.firstName} ${p.lastName ?? ''}`.toLowerCase().includes(parentSearch.toLowerCase()))
                      : parents;
                    return (
                      <div className="relative">
                        <input
                          type="text"
                          className={inputCls()}
                          value={sel ? `${sel.firstName}${sel.lastName ? ` ${sel.lastName}` : ''}` : parentSearch}
                          readOnly={!!sel}
                          onChange={(e) => { setParentSearch(e.target.value); setParentDropOpen(true); }}
                          onFocus={() => { if (!sel) setParentDropOpen(true); }}
                          onBlur={() => setTimeout(() => setParentDropOpen(false), 150)}
                          placeholder="Search by name…"
                        />
                        {sel && (
                          <button
                            type="button"
                            onClick={() => { setField('parentId', ''); setField('parentRelation', ''); setParentSearch(''); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors text-xs font-bold"
                            title="Remove parent assignment"
                          >✕</button>
                        )}
                        {parentDropOpen && !sel && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filtered.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-slate-400 italic">No parents match your search.</p>
                            ) : (
                              filtered.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onMouseDown={() => {
                                    setField('parentId', p.id);
                                    setField('parentRelation', p.relation);
                                    setParentSearch('');
                                    setParentDropOpen(false);
                                  }}
                                  className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-blue-50 text-left transition-colors"
                                >
                                  <div>
                                    <span className="text-sm font-medium text-slate-800">
                                      {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}
                                    </span>
                                    <span className="ml-2 text-xs text-slate-400">
                                      {RELATION_LABELS[p.relation] ?? p.relation}
                                    </span>
                                    {p.phone && <span className="ml-1 text-xs text-slate-400">• {p.phone}</span>}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                {/* ── Relation dropdown ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Relation</label>
                  <select
                    className={inputCls()}
                    value={form.parentRelation}
                    onChange={(e) => setField('parentRelation', e.target.value)}
                    disabled={!form.parentId}
                  >
                    <option value="">— Select —</option>
                    {Object.entries(RELATION_LABELS).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Emergency Contact</label>
                <input type="text" className={inputCls()}
                  value={form.emergencyContact} onChange={(e) => setField('emergencyContact', e.target.value)}
                  placeholder="Name | Relation | Phone" maxLength={500} />
              </div>
            </>
          )}

          {/* ── Section 4: Residential Address ── all optional */}
          {anyO && (
            <>
              <SH label="Residential Address" />
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Address Line</label>
                <input type="text" className={inputCls()}
                  value={form.addressLine} onChange={(e) => setField('addressLine', e.target.value)}
                  placeholder="42, MG Road" maxLength={500} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">City</label>
                  <input type="text" className={inputCls()}
                    value={form.city} onChange={(e) => setField('city', e.target.value)}
                    placeholder="Bengaluru" maxLength={100} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">State</label>
                  <input type="text" className={inputCls()}
                    value={form.state} onChange={(e) => setField('state', e.target.value)}
                    placeholder="Karnataka" maxLength={100} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Pincode</label>
                  <input type="text" className={inputCls()}
                    value={form.pincode} onChange={(e) => setField('pincode', e.target.value)}
                    placeholder="560001" maxLength={10} />
                </div>
              </div>
            </>
          )}

          {/* ── Section 5: Government & Compliance ── all optional */}
          {anyO && (
            <>
              <SH label="Government & Compliance" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Aadhaar (last 4 digits)</label>
                  <input type="text" className={inputCls()}
                    value={form.aadhaarMasked} onChange={(e) => setField('aadhaarMasked', e.target.value)}
                    placeholder="XXXX" maxLength={10} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">APAAR / ABC ID</label>
                  <input type="text" className={inputCls()}
                    value={form.apaarId} onChange={(e) => setField('apaarId', e.target.value)}
                    placeholder="NEP 2020 Academic Bank of Credits ID" maxLength={30} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Religion</label>
                  <select className={inputCls()} value={form.religion} onChange={(e) => setField('religion', e.target.value)}>
                    <option value="HINDUISM">Hinduism</option>
                    <option value="ISLAM">Islam</option>
                    <option value="CHRISTIANITY">Christianity</option>
                    <option value="SIKHISM">Sikhism</option>
                    <option value="BUDDHISM">Buddhism</option>
                    <option value="JAINISM">Jainism</option>
                    <option value="OTHER">Other</option>
                    <option value="NOT_STATED">Not Stated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
                  <select className={inputCls()} value={form.category} onChange={(e) => setField('category', e.target.value)}>
                    <option value="GENERAL">General</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="EWS">EWS</option>
                    <option value="PWD">PWD</option>
                    <option value="CWSN">CWSN</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Caste / Sub-caste</label>
                <input type="text" className={inputCls()}
                  value={form.caste} onChange={(e) => setField('caste', e.target.value)}
                  placeholder="Optional" maxLength={100} />
              </div>
              <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                {([
                  ['isRteAdmission', 'RTE Admitted'],
                  ['isBpl', 'BPL (Below Poverty Line)'],
                  ['isMinority', 'Minority Community'],
                ] as [keyof StudentForm, string][]).map(([f, lbl]) => (
                  <label key={f as string} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4 rounded text-blue-600"
                      checked={form[f] as boolean} onChange={(e) => setField(f, e.target.checked)} />
                    <span className="text-sm text-slate-700">{lbl}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* ── Section 6: Special Needs & Health ── all optional */}
          {anyO && (
            <>
              <SH label="Special Needs & Health" />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 rounded text-blue-600"
                  checked={form.isCwsn} onChange={(e) => setField('isCwsn', e.target.checked)} />
                <span className="text-sm text-slate-700">CWSN (Children With Special Needs)</span>
              </label>
              {/* Task-224: Disability Type — conditionally shown only when CWSN is ticked */}
              {form.isCwsn && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Disability Type</label>
                  <input type="text" className={inputCls()}
                    value={form.disabilityType} onChange={(e) => setField('disabilityType', e.target.value)}
                    placeholder="e.g. Visual Impairment, Hearing Impairment" maxLength={200} />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Allergies</label>
                <input type="text" className={inputCls()}
                  value={form.allergies} onChange={(e) => setField('allergies', e.target.value)}
                  placeholder="e.g. Peanuts, Dust" maxLength={500} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Medical Conditions</label>
                <input type="text" className={inputCls()}
                  value={form.medicalConditions} onChange={(e) => setField('medicalConditions', e.target.value)}
                  placeholder="e.g. Asthma, Diabetes" maxLength={500} />
              </div>
            </>
          )}

          {/* ── Section 7: Previous Academic History ── all optional */}
          {anyO && (
            <>
              <SH label="Previous Academic History" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Previous School</label>
                  <input type="text" className={inputCls()}
                    value={form.previousSchool} onChange={(e) => setField('previousSchool', e.target.value)}
                    placeholder="School name" maxLength={200} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">TC Number</label>
                  <input type="text" className={inputCls()}
                    value={form.tcNumber} onChange={(e) => setField('tcNumber', e.target.value)}
                    placeholder="Transfer Certificate No." maxLength={50} />
                </div>
              </div>
            </>
          )}

          {/* ── Section 8: Lifecycle & Status ── Status is Required; Leaving fields Optional */}
          {(anyR || (isEdit && anyO)) && (
            <>
              <SH label="Lifecycle & Status" />
              {anyR && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select className={inputCls(undefined, true)} value={form.status} onChange={(e) => setField('status', e.target.value)}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="TRANSFERRED">Transferred</option>
                    <option value="GRADUATED">Graduated</option>
                    <option value="DROPPED_OUT">Dropped Out</option>
                  </select>
                </div>
              )}
              {isEdit && anyO && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of Leaving</label>
                    <DateInput
                      value={form.dateOfLeaving}
                      onValueChange={(v) => setField('dateOfLeaving', v)}
                      className={inputCls()}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Leaving Reason</label>
                    <input type="text" className={inputCls()}
                      value={form.leavingReason} onChange={(e) => setField('leavingReason', e.target.value)}
                      placeholder="Transfer / Graduated / Dropout" maxLength={200} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Module-managed fields info — shown in Optional/All views */}
          {anyO && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 divide-y divide-slate-100">
              {[
                { label: 'Bus Route', note: 'Managed in Logistics Module' },
                { label: 'Fee Status', note: 'N/A on Creation — managed in Finance Module' },
                { label: 'Attendance %', note: 'Auto-calculated from Attendance sessions' },
              ].map(({ label, note }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-500">{label}</span>
                  <span className="text-xs text-slate-400 italic">{note}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1" />

          {/* Sticky footer */}
          <div className="sticky bottom-0 flex gap-3 pt-4 border-t border-slate-100 bg-white -mx-6 px-6 pb-2">
            <button type="button" onClick={onClose} disabled={saving || deepFetching}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || deepFetching}
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
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
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
  // Issue-250: Filter dropdowns — Academic Year / Class / Section
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterSection, setFilterSection] = useState<string>('');
  const [years, setYears] = useState<AcademicYearOption[]>([]);
  // Issue-250: Pagination state
  const [page, setPage] = useState(1);
  // Issue-217: search and sort state
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Issue-238b: Extracted to a named function so POST/PATCH/DELETE handlers call this
  // for an accurate server re-fetch instead of incomplete optimistic state patches.
  async function loadStudents(silent = false) {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const [studs, pars] = await Promise.all([
        bffFetch<Student[]>('/api/academic/students'),
        bffFetch<Parent[]>('/api/academic/parents'),
      ]);
      setStudents(Array.isArray(studs) ? studs : []);
      setParents(Array.isArray(pars) ? pars : []);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadStudents(); }, []);

  // Issue-250: Fetch academic years on mount; auto-select the current active year.
  useEffect(() => {
    bffFetch<AcademicYearOption[]>('/api/academic/years')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setYears(list);
        const active = list.find((y) => y.isActive);
        if (active) setFilterYear(active.id);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Issue-250: Reset to page 1 whenever filters or search change.
  useEffect(() => { setPage(1); }, [search, filterYear, filterClass, filterSection]);

  function openAdd() { setEditing(null); setPanelOpen(true); }
  function openEdit(s: Student) { setEditing(s); setPanelOpen(true); }
  function handleClose() { setPanelOpen(false); setSaveError(''); setTimeout(() => setEditing(null), 300); }

  async function handleSave(form: StudentForm) {
    setSaving(true);
    setSaveError('');
    try {
      // Issue-219: Build the enrollment sub-object once (used by both create and edit paths).
      // Issue-231: Section + rollNumber are optional — enrollment created with just academicYear + class
      const enrollmentPayload =
        form.academicYearId && form.classId
          ? {
              academicYearId: form.academicYearId,
              classId: form.classId,
              ...(form.sectionId && { sectionId: form.sectionId }),
              ...(form.rollNumber.trim() && { rollNumber: form.rollNumber.trim() }),
            }
          : undefined;

      if (editing) {
        // Issue-219/222: Single PATCH — all fields + enrollment bundled in ONE request.
        // Issue-231 Gap 1: PATCH sends null for cleared optional fields so DB values are wiped.
        await bffFetch<unknown>(`/api/academic/students/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            middleName: form.middleName.trim() || null,
            lastName: form.lastName.trim() || null,
            preferredName: form.preferredName.trim() || null,
            ...(form.dateOfJoining && { dateOfJoining: new Date(form.dateOfJoining).toISOString() }),
            gender: form.gender,
            preferredGender: form.preferredGender.trim() || null,
            bloodGroup: form.bloodGroup,
            status: form.status,
            motherTongue: form.motherTongue.trim(),
            nationality: form.nationality.trim(),
            // Govt & Compliance
            category: form.category,
            religion: form.religion,
            caste: form.caste.trim() || null,
            aadhaarMasked: form.aadhaarMasked.trim() || null,
            apaarId: form.apaarId.trim() || null,
            isRteAdmission: form.isRteAdmission,
            isCwsn: form.isCwsn,
            disabilityType: form.disabilityType.trim() || null,
            isBpl: form.isBpl,
            isMinority: form.isMinority,
            // Health & Emergency
            allergies: form.allergies.trim() || null,
            medicalConditions: form.medicalConditions.trim() || null,
            emergencyContact: form.emergencyContact.trim() || null,
            // Admission & Address
            previousSchool: form.previousSchool.trim() || null,
            tcNumber: form.tcNumber.trim() || null,
            addressLine: form.addressLine.trim() || null,
            city: form.city.trim() || null,
            state: form.state.trim() || null,
            pincode: form.pincode.trim() || null,
            photoUrl: form.photoUrl.trim() || null,
            // Lifecycle
            ...(form.dateOfLeaving && { dateOfLeaving: new Date(form.dateOfLeaving).toISOString() }),
            leavingReason: form.leavingReason.trim() || null,
            // Relations — always send parentId on edit (null clears mapping, UUID replaces)
            parentId: form.parentId || null,
            ...(form.parentId && { parentRelation: form.parentRelation || 'GUARDIAN' }),
            ...(enrollmentPayload && { enrollment: enrollmentPayload }),
          }),
        });
        setStudents((prev) =>
          prev.map((s) => {
            if (s.id !== editing.id) return s;
            // Optimistically update the in-memory enrollment so the table reflects the change.
            // Issue-220: Find the enrollment being updated by matching academicYearId
            // (not [0]) so we update the right record and preserve names of other enrollments.
            const existingEnrollment = enrollmentPayload
              ? (s.enrollments ?? []).find((e) => e.academicYear?.id === enrollmentPayload.academicYearId) ?? null
              : null;
            const updatedEnrollments: StudentEnrollment[] =
              enrollmentPayload
                ? [
                    {
                      id: existingEnrollment?.id ?? '',
                      ...(enrollmentPayload.rollNumber !== undefined && { rollNumber: enrollmentPayload.rollNumber }),
                      class: { id: enrollmentPayload.classId, name: existingEnrollment?.class?.name ?? enrollmentPayload.classId, code: existingEnrollment?.class?.code ?? '' },
                      ...(enrollmentPayload.sectionId !== undefined && { section: { id: enrollmentPayload.sectionId, name: existingEnrollment?.section?.name ?? enrollmentPayload.sectionId } }),
                      academicYear: { id: enrollmentPayload.academicYearId, name: existingEnrollment?.academicYear?.name ?? '', isActive: existingEnrollment?.academicYear?.isActive ?? false },
                    },
                  ]
                : s.enrollments;
            return {
              ...s,
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              gender: form.gender,
              status: form.status,
              enrollments: updatedEnrollments,
            };
          }),
        );
        setSuccessMsg(`Student "${form.firstName} ${form.lastName}" updated.`);
      } else {
        // Issue-219/222: Single POST — all fields + enrollment bundled in ONE atomic request.
        await bffFetch<unknown>('/api/academic/students', {
          method: 'POST',
          body: JSON.stringify({
            admissionNumber: form.admissionNumber.trim(),
            ...(form.dateOfJoining && { dateOfJoining: new Date(form.dateOfJoining).toISOString() }),
            firstName: form.firstName.trim(),
            ...(form.middleName.trim() && { middleName: form.middleName.trim() }),
            ...(form.lastName.trim() && { lastName: form.lastName.trim() }),
            ...(form.preferredName.trim() && { preferredName: form.preferredName.trim() }),
            dateOfBirth: new Date(form.dateOfBirth).toISOString(),
            gender: form.gender,
            ...(form.preferredGender.trim() && { preferredGender: form.preferredGender.trim() }),
            bloodGroup: form.bloodGroup,
            motherTongue: form.motherTongue.trim(),
            nationality: form.nationality.trim(),
            status: form.status,
            category: form.category,
            religion: form.religion,
            ...(form.caste.trim() && { caste: form.caste.trim() }),
            ...(form.aadhaarMasked.trim() && { aadhaarMasked: form.aadhaarMasked.trim() }),
            ...(form.apaarId.trim() && { apaarId: form.apaarId.trim() }),
            isRteAdmission: form.isRteAdmission,
            isCwsn: form.isCwsn,
            ...(form.disabilityType.trim() && { disabilityType: form.disabilityType.trim() }),
            isBpl: form.isBpl,
            isMinority: form.isMinority,
            ...(form.allergies.trim() && { allergies: form.allergies.trim() }),
            ...(form.medicalConditions.trim() && { medicalConditions: form.medicalConditions.trim() }),
            ...(form.emergencyContact.trim() && { emergencyContact: form.emergencyContact.trim() }),
            ...(form.previousSchool.trim() && { previousSchool: form.previousSchool.trim() }),
            ...(form.tcNumber.trim() && { tcNumber: form.tcNumber.trim() }),
            ...(form.addressLine.trim() && { addressLine: form.addressLine.trim() }),
            ...(form.city.trim() && { city: form.city.trim() }),
            ...(form.state.trim() && { state: form.state.trim() }),
            ...(form.pincode.trim() && { pincode: form.pincode.trim() }),
            ...(form.photoUrl.trim() && { photoUrl: form.photoUrl.trim() }),
            ...(form.parentId && { parentId: form.parentId, parentRelation: form.parentRelation || 'GUARDIAN' }),
            ...(enrollmentPayload && { enrollment: enrollmentPayload }),
          }),
        });
        void loadStudents(true); // Issue-238b: server re-fetch for accurate table data
        setSuccessMsg(`Student "${form.firstName.trim()}${form.lastName.trim() ? ' ' + form.lastName.trim() : ''}" registered.`);
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

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }

  // ── Issue-250: Derived filter options from loaded enrollment data ────────────
  const classOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    students.forEach((s) => {
      const e0 = s.enrollments?.[0];
      if (!e0) return;
      if (filterYear && e0.academicYear.id !== filterYear) return;
      if (!map.has(e0.class.id)) map.set(e0.class.id, e0.class);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, filterYear]);

  const sectionOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    students.forEach((s) => {
      const e0 = s.enrollments?.[0];
      if (!e0?.section) return;
      if (filterYear && e0.academicYear.id !== filterYear) return;
      if (filterClass && e0.class.id !== filterClass) return;
      if (!map.has(e0.section.id)) map.set(e0.section.id, e0.section);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, filterYear, filterClass]);

  // ── Derived: filtered + sorted ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students
      .filter((s) => {
        const e0 = s.enrollments?.[0];
        if (filterYear && e0?.academicYear?.id !== filterYear) return false;
        if (filterClass && e0?.class?.id !== filterClass) return false;
        if (filterSection && e0?.section?.id !== filterSection) return false;
        if (!q) return true;
        return (
          s.firstName.toLowerCase().includes(q) ||
          (s.lastName ?? '').toLowerCase().includes(q) ||
          (e0?.rollNumber ?? '').toLowerCase().includes(q) ||
          (e0?.class?.name ?? '').toLowerCase().includes(q) ||
          (e0?.section?.name ?? '').toLowerCase().includes(q) ||
          (e0?.academicYear?.name ?? '').toLowerCase().includes(q) ||
          (s.parentMappings ?? []).some((pm) =>
            `${pm.parent.firstName} ${pm.parent.lastName ?? ''}`.toLowerCase().includes(q),
          )
        );
      })
      .sort((a, b) => {
        const ae = a.enrollments?.[0];
        const be = b.enrollments?.[0];
        let av = '', bv = '';
        switch (sortField) {
          case 'rollNumber': av = ae?.rollNumber ?? ''; bv = be?.rollNumber ?? ''; break;
          case 'name': av = `${a.lastName} ${a.firstName}`; bv = `${b.lastName} ${b.firstName}`; break;
          case 'academicYear': av = ae?.academicYear?.name ?? ''; bv = be?.academicYear?.name ?? ''; break;
          case 'class': av = ae?.class?.name ?? ''; bv = be?.class?.name ?? ''; break;
          case 'section': av = ae?.section?.name ?? ''; bv = be?.section?.name ?? ''; break;
          case 'gender': av = a.gender; bv = b.gender; break;
          case 'status': av = a.status; bv = b.status; break;
        }
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [students, search, filterYear, filterClass, filterSection, sortField, sortDir]);

  // Issue-250: Pagination
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  return (
    <div className="w-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
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

      {/* ── Alerts ─────────────────────────────────────────────────────────── */}
      {loadError && (<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3"><p className="text-sm text-red-700">{loadError}</p></div>)}
      {saveError && (<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3"><p className="text-sm text-red-700">{saveError}</p></div>)}
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
          {/* ── Issue-250: Filter + Search toolbar ─────────────────────────── */}
          <div className="mb-4 flex flex-wrap gap-2 items-end">
            {/* Academic Year */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Academic Year</label>
              <select
                value={filterYear}
                onChange={(e) => { setFilterYear(e.target.value); setFilterClass(''); setFilterSection(''); }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors min-w-[140px]"
              >
                <option value="">All Years</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' ★' : ''}</option>
                ))}
              </select>
            </div>
            {/* Class */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</label>
              <select
                value={filterClass}
                onChange={(e) => { setFilterClass(e.target.value); setFilterSection(''); }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors min-w-[120px]"
              >
                <option value="">All Classes</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {/* Section */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Section</label>
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors min-w-[110px]"
              >
                <option value="">All Sections</option>
                {sectionOptions.map((sec) => (
                  <option key={sec.id} value={sec.id}>{sec.name}</option>
                ))}
              </select>
            </div>
            {/* Search */}
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Search</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, roll no., class…"
                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
                {search && (
                  <button type="button" onClick={() => setSearch('')} aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {/* Count */}
            <span className="text-xs text-slate-400 flex-shrink-0 pb-2">
              {filtered.length} of {students.length} student{students.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="hidden sm:block">
            <PremiumCard accentColor="blue" className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap min-w-[900px]">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5 text-left"><SortBtn field="rollNumber" active={sortField === 'rollNumber'} dir={sortDir} onClick={toggleSort}>Roll No.</SortBtn></th>
                      <th className="px-4 py-3.5 text-left"><SortBtn field="name" active={sortField === 'name'} dir={sortDir} onClick={toggleSort}>Name</SortBtn></th>
                      <th className="px-4 py-3.5 text-left"><SortBtn field="academicYear" active={sortField === 'academicYear'} dir={sortDir} onClick={toggleSort}>Acad. Year</SortBtn></th>
                      <th className="px-4 py-3.5 text-left"><SortBtn field="class" active={sortField === 'class'} dir={sortDir} onClick={toggleSort}>Class</SortBtn></th>
                      <th className="px-4 py-3.5 text-left"><SortBtn field="section" active={sortField === 'section'} dir={sortDir} onClick={toggleSort}>Section</SortBtn></th>
                      <th className="px-4 py-3.5 text-left"><SortBtn field="gender" active={sortField === 'gender'} dir={sortDir} onClick={toggleSort}>Gender</SortBtn></th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Parent</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Bus Route <span className="ml-1 text-[9px] font-normal text-slate-300">(coming soon)</span>
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Fee Status <span className="ml-1 text-[9px] font-normal text-slate-300">(coming soon)</span>
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Attendance <span className="ml-1 text-[9px] font-normal text-slate-300">(coming soon)</span>
                      </th>
                      <th className="px-4 py-3.5 text-left"><SortBtn field="status" active={sortField === 'status'} dir={sortDir} onClick={toggleSort}>Status</SortBtn></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.map(s => {
                      const e0 = s.enrollments?.[0];
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3.5 text-slate-600">{e0?.rollNumber ?? <span className="text-slate-300">{DASH}</span>}</td>
                          <td className="px-4 py-3.5">
                            {/* Issue-250: Name is the edit trigger — click to open slide-over */}
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              className="font-semibold text-blue-700 hover:text-blue-900 hover:underline text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
                              title="Click to edit student"
                            >
                              {s.firstName}{s.lastName ? ` ${s.lastName}` : ''}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">{e0?.academicYear?.name ?? <span className="text-slate-300">{DASH}</span>}</td>
                          <td className="px-4 py-3.5 text-slate-600">{e0?.class?.name ?? <span className="text-slate-300">{DASH}</span>}</td>
                          <td className="px-4 py-3.5 text-slate-600">{e0?.section?.name ?? <span className="text-slate-300">{DASH}</span>}</td>
                          <td className="px-4 py-3.5">{genderBadge(s.gender)}</td>
                          <td className="px-4 py-3.5">
                            {(s.parentMappings ?? []).length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[160px]">
                                {s.parentMappings.map(pm => (
                                  <span key={pm.parent.id}
                                    className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                    {pm.parent.firstName}{pm.parent.lastName ? ` ${pm.parent.lastName}` : ''}
                                  </span>
                                ))}
                              </div>
                            ) : <span className="text-slate-300">{DASH}</span>}
                          </td>
                          <td className="px-4 py-3.5"><span className="text-slate-300 text-xs">{DASH}</span></td>
                          <td className="px-4 py-3.5"><PlaceholderBar label="N/A" /></td>
                          <td className="px-4 py-3.5"><PlaceholderBar label="N/A" /></td>
                          <td className="px-4 py-3.5"><StatusPill status={s.status} /></td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-5 py-16 text-center text-sm text-slate-400">
                          {search || filterYear || filterClass || filterSection
                            ? 'No students match the current filters. Try adjusting your selection.'
                            : 'No students yet. Click "Add Student" to register one.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Issue-250: Pagination footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white rounded-b-xl">
                <span className="text-xs text-slate-500">
                  {filtered.length === 0
                    ? 'No results'
                    : `Showing ${((page - 1) * PAGE_SIZE + 1).toLocaleString()}–${Math.min(page * PAGE_SIZE, filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()}`}
                </span>
                <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
              </div>
            </PremiumCard>
          </div>

          {/* ── Mobile card stack ───────────────────────────────────────────── */}
          <div className="sm:hidden space-y-3">
            {paginated.map(s => {
              const e0 = s.enrollments?.[0];
              return (
                <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      {/* Issue-250: Name is the edit trigger on mobile too */}
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="font-bold text-blue-700 hover:text-blue-900 hover:underline text-left"
                      >
                        {s.firstName}{s.lastName ? ` ${s.lastName}` : ''}
                      </button>
                    </div>
                    <StatusPill status={s.status} />
                  </div>
                  {e0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      <span className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{e0.academicYear.name}</span>
                      <span className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{e0.class.name}</span>
                      {e0.section && <span className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{e0.section.name}</span>}
                      {e0.rollNumber && <span className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">Roll: {e0.rollNumber}</span>}
                    </div>
                  )}
                  {(s.parentMappings ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.parentMappings.map(pm => (
                        <span key={pm.parent.id}
                          className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {pm.parent.firstName}{pm.parent.lastName ? ` ${pm.parent.lastName}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">
                {search || filterYear || filterClass || filterSection ? 'No matches found.' : 'No students yet.'}
              </div>
            )}
            {/* Mobile pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">{filtered.length} students</span>
                <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
              </div>
            )}
          </div>
        </>
      )}

      <StudentPanel
        open={panelOpen} editing={editing} parents={parents}
        onClose={handleClose} onSave={handleSave} saving={saving}
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
