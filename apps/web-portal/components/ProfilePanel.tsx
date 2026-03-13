'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchProfile, ProfileApiError, updateProfile } from '../lib/profileApi';

export interface SchoolProfile {
  tenantId: string;
  tenantCode: string;
  schoolName: string;
  legalName: string | null;
  udiseCode: string | null;
  affiliationNumber: string | null;
  board: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  district: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  establishmentYear: number | null;
  schoolType: string | null;
  managementType: string | null;
  lowestClass: string | null;
  highestClass: string | null;
  schoolStatus: string;
  tenantStatus: string;
  updatedAt?: string;
}

type EditableForm = {
  legalName: string;
  affiliationNumber: string;
  board: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  district: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  establishmentYear: string;
  schoolType: string;
  managementType: string;
  lowestClass: string;
  highestClass: string;
};

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'identity' | 'academic' | 'contact';

const BOARD_OPTIONS = ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE', 'Other'];
const SCHOOL_TYPE_OPTIONS = ['Government', 'Government Aided', 'Private Unaided', 'Central Government'];
const MANAGEMENT_OPTIONS = ['Central Government', 'State Government', 'Local Body', 'Private Aided', 'Private Unaided', 'Other'];
const CLASS_OPTIONS = ['LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const CURRENT_YEAR = new Date().getFullYear();

const EMPTY_FORM: EditableForm = {
  legalName: '', affiliationNumber: '', board: '',
  address: '', city: '', state: '', pincode: '', district: '',
  contactPhone: '', contactEmail: '', website: '',
  establishmentYear: '', schoolType: '', managementType: '',
  lowestClass: '', highestClass: '',
};

// â”€â”€ Validators â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function validate(form: EditableForm): Partial<Record<keyof EditableForm, string>> {
  const e: Partial<Record<keyof EditableForm, string>> = {};
  if (form.contactPhone && !/^\+?[\d\s\-().]{7,15}$/.test(form.contactPhone))
    e.contactPhone = 'Enter a valid phone number (7–15 digits).';
  if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail))
    e.contactEmail = 'Enter a valid email address.';
  if (form.pincode && !/^\d{6}$/.test(form.pincode))
    e.pincode = 'Pincode must be exactly 6 digits.';
  if (form.website && !/^https?:\/\/.+/.test(form.website))
    e.website = 'Website must start with http:// or https://';
  if (form.establishmentYear) {
    const y = parseInt(form.establishmentYear, 10);
    if (isNaN(y) || y < 1800 || y > CURRENT_YEAR)
      e.establishmentYear = `Year must be between 1800 and ${CURRENT_YEAR}.`;
  }
  return e;
}

// â”€â”€ Completeness â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function completeness(p: SchoolProfile): number {
  const fields: Array<unknown> = [
    p.schoolName, p.udiseCode, p.legalName, p.board, p.affiliationNumber,
    p.address, p.city, p.state, p.pincode, p.district,
    p.contactPhone, p.contactEmail, p.website,
    p.establishmentYear, p.schoolType, p.managementType, p.lowestClass, p.highestClass,
  ];
  const filled = fields.filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length;
  return Math.round((filled / fields.length) * 100);
}

// â”€â”€ Status badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cfg =
    s === 'active' ? { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' } :
    s === 'pending_activation' || s === 'pending' ? { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' } :
    s === 'suspended' ? { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200' } :
    { dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// â”€â”€ Skeleton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SkeletonField() {
  return (
    <div className="mb-4">
      <div className="h-3 w-24 bg-slate-200 rounded mb-1.5 animate-pulse" />
      <div className="h-9 bg-slate-100 rounded animate-pulse" />
    </div>
  );
}

function SkeletonSection() {
  return (
    <div className="space-y-1">
      {[1, 2, 3, 4].map((i) => <SkeletonField key={i} />)}
    </div>
  );
}

// â”€â”€ Form primitives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const inputCls = (err?: string) =>
  `w-full rounded-md border px-3 py-2 text-sm bg-white
   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
   transition-colors placeholder:text-slate-400
   ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 hover:border-slate-400'}`;

function Field({
  label, value, onChange, type = 'text', placeholder, error, readOnly, hint,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; error?: string; readOnly?: boolean; hint?: string;
}) {
  return (
    <div className="mb-4">
      <label className="flex items-center gap-1 text-xs font-semibold text-slate-600 mb-1.5">
        {label}
        {readOnly && (
          <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
      </label>
      {readOnly ? (
        <div
          className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 cursor-not-allowed select-all"
          title="Managed by the platform — contact support to change"
        >
          {value || <span className="text-slate-400 italic text-xs">Not set</span>}
        </div>
      ) : (
        <input
          type={type}
          className={inputCls(error)}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><span aria-hidden="true">&#x26A0;</span>{error}</p>}
    </div>
  );
}

function SelectField({
  label, value, options, onChange, error,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; error?: string;
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <select className={inputCls(error)} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">- Select -</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><span>âš </span>{error}</p>}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap
        ${active
          ? 'border-blue-600 text-blue-700 bg-blue-50/60'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
        }`}
    >
      {children}
    </button>
  );
}

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function ProfilePanel({ isOpen, onClose }: ProfilePanelProps) {
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [form, setForm] = useState<EditableForm>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<EditableForm>(EMPTY_FORM);
  const [tab, setTab] = useState<Tab>('identity');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof EditableForm, string>>>({});
  const [savedAt, setSavedAt] = useState('');
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  const profileToForm = (data: SchoolProfile): EditableForm => {
    // Sanitize a raw API value to a clean string:
    // • null / undefined / "null" / "undefined"  → ''
    // • strips leading/trailing whitespace
    // • removes non-printable control characters (U+0000–U+001F, U+007F)
    const s = (v: string | null | undefined): string => {
      if (v == null) return '';
      const str = String(v).trim();
      if (str === 'null' || str === 'undefined') return '';
      // Remove ASCII control characters that can appear as garbage in some DB exports
      return str.replace(/[\x00-\x1F\x7F]/g, '');
    };

    return {
      legalName:         s(data.legalName),
      affiliationNumber: s(data.affiliationNumber),
      board:             s(data.board),
      address:           s(data.address),
      city:              s(data.city),
      state:             s(data.state),
      pincode:           s(data.pincode),
      district:          s(data.district),
      contactPhone:      s(data.contactPhone),
      contactEmail:      s(data.contactEmail),
      website:           s(data.website),
      establishmentYear: data.establishmentYear != null ? String(data.establishmentYear) : '',
      schoolType:        s(data.schoolType),
      managementType:    s(data.managementType),
      lowestClass:       s(data.lowestClass),
      highestClass:      s(data.highestClass),
    };
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSavedAt('');
    try {
      const data = await fetchProfile<SchoolProfile>();
      setProfile(data);
      const f = profileToForm(data);
      setForm(f);
      setSavedForm(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : '[ERR-SCH-PROF-5001] Failed to load school profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTab('identity');
      void load();
    }
  }, [isOpen, load]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (successTimerRef.current) clearTimeout(successTimerRef.current); }, []);

  const setField = (field: keyof EditableForm) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error as user types
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  async function handleSave() {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      // Jump to the first tab that has an error
      const academicFields: Array<keyof EditableForm> = ['board','affiliationNumber','establishmentYear','schoolType','managementType','lowestClass','highestClass','legalName'];
      const contactFields: Array<keyof EditableForm> = ['contactPhone','contactEmail','website','address','city','district','state','pincode'];
      if (Object.keys(errs).some((k) => academicFields.includes(k as keyof EditableForm))) setTab('academic');
      else if (Object.keys(errs).some((k) => contactFields.includes(k as keyof EditableForm))) setTab('contact');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (k === 'establishmentYear') {
          payload[k] = v.trim() !== '' ? parseInt(v, 10) : null;
        } else {
          payload[k] = v.trim() !== '' ? v.trim() : null;
        }
      }
      await updateProfile(payload);
      setSavedForm({ ...form });
      setSavedAt(new Date().toLocaleTimeString());
      setFieldErrors({});
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSavedAt(''), 5000);
      // Reload to sync any server-side transformations
      await load();
    } catch (e) {
      if (e instanceof ProfileApiError && e.status === 409 && e.conflictField) {
        // Inline field-level conflict error — do not show generic banner
        const conflictMsg =
          e.conflictField === 'contactEmail'
            ? 'This email is already registered to another school.'
            : 'This phone number is already registered to another school.';
        setFieldErrors((prev) => ({ ...prev, [e.conflictField!]: conflictMsg }));
        setTab('contact');
      } else {
        setError(e instanceof Error ? e.message : '[ERR-SCH-PROF-5002] Failed to save school profile');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setForm(savedForm);
    setFieldErrors({});
    setError('');
  }

  const pct = profile ? completeness(profile) : 0;
  const pctColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden
      />

      {/* Side panel */}
      <div
        role="dialog"
        aria-label="School Profile"
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-[560px] bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* â”€â”€ Header â”€â”€ */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-white">
          <div className="flex items-start justify-between px-6 pt-5 pb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-900 leading-tight truncate">
                  {profile?.schoolName ?? 'School Profile'}
                </h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {profile && (
                    <>
                      <span className="text-xs text-slate-500 font-mono">{profile.tenantCode}</span>
                      <span className="text-slate-300">&bull;</span>
                      <StatusBadge status={profile.tenantStatus} />
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-3 flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Profile completeness bar */}
          {profile && !loading && (
            <div className="px-6 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 font-medium">Profile completeness</span>
                <span className={`text-xs font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${pctColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-t border-slate-100 overflow-x-auto">
            <TabButton active={tab === 'identity'} onClick={() => setTab('identity')}>
              Identity
            </TabButton>
            <TabButton active={tab === 'academic'} onClick={() => setTab('academic')}>
              Academic
            </TabButton>
            <TabButton active={tab === 'contact'} onClick={() => setTab('contact')}>
              Contact &amp; Address
            </TabButton>
          </div>
        </div>

        {/* â”€â”€ Body â”€â”€ */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="px-6 py-6">
              <SkeletonSection />
            </div>
          )}

          {!loading && error && !profile && (
            <div className="px-6 py-8 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Failed to load profile</p>
                <p className="text-xs text-slate-500 font-mono bg-slate-50 px-3 py-2 rounded border border-slate-200 max-w-sm">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>
            </div>
          )}

          {!loading && profile && (
            <div className="px-6 py-5">
              {/* â”€â”€ Identity Tab â”€â”€ */}
              {tab === 'identity' && (
                <>
                  <SectionHeading
                    icon={<svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                    title="School Identity"
                    subtitle="Read-only — contact platform support to update these fields"
                  />
                  <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-4">
                    <Field label="School Name" value={profile.schoolName} readOnly />
                    <Field label="School Code" value={profile.tenantCode} readOnly hint="Used as your subdomain" />
                    <Field label="UDISE Code" value={profile.udiseCode ?? ''} readOnly />
                    <Field label="Affiliation Number" value={profile.affiliationNumber ?? ''} readOnly />
                  </div>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-600 mb-3">Account Status</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Tenant</p>
                        <StatusBadge status={profile.tenantStatus} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">School</p>
                        <StatusBadge status={profile.schoolStatus} />
                      </div>
                    </div>
                  </div>
                  {profile.updatedAt && (
                    <p className="text-xs text-slate-400 mt-4">
                      Last updated: {new Date(profile.updatedAt).toLocaleString()}
                    </p>
                  )}
                </>
              )}

              {/* â”€â”€ Academic Tab â”€â”€ */}
              {tab === 'academic' && (
                <>
                  <SectionHeading
                    icon={<svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>}
                    title="Academic Details"
                    subtitle="Affiliations, board, class range and school classification"
                  />
                  <Field
                    label="Legal / Trust Name"
                    value={form.legalName}
                    onChange={setField('legalName')}
                    placeholder="e.g. Greenwood Educational Trust"
                    error={fieldErrors.legalName}
                  />
                  <SelectField
                    label="Board of Education"
                    value={form.board}
                    options={BOARD_OPTIONS}
                    onChange={setField('board')}
                    error={fieldErrors.board}
                  />
                  <Field
                    label="Affiliation Number"
                    value={form.affiliationNumber}
                    onChange={setField('affiliationNumber')}
                    placeholder="e.g. CBSE/OTH/12345/678"
                    error={fieldErrors.affiliationNumber}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <SelectField label="Lowest Class" value={form.lowestClass} options={CLASS_OPTIONS} onChange={setField('lowestClass')} />
                    <SelectField label="Highest Class" value={form.highestClass} options={CLASS_OPTIONS} onChange={setField('highestClass')} />
                  </div>
                  <Field
                    label="Year of Establishment"
                    value={form.establishmentYear}
                    onChange={setField('establishmentYear')}
                    type="number"
                    placeholder={`e.g. 1998`}
                    error={fieldErrors.establishmentYear}
                    hint={`4-digit year between 1800 and ${CURRENT_YEAR}`}
                  />
                  <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-4">
                    <SelectField label="School Type" value={form.schoolType} options={SCHOOL_TYPE_OPTIONS} onChange={setField('schoolType')} />
                    <SelectField label="Management Type" value={form.managementType} options={MANAGEMENT_OPTIONS} onChange={setField('managementType')} />
                  </div>
                </>
              )}

              {/* â”€â”€ Contact & Address Tab â”€â”€ */}
              {tab === 'contact' && (
                <>
                  <SectionHeading
                    icon={<svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                    title="Contact & Address"
                    subtitle="Public-facing contact details and physical address"
                  />
                  <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-4">
                    <Field
                      label="Contact Phone"
                      value={form.contactPhone}
                      onChange={setField('contactPhone')}
                      placeholder="+91-9876543210"
                      type="tel"
                      error={fieldErrors.contactPhone}
                    />
                    <Field
                      label="Contact Email"
                      value={form.contactEmail}
                      onChange={setField('contactEmail')}
                      placeholder="admin@school.edu.in"
                      type="email"
                      error={fieldErrors.contactEmail}
                    />
                  </div>
                  <Field
                    label="Website"
                    value={form.website}
                    onChange={setField('website')}
                    placeholder="https://school.edu.in"
                    error={fieldErrors.website}
                  />
                  <Field
                    label="Street Address"
                    value={form.address}
                    onChange={setField('address')}
                    placeholder="e.g. 42, Main Road, Sector 5"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="City / Town" value={form.city} onChange={setField('city')} placeholder="e.g. Mumbai" />
                    <Field label="District" value={form.district} onChange={setField('district')} placeholder="e.g. Mumbai Suburban" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="State" value={form.state} onChange={setField('state')} placeholder="e.g. Maharashtra" />
                    <Field
                      label="Pincode"
                      value={form.pincode}
                      onChange={setField('pincode')}
                      placeholder="e.g. 400001"
                      error={fieldErrors.pincode}
                      hint="6-digit PIN"
                    />
                  </div>
                </>
              )}

              {/* â”€â”€ Inline save error â”€â”€ */}
              {error && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <p className="text-xs text-red-700 font-mono">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* â”€â”€ Footer â”€â”€ */}
        {!loading && profile && (
          <div className="flex-shrink-0 border-t border-slate-200 bg-white px-6 py-4">
            {/* Success toast */}
            {savedAt && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-emerald-700 font-medium">Profile saved successfully at {savedAt}</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                {isDirty && (
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <span className="text-xs font-medium">Unsaved changes</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={isDirty ? handleDiscard : onClose}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700
                    hover:bg-slate-50 hover:border-slate-400 transition-colors"
                >
                  {isDirty ? 'Discard' : 'Close'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white
                    hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving…
                    </>
                  ) : (
                    'Save Profile'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}


