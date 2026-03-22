'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

/** Grid row: student + optional active allocation */
interface StudentRow {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  enrollments: { class: { name: string }; section: { name: string } }[];
  transportAllocations: {
    id: string;
    routeId: string;
    route: { code: string; name: string };
    pickupTripId: string;
    pickupStopId: string;
    pickupStop: { stop: { name: string } };
    dropTripId: string;
    dropStopId: string;
    dropStop: { stop: { name: string } };
    academicYearId: string;
    startDate: string;
    endDate: string | null;
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

// ── Constants ────────────────────────────────────────────────────────────────

const BFF = '/api/web-admin/transport-allocations';

// ── Main Page ────────────────────────────────────────────────────────────────

export default function StudentAllocationsPage() {
  // ── State: Data ────────────────────────────────────────────────────────────
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [routes, setRoutes] = useState<RouteLookup[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearLookup[]>([]);

  // ── State: Grid ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');

  // ── State: Modal ───────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStudent, setModalStudent] = useState<StudentRow | null>(null);
  const [formRouteId, setFormRouteId] = useState('');
  const [formPickupTripId, setFormPickupTripId] = useState('');
  const [formPickupStopId, setFormPickupStopId] = useState('');
  const [formDropTripId, setFormDropTripId] = useState('');
  const [formDropStopId, setFormDropStopId] = useState('');
  const [formAcademicYearId, setFormAcademicYearId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  // ── State: Toast ───────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedRoute = routes.find((r) => r.id === formRouteId);
  const routeTrips = selectedRoute?.trips ?? [];
  const routeStops = selectedRoute?.stops ?? [];

  /** Existing allocation for the modal student (if any) */
  const existingAlloc = modalStudent?.transportAllocations?.[0] ?? null;

  /** Filtered students for the grid */
  const filteredStudents = useMemo(() => {
    if (!filterText) return students;
    const q = filterText.toLowerCase();
    return students.filter((s) => {
      const name = `${s.firstName} ${s.lastName ?? ''}`.toLowerCase();
      const cls = s.enrollments[0]
        ? `${s.enrollments[0].class.name} ${s.enrollments[0].section.name}`.toLowerCase()
        : '';
      return (
        name.includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        cls.includes(q)
      );
    });
  }, [students, filterText]);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bffFetch<StudentRow[]>(`${BFF}/students-grid`);
      setStudents(data);
    } catch {
      flash('Failed to load students', 'err');
    }
    setLoading(false);
  }, []);

  const loadLookup = useCallback(async () => {
    try {
      const data = await bffFetch<{ routes: RouteLookup[]; academicYears: AcademicYearLookup[] }>(
        `${BFF}/lookup`,
      );
      setRoutes(data.routes);
      setAcademicYears(data.academicYears);
    } catch {
      flash('Failed to load lookup data', 'err');
    }
  }, []);

  useEffect(() => {
    loadStudents();
    loadLookup();
  }, [loadStudents, loadLookup]);

  // ── Toast helper ───────────────────────────────────────────────────────────

  function flash(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openModal(student: StudentRow) {
    const alloc = student.transportAllocations?.[0] ?? null;
    const activeYear = academicYears.find((y) => y.isActive);

    setModalStudent(student);
    setFormRouteId(alloc?.routeId ?? '');
    setFormPickupTripId(alloc?.pickupTripId ?? '');
    setFormPickupStopId(alloc?.pickupStopId ?? '');
    setFormDropTripId(alloc?.dropTripId ?? '');
    setFormDropStopId(alloc?.dropStopId ?? '');
    setFormAcademicYearId(alloc?.academicYearId ?? activeYear?.id ?? '');
    setFormStartDate(alloc ? alloc.startDate.slice(0, 10) : '');
    setFormEndDate(alloc?.endDate ? alloc.endDate.slice(0, 10) : '');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalStudent(null);
    setFormRouteId('');
    setFormPickupTripId('');
    setFormPickupStopId('');
    setFormDropTripId('');
    setFormDropStopId('');
    setFormStartDate('');
    setFormEndDate('');
  }

  /** When route changes, reset trip & stop selections (cascade) */
  function handleRouteChange(routeId: string) {
    setFormRouteId(routeId);
    setFormPickupTripId('');
    setFormPickupStopId('');
    setFormDropTripId('');
    setFormDropStopId('');

    // Auto-select trips if exactly one of each type exists
    if (routeId) {
      const route = routes.find((r) => r.id === routeId);
      if (route) {
        const morningTrips = route.trips.filter((t) => t.tripType === 'MORNING');
        const eveningTrips = route.trips.filter((t) => t.tripType === 'EVENING');
        if (morningTrips.length === 1) setFormPickupTripId(morningTrips[0].id);
        else if (route.trips.length === 1) setFormPickupTripId(route.trips[0].id);
        if (eveningTrips.length === 1) setFormDropTripId(eveningTrips[0].id);
        else if (route.trips.length === 1) setFormDropTripId(route.trips[0].id);
      }
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (
      !modalStudent || !formRouteId || !formPickupTripId || !formPickupStopId ||
      !formDropTripId || !formDropStopId || !formAcademicYearId || !formStartDate
    ) {
      flash('Please fill all required fields.', 'err');
      return;
    }

    setSaving(true);
    try {
      if (existingAlloc) {
        // PATCH existing allocation
        await bffFetch(`${BFF}/${existingAlloc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeId: formRouteId,
            pickupTripId: formPickupTripId,
            pickupStopId: formPickupStopId,
            dropTripId: formDropTripId,
            dropStopId: formDropStopId,
            startDate: formStartDate,
            endDate: formEndDate || undefined,
          }),
        });
      } else {
        // POST new allocation
        await bffFetch(BFF, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: modalStudent.id,
            academicYearId: formAcademicYearId,
            routeId: formRouteId,
            pickupTripId: formPickupTripId,
            pickupStopId: formPickupStopId,
            dropTripId: formDropTripId,
            dropStopId: formDropStopId,
            startDate: formStartDate,
            endDate: formEndDate || undefined,
          }),
        });
      }

      flash(existingAlloc ? 'Allocation updated!' : 'Allocation saved!', 'ok');
      closeModal();
      loadStudents();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save allocation';
      flash(msg, 'err');
    }
    setSaving(false);
  }

  // ── Revoke ─────────────────────────────────────────────────────────────────

  async function handleRevoke(allocId: string) {
    if (!confirm('Revoke this transport allocation?')) return;
    try {
      await bffFetch(`${BFF}/${allocId}`, { method: 'DELETE' });
      flash('Allocation revoked.', 'ok');
      loadStudents();
    } catch {
      flash('Failed to revoke allocation.', 'err');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AuthGuard>
      {() => (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 p-4 sm:p-6">
          {/* ── Toast ──────────────────────────────────────────────────── */}
          {toast && (
            <div
              role="status"
              className={`fixed top-4 right-4 z-[60] px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
                toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
              }`}
            >
              {toast.msg}
            </div>
          )}

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <h1 className="text-2xl font-bold text-slate-800">Student Transport Allocations</h1>
            <div className="relative w-full sm:w-72">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Filter by name, admission #, class…"
                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
          </div>

          {/* ── Data Grid ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-700">
                Students
                {!loading && (
                  <span className="text-sm text-slate-400 font-normal ml-2">
                    ({filteredStudents.length}{filterText ? ` of ${students.length}` : ''})
                  </span>
                )}
              </h2>
            </div>

            {loading ? (
              <div className="p-10 text-center text-slate-400">Loading students…</div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                {filterText ? 'No students match your filter.' : 'No students found.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Grade / Class</th>
                      <th className="px-4 py-3">Assigned Route</th>
                      <th className="px-4 py-3">Pickup Stop</th>
                      <th className="px-4 py-3">Drop Stop</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((s) => {
                      const alloc = s.transportAllocations?.[0] ?? null;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-700">
                              {s.firstName} {s.lastName ?? ''}
                            </div>
                            <div className="text-xs text-slate-400">{s.admissionNumber}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {s.enrollments[0]
                              ? `${s.enrollments[0].class.name} – ${s.enrollments[0].section.name}`
                              : <span className="text-slate-400 italic">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {alloc ? (
                              <span className="text-slate-700">{alloc.route.code} — {alloc.route.name}</span>
                            ) : (
                              <span className="text-slate-400 italic">Not Assigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {alloc ? (
                              <span className="text-slate-600">{alloc.pickupStop.stop.name}</span>
                            ) : (
                              <span className="text-slate-400 italic">Not Assigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {alloc ? (
                              <span className="text-slate-600">{alloc.dropStop.stop.name}</span>
                            ) : (
                              <span className="text-slate-400 italic">Not Assigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                                  alloc
                                    ? 'text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200'
                                    : 'text-white bg-sky-600 hover:bg-sky-700'
                                }`}
                                onClick={() => openModal(s)}
                              >
                                {alloc ? 'Edit' : 'Assign'}
                              </button>
                              {alloc && (
                                <button
                                  className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                  onClick={() => handleRevoke(alloc.id)}
                                >
                                  Revoke
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Assignment Modal ────────────────────────────────────────── */}
          <AssignmentModal
            open={modalOpen}
            student={modalStudent}
            existingAlloc={existingAlloc}
            routes={routes}
            academicYears={academicYears}
            selectedRoute={selectedRoute ?? null}
            routeTrips={routeTrips}
            routeStops={routeStops}
            formRouteId={formRouteId}
            formPickupTripId={formPickupTripId}
            formPickupStopId={formPickupStopId}
            formDropTripId={formDropTripId}
            formDropStopId={formDropStopId}
            formAcademicYearId={formAcademicYearId}
            formStartDate={formStartDate}
            formEndDate={formEndDate}
            saving={saving}
            onRouteChange={handleRouteChange}
            onPickupTripChange={setFormPickupTripId}
            onPickupStopChange={setFormPickupStopId}
            onDropTripChange={setFormDropTripId}
            onDropStopChange={setFormDropStopId}
            onAcademicYearChange={setFormAcademicYearId}
            onStartDateChange={setFormStartDate}
            onEndDateChange={setFormEndDate}
            onSave={handleSave}
            onClose={closeModal}
          />
        </div>
      )}
    </AuthGuard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ═══  ASSIGNMENT MODAL  ══════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════

interface AssignmentModalProps {
  open: boolean;
  student: StudentRow | null;
  existingAlloc: StudentRow['transportAllocations'][0] | null;
  routes: RouteLookup[];
  academicYears: AcademicYearLookup[];
  selectedRoute: RouteLookup | null;
  routeTrips: TripLookup[];
  routeStops: StopLookup[];
  formRouteId: string;
  formPickupTripId: string;
  formPickupStopId: string;
  formDropTripId: string;
  formDropStopId: string;
  formAcademicYearId: string;
  formStartDate: string;
  formEndDate: string;
  saving: boolean;
  onRouteChange: (id: string) => void;
  onPickupTripChange: (id: string) => void;
  onPickupStopChange: (id: string) => void;
  onDropTripChange: (id: string) => void;
  onDropStopChange: (id: string) => void;
  onAcademicYearChange: (id: string) => void;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}

function AssignmentModal({
  open,
  student,
  existingAlloc,
  routes,
  academicYears,
  routeTrips,
  routeStops,
  formRouteId,
  formPickupTripId,
  formPickupStopId,
  formDropTripId,
  formDropStopId,
  formAcademicYearId,
  formStartDate,
  formEndDate,
  saving,
  onRouteChange,
  onPickupTripChange,
  onPickupStopChange,
  onDropTripChange,
  onDropStopChange,
  onAcademicYearChange,
  onStartDateChange,
  onEndDateChange,
  onSave,
  onClose,
}: AssignmentModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !student) return null;

  const isValid =
    formRouteId && formPickupTripId && formPickupStopId &&
    formDropTripId && formDropStopId && formAcademicYearId && formStartDate;

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Transport allocation for ${student.firstName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {existingAlloc ? 'Edit Transport Allocation' : 'Assign Transport'}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {student.firstName} {student.lastName ?? ''}
              <span className="text-slate-400 ml-1">({student.admissionNumber})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-4">
          {/* Route */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Route *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none"
              value={formRouteId}
              onChange={(e) => onRouteChange(e.target.value)}
            >
              <option value="">Select route…</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pickup Trip */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Pickup Trip *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
              value={formPickupTripId}
              onChange={(e) => onPickupTripChange(e.target.value)}
              disabled={!formRouteId}
            >
              <option value="">Select pickup trip…</option>
              {routeTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tripType} ({t.startTime}–{t.endTime})
                  {t.vehicle ? ` · ${t.vehicle.registrationNo} (${t.vehicle.capacity} seats)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Pickup Stop */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Pickup Stop *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
              value={formPickupStopId}
              onChange={(e) => onPickupStopChange(e.target.value)}
              disabled={!formRouteId}
            >
              <option value="">Select pickup stop…</option>
              {routeStops.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.sequence} {s.stop.name}
                  {s.pickupTime ? ` (${s.pickupTime})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Drop Trip */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Drop Trip *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
              value={formDropTripId}
              onChange={(e) => onDropTripChange(e.target.value)}
              disabled={!formRouteId}
            >
              <option value="">Select drop trip…</option>
              {routeTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tripType} ({t.startTime}–{t.endTime})
                  {t.vehicle ? ` · ${t.vehicle.registrationNo} (${t.vehicle.capacity} seats)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Drop Stop */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Drop Stop *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
              value={formDropStopId}
              onChange={(e) => onDropStopChange(e.target.value)}
              disabled={!formRouteId}
            >
              <option value="">Select drop stop…</option>
              {routeStops.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.sequence} {s.stop.name}
                  {s.dropTime ? ` (${s.dropTime})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Academic Year *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none"
              value={formAcademicYearId}
              onChange={(e) => onAcademicYearChange(e.target.value)}
            >
              <option value="">Select…</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}{y.isActive ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Start Date *</label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none"
                value={formStartDate}
                onChange={(e) => onStartDateChange(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">End Date</label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none"
                value={formEndDate}
                onChange={(e) => onEndDateChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-5 py-2 text-sm rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50 transition-colors"
            disabled={saving || !isValid}
            onClick={onSave}
          >
            {saving ? 'Saving…' : existingAlloc ? 'Update Allocation' : 'Save Allocation'}
          </button>
        </div>
      </div>
    </div>
  );
}
