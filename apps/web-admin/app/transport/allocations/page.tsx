'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { apiRequest } from '../../../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  status: string;
  enrollments: {
    class: { name: string };
    section: { name: string };
    academicYear: { id: string; name: string };
  }[];
}

interface TripLookup {
  id: string;
  tripType: string;
  startTime: string;
  endTime: string;
  vehicleId: string | null;
  vehicle: { capacity: number; registrationNo: string } | null;
}

interface StopLookup {
  id: string;
  sequence: number;
  pickupTime: string | null;
  dropTime: string | null;
  stop: { id: string; name: string };
}

interface RouteLookup {
  id: string;
  code: string;
  name: string;
  trips: TripLookup[];
  stops: StopLookup[];
}

interface AcademicYearLookup {
  id: string;
  name: string;
  isActive: boolean;
}

interface Allocation {
  id: string;
  studentId: string;
  isActive: boolean;
  startDate: string;
  endDate: string | null;
  student: { id: string; admissionNumber: string; firstName: string; lastName: string | null; status: string };
  academicYear: { id: string; name: string };
  route: { id: string; code: string; name: string };
  pickupTrip: { id: string; tripType: string; startTime: string; endTime: string };
  pickupStop: { id: string; sequence: number; pickupTime: string | null; stop: { name: string } };
  dropTrip: { id: string; tripType: string; startTime: string; endTime: string };
  dropStop: { id: string; sequence: number; dropTime: string | null; stop: { name: string } };
}

// ── Constants ────────────────────────────────────────────────────────────────

const BFF = '/api/web-admin/transport-allocations';

// ── Main Page ────────────────────────────────────────────────────────────────

export default function StudentAllocationsPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [routes, setRoutes] = useState<RouteLookup[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearLookup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [searchQ, setSearchQ] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [formRouteId, setFormRouteId] = useState('');
  const [formPickupTripId, setFormPickupTripId] = useState('');
  const [formPickupStopId, setFormPickupStopId] = useState('');
  const [formDropTripId, setFormDropTripId] = useState('');
  const [formDropStopId, setFormDropStopId] = useState('');
  const [formAcademicYearId, setFormAcademicYearId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedRoute = routes.find((r) => r.id === formRouteId);
  const routeTrips = selectedRoute?.trips ?? [];
  const routeStops = selectedRoute?.stops ?? [];

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadAllocations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Allocation[]>(BFF, { disableTenantValidation: true });
      setAllocations(data);
    } catch { flash('Failed to load allocations', 'err'); }
    setLoading(false);
  }, []);

  const loadLookup = useCallback(async () => {
    try {
      const data = await apiRequest<{ routes: RouteLookup[]; academicYears: AcademicYearLookup[] }>(
        `${BFF}/lookup`, { disableTenantValidation: true },
      );
      setRoutes(data.routes);
      setAcademicYears(data.academicYears);
      // Auto-select active academic year
      const active = data.academicYears.find((y) => y.isActive);
      if (active) setFormAcademicYearId(active.id);
    } catch { flash('Failed to load lookup data', 'err'); }
  }, []);

  const searchStudents = useCallback(async (q: string) => {
    setSearchLoading(true);
    try {
      const data = await apiRequest<Student[]>(
        `${BFF}/students?q=${encodeURIComponent(q)}`, { disableTenantValidation: true },
      );
      setStudents(data);
    } catch { flash('Failed to search students', 'err'); }
    setSearchLoading(false);
  }, []);

  useEffect(() => { loadAllocations(); loadLookup(); }, [loadAllocations, loadLookup]);

  // Debounced student search
  useEffect(() => {
    if (searchQ.length < 2) { setStudents([]); return; }
    const t = setTimeout(() => searchStudents(searchQ), 350);
    return () => clearTimeout(t);
  }, [searchQ, searchStudents]);

  // ── Toast helper ───────────────────────────────────────────────────────────

  function flash(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Form Reset ─────────────────────────────────────────────────────────────

  function resetForm() {
    setSelectedStudent(null);
    setFormRouteId('');
    setFormPickupTripId('');
    setFormPickupStopId('');
    setFormDropTripId('');
    setFormDropStopId('');
    setFormStartDate('');
    setFormEndDate('');
    setSearchQ('');
    setStudents([]);
  }

  // ── Save Allocation ────────────────────────────────────────────────────────

  async function handleSave() {
    if (!selectedStudent || !formRouteId || !formPickupTripId || !formPickupStopId ||
        !formDropTripId || !formDropStopId || !formAcademicYearId || !formStartDate) {
      flash('Please fill all required fields.', 'err');
      return;
    }
    setSaving(true);
    try {
      await apiRequest(BFF, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          academicYearId: formAcademicYearId,
          routeId: formRouteId,
          pickupTripId: formPickupTripId,
          pickupStopId: formPickupStopId,
          dropTripId: formDropTripId,
          dropStopId: formDropStopId,
          startDate: formStartDate,
          endDate: formEndDate || undefined,
        }),
        disableTenantValidation: true,
      });
      flash('Allocation saved successfully!', 'ok');
      resetForm();
      loadAllocations();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save allocation';
      flash(msg, 'err');
    }
    setSaving(false);
  }

  // ── Revoke ─────────────────────────────────────────────────────────────────

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this transport allocation?')) return;
    try {
      await apiRequest(`${BFF}/${id}`, { method: 'DELETE', disableTenantValidation: true });
      flash('Allocation revoked.', 'ok');
      loadAllocations();
    } catch { flash('Failed to revoke allocation.', 'err'); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AuthGuard>
      {() => (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Student Transport Allocations</h1>

        {/* ── Toast ──────────────────────────────────────────────────────── */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.msg}
          </div>
        )}

        {/* ── Allocation Form ────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">New Allocation</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Left: Student Search ─────────────────────────────────── */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Search Student</label>
              <input
                type="text"
                placeholder="Type name or admission no (min 2 chars)…"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />

              {searchLoading && <p className="text-xs text-slate-400 mt-1">Searching…</p>}

              {students.length > 0 && !selectedStudent && (
                <ul className="mt-2 border rounded-lg max-h-52 overflow-y-auto divide-y text-sm">
                  {students.map((s) => (
                    <li key={s.id}
                      className="px-3 py-2 hover:bg-sky-50 cursor-pointer flex justify-between items-center"
                      onClick={() => { setSelectedStudent(s); setStudents([]); setSearchQ(''); }}>
                      <span className="font-medium text-slate-700">
                        {s.firstName} {s.lastName ?? ''}
                      </span>
                      <span className="text-xs text-slate-400">
                        {s.admissionNumber}
                        {s.enrollments[0] && ` · ${s.enrollments[0].class.name} ${s.enrollments[0].section.name}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {selectedStudent && (
                <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-sky-800">
                      {selectedStudent.firstName} {selectedStudent.lastName ?? ''}
                    </p>
                    <p className="text-xs text-sky-600">
                      {selectedStudent.admissionNumber}
                      {selectedStudent.enrollments[0] &&
                        ` · ${selectedStudent.enrollments[0].class.name} ${selectedStudent.enrollments[0].section.name}`}
                    </p>
                  </div>
                  <button className="text-xs text-red-500 hover:underline" onClick={() => setSelectedStudent(null)}>
                    Clear
                  </button>
                </div>
              )}

              {/* Academic Year */}
              <label className="block text-sm font-medium text-slate-600 mt-4 mb-1">Academic Year</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={formAcademicYearId}
                onChange={(e) => setFormAcademicYearId(e.target.value)}>
                <option value="">Select…</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (Active)' : ''}</option>
                ))}
              </select>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Start Date *</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">End Date</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── Right: Route / Trip / Stop Selectors ─────────────────── */}
            <div>
              {/* Route */}
              <label className="block text-sm font-medium text-slate-600 mb-1">Route *</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={formRouteId}
                onChange={(e) => {
                  setFormRouteId(e.target.value);
                  setFormPickupTripId(''); setFormPickupStopId('');
                  setFormDropTripId(''); setFormDropStopId('');
                }}>
                <option value="">Select route…</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
                ))}
              </select>

              {/* Pickup Trip */}
              <label className="block text-sm font-medium text-slate-600 mt-4 mb-1">Pickup Trip *</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={formPickupTripId}
                onChange={(e) => setFormPickupTripId(e.target.value)}
                disabled={!formRouteId}>
                <option value="">Select pickup trip…</option>
                {routeTrips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tripType} ({t.startTime}–{t.endTime})
                    {t.vehicle ? ` · ${t.vehicle.registrationNo} (${t.vehicle.capacity} seats)` : ' · No vehicle'}
                  </option>
                ))}
              </select>

              {/* Pickup Stop */}
              <label className="block text-sm font-medium text-slate-600 mt-4 mb-1">Pickup Stop *</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={formPickupStopId}
                onChange={(e) => setFormPickupStopId(e.target.value)}
                disabled={!formRouteId}>
                <option value="">Select pickup stop…</option>
                {routeStops.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.sequence} {s.stop.name}{s.pickupTime ? ` (${s.pickupTime})` : ''}
                  </option>
                ))}
              </select>

              {/* Drop Trip */}
              <label className="block text-sm font-medium text-slate-600 mt-4 mb-1">Drop Trip *</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={formDropTripId}
                onChange={(e) => setFormDropTripId(e.target.value)}
                disabled={!formRouteId}>
                <option value="">Select drop trip…</option>
                {routeTrips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tripType} ({t.startTime}–{t.endTime})
                    {t.vehicle ? ` · ${t.vehicle.registrationNo} (${t.vehicle.capacity} seats)` : ' · No vehicle'}
                  </option>
                ))}
              </select>

              {/* Drop Stop */}
              <label className="block text-sm font-medium text-slate-600 mt-4 mb-1">Drop Stop *</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={formDropStopId}
                onChange={(e) => setFormDropStopId(e.target.value)}
                disabled={!formRouteId}>
                <option value="">Select drop stop…</option>
                {routeStops.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.sequence} {s.stop.name}{s.dropTime ? ` (${s.dropTime})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Save Button ─────────────────────────────────────────────── */}
          <div className="mt-6 flex justify-end gap-3">
            <button className="px-4 py-2 text-sm rounded-lg border text-slate-600 hover:bg-slate-50"
              onClick={resetForm}>
              Reset
            </button>
            <button
              className="px-5 py-2 text-sm rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50"
              disabled={saving || !selectedStudent || !formRouteId || !formPickupTripId || !formPickupStopId ||
                        !formDropTripId || !formDropStopId || !formAcademicYearId || !formStartDate}
              onClick={handleSave}>
              {saving ? 'Saving…' : 'Save Allocation'}
            </button>
          </div>
        </div>

        {/* ── Allocations Data Grid ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-700">
              Current Allocations {!loading && <span className="text-sm text-slate-400 font-normal">({allocations.length})</span>}
            </h2>
          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-400">Loading…</div>
          ) : allocations.length === 0 ? (
            <div className="p-10 text-center text-slate-400">No allocations found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Adm #</th>
                    <th className="px-4 py-3">Year</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Pickup</th>
                    <th className="px-4 py-3">Drop</th>
                    <th className="px-4 py-3">Start</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allocations.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {a.student.firstName} {a.student.lastName ?? ''}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{a.student.admissionNumber}</td>
                      <td className="px-4 py-3 text-slate-500">{a.academicYear.name}</td>
                      <td className="px-4 py-3 text-slate-600">{a.route.code} — {a.route.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-slate-600">{a.pickupStop.stop.name}</span>
                        <span className="text-xs text-slate-400 ml-1">
                          ({a.pickupTrip.tripType} {a.pickupStop.pickupTime ?? a.pickupTrip.startTime})
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-600">{a.dropStop.stop.name}</span>
                        <span className="text-xs text-slate-400 ml-1">
                          ({a.dropTrip.tripType} {a.dropStop.dropTime ?? a.dropTrip.startTime})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(a.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          a.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {a.isActive ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.isActive && (
                          <button className="text-xs text-red-600 hover:underline font-medium"
                            onClick={() => handleRevoke(a.id)}>
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}
    </AuthGuard>
  );
}
