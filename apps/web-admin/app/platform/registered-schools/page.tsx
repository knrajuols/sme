'use client';

import { useEffect, useState } from 'react';
import { DataTable, TableColumn } from '../../../components/DataTable';
import { AuthGuard } from '../../../components/AuthGuard';
import { apiRequest } from '../../../lib/api';

interface ActivationResult {
  schoolName: string;
  tenantCode: string;
  onboardingCredentials: Array<{ email: string; loginUrl: string }>;
}

interface School {
  id: string; // maps to tenantId, required by DataTable
  tenantId: string;
  tenantCode: string;
  schoolName: string;
  legalName: string | null;
  schoolStatus: string;
  tenantStatus: string;
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
  createdAt: string;
  updatedAt: string;
}

type EditDraft = Omit<School, 'id' | 'tenantId' | 'tenantStatus' | 'createdAt' | 'updatedAt'>;

const STATUS_COLOUR: Record<string, string> = {
  ACTIVE:    'bg-emerald-100 text-emerald-800',
  PENDING:   'bg-amber-100 text-amber-800',
  SUSPENDED: 'bg-red-100 text-red-800',
};

function StatusBadge({ value }: { value: string }) {
  const cls = STATUS_COLOUR[value] ?? 'bg-slate-100 text-slate-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{value}</span>;
}

function Field({
  label, name, value, type = 'text', onChange,
}: {
  label: string;
  name: keyof EditDraft;
  value: string | number | null;
  type?: string;
  onChange: (name: keyof EditDraft, value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        name={name}
        value={value ?? ''}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

function SelectField({
  label, name, value, options, onChange,
}: {
  label: string;
  name: keyof EditDraft;
  value: string | null;
  options: string[];
  onChange: (name: keyof EditDraft, value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <select
        name={name}
        value={value ?? ''}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">— select —</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function EditModal({
  school,
  onClose,
  onSaved,
}: {
  school: School;
  onClose: () => void;
  onSaved: (updated: School) => void;
}) {
  const [draft, setDraft] = useState<EditDraft>({
    tenantCode:        school.tenantCode,
    schoolName:        school.schoolName,
    legalName:         school.legalName,
    schoolStatus:      school.schoolStatus,
    udiseCode:         school.udiseCode,
    affiliationNumber: school.affiliationNumber,
    board:             school.board,
    address:           school.address,
    city:              school.city,
    state:             school.state,
    pincode:           school.pincode,
    district:          school.district,
    contactPhone:      school.contactPhone,
    contactEmail:      school.contactEmail,
    website:           school.website,
    establishmentYear: school.establishmentYear,
    schoolType:        school.schoolType,
    managementType:    school.managementType,
    lowestClass:       school.lowestClass,
    highestClass:      school.highestClass,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function handleChange(name: keyof EditDraft, value: string) {
    setDraft((prev) => ({
      ...prev,
      [name]: name === 'establishmentYear'
        ? (value === '' ? null : Number(value))
        : (value === '' ? null : value),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/platform/tenants/${school.tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      onSaved({ ...school, ...draft });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Edit School</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{school.tenantId}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {/* Identity */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">School Identity</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="School Name *"         name="schoolName"        value={draft.schoolName}        onChange={handleChange} />
              <Field label="Legal Name"            name="legalName"         value={draft.legalName}         onChange={handleChange} />
              <Field label="Subdomain (Tenant Code)" name="tenantCode"      value={draft.tenantCode}        onChange={handleChange} />
              <Field label="UDISE Code (11 digits)"  name="udiseCode"       value={draft.udiseCode}         onChange={handleChange} />
              <Field label="Affiliation Number"    name="affiliationNumber" value={draft.affiliationNumber} onChange={handleChange} />
              <Field label="Board (CBSE / ICSE…)"  name="board"            value={draft.board}             onChange={handleChange} />
              <SelectField label="School Status"   name="schoolStatus"      value={draft.schoolStatus}
                options={['PENDING', 'ACTIVE', 'SUSPENDED']} onChange={handleChange} />
            </div>
          </section>

          {/* Address */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Address</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Address" name="address" value={draft.address} onChange={handleChange} />
              </div>
              <Field label="City"     name="city"     value={draft.city}     onChange={handleChange} />
              <Field label="District" name="district" value={draft.district} onChange={handleChange} />
              <Field label="State"    name="state"    value={draft.state}    onChange={handleChange} />
              <Field label="Pincode"  name="pincode"  value={draft.pincode}  onChange={handleChange} />
            </div>
          </section>

          {/* Contact */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Contact</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Contact Phone" name="contactPhone" value={draft.contactPhone} onChange={handleChange} />
              <Field label="Contact Email" name="contactEmail" value={draft.contactEmail} onChange={handleChange} />
              <Field label="Website"       name="website"      value={draft.website}      onChange={handleChange} />
            </div>
          </section>

          {/* Establishment */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Establishment</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Establishment Year" name="establishmentYear" value={draft.establishmentYear} type="number" onChange={handleChange} />
              <Field label="School Type"        name="schoolType"        value={draft.schoolType}        onChange={handleChange} />
              <Field label="Management Type"    name="managementType"    value={draft.managementType}    onChange={handleChange} />
              <Field label="Lowest Class"       name="lowestClass"       value={draft.lowestClass}       onChange={handleChange} />
              <Field label="Highest Class"      name="highestClass"      value={draft.highestClass}      onChange={handleChange} />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          {error ? <p className="text-sm text-red-600">{error}</p> : <span />}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CredentialsModal({
  result,
  onClose,
}: {
  result: ActivationResult;
  onClose: () => void;
}) {
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'sme.test';
  const portalUrl = `http://${result.tenantCode}.${baseDomain}:3102/login`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-emerald-700">✓ School Approved</h2>
            <p className="mt-0.5 text-sm text-slate-500">{result.schoolName} is now active.</p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-600">&times;</button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="rounded border border-emerald-200 bg-emerald-50 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">School Portal Login URL</p>
            <code className="block break-all font-mono text-sm text-emerald-900">{portalUrl}</code>
          </div>
          {result.onboardingCredentials.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">School Admin Account(s)</p>
              <div className="space-y-2">
                {result.onboardingCredentials.map((cred, idx) => (
                  <div key={idx} className="rounded border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-900">{cred.email}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Admin login:{' '}
                      <a href={cred.loginUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        {cred.loginUrl}
                      </a>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Share the portal URL and admin credentials with the school. The school admin can log in, update their password, and start managing students and staff.
          </p>
        </div>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RegisteredSchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<School | null>(null);
  const [search, setSearch]   = useState('');
  const [approving, setApproving] = useState<string | null>(null);
  const [activationResult, setActivationResult] = useState<ActivationResult | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const rows = await apiRequest<Array<Record<string, unknown>>>('/platform/tenants');
      setSchools(rows.map((r) => ({ ...r, id: r.tenantId as string } as School)));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  }

  function handleSaved(updated: School) {
    setSchools((prev) => prev.map((s) => (s.tenantId === updated.tenantId ? updated : s)));
    setSelected(null);
    setMessage('School record updated successfully.');
  }

  async function handleApprove(school: School) {
    setApproving(school.tenantId);
    setMessage('');
    try {
      const result = await apiRequest<{
        tenantId: string;
        status: string;
        onboardingCredentials: Array<{ email: string; loginUrl: string }>;
      }>(`/platform/tenants/${school.tenantId}/activate`, { method: 'POST' });
      setSchools((prev) =>
        prev.map((s) =>
          s.tenantId === school.tenantId
            ? { ...s, schoolStatus: 'ACTIVE', tenantStatus: 'ACTIVE' }
            : s,
        ),
      );
      setActivationResult({
        schoolName: school.schoolName,
        tenantCode: school.tenantCode,
        onboardingCredentials: result.onboardingCredentials,
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setApproving(null);
    }
  }

  const filtered = schools.filter((s) => {
    const q = search.toLowerCase();
    return (
      !q ||
      s.schoolName.toLowerCase().includes(q) ||
      s.tenantCode.toLowerCase().includes(q) ||
      (s.udiseCode ?? '').toLowerCase().includes(q) ||
      (s.city ?? '').toLowerCase().includes(q) ||
      (s.state ?? '').toLowerCase().includes(q)
    );
  });

  const columns: TableColumn<School>[] = [
    {
      key: 'tenantId',
      label: 'Tenant ID',
      render: (row) => (
        <button
          type="button"
          className="font-mono text-xs text-blue-600 underline hover:text-blue-800"
          title="Click to edit school record"
          onClick={() => setSelected(row)}
        >
          {row.tenantId.slice(0, 8)}…
        </button>
      ),
    },
    {
      key: 'udiseCode',
      label: 'UDISE Code',
      render: (row) => <span className="font-mono text-xs">{row.udiseCode ?? '—'}</span>,
    },
    { key: 'schoolName', label: 'School Name' },
    {
      key: 'tenantCode',
      label: 'Subdomain',
      render: (row) => <span className="font-mono text-xs">{row.tenantCode}</span>,
    },
    {
      key: 'board',
      label: 'Board',
      render: (row) => row.board ?? '—',
    },
    {
      key: 'city',
      label: 'City',
      render: (row) => row.city ?? '—',
    },
    {
      key: 'state',
      label: 'State',
      render: (row) => row.state ?? '—',
    },
    {
      key: 'contactEmail',
      label: 'Contact Email',
      render: (row) => row.contactEmail ?? '—',
    },
    {
      key: 'schoolStatus',
      label: 'Status',
      render: (row) => <StatusBadge value={row.schoolStatus} />,
    },
    {
      key: 'createdAt',
      label: 'Registered At',
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: '_actions' as keyof School,
      label: 'Actions',
      render: (row) =>
        row.schoolStatus === 'PENDING' ? (
          <button
            type="button"
            onClick={() => void handleApprove(row)}
            disabled={approving === row.tenantId}
            className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {approving === row.tenantId ? 'Approving…' : 'Approve'}
          </button>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  return (
    <AuthGuard>
      {(claims) => (
        <main className="mx-auto max-w-7xl p-6">
          {!claims.roles.includes('PLATFORM_ADMIN') ? (
            <section className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This page is available only for Platform Admin.
            </section>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Registered Schools</h1>
                <div className="flex gap-3">
                  <input
                    type="search"
                    placeholder="Search by name, subdomain, UDISE…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded border border-slate-300 px-3 py-2 text-sm w-64 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading}
                    className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {loading ? 'Loading…' : 'Refresh'}
                  </button>
                </div>
              </div>

              {message ? (
                <p className={`mb-4 text-sm ${message.includes('failed') || message.includes('Failed') ? 'text-red-600' : 'text-emerald-700'}`}>
                  {message}
                </p>
              ) : null}

              <p className="mb-2 text-xs text-slate-500">
                {filtered.length} school{filtered.length !== 1 ? 's' : ''} found
                {search ? ` matching "${search}"` : ''}
                {' '}— click a Tenant ID to edit.
              </p>

              <DataTable
                columns={columns}
                data={filtered}
                loading={loading}
                filters={null}
                page={1}
                pageSize={filtered.length || 20}
                total={filtered.length}
                onPageChange={() => {}}
                onPageSizeChange={() => {}}
              />
            </>
          )}

          {selected ? (
            <EditModal
              school={selected}
              onClose={() => setSelected(null)}
              onSaved={handleSaved}
            />
          ) : null}

          {activationResult ? (
            <CredentialsModal
              result={activationResult}
              onClose={() => setActivationResult(null)}
            />
          ) : null}
        </main>
      )}
    </AuthGuard>
  );
}
