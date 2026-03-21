'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { apiRequest } from '../../../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface Vehicle {
  id: string;
  registrationNo: string;
  vehicleType: string;
  capacity: number;
  fitnessCertificateNo: string | null;
  fitnessExpiryDate: string | null;
  insurancePolicyNo: string | null;
  insuranceExpiryDate: string | null;
  pucCertificateNo: string | null;
  pucExpiryDate: string | null;
  permitNo: string | null;
  permitExpiryDate: string | null;
  lastServiceDate: string | null;
  nextServiceDue: string | null;
  odometerReading: number | null;
  gpsDeviceId: string | null;
  cctvInstalled: boolean;
  fireExtinguisherAvailable: boolean;
  firstAidAvailable: boolean;
  isActive: boolean;
}

const BFF = '/api/web-admin/transport/vehicles';
const VEHICLE_TYPES = ['Bus', 'Minivan', 'Winger', 'Van', 'Auto'];

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
  const diff = (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

function ExpiryBadge({ label, date }: { label: string; date: string | null }) {
  if (!date) return <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">{label}: N/A</span>;
  const expired = isExpired(date);
  const soon = expirySoon(date);
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
      expired ? 'bg-red-100 text-red-700' : soon ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
    }`}>
      {label}: {fmtDate(date)}
    </span>
  );
}

// ── Initial form state ───────────────────────────────────────────────────────

type VehicleForm = {
  registrationNo: string; vehicleType: string; capacity: string;
  fitnessCertificateNo: string; fitnessExpiryDate: string;
  insurancePolicyNo: string; insuranceExpiryDate: string;
  pucCertificateNo: string; pucExpiryDate: string;
  permitNo: string; permitExpiryDate: string;
  lastServiceDate: string; nextServiceDue: string;
  odometerReading: string; gpsDeviceId: string;
  cctvInstalled: boolean; fireExtinguisherAvailable: boolean; firstAidAvailable: boolean;
};

const emptyForm: VehicleForm = {
  registrationNo: '', vehicleType: 'Bus', capacity: '',
  fitnessCertificateNo: '', fitnessExpiryDate: '',
  insurancePolicyNo: '', insuranceExpiryDate: '',
  pucCertificateNo: '', pucExpiryDate: '',
  permitNo: '', permitExpiryDate: '',
  lastServiceDate: '', nextServiceDue: '',
  odometerReading: '', gpsDeviceId: '',
  cctvInstalled: false, fireExtinguisherAvailable: false, firstAidAvailable: false,
};

function vehicleToForm(v: Vehicle): VehicleForm {
  return {
    registrationNo: v.registrationNo,
    vehicleType: v.vehicleType,
    capacity: String(v.capacity),
    fitnessCertificateNo: v.fitnessCertificateNo ?? '',
    fitnessExpiryDate: v.fitnessExpiryDate?.slice(0, 10) ?? '',
    insurancePolicyNo: v.insurancePolicyNo ?? '',
    insuranceExpiryDate: v.insuranceExpiryDate?.slice(0, 10) ?? '',
    pucCertificateNo: v.pucCertificateNo ?? '',
    pucExpiryDate: v.pucExpiryDate?.slice(0, 10) ?? '',
    permitNo: v.permitNo ?? '',
    permitExpiryDate: v.permitExpiryDate?.slice(0, 10) ?? '',
    lastServiceDate: v.lastServiceDate?.slice(0, 10) ?? '',
    nextServiceDue: v.nextServiceDue?.slice(0, 10) ?? '',
    odometerReading: v.odometerReading != null ? String(v.odometerReading) : '',
    gpsDeviceId: v.gpsDeviceId ?? '',
    cctvInstalled: v.cctvInstalled,
    fireExtinguisherAvailable: v.fireExtinguisherAvailable,
    firstAidAvailable: v.firstAidAvailable,
  };
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function FleetManagementPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const flash = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Vehicle[]>(BFF, { disableTenantValidation: true });
      setVehicles(data);
    } catch { flash('error', 'Failed to load vehicles'); }
    setLoading(false);
  }, [flash]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const set = (field: keyof VehicleForm, val: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  const openAdd = () => { setEditId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (v: Vehicle) => { setEditId(v.id); setForm(vehicleToForm(v)); setModalOpen(true); };

  const save = async () => {
    if (!form.registrationNo.trim() || !form.vehicleType || !form.capacity) {
      flash('error', 'Registration No, Type, and Capacity are required.');
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      registrationNo: form.registrationNo.trim(),
      vehicleType: form.vehicleType,
      capacity: parseInt(form.capacity, 10),
    };
    // Only send non-empty compliance fields
    if (form.fitnessCertificateNo) payload.fitnessCertificateNo = form.fitnessCertificateNo;
    if (form.fitnessExpiryDate) payload.fitnessExpiryDate = form.fitnessExpiryDate;
    if (form.insurancePolicyNo) payload.insurancePolicyNo = form.insurancePolicyNo;
    if (form.insuranceExpiryDate) payload.insuranceExpiryDate = form.insuranceExpiryDate;
    if (form.pucCertificateNo) payload.pucCertificateNo = form.pucCertificateNo;
    if (form.pucExpiryDate) payload.pucExpiryDate = form.pucExpiryDate;
    if (form.permitNo) payload.permitNo = form.permitNo;
    if (form.permitExpiryDate) payload.permitExpiryDate = form.permitExpiryDate;
    if (form.lastServiceDate) payload.lastServiceDate = form.lastServiceDate;
    if (form.nextServiceDue) payload.nextServiceDue = form.nextServiceDue;
    if (form.odometerReading) payload.odometerReading = parseInt(form.odometerReading, 10);
    if (form.gpsDeviceId) payload.gpsDeviceId = form.gpsDeviceId;
    payload.cctvInstalled = form.cctvInstalled;
    payload.fireExtinguisherAvailable = form.fireExtinguisherAvailable;
    payload.firstAidAvailable = form.firstAidAvailable;

    try {
      if (editId) {
        await apiRequest(`${BFF}/${editId}`, { method: 'PATCH', body: JSON.stringify(payload), disableTenantValidation: true });
        flash('success', 'Vehicle updated');
      } else {
        await apiRequest(BFF, { method: 'POST', body: JSON.stringify(payload), disableTenantValidation: true });
        flash('success', 'Vehicle created');
      }
      setModalOpen(false);
      loadVehicles();
    } catch { flash('error', 'Failed to save vehicle'); }
    setSaving(false);
  };

  const deleteVehicle = async (id: string) => {
    if (!confirm('Delete this vehicle?')) return;
    try {
      await apiRequest(`${BFF}/${id}`, { method: 'DELETE', disableTenantValidation: true });
      flash('success', 'Vehicle deleted');
      loadVehicles();
    } catch { flash('error', 'Failed to delete vehicle'); }
  };

  return (
    <AuthGuard>
      {() => (
        <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
          {toast && (
            <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}>
              {toast.text}
            </div>
          )}

          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Fleet Management</h1>
                <p className="text-sm text-slate-500 mt-1">Manage school transport vehicles, compliance, and safety equipment.</p>
              </div>
              <button onClick={openAdd}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                + Add Vehicle
              </button>
            </div>

            {loading && <p className="text-sm text-slate-500 py-8 text-center">Loading vehicles...</p>}

            {!loading && vehicles.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-500">No vehicles yet. Click &quot;+ Add Vehicle&quot; to register your fleet.</p>
              </div>
            )}

            {!loading && vehicles.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Reg No</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">Seats</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Compliance</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">Safety</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                        <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map((v) => (
                        <tr key={v.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono font-semibold text-slate-800">{v.registrationNo}</td>
                          <td className="px-4 py-3 text-slate-600">{v.vehicleType}</td>
                          <td className="px-4 py-3 text-center text-slate-700">{v.capacity}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              <ExpiryBadge label="Fitness" date={v.fitnessExpiryDate} />
                              <ExpiryBadge label="Insurance" date={v.insuranceExpiryDate} />
                              <ExpiryBadge label="PUC" date={v.pucExpiryDate} />
                              <ExpiryBadge label="Permit" date={v.permitExpiryDate} />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              {v.gpsDeviceId && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">GPS</span>
                              )}
                              {v.cctvInstalled && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">CCTV</span>
                              )}
                              {v.fireExtinguisherAvailable && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-medium">Fire Ext</span>
                              )}
                              {v.firstAidAvailable && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">First Aid</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              v.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {v.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openEdit(v)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mr-3">Edit</button>
                            <button onClick={() => deleteVehicle(v.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── Add/Edit Modal ─────────────────────────────────────────────── */}
          {modalOpen && (
            <div className="fixed inset-0 z-40 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30" onClick={() => setModalOpen(false)} />
              <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
                  <h3 className="text-lg font-semibold text-slate-800">{editId ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
                  <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                </div>

                <div className="px-6 py-4 space-y-5">
                  {/* Basic Info */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Basic Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Registration No *</label>
                        <input type="text" value={form.registrationNo} onChange={(e) => set('registrationNo', e.target.value)}
                          placeholder="e.g. TS-07-UA-1234"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Type *</label>
                        <select value={form.vehicleType} onChange={(e) => set('vehicleType', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300">
                          {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Capacity (Seats) *</label>
                        <input type="number" min="1" value={form.capacity} onChange={(e) => set('capacity', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                    </div>
                  </div>

                  {/* Compliance */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Compliance &amp; Legal</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { label: 'Fitness Certificate No', field: 'fitnessCertificateNo' as const, dateField: 'fitnessExpiryDate' as const },
                        { label: 'Insurance Policy No', field: 'insurancePolicyNo' as const, dateField: 'insuranceExpiryDate' as const },
                        { label: 'PUC Certificate No', field: 'pucCertificateNo' as const, dateField: 'pucExpiryDate' as const },
                        { label: 'Permit No', field: 'permitNo' as const, dateField: 'permitExpiryDate' as const },
                      ].map(({ label, field, dateField }) => (
                        <div key={field} className="space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                            <input type="text" value={form[field] as string} onChange={(e) => set(field, e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
                            <input type="date" value={form[dateField] as string} onChange={(e) => set(dateField, e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Maintenance */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Maintenance</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Last Service Date</label>
                        <input type="date" value={form.lastServiceDate} onChange={(e) => set('lastServiceDate', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Next Service Due</label>
                        <input type="date" value={form.nextServiceDue} onChange={(e) => set('nextServiceDue', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Odometer (km)</label>
                        <input type="number" min="0" value={form.odometerReading} onChange={(e) => set('odometerReading', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                    </div>
                  </div>

                  {/* Safety */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Safety Equipment</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">GPS Device ID</label>
                        <input type="text" value={form.gpsDeviceId} onChange={(e) => set('gpsDeviceId', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-6 mt-3">
                      {[
                        { label: 'CCTV Installed', field: 'cctvInstalled' as const },
                        { label: 'Fire Extinguisher', field: 'fireExtinguisherAvailable' as const },
                        { label: 'First Aid Kit', field: 'firstAidAvailable' as const },
                      ].map(({ label, field }) => (
                        <label key={field} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form[field] as boolean}
                            onChange={(e) => set(field, e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                          <span className="text-sm text-slate-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3 rounded-b-xl">
                  <button onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                    Cancel
                  </button>
                  <button onClick={save} disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
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
