'use client';

import { useEffect, useState, useCallback } from 'react';
import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import type { UserClaims } from '../../../../lib/auth';
import { PremiumCard } from '../../../../components/ui/PremiumCard';
import { StatusPill } from '../../../../components/ui/StatusPill';
import { DriverForm } from '../../../../components/forms/DriverForm';
import { AttendantForm } from '../../../../components/forms/AttendantForm';

// ── Shared ref types ──────────────────────────────────────────────────────────
interface DeptRef { id: string; name: string; code: string }
interface RoleRef { id: string; name: string; code: string }

// ── Driver types ──────────────────────────────────────────────────────────────
interface DriverRecord {
  id: string;
  licenseNumber: string;
  licenseExpiry: string;
  badgeNumber: string | null;
  badgeExpiry: string | null;
  policeVerificationStatus: string | null;
  isActive: boolean;
  employee: { id: string; firstName: string; lastName: string | null; contactPhone: string; email: string | null; dateOfBirth: string | null; dateOfJoining: string | null };
}

// ── Attendant types ───────────────────────────────────────────────────────────
interface AttendantRecord {
  id: string;
  policeVerificationStatus: string | null;
  isActive: boolean;
  employee: { id: string; firstName: string; lastName: string | null; contactPhone: string; email: string | null; dateOfBirth: string | null; dateOfJoining: string | null };
}

type ActiveTab = 'drivers' | 'attendants';

function displayName(emp: { firstName: string; lastName: string | null }): string {
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ');
}

// ── Driver Slide-over (thin wrapper around DriverForm) ────────────────────────
function DriverPanel({
  open, editing, allDepts, allRoles, onClose, onSuccess, onError,
}: {
  open: boolean; editing: DriverRecord | null; allDepts: DeptRef[]; allRoles: RoleRef[];
  onClose: () => void; onSuccess: () => void; onError: (msg: string) => void;
}) {
  if (!open) return null;
  const isEdit = editing !== null;
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-orange-50 to-amber-50">
        <h2 className="text-lg font-bold text-slate-800">{isEdit ? 'Edit Driver' : 'Add New Driver'}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <DriverForm editing={editing} allDepts={allDepts} allRoles={allRoles}
          onSuccess={() => onSuccess()} onError={onError} onCancel={onClose} />
      </div>
    </div>
  );
}

// ── Attendant Slide-over (thin wrapper around AttendantForm) ──────────────────
function AttendantPanel({
  open, editing, allDepts, allRoles, onClose, onSuccess, onError,
}: {
  open: boolean; editing: AttendantRecord | null; allDepts: DeptRef[]; allRoles: RoleRef[];
  onClose: () => void; onSuccess: () => void; onError: (msg: string) => void;
}) {
  if (!open) return null;
  const isEdit = editing !== null;
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-teal-50 to-cyan-50">
        <h2 className="text-lg font-bold text-slate-800">{isEdit ? 'Edit Attendant' : 'Add New Attendant'}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <AttendantForm editing={editing} allDepts={allDepts} allRoles={allRoles}
          onSuccess={() => onSuccess()} onError={onError} onCancel={onClose} />
      </div>
    </div>
  );
}

// ── Main Content ──────────────────────────────────────────────────────────────
function TransportStaffContent() {
  const [tab, setTab] = useState<ActiveTab>('drivers');

  // shared refs
  const [allDepts, setAllDepts] = useState<DeptRef[]>([]);
  const [allRoles, setAllRoles] = useState<RoleRef[]>([]);

  // drivers
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [drvPanel, setDrvPanel] = useState(false);
  const [editingDrv, setEditingDrv] = useState<DriverRecord | null>(null);

  // attendants
  const [attendants, setAttendants] = useState<AttendantRecord[]>([]);
  const [attPanel, setAttPanel] = useState(false);
  const [editingAtt, setEditingAtt] = useState<AttendantRecord | null>(null);

  // loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [drvRes, attRes, depRes, rolRes] = await Promise.all([
        bffFetch<DriverRecord[]>('/api/transport/drivers'),
        bffFetch<AttendantRecord[]>('/api/transport/attendants'),
        bffFetch<DeptRef[]>('/api/hr/departments'),
        bffFetch<RoleRef[]>('/api/hr/roles'),
      ]);
      setDrivers(drvRes ?? []);
      setAttendants(attRes ?? []);
      setAllDepts(depRes ?? []);
      setAllRoles(rolRes ?? []);
    } catch {
      setError('Failed to load transport staff data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Driver CRUD ───────────────────────────────────────────────────────────
  function handleDriverSuccess() {
    setDrvPanel(false);
    setEditingDrv(null);
    refresh();
  }

  async function deleteDriver(d: DriverRecord) {
    if (!confirm(`Delete driver "${displayName(d.employee)}"?`)) return;
    try {
      await bffFetch(`/api/transport/drivers/${d.id}`, { method: 'DELETE' });
      refresh();
    } catch {
      setError('Failed to delete driver.');
    }
  }

  // ── Attendant CRUD ────────────────────────────────────────────────────────
  function handleAttendantSuccess() {
    setAttPanel(false);
    setEditingAtt(null);
    refresh();
  }

  async function deleteAttendant(a: AttendantRecord) {
    if (!confirm(`Delete attendant "${displayName(a.employee)}"?`)) return;
    try {
      await bffFetch(`/api/transport/attendants/${a.id}`, { method: 'DELETE' });
      refresh();
    } catch {
      setError('Failed to delete attendant.');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Transport Staff</h1>
          <p className="text-sm text-slate-500 mt-1">Manage drivers and attendants for your school transport fleet</p>
        </div>
        <button
          onClick={() => {
            if (tab === 'drivers') { setEditingDrv(null); setDrvPanel(true); }
            else { setEditingAtt(null); setAttPanel(true); }
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-2.5 rounded-lg transition shadow-sm"
        >
          + Add {tab === 'drivers' ? 'Driver' : 'Attendant'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
          <button className="ml-3 underline text-red-600" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(['drivers', 'attendants'] as ActiveTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-md text-sm font-semibold transition ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'drivers' ? `Drivers (${drivers.length})` : `Attendants (${attendants.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      ) : tab === 'drivers' ? (
        <PremiumCard>
          {drivers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-lg font-semibold">No drivers yet</p>
              <p className="text-sm mt-1">Click &quot;+ Add Driver&quot; to register a new driver.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Mobile</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">License #</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">License Exp.</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Badge #</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Police Check</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map(d => (
                    <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-800">{displayName(d.employee)}</td>
                      <td className="px-4 py-3 text-slate-600">{d.employee.contactPhone}</td>
                      <td className="px-4 py-3 text-slate-600">{d.licenseNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{d.licenseExpiry ? new Date(d.licenseExpiry).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{d.badgeNumber ?? '—'}</td>
                      <td className="px-4 py-3">
                        {d.policeVerificationStatus
                          ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.policeVerificationStatus === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{d.policeVerificationStatus}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusPill status={d.isActive ? 'Active' : 'Inactive'} /></td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => { setEditingDrv(d); setDrvPanel(true); }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-semibold">Edit</button>
                        <button onClick={() => deleteDriver(d)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PremiumCard>
      ) : (
        <PremiumCard>
          {attendants.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-lg font-semibold">No attendants yet</p>
              <p className="text-sm mt-1">Click &quot;+ Add Attendant&quot; to register a new attendant.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Mobile</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Email</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Police Check</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attendants.map(a => (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-800">{displayName(a.employee)}</td>
                      <td className="px-4 py-3 text-slate-600">{a.employee.contactPhone}</td>
                      <td className="px-4 py-3 text-slate-600">{a.employee.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        {a.policeVerificationStatus
                          ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${a.policeVerificationStatus === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{a.policeVerificationStatus}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusPill status={a.isActive ? 'Active' : 'Inactive'} /></td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => { setEditingAtt(a); setAttPanel(true); }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-semibold">Edit</button>
                        <button onClick={() => deleteAttendant(a)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PremiumCard>
      )}

      {/* Slide-overs */}
      <DriverPanel open={drvPanel} editing={editingDrv} allDepts={allDepts} allRoles={allRoles}
        onClose={() => { setDrvPanel(false); setEditingDrv(null); }}
        onSuccess={handleDriverSuccess} onError={(msg) => setError(msg)} />

      <AttendantPanel open={attPanel} editing={editingAtt} allDepts={allDepts} allRoles={allRoles}
        onClose={() => { setAttPanel(false); setEditingAtt(null); }}
        onSuccess={handleAttendantSuccess} onError={(msg) => setError(msg)} />
    </div>
  );
}

// ── Page Export ────────────────────────────────────────────────────────────────
export default function TransportStaffPage() {
  return (
    <AuthGuard>
      {() => <TransportStaffContent />}
    </AuthGuard>
  );
}
