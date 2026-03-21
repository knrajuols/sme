'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { apiRequest } from '../../../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface Driver {
  id: string;
  name: string;
  mobile: string;
  licenseNumber: string;
  licenseExpiry: string;
  badgeNumber: string | null;
  badgeExpiry: string | null;
  policeVerificationStatus: string | null;
  isActive: boolean;
}

interface Attendant {
  id: string;
  name: string;
  mobile: string;
  policeVerificationStatus: string | null;
  isActive: boolean;
}

type Tab = 'drivers' | 'attendants';

const BFF_DRIVERS    = '/api/web-admin/transport/staff/drivers';
const BFF_ATTENDANTS = '/api/web-admin/transport/staff/attendants';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

function expirySoon(iso: string | null, days = 30): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function TransportStaffPage() {
  const [tab, setTab] = useState<Tab>('drivers');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Slide-out panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Driver form
  const [dName, setDName]       = useState('');
  const [dMobile, setDMobile]   = useState('');
  const [dLicense, setDLicense] = useState('');
  const [dLicExp, setDLicExp]   = useState('');
  const [dBadge, setDBadge]     = useState('');
  const [dBadgeExp, setDBadgeExp] = useState('');
  const [dPolice, setDPolice]   = useState('');

  // Attendant form
  const [aName, setAName]     = useState('');
  const [aMobile, setAMobile] = useState('');
  const [aPolice, setAPolice] = useState('');

  const [saving, setSaving] = useState(false);

  const flash = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Driver[]>(BFF_DRIVERS, { disableTenantValidation: true });
      setDrivers(data);
    } catch { flash('error', 'Failed to load drivers'); }
    setLoading(false);
  }, [flash]);

  const loadAttendants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Attendant[]>(BFF_ATTENDANTS, { disableTenantValidation: true });
      setAttendants(data);
    } catch { flash('error', 'Failed to load attendants'); }
    setLoading(false);
  }, [flash]);

  useEffect(() => { loadDrivers(); loadAttendants(); }, [loadDrivers, loadAttendants]);

  // ── Open Panel ─────────────────────────────────────────────────────────────

  const openAddDriver = () => {
    setEditId(null);
    setDName(''); setDMobile(''); setDLicense(''); setDLicExp('');
    setDBadge(''); setDBadgeExp(''); setDPolice('');
    setPanelOpen(true);
  };

  const openEditDriver = (d: Driver) => {
    setEditId(d.id);
    setDName(d.name); setDMobile(d.mobile); setDLicense(d.licenseNumber);
    setDLicExp(d.licenseExpiry ? d.licenseExpiry.slice(0, 10) : '');
    setDBadge(d.badgeNumber ?? ''); setDBadgeExp(d.badgeExpiry ? d.badgeExpiry.slice(0, 10) : '');
    setDPolice(d.policeVerificationStatus ?? '');
    setPanelOpen(true);
  };

  const openAddAttendant = () => {
    setEditId(null);
    setAName(''); setAMobile(''); setAPolice('');
    setPanelOpen(true);
  };

  const openEditAttendant = (a: Attendant) => {
    setEditId(a.id);
    setAName(a.name); setAMobile(a.mobile); setAPolice(a.policeVerificationStatus ?? '');
    setPanelOpen(true);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const saveDriver = async () => {
    if (!dName.trim() || !dMobile.trim() || !dLicense.trim() || !dLicExp) {
      flash('error', 'Name, Mobile, License Number, and License Expiry are required.');
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: dName.trim(),
      mobile: dMobile.trim(),
      licenseNumber: dLicense.trim(),
      licenseExpiry: dLicExp,
    };
    if (dBadge.trim()) payload.badgeNumber = dBadge.trim();
    if (dBadgeExp) payload.badgeExpiry = dBadgeExp;
    if (dPolice.trim()) payload.policeVerificationStatus = dPolice.trim();

    try {
      if (editId) {
        await apiRequest(`${BFF_DRIVERS}/${editId}`, {
          method: 'PATCH', body: JSON.stringify(payload), disableTenantValidation: true,
        });
        flash('success', 'Driver updated');
      } else {
        await apiRequest(BFF_DRIVERS, {
          method: 'POST', body: JSON.stringify(payload), disableTenantValidation: true,
        });
        flash('success', 'Driver created');
      }
      setPanelOpen(false);
      loadDrivers();
    } catch { flash('error', 'Failed to save driver'); }
    setSaving(false);
  };

  const saveAttendant = async () => {
    if (!aName.trim() || !aMobile.trim()) {
      flash('error', 'Name and Mobile are required.');
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: aName.trim(),
      mobile: aMobile.trim(),
    };
    if (aPolice.trim()) payload.policeVerificationStatus = aPolice.trim();

    try {
      if (editId) {
        await apiRequest(`${BFF_ATTENDANTS}/${editId}`, {
          method: 'PATCH', body: JSON.stringify(payload), disableTenantValidation: true,
        });
        flash('success', 'Attendant updated');
      } else {
        await apiRequest(BFF_ATTENDANTS, {
          method: 'POST', body: JSON.stringify(payload), disableTenantValidation: true,
        });
        flash('success', 'Attendant created');
      }
      setPanelOpen(false);
      loadAttendants();
    } catch { flash('error', 'Failed to save attendant'); }
    setSaving(false);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const deleteDriver = async (id: string) => {
    if (!confirm('Delete this driver?')) return;
    try {
      await apiRequest(`${BFF_DRIVERS}/${id}`, { method: 'DELETE', disableTenantValidation: true });
      flash('success', 'Driver deleted');
      loadDrivers();
    } catch { flash('error', 'Failed to delete driver'); }
  };

  const deleteAttendant = async (id: string) => {
    if (!confirm('Delete this attendant?')) return;
    try {
      await apiRequest(`${BFF_ATTENDANTS}/${id}`, { method: 'DELETE', disableTenantValidation: true });
      flash('success', 'Attendant deleted');
      loadAttendants();
    } catch { flash('error', 'Failed to delete attendant'); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AuthGuard>
      {() => (
        <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
          {/* Toast */}
          {toast && (
            <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}>
              {toast.text}
            </div>
          )}

          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Transport Staff</h1>
                <p className="text-sm text-slate-500 mt-1">Manage drivers and attendants for transport operations.</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-200 rounded-lg p-1 w-fit">
              {(['drivers', 'attendants'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setPanelOpen(false); }}
                  className={`px-5 py-2 text-sm font-medium rounded-md transition-colors ${
                    tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t === 'drivers' ? `Drivers (${drivers.length})` : `Attendants (${attendants.length})`}
                </button>
              ))}
            </div>

            {loading && <p className="text-sm text-slate-500 py-8 text-center">Loading...</p>}

            {/* ── Drivers Tab ──────────────────────────────────────────────── */}
            {!loading && tab === 'drivers' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-700">Drivers</h2>
                  <button
                    onClick={openAddDriver}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                    + Add Driver
                  </button>
                </div>

                {drivers.length === 0 && (
                  <p className="text-sm text-slate-500 py-6 text-center">No drivers yet. Click &quot;+ Add Driver&quot; to get started.</p>
                )}

                {drivers.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {drivers.map((d) => (
                      <div key={d.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-slate-800">{d.name}</h3>
                            <p className="text-sm text-slate-500">{d.mobile}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            d.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {d.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className="mt-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">License</span>
                            <span className="text-slate-700 font-mono text-xs">{d.licenseNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">License Exp</span>
                            <span className={`font-medium ${isExpired(d.licenseExpiry) ? 'text-red-600' : expirySoon(d.licenseExpiry) ? 'text-amber-600' : 'text-slate-700'}`}>
                              {fmtDate(d.licenseExpiry)}
                            </span>
                          </div>
                          {d.badgeNumber && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Badge</span>
                              <span className="text-slate-700">{d.badgeNumber}</span>
                            </div>
                          )}
                          {d.badgeExpiry && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Badge Exp</span>
                              <span className={`font-medium ${isExpired(d.badgeExpiry) ? 'text-red-600' : expirySoon(d.badgeExpiry) ? 'text-amber-600' : 'text-slate-700'}`}>
                                {fmtDate(d.badgeExpiry)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-500">Police Verification</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              d.policeVerificationStatus === 'Verified' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {d.policeVerificationStatus ?? 'Pending'}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                          <button onClick={() => openEditDriver(d)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                          <button onClick={() => deleteDriver(d.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Attendants Tab ───────────────────────────────────────────── */}
            {!loading && tab === 'attendants' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-700">Attendants</h2>
                  <button
                    onClick={openAddAttendant}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                    + Add Attendant
                  </button>
                </div>

                {attendants.length === 0 && (
                  <p className="text-sm text-slate-500 py-6 text-center">No attendants yet. Click &quot;+ Add Attendant&quot; to get started.</p>
                )}

                {attendants.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {attendants.map((a) => (
                      <div key={a.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-slate-800">{a.name}</h3>
                            <p className="text-sm text-slate-500">{a.mobile}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            a.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {a.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className="mt-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Police Verification</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              a.policeVerificationStatus === 'Verified' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {a.policeVerificationStatus ?? 'Pending'}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                          <button onClick={() => openEditAttendant(a)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                          <button onClick={() => deleteAttendant(a.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Slide-out Panel ────────────────────────────────────────────── */}
          {panelOpen && (
            <div className="fixed inset-0 z-40 flex justify-end">
              <div className="absolute inset-0 bg-black/30" onClick={() => setPanelOpen(false)} />
              <div className="relative w-full max-w-md bg-white shadow-xl overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">
                    {editId ? 'Edit' : 'Add'} {tab === 'drivers' ? 'Driver' : 'Attendant'}
                  </h3>
                  <button onClick={() => setPanelOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                </div>

                <div className="px-6 py-4 space-y-4">
                  {tab === 'drivers' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                        <input type="text" value={dName} onChange={(e) => setDName(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mobile *</label>
                        <input type="text" value={dMobile} onChange={(e) => setDMobile(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">License Number *</label>
                        <input type="text" value={dLicense} onChange={(e) => setDLicense(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">License Expiry *</label>
                        <input type="date" value={dLicExp} onChange={(e) => setDLicExp(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Badge Number</label>
                        <input type="text" value={dBadge} onChange={(e) => setDBadge(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Badge Expiry</label>
                        <input type="date" value={dBadgeExp} onChange={(e) => setDBadgeExp(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Police Verification Status</label>
                        <select value={dPolice} onChange={(e) => setDPolice(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300">
                          <option value="">Select...</option>
                          <option value="Verified">Verified</option>
                          <option value="Pending">Pending</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                        <input type="text" value={aName} onChange={(e) => setAName(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mobile *</label>
                        <input type="text" value={aMobile} onChange={(e) => setAMobile(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Police Verification Status</label>
                        <select value={aPolice} onChange={(e) => setAPolice(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300">
                          <option value="">Select...</option>
                          <option value="Verified">Verified</option>
                          <option value="Pending">Pending</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
                  <button onClick={() => setPanelOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                    Cancel
                  </button>
                  <button
                    onClick={tab === 'drivers' ? saveDriver : saveAttendant}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AuthGuard>
  );
}
