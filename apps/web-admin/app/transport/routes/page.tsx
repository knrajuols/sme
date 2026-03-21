'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { apiRequest } from '../../../lib/api';

// ── Shared constants ─────────────────────────────────────────────────────────

const STOPS_BFF = '/api/web-admin/transport/stops';
const ROUTES_BFF = '/api/web-admin/transport/routes';
const DRIVERS_BFF = '/api/web-admin/transport/staff/drivers';
const ATTENDANTS_BFF = '/api/web-admin/transport/staff/attendants';
const VEHICLES_BFF = '/api/web-admin/transport/vehicles';

// ── Types ────────────────────────────────────────────────────────────────────

interface Stop { id: string; name: string; landmark: string | null; latitude: number | null; longitude: number | null; }

interface TripVehicle { id: string; registrationNo: string; vehicleType: string; }
interface TripPerson { id: string; name: string; }
interface RouteTrip {
  id: string; tripType: string; startTime: string; endTime: string;
  vehicleId: string | null; driverId: string | null; attendantId: string | null;
  vehicle: TripVehicle | null; driver: TripPerson | null; attendant: TripPerson | null;
}
interface RouteStop {
  id: string; sequence: number; distanceKm: number | null;
  pickupTime: string | null; dropTime: string | null;
  stopId: string; stop: { id: string; name: string; landmark: string | null; };
}
interface TransportRoute {
  id: string; code: string; name: string; description: string | null;
  trips: RouteTrip[]; stops: RouteStop[];
}
interface DriverRef { id: string; name: string; }
interface AttendantRef { id: string; name: string; }
interface VehicleRef { id: string; registrationNo: string; vehicleType: string; }

// ── Local form types ─────────────────────────────────────────────────────────

interface TripForm { id?: string; tripType: string; startTime: string; endTime: string; vehicleId: string; driverId: string; attendantId: string; }
interface StopForm { id?: string; stopId: string; sequence: string; distanceKm: string; pickupTime: string; dropTime: string; }

// ── Main Page ────────────────────────────────────────────────────────────────

export default function RoutesAndStopsPage() {
  const [tab, setTab] = useState<'stops' | 'routes'>('stops');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const flash = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  return (
    <AuthGuard>
      {() => (
        <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
          {toast && (
            <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}>{toast.text}</div>
          )}
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Routes &amp; Stops</h1>
              <p className="text-sm text-slate-500 mt-1">Manage bus stops and build transport routes with assigned trips.</p>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 bg-slate-200 rounded-lg p-1 w-fit">
              {(['stops', 'routes'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    tab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                  }`}>
                  {t === 'stops' ? 'Stop Master' : 'Route Builder'}
                </button>
              ))}
            </div>
            {tab === 'stops' ? <StopMaster flash={flash} /> : <RouteBuilder flash={flash} />}
          </div>
        </div>
      )}
    </AuthGuard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══  STOP MASTER  ═════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

function StopMaster({ flash }: { flash: (t: 'success' | 'error', m: string) => void }) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', landmark: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStops(await apiRequest<Stop[]>(STOPS_BFF, { disableTenantValidation: true })); }
    catch { flash('error', 'Failed to load stops'); }
    setLoading(false);
  }, [flash]);

  useEffect(() => { load(); }, [load]);

  const set = (f: 'name' | 'landmark', v: string) => setForm((p) => ({ ...p, [f]: v }));

  const openAdd = () => { setEditId(null); setForm({ name: '', landmark: '' }); setModalOpen(true); };
  const openEdit = (s: Stop) => { setEditId(s.id); setForm({ name: s.name, landmark: s.landmark ?? '' }); setModalOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { flash('error', 'Stop name is required.'); return; }
    setSaving(true);
    const payload: Record<string, string> = { name: form.name.trim() };
    if (form.landmark.trim()) payload.landmark = form.landmark.trim();
    try {
      if (editId) {
        await apiRequest(`${STOPS_BFF}/${editId}`, { method: 'PATCH', body: JSON.stringify(payload), disableTenantValidation: true });
        flash('success', 'Stop updated');
      } else {
        await apiRequest(STOPS_BFF, { method: 'POST', body: JSON.stringify(payload), disableTenantValidation: true });
        flash('success', 'Stop created');
      }
      setModalOpen(false); load();
    } catch { flash('error', 'Failed to save stop'); }
    setSaving(false);
  };

  const del = async (id: string) => {
    if (!confirm('Delete this stop?')) return;
    try {
      await apiRequest(`${STOPS_BFF}/${id}`, { method: 'DELETE', disableTenantValidation: true });
      flash('success', 'Stop deleted'); load();
    } catch { flash('error', 'Failed to delete stop'); }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{stops.length} stop{stops.length !== 1 && 's'}</p>
        <button onClick={openAdd}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
          + Add Stop
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500 py-8 text-center">Loading...</p>}

      {!loading && stops.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">No stops defined. Add stops before building routes.</p>
        </div>
      )}

      {!loading && stops.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">#</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Landmark</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((s, i) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-2 text-slate-500">{s.landmark ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => openEdit(s)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mr-3">Edit</button>
                    <button onClick={() => del(s.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">{editId ? 'Edit Stop' : 'Add Stop'}</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Landmark</label>
              <input type="text" value={form.landmark} onChange={(e) => set('landmark', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══  ROUTE BUILDER  ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

function RouteBuilder({ flash }: { flash: (t: 'success' | 'error', m: string) => void }) {
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reference data for dropdowns
  const [drivers, setDrivers] = useState<DriverRef[]>([]);
  const [attendants, setAttendants] = useState<AttendantRef[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRef[]>([]);
  const [allStops, setAllStops] = useState<Stop[]>([]);

  // Detail panel state
  const [detailMode, setDetailMode] = useState<'view' | 'edit' | 'create'>('view');
  const [routeForm, setRouteForm] = useState({ code: '', name: '', description: '' });
  const [tripsForm, setTripsForm] = useState<TripForm[]>([]);
  const [stopsForm, setStopsForm] = useState<StopForm[]>([]);
  const [saving, setSaving] = useState(false);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    try { setRoutes(await apiRequest<TransportRoute[]>(ROUTES_BFF, { disableTenantValidation: true })); }
    catch { flash('error', 'Failed to load routes'); }
    setLoading(false);
  }, [flash]);

  const loadRefs = useCallback(async () => {
    try {
      const [d, a, v, s] = await Promise.all([
        apiRequest<DriverRef[]>(DRIVERS_BFF, { disableTenantValidation: true }),
        apiRequest<AttendantRef[]>(ATTENDANTS_BFF, { disableTenantValidation: true }),
        apiRequest<VehicleRef[]>(VEHICLES_BFF, { disableTenantValidation: true }),
        apiRequest<Stop[]>(STOPS_BFF, { disableTenantValidation: true }),
      ]);
      setDrivers(d); setAttendants(a); setVehicles(v); setAllStops(s);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { loadRoutes(); loadRefs(); }, [loadRoutes, loadRefs]);

  const selectedRoute = useMemo(() => routes.find((r) => r.id === selectedId) ?? null, [routes, selectedId]);

  // Populate edit form from selected route
  const startEdit = useCallback((r: TransportRoute) => {
    setRouteForm({ code: r.code, name: r.name, description: r.description ?? '' });
    setTripsForm(r.trips.map((t) => ({
      id: t.id, tripType: t.tripType, startTime: t.startTime, endTime: t.endTime,
      vehicleId: t.vehicleId ?? '', driverId: t.driverId ?? '', attendantId: t.attendantId ?? '',
    })));
    setStopsForm(r.stops.map((s) => ({
      id: s.id, stopId: s.stopId, sequence: String(s.sequence),
      distanceKm: s.distanceKm != null ? String(s.distanceKm) : '',
      pickupTime: s.pickupTime ?? '', dropTime: s.dropTime ?? '',
    })));
    setDetailMode('edit');
  }, []);

  const startCreate = () => {
    setSelectedId(null);
    setRouteForm({ code: '', name: '', description: '' });
    setTripsForm([{ tripType: 'MORNING', startTime: '07:00', endTime: '08:30', vehicleId: '', driverId: '', attendantId: '' }]);
    setStopsForm([]);
    setDetailMode('create');
  };

  // ── Save (create or update) ──────────────────────────────────────────────
  const save = async () => {
    if (!routeForm.code.trim() || !routeForm.name.trim()) {
      flash('error', 'Route code and name are required.'); return;
    }
    setSaving(true);
    const trips = tripsForm.map((t) => ({
      ...(t.id ? { id: t.id } : {}),
      tripType: t.tripType,
      startTime: t.startTime,
      endTime: t.endTime,
      vehicleId: t.vehicleId || null,
      driverId: t.driverId || null,
      attendantId: t.attendantId || null,
    }));
    const stops = stopsForm.map((s) => ({
      ...(s.id ? { id: s.id } : {}),
      stopId: s.stopId,
      sequence: parseInt(s.sequence, 10),
      distanceKm: s.distanceKm ? parseFloat(s.distanceKm) : null,
      pickupTime: s.pickupTime || null,
      dropTime: s.dropTime || null,
    }));

    try {
      if (detailMode === 'create') {
        const payload = { code: routeForm.code.trim(), name: routeForm.name.trim(), description: routeForm.description.trim() || undefined, trips, stops };
        const res = await apiRequest<{ id: string }>(ROUTES_BFF, { method: 'POST', body: JSON.stringify(payload), disableTenantValidation: true });
        flash('success', 'Route created');
        await loadRoutes();
        setSelectedId(res.id);
        setDetailMode('view');
      } else if (detailMode === 'edit' && selectedId) {
        const payload = { code: routeForm.code.trim(), name: routeForm.name.trim(), description: routeForm.description.trim() || undefined, trips, stops };
        await apiRequest(`${ROUTES_BFF}/${selectedId}`, { method: 'PUT', body: JSON.stringify(payload), disableTenantValidation: true });
        flash('success', 'Route saved');
        await loadRoutes();
        setDetailMode('view');
      }
    } catch { flash('error', 'Failed to save route'); }
    setSaving(false);
  };

  const deleteRoute = async () => {
    if (!selectedId || !confirm('Delete this route and all its trips/stops?')) return;
    try {
      await apiRequest(`${ROUTES_BFF}/${selectedId}`, { method: 'DELETE', disableTenantValidation: true });
      flash('success', 'Route deleted');
      setSelectedId(null); setDetailMode('view');
      loadRoutes();
    } catch { flash('error', 'Failed to delete route'); }
  };

  // ── Trip helpers ─────────────────────────────────────────────────────────
  const addTrip = () => setTripsForm((p) => [...p, { tripType: 'EVENING', startTime: '14:00', endTime: '15:30', vehicleId: '', driverId: '', attendantId: '' }]);
  const removeTrip = (i: number) => setTripsForm((p) => p.filter((_, idx) => idx !== i));
  const setTrip = (i: number, field: keyof TripForm, val: string) =>
    setTripsForm((p) => p.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  // ── Stop helpers ─────────────────────────────────────────────────────────
  const addStop = () => {
    const next = stopsForm.length + 1;
    setStopsForm((p) => [...p, { stopId: '', sequence: String(next), distanceKm: '', pickupTime: '', dropTime: '' }]);
  };
  const removeStop = (i: number) => setStopsForm((p) => p.filter((_, idx) => idx !== i));
  const setStop = (i: number, field: keyof StopForm, val: string) =>
    setStopsForm((p) => p.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  const moveStop = (i: number, dir: -1 | 1) => {
    setStopsForm((prev) => {
      const copy = [...prev];
      const j = i + dir;
      if (j < 0 || j >= copy.length) return prev;
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy.map((s, idx) => ({ ...s, sequence: String(idx + 1) }));
    });
  };

  const isEditing = detailMode === 'edit' || detailMode === 'create';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Left: Route List ────────────────────────────────────────────── */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="font-semibold text-slate-700 text-sm">Routes ({routes.length})</h3>
            <button onClick={startCreate}
              className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-md hover:bg-indigo-700">
              + New
            </button>
          </div>
          {loading && <p className="text-sm text-slate-500 p-4 text-center">Loading...</p>}
          {!loading && routes.length === 0 && (
            <p className="text-sm text-slate-400 p-4 text-center">No routes yet.</p>
          )}
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
            {routes.map((r) => (
              <button key={r.id} onClick={() => { setSelectedId(r.id); setDetailMode('view'); }}
                className={`w-full text-left px-4 py-3 hover:bg-indigo-50/50 transition-colors ${
                  selectedId === r.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
                }`}>
                <p className="font-mono text-xs text-indigo-600 font-semibold">{r.code}</p>
                <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {r.trips.length} trip{r.trips.length !== 1 && 's'} &middot; {r.stops.length} stop{r.stops.length !== 1 && 's'}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Detail Panel ────────────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-4">
        {!selectedRoute && detailMode === 'view' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-slate-400 text-sm">Select a route from the list or create a new one.</p>
          </div>
        )}

        {(selectedRoute || detailMode === 'create') && (
          <>
            {/* Route Header */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  {detailMode === 'create' ? 'New Route' : selectedRoute?.name}
                </h3>
                <div className="flex gap-2">
                  {detailMode === 'view' && selectedRoute && (
                    <>
                      <button onClick={() => startEdit(selectedRoute)}
                        className="text-xs font-medium text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-md hover:bg-indigo-50">
                        Edit
                      </button>
                      <button onClick={deleteRoute}
                        className="text-xs font-medium text-red-500 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50">
                        Delete
                      </button>
                    </>
                  )}
                  {isEditing && (
                    <>
                      <button onClick={() => { setDetailMode('view'); if (detailMode === 'create') setSelectedId(null); }}
                        className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md hover:bg-slate-200">
                        Cancel
                      </button>
                      <button onClick={save} disabled={saving}
                        className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save Route'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Code *</label>
                    <input type="text" value={routeForm.code}
                      onChange={(e) => setRouteForm((p) => ({ ...p, code: e.target.value }))}
                      placeholder="e.g. RT-01"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                    <input type="text" value={routeForm.name}
                      onChange={(e) => setRouteForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Jubilee Hills Route"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                    <input type="text" value={routeForm.description}
                      onChange={(e) => setRouteForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
              ) : selectedRoute ? (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-slate-400 text-xs">Code</span><p className="font-mono font-semibold text-indigo-600">{selectedRoute.code}</p></div>
                  <div><span className="text-slate-400 text-xs">Name</span><p className="text-slate-800">{selectedRoute.name}</p></div>
                  <div><span className="text-slate-400 text-xs">Description</span><p className="text-slate-600">{selectedRoute.description || '—'}</p></div>
                </div>
              ) : null}
            </div>

            {/* ── Trips Section ──────────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Trips</h4>
                {isEditing && (
                  <button onClick={addTrip}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                    + Add Trip
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  {tripsForm.length === 0 && <p className="text-sm text-slate-400">No trips. Add at least one trip.</p>}
                  {tripsForm.map((t, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Trip #{i + 1}</span>
                        <button onClick={() => removeTrip(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Type</label>
                          <select value={t.tripType} onChange={(e) => setTrip(i, 'tripType', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                            <option value="MORNING">Morning</option>
                            <option value="EVENING">Evening</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Start</label>
                          <input type="time" value={t.startTime} onChange={(e) => setTrip(i, 'startTime', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">End</label>
                          <input type="time" value={t.endTime} onChange={(e) => setTrip(i, 'endTime', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Vehicle</label>
                          <select value={t.vehicleId} onChange={(e) => setTrip(i, 'vehicleId', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                            <option value="">— None —</option>
                            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNo} ({v.vehicleType})</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Driver</label>
                          <select value={t.driverId} onChange={(e) => setTrip(i, 'driverId', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                            <option value="">— None —</option>
                            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Attendant</label>
                          <select value={t.attendantId} onChange={(e) => setTrip(i, 'attendantId', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                            <option value="">— None —</option>
                            {attendants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedRoute ? (
                <div className="space-y-2">
                  {selectedRoute.trips.length === 0 && <p className="text-sm text-slate-400">No trips defined.</p>}
                  {selectedRoute.trips.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        t.tripType === 'MORNING' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>{t.tripType}</span>
                      <span className="text-slate-600">{t.startTime} – {t.endTime}</span>
                      {t.vehicle && <span className="text-xs bg-slate-200 rounded px-1.5 py-0.5 text-slate-600">{t.vehicle.registrationNo}</span>}
                      {t.driver && <span className="text-xs text-slate-500">Driver: {t.driver.name}</span>}
                      {t.attendant && <span className="text-xs text-slate-500">Att: {t.attendant.name}</span>}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* ── Stops Section ──────────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Route Stops</h4>
                {isEditing && (
                  <button onClick={addStop}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                    + Add Stop
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  {stopsForm.length === 0 && <p className="text-sm text-slate-400">No stops. Add stops to define the route path.</p>}
                  {stopsForm.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                      {/* Reorder */}
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveStop(i, -1)} disabled={i === 0}
                          className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30">&uarr;</button>
                        <button onClick={() => moveStop(i, 1)} disabled={i === stopsForm.length - 1}
                          className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30">&darr;</button>
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-6 text-center">{s.sequence}</span>
                      <select value={s.stopId} onChange={(e) => setStop(i, 'stopId', e.target.value)}
                        className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm min-w-0">
                        <option value="">— Select Stop —</option>
                        {allStops.map((st) => <option key={st.id} value={st.id}>{st.name}{st.landmark ? ` (${st.landmark})` : ''}</option>)}
                      </select>
                      <input type="number" min="0" step="0.1" value={s.distanceKm} onChange={(e) => setStop(i, 'distanceKm', e.target.value)}
                        placeholder="km" className="w-16 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                      <input type="time" value={s.pickupTime} onChange={(e) => setStop(i, 'pickupTime', e.target.value)}
                        title="Pickup Time" className="w-24 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                      <input type="time" value={s.dropTime} onChange={(e) => setStop(i, 'dropTime', e.target.value)}
                        title="Drop Time" className="w-24 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                      <button onClick={() => removeStop(i)} className="text-xs text-red-500 hover:text-red-700 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              ) : selectedRoute ? (
                <div className="space-y-1">
                  {selectedRoute.stops.length === 0 && <p className="text-sm text-slate-400">No stops defined.</p>}
                  {selectedRoute.stops.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 text-sm py-1.5">
                      <span className="w-6 h-6 flex items-center justify-center text-xs font-bold bg-indigo-100 text-indigo-700 rounded-full">{s.sequence}</span>
                      <span className="font-medium text-slate-800">{s.stop.name}</span>
                      {s.stop.landmark && <span className="text-xs text-slate-400">({s.stop.landmark})</span>}
                      {s.distanceKm != null && <span className="text-xs bg-slate-100 rounded px-1.5 py-0.5 text-slate-500">{s.distanceKm} km</span>}
                      {s.pickupTime && <span className="text-xs text-emerald-600">↑{s.pickupTime}</span>}
                      {s.dropTime && <span className="text-xs text-amber-600">↓{s.dropTime}</span>}
                      {i < (selectedRoute?.stops.length ?? 0) - 1 && (
                        <span className="text-slate-300 text-xs ml-auto">│</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
