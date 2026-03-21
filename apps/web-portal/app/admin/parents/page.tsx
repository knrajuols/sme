// Issue-217: Enterprise-grade Parents Table — Phase 1 UI Architecture
// Implements: Wards chips, Address modal, Manage Wards modal, search, sort,
// sticky headers, horizontal scroll, tel/mailto links, mobile cards.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PaginationBar } from '../../../components/ui/PaginationBar';
import { PremiumCard } from '../../../components/ui/PremiumCard';

// ── Types ─────────────────────────────────────────────────────────────────────
interface StudentEnrollmentRef {
  academicYear: { id: string; name: string; isActive: boolean };
  class: { id: string; name: string; code: string };
  section?: { id: string; name: string };
}
interface StudentWard {
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
}
interface StudentOption {
  id: string; firstName: string; lastName: string; admissionNumber: string;
  enrollments?: StudentEnrollmentRef[];
}
interface WardMapping {
  id: string; studentId: string;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
}
interface Parent {
  id: string;
  firstName: string;
  lastName?: string;
  relation: string;
  gender: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  motherTongue?: string;
  knownLanguages?: string;
  profession?: string;
  annualIncomeSlab?: string;
  education?: string;
  aadhaarMasked?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  pincode?: string;
  studentMappings: StudentWard[];
}

type SortField = 'name' | 'relation' | 'gender';
type SortDir = 'asc' | 'desc';
const DASH = '—';

// ── UI helpers ────────────────────────────────────────────────────────────────
const RELATION_MAP: Record<string, [string, string]> = {
  FATHER: ['Father', 'bg-blue-50 text-blue-700'],
  MOTHER: ['Mother', 'bg-pink-50 text-pink-700'],
  GUARDIAN: ['Guardian', 'bg-amber-50 text-amber-700'],
  GRANDPARENT: ['Grandparent', 'bg-purple-50 text-purple-700'],
  SIBLING: ['Sibling', 'bg-emerald-50 text-emerald-700'],
  OTHER: ['Other', 'bg-slate-100 text-slate-600'],
};

function relationBadge(rel: string) {
  const [label, cls] = RELATION_MAP[rel] ?? [rel, 'bg-slate-100 text-slate-600'];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
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

// Address cell — truncated text with click-to-expand modal
function AddressCell({ parent }: { parent: Parent }) {
  const [open, setOpen] = useState(false);
  const parts = [parent.addressLine, parent.city, parent.state, parent.pincode].filter(Boolean);
  if (parts.length === 0) return <span className="text-slate-300">{DASH}</span>;
  const full = parts.join(', ');
  const trunc = full.length > 30 ? full.slice(0, 30) + '…' : full;
  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)} title="Click to view full address"
        className="text-left text-xs text-slate-500 hover:text-blue-600 hover:underline transition-colors max-w-[180px] truncate block"
      >
        {trunc}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 mb-2">Full Address</h3>
            <p className="text-sm font-semibold text-slate-800">{parent.firstName} {parent.lastName}</p>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{full}</p>
            <button type="button" onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-lg bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Manage Wards modal — link / unlink students to this parent
function ManageWardsModal({ parent, allStudents, onClose, onChange }: {
  parent: Parent; allStudents: StudentOption[];
  onClose: () => void; onChange: (updated: Parent) => void;
}) {
  const [mappings, setMappings] = useState<WardMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    bffFetch<WardMapping[]>(`/api/academic/parents/mappings?parentId=${parent.id}`)
      .then(data => setMappings(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load wards'))
      .finally(() => setLoadingMappings(false));
  }, [parent.id]);

  const linkedStudentIds = mappings.map(m => m.student?.id ?? m.studentId);
  const available = allStudents.filter(s => !linkedStudentIds.includes(s.id));

  async function addWard() {
    if (!selectedStudentId) return;
    setSaving(true); setError('');
    try {
      const result = await bffFetch<WardMapping>('/api/academic/parents/mappings', {
        method: 'POST',
        body: JSON.stringify({ parentId: parent.id, studentId: selectedStudentId }),
      });
      setMappings(prev => [...prev, result]);
      setSelectedStudentId('');
      const student = allStudents.find(s => s.id === selectedStudentId);
      if (student) {
        onChange({
          ...parent,
          studentMappings: [...parent.studentMappings, { student }],
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add ward');
    } finally { setSaving(false); }
  }

  async function removeWard(mappingId: string, studentId: string) {
    setSaving(true); setError('');
    try {
      await bffFetch<unknown>(`/api/academic/parents/mappings/${mappingId}`, { method: 'DELETE' });
      setMappings(prev => prev.filter(m => m.id !== mappingId));
      onChange({ ...parent, studentMappings: parent.studentMappings.filter(sm => sm.student.id !== studentId) });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove ward');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Manage Wards</h3>
            <p className="text-xs text-slate-500 mt-0.5">{parent.firstName} {parent.lastName}</p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <p className="mb-3 text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{error}</p>}
          {loadingMappings ? (
            <p className="text-sm text-slate-400 text-center py-6">Loading wards…</p>
          ) : (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Linked Students</p>
              {mappings.length === 0 ? (
                <p className="text-sm text-slate-400 py-3">No students linked yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-4">
                  {mappings.map(m => (
                    <span key={m.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                      {m.student.firstName} {m.student.lastName}
                      <span className="text-xs text-indigo-400 font-normal">({m.student.admissionNumber})</span>
                      <button type="button" onClick={() => removeWard(m.id, m.student.id)} disabled={saving}
                        className="ml-0.5 rounded-full p-0.5 text-indigo-400 hover:text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50"
                        aria-label="Remove ward">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {available.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Link a Student</p>
                  <div className="flex gap-2">
                    <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select student…</option>
                      {available.map(s => (
                        <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
                      ))}
                    </select>
                    <button type="button" onClick={addWard} disabled={!selectedStudentId || saving}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {saving ? '…' : 'Link'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface ParentForm {
  firstName: string;
  lastName: string;
  relation: string;
  gender: string;
  phone: string;
  alternatePhone: string;
  email: string;
  motherTongue: string;
  knownLanguages: string;
  profession: string;
  annualIncomeSlab: string;
  education: string;
  aadhaarMasked: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  // Issue-222: Bidirectional linking — assign wards from parent form
  studentIds: string[];
}

type FormErrors = Partial<Record<keyof Omit<ParentForm, 'studentIds'>, string>>;

const EMPTY_FORM: ParentForm = {
  firstName: '',
  lastName: '',
  relation: 'GUARDIAN',
  gender: 'PREFER_NOT_TO_SAY',
  phone: '',
  alternatePhone: '',
  email: '',
  motherTongue: '',
  knownLanguages: '',
  profession: '',
  annualIncomeSlab: '',
  education: '',
  aadhaarMasked: '',
  addressLine: '',
  city: '',
  state: '',
  pincode: '',
  studentIds: [],
};

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm(form: ParentForm): FormErrors {
  const e: FormErrors = {};
  if (!form.firstName.trim()) e.firstName = 'First name is required.';
  // Issue-226: phone and motherTongue are required per spec
  if (!form.phone.trim()) e.phone = 'Phone number is required.';
  if (!form.motherTongue.trim()) e.motherTongue = 'Mother tongue is required.';
  // Issue-222: lastName is intentionally NOT validated as required (culturally optional)
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    e.email = 'Enter a valid email address.';
  }
  return e;
}

// ── Slide-over panel ──────────────────────────────────────────────────────────
function ParentPanel({
  open,
  editing,
  allStudents,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  editing: Parent | null;
  allStudents: StudentOption[];
  onClose: () => void;
  onSave: (form: ParentForm) => void;
  saving: boolean;
}) {
  const isEdit = editing !== null;
  const [form, setForm] = useState<ParentForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  // Task-226-2B: field visibility filter — ALL | MANDATORY | OPTIONAL
  const [fieldFilter, setFieldFilter] = useState<'ALL' | 'MANDATORY' | 'OPTIONAL'>('ALL');
  // Issue-227: searchable student multi-select combobox
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const wardPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setFieldFilter('ALL'); // Reset filter to All on every open
      setStudentSearch(''); // Reset ward search on every open
      setStudentDropdownOpen(false);
      setForm(
        editing
          ? {
              firstName: editing.firstName,
              lastName: editing.lastName ?? '',
              relation: editing.relation,
              gender: editing.gender,
              phone: editing.phone ?? '',
              alternatePhone: editing.alternatePhone ?? '',
              email: editing.email ?? '',
              motherTongue: editing.motherTongue ?? '',
              knownLanguages: editing.knownLanguages ?? '',
              profession: editing.profession ?? '',
              annualIncomeSlab: editing.annualIncomeSlab ?? '',
              education: editing.education ?? '',
              aadhaarMasked: editing.aadhaarMasked ?? '',
              addressLine: editing.addressLine ?? '',
              city: editing.city ?? '',
              state: editing.state ?? '',
              pincode: editing.pincode ?? '',
              // Pre-populate with current ward mappings on edit
              studentIds: (editing.studentMappings ?? []).map((sm) => sm.student.id),
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

  function toggleStudent(id: string) {
    setForm((prev) => ({
      ...prev,
      studentIds: prev.studentIds.includes(id)
        ? prev.studentIds.filter((s) => s !== id)
        : [...prev.studentIds, id],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
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

  // Task-226-2B: anyR/anyO drive per-field and per-section visibility
  const anyR = fieldFilter !== 'OPTIONAL';  // Required fields are visible
  const anyO = fieldFilter !== 'MANDATORY'; // Optional fields are visible

  // Inline section header component — conditionally rendered by their parent block
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

        {/* Task-226-2B: Field Filter — sticky segmented control just below panel header */}
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          {/* ── Section 1: Personal Identity ── R: firstName, gender | O: lastName */}
          {/* Issue-227: Relation moved to Linked Wards section; userId removed (auto-generated) */}
          <SH label="Personal Identity" />

          {anyR && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input type="text" className={inputCls(errors.firstName, true)}
                value={form.firstName} onChange={(e) => setField('firstName', e.target.value)}
                placeholder="Ramesh" maxLength={100} autoFocus />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
            </div>
          )}

          {anyO && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Last Name <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </label>
              <input type="text" className={inputCls(errors.lastName)}
                value={form.lastName} onChange={(e) => setField('lastName', e.target.value)}
                placeholder="Sharma" maxLength={100} />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
            </div>
          )}

          {anyR && (
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
          )}

          {/* ── Section 2: Linked Wards / Students ── students: Optional | relation: Required */}
          {/* Issue-227: Section moved up from bottom; Relation dropdown placed after ward picker */}
          {/* Issue-229: Guard stripped of allStudents.length > 0 — heading must always show */}
          {(anyR || anyO) && (
            <SH label="Linked Wards / Students" />
          )}

          {/* Issue-229: Ward picker must always render — even when student list is empty */}
          {anyO && (
            // Issue-227: Combobox — click/focus opens dropdown, typing filters, chip strip shows selections.
            // wardPickerRef used for outside-click detection to close the dropdown.
            <div ref={wardPickerRef}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Link Wards / Students
                <span className="ml-1 text-xs text-slate-400 font-normal">(optional — select one or more)</span>
              </label>

              {/* Removable chips for already-selected students */}
              {form.studentIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.studentIds.map((id) => {
                    const s = allStudents.find((st) => st.id === id);
                    if (!s) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {s.firstName} {s.lastName ?? ''}
                        <button type="button" onClick={() => toggleStudent(id)}
                          className="ml-0.5 text-blue-400 hover:text-blue-700" aria-label={`Remove ${s.firstName}`}>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Combobox trigger: shows dropdown on focus *and* on click, closes on outside blur */}
              <div className="relative">
                <input
                  type="text"
                  className={`${inputCls()} pr-8`}
                  placeholder={studentDropdownOpen ? 'Type to filter…' : 'Click to select students…'}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  onFocus={() => setStudentDropdownOpen(true)}
                  onBlur={() =>
                    // Small delay so click-on-option fires before blur closes the list
                    setTimeout(() => {
                      if (!wardPickerRef.current?.contains(document.activeElement)) {
                        setStudentDropdownOpen(false);
                        setStudentSearch('');
                      }
                    }, 150)
                  }
                />
                {/* Chevron indicator */}
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className={`w-4 h-4 transition-transform ${studentDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>

                {/* Live-filtered dropdown list — visible when open */}
                {studentDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 max-h-48 overflow-y-auto shadow-lg">
                    {(() => {
                      const filtered = allStudents.filter((s) =>
                        `${s.firstName} ${s.lastName ?? ''} ${s.admissionNumber}`
                          .toLowerCase()
                          .includes(studentSearch.toLowerCase())
                      );
                      if (allStudents.length === 0)
                        return <p className="px-3 py-2.5 text-xs text-slate-400">No students found. Add students first.</p>;
                      if (filtered.length === 0)
                        return <p className="px-3 py-2.5 text-xs text-slate-400">No students match.</p>;
                      return filtered.map((s) => (
                        <button key={s.id} type="button"
                          onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                          onClick={() => { toggleStudent(s.id); setStudentSearch(''); }}
                          className={`w-full text-left flex items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
                            form.studentIds.includes(s.id) ? 'bg-blue-50' : ''
                          }`}>
                          <span>
                            <span className={`font-medium ${
                              form.studentIds.includes(s.id) ? 'text-blue-700' : 'text-slate-800'
                            }`}>{s.firstName} {s.lastName ?? ''}</span>
                            <span className="ml-2 text-xs text-slate-400 font-mono">{s.admissionNumber}</span>
                          </span>
                          {form.studentIds.includes(s.id) && (
                            <span className="text-xs text-blue-500 font-semibold">✓</span>
                          )}
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {form.studentIds.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">{form.studentIds.length} student{form.studentIds.length !== 1 ? 's' : ''} linked.</p>
              )}
            </div>
          )}

          {/* Relation — optional; defaults to GUARDIAN if not specified */}
          {anyO && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Relation to Ward <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </label>
              <select className={inputCls()} value={form.relation} onChange={(e) => setField('relation', e.target.value)}>
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="GUARDIAN">Guardian</option>
                <option value="GRANDPARENT">Grandparent</option>
                <option value="SIBLING">Sibling</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          )}

          {/* ── Section 3: Contact Information ── R: phone, motherTongue | O: alternatePhone, email, knownLanguages */}
          <SH label="Contact Information" />

          {anyR && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input type="tel" className={inputCls(errors.phone, true)}
                  value={form.phone} onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+91 98765 43210" maxLength={20} />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>

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
            </>
          )}

          {anyO && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Alternate Phone</label>
                <input type="tel" className={inputCls(errors.alternatePhone)}
                  value={form.alternatePhone} onChange={(e) => setField('alternatePhone', e.target.value)}
                  placeholder="+91 98765 00000" maxLength={20} />
                {errors.alternatePhone && <p className="mt-1 text-xs text-red-600">{errors.alternatePhone}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                <input type="email" className={inputCls(errors.email)}
                  value={form.email} onChange={(e) => setField('email', e.target.value)}
                  placeholder="ramesh.sharma@example.com" maxLength={200} />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Known Languages</label>
                <input type="text" className={inputCls()}
                  value={form.knownLanguages} onChange={(e) => setField('knownLanguages', e.target.value)}
                  placeholder="e.g. Hindi, English, Telugu" maxLength={200} />
              </div>
            </>
          )}

          {/* ── Section 3: Demographics & Employment ── all Optional */}
          {anyO && (
            <>
              <SH label="Demographics & Employment" />

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Profession</label>
                <input type="text" className={inputCls()}
                  value={form.profession} onChange={(e) => setField('profession', e.target.value)}
                  placeholder="e.g. Software Engineer" maxLength={100} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Education</label>
                <input type="text" className={inputCls()}
                  value={form.education} onChange={(e) => setField('education', e.target.value)}
                  placeholder="e.g. Postgraduate" maxLength={100} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Annual Income Slab</label>
                <input type="text" className={inputCls()}
                  value={form.annualIncomeSlab} onChange={(e) => setField('annualIncomeSlab', e.target.value)}
                  placeholder="e.g. 5-10 LPA" maxLength={50} />
              </div>
            </>
          )}

          {/* ── Section 4: Government & Compliance ── all Optional */}
          {anyO && (
            <>
              <SH label="Government & Compliance" />

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Aadhaar (Last 4 digits)</label>
                <input type="text" className={inputCls()}
                  value={form.aadhaarMasked} onChange={(e) => setField('aadhaarMasked', e.target.value)}
                  placeholder="e.g. 1234" maxLength={10} />
                <p className="mt-1.5 text-xs text-slate-400">Store only the last 4 digits for compliance.</p>
              </div>
            </>
          )}

          {/* ── Section 5: Address ── all Optional */}
          {anyO && (
            <>
              <SH label="Address" />

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Address Line</label>
                <input type="text" className={inputCls()}
                  value={form.addressLine} onChange={(e) => setField('addressLine', e.target.value)}
                  placeholder="42, MG Road" maxLength={200} />
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

          {/* Section 6 (Linked Wards) was moved to Section 2 — Issue-227 */}

          <div className="flex-1" />

          <div className="sticky bottom-0 flex gap-3 pt-4 border-t border-slate-100 bg-white -mx-6 px-6 pb-2">
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
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [wardsTarget, setWardsTarget] = useState<Parent | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Parent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Parent | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Issue-250: Filter dropdowns — Academic Year / Class / Section (via ward enrollments)
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterSection, setFilterSection] = useState<string>('');
  const [years, setYears] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);
  // Issue-250: Pagination
  const [page, setPage] = useState(1);

  useEffect(() => {
    Promise.all([
      bffFetch<Parent[]>('/api/academic/parents'),
      bffFetch<StudentOption[]>('/api/academic/students'),
    ])
      .then(([pars, studs]) => {
        setParents(Array.isArray(pars) ? pars : []);
        setAllStudents(Array.isArray(studs) ? studs : []);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  // Issue-250: Fetch academic years; auto-select the current active year.
  useEffect(() => {
    bffFetch<Array<{ id: string; name: string; isActive: boolean }>>('/api/academic/years')
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
  function openEdit(p: Parent) { setEditing(p); setPanelOpen(true); }
  function handleClose() { setPanelOpen(false); setSaveError(''); setTimeout(() => setEditing(null), 300); }

  async function handleSave(form: ParentForm) {
    setSaving(true);
    setSaveError('');
    try {
      if (editing) {
        // Issue-231 Gap 1: PATCH sends null for cleared optional fields so DB values are wiped.
        await bffFetch<unknown>(`/api/academic/parents/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim() || null,
            relation: form.relation || null,
            gender: form.gender,
            phone: form.phone.trim(),
            motherTongue: form.motherTongue.trim(),
            alternatePhone: form.alternatePhone.trim() || null,
            email: form.email.trim() || null,
            knownLanguages: form.knownLanguages.trim() || null,
            profession: form.profession.trim() || null,
            education: form.education.trim() || null,
            annualIncomeSlab: form.annualIncomeSlab.trim() || null,
            aadhaarMasked: form.aadhaarMasked.trim() || null,
            addressLine: form.addressLine.trim() || null,
            city: form.city.trim() || null,
            state: form.state.trim() || null,
            pincode: form.pincode.trim() || null,
            studentIds: form.studentIds,
          }),
        });
        setParents((prev) =>
          prev.map((p) =>
            p.id === editing.id
              ? {
                  ...p,
                  firstName: form.firstName.trim(),
                  lastName: form.lastName.trim() || undefined,
                  relation: form.relation, gender: form.gender,
                  phone: form.phone.trim() || undefined,
                  alternatePhone: form.alternatePhone.trim() || undefined,
                  email: form.email.trim() || undefined,
                  motherTongue: form.motherTongue.trim() || undefined,
                  knownLanguages: form.knownLanguages.trim() || undefined,
                  profession: form.profession.trim() || undefined,
                  education: form.education.trim() || undefined,
                  annualIncomeSlab: form.annualIncomeSlab.trim() || undefined,
                  aadhaarMasked: form.aadhaarMasked.trim() || undefined,
                  addressLine: form.addressLine.trim() || undefined,
                  city: form.city.trim() || undefined,
                  state: form.state.trim() || undefined,
                  pincode: form.pincode.trim() || undefined,
                }
              : p,
          ),
        );
        setSuccessMsg(`Parent "${form.firstName}${form.lastName.trim() ? ' ' + form.lastName.trim() : ''}" updated.`);
      } else {
        const result = await bffFetch<{ id: string }>('/api/academic/parents', {
          method: 'POST',
          body: JSON.stringify({
            // Issue-227: userId is auto-generated; never exposed to the admin in the UI
            userId: crypto.randomUUID(),
            firstName: form.firstName.trim(),
            ...(form.lastName.trim() && { lastName: form.lastName.trim() }),
            ...(form.relation && { relation: form.relation }),
            gender: form.gender,
            phone: form.phone.trim(),
            motherTongue: form.motherTongue.trim(),
            ...(form.alternatePhone.trim() && { alternatePhone: form.alternatePhone.trim() }),
            ...(form.email.trim() && { email: form.email.trim() }),
            ...(form.knownLanguages.trim() && { knownLanguages: form.knownLanguages.trim() }),
            ...(form.profession.trim() && { profession: form.profession.trim() }),
            ...(form.education.trim() && { education: form.education.trim() }),
            ...(form.annualIncomeSlab.trim() && { annualIncomeSlab: form.annualIncomeSlab.trim() }),
            ...(form.aadhaarMasked.trim() && { aadhaarMasked: form.aadhaarMasked.trim() }),
            ...(form.addressLine.trim() && { addressLine: form.addressLine.trim() }),
            ...(form.city.trim() && { city: form.city.trim() }),
            ...(form.state.trim() && { state: form.state.trim() }),
            ...(form.pincode.trim() && { pincode: form.pincode.trim() }),
            ...(form.studentIds.length > 0 && { studentIds: form.studentIds }),
          }),
        });
        const newParent: Parent = {
          id: result.id,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || undefined,
          relation: form.relation,
          gender: form.gender,
          phone: form.phone.trim() || undefined,
          alternatePhone: form.alternatePhone.trim() || undefined,
          email: form.email.trim() || undefined,
          motherTongue: form.motherTongue.trim() || undefined,
          knownLanguages: form.knownLanguages.trim() || undefined,
          profession: form.profession.trim() || undefined,
          education: form.education.trim() || undefined,
          annualIncomeSlab: form.annualIncomeSlab.trim() || undefined,
          aadhaarMasked: form.aadhaarMasked.trim() || undefined,
          addressLine: form.addressLine.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          pincode: form.pincode.trim() || undefined,
          studentMappings: [],
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

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }

  // ── Issue-250: Derived class/section options from ward enrollments ────────────
  const classOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    allStudents.forEach((s) => {
      const e0 = s.enrollments?.[0];
      if (!e0) return;
      if (filterYear && e0.academicYear.id !== filterYear) return;
      if (!map.has(e0.class.id)) map.set(e0.class.id, e0.class);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allStudents, filterYear]);

  const sectionOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    allStudents.forEach((s) => {
      const e0 = s.enrollments?.[0];
      if (!e0?.section) return;
      if (filterYear && e0.academicYear.id !== filterYear) return;
      if (filterClass && e0.class.id !== filterClass) return;
      if (!map.has(e0.section.id)) map.set(e0.section.id, e0.section);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allStudents, filterYear, filterClass]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return parents
      .filter(p => {
        // Year / class / section: show parent only if at least one ward matches all active filters
        if (filterYear || filterClass || filterSection) {
          const wardIds = (p.studentMappings ?? []).map((sm) => sm.student.id);
          const hasMatchingWard = wardIds.some((wid) => {
            const ward = allStudents.find((s) => s.id === wid);
            const e0 = ward?.enrollments?.[0];
            if (!e0) return false;
            if (filterYear && e0.academicYear.id !== filterYear) return false;
            if (filterClass && e0.class.id !== filterClass) return false;
            if (filterSection && e0.section?.id !== filterSection) return false;
            return true;
          });
          if (!hasMatchingWard) return false;
        }
        if (!q) return true;
        return (
          [p.firstName, p.lastName ?? '', p.phone ?? '', p.email ?? '', p.city ?? ''].some(v => v.toLowerCase().includes(q)) ||
          (p.studentMappings ?? []).some(sm =>
            `${sm.student.firstName} ${sm.student.lastName}`.toLowerCase().includes(q)
          )
        );
      })
      .sort((a, b) => {
        let av = '', bv = '';
        if (sortField === 'name') { av = `${a.lastName} ${a.firstName}`; bv = `${b.lastName} ${b.firstName}`; }
        else if (sortField === 'relation') { av = a.relation; bv = b.relation; }
        else { av = a.gender; bv = b.gender; }
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [parents, allStudents, search, filterYear, filterClass, filterSection, sortField, sortDir]);

  // Issue-250: Pagination
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      {/* Alert banners */}
      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{loadError}</p>
        </div>
      )}
      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{saveError}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {/* Issue-250: Filter + Search toolbar */}
      <div className="flex flex-wrap gap-2 items-end">
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
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, ward…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" aria-label="Clear search">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {/* Count */}
        <span className="text-xs text-slate-400 flex-shrink-0 pb-2">
          {filtered.length} of {parents.length} parent{parents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && <div className="py-12 text-center text-sm text-slate-400">Loading parents…</div>}

      {!loading && (
        <>
          {/* Table — desktop */}
          <PremiumCard accentColor="green" className="hidden sm:block overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="grand-table w-full text-sm" style={{ minWidth: '900px' }}>
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5 text-left">
                      <SortBtn field="name" active={sortField === 'name'} dir={sortDir} onClick={toggleSort}>Name</SortBtn>
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Wards</th>
                    <th className="px-4 py-3.5 text-left">
                      <SortBtn field="relation" active={sortField === 'relation'} dir={sortDir} onClick={toggleSort}>Relation</SortBtn>
                    </th>
                    <th className="px-4 py-3.5 text-left">
                      <SortBtn field="gender" active={sortField === 'gender'} dir={sortDir} onClick={toggleSort}>Gender</SortBtn>
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Address</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {p.firstName} {p.lastName}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {(p.studentMappings ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.studentMappings.map((sm) => (
                              <span key={sm.student.id}
                                className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 whitespace-nowrap">
                                {sm.student.firstName} {sm.student.lastName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300">{DASH}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{relationBadge(p.relation)}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap capitalize">
                        {p.gender ? p.gender.toLowerCase().replace('_', ' ') : DASH}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.phone ? (
                          <a href={`tel:${p.phone}`} className="text-xs text-blue-600 hover:underline">{p.phone}</a>
                        ) : <span className="text-slate-300">{DASH}</span>}
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        {p.email ? (
                          <a href={`mailto:${p.email}`} className="text-xs text-blue-600 hover:underline truncate block">{p.email}</a>
                        ) : <span className="text-slate-300">{DASH}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <AddressCell parent={p} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit */}
                          <button type="button" onClick={() => openEdit(p)} title="Edit parent"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" aria-label="Edit">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {/* Delete */}
                          <button type="button" onClick={() => setDeleteTarget(p)} title="Delete parent"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" aria-label="Delete">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          {/* Manage Wards */}
                          <button type="button" onClick={() => setWardsTarget(p)} title="Manage wards"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" aria-label="Manage wards">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center text-sm text-slate-400">
                        {search || filterYear || filterClass || filterSection
                          ? 'No parents match the current filters. Try adjusting your selection.'
                          : 'No parents yet. Click "Add Parent" to register one.'}
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

          {/* Card stack — mobile */}
          <div className="sm:hidden space-y-3">
            {paginated.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between mb-1.5">
                  <p className="font-bold text-slate-900">{p.firstName} {p.lastName}</p>
                  {relationBadge(p.relation)}
                </div>
                {(p.studentMappings ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {p.studentMappings.map(sm => (
                      <span key={sm.student.id}
                        className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {sm.student.firstName} {sm.student.lastName}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-3">
                  {p.phone && <a href={`tel:${p.phone}`} className="text-blue-600 hover:underline">{p.phone}</a>}
                  {p.email && <a href={`mailto:${p.email}`} className="text-blue-600 hover:underline">{p.email}</a>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(p)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Edit
                  </button>
                  <button type="button" onClick={() => setWardsTarget(p)}
                    className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">
                    Wards
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(p)}
                    className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">
                {search || filterYear || filterClass || filterSection ? 'No parents match the current filters.' : 'No parents yet.'}
              </div>
            )}
            {/* Mobile pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">{filtered.length} parents</span>
                <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
              </div>
            )}
          </div>
        </>
      )}

      {wardsTarget && (
        <ManageWardsModal
          parent={wardsTarget}
          allStudents={allStudents}
          onClose={() => setWardsTarget(null)}
          onChange={updated => setParents(prev => prev.map(p => p.id === updated.id ? updated : p))}
        />
      )}

      <ParentPanel
        open={panelOpen}
        editing={editing}
        allStudents={allStudents}
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
