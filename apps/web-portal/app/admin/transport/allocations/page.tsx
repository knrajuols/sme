'use client';

/**
 * Student Transport Allocations — Web-Portal (School Admin)
 * ──────────────────────────────────────────────────────────────────────────────
 * Prompt #285 — Tenant-scoped transport allocation management.
 * Data is strictly isolated by the tenantId embedded in the authenticated
 * user's JWT claim.  ZERO cross-tenant data bleed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

/** Grid row: student + optional active allocation */
interface StudentRow {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  enrollments: {
    rollNumber: string | null;
    class: { name: string };
    section: { name: string };
    academicYear: { id: string; name: string };
  }[];
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

const BFF = '/api/transport/allocations';
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

/** Sortable column keys for the student grid */
type SortKey = 'rollNumber' | 'name' | 'classSection' | 'route' | 'pickupStop' | 'dropStop';
type SortDir = 'asc' | 'desc';

// ── Main Page ────────────────────────────────────────────────────────────────

export default function StudentAllocationsPage() {
  // ── State: Data ────────────────────────────────────────────────────────────
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [routes, setRoutes] = useState<RouteLookup[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearLookup[]>([]);

  // ── State: Grid ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterAcademicYear, setFilterAcademicYear] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');

  // ── State: Sort ──────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── State: Pagination ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

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

  // ── Dynamic dropdown options (derived from loaded data) ────────────────
  const filterOptions = useMemo(() => {
    const aySet = new Map<string, string>();
    const classSet = new Set<string>();
    const sectionSet = new Set<string>();
    for (const s of students) {
      const enr = s.enrollments[0];
      if (!enr) continue;
      if (enr.academicYear) aySet.set(enr.academicYear.id, enr.academicYear.name);
      if (enr.class?.name) classSet.add(enr.class.name);
      if (enr.section?.name) sectionSet.add(enr.section.name);
    }
    return {
      academicYears: Array.from(aySet, ([id, name]) => ({ id, name })).sort((a, b) => b.name.localeCompare(a.name)),
      classes: Array.from(classSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      sections: Array.from(sectionSet).sort(),
    };
  }, [students]);

  /** Filtered students for the grid */
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const enr = s.enrollments[0];
      if (filterAcademicYear && (!enr || enr.academicYear?.id !== filterAcademicYear)) return false;
      if (filterClass && (!enr || enr.class?.name !== filterClass)) return false;
      if (filterSection && (!enr || enr.section?.name !== filterSection)) return false;
      if (filterText) {
        const q = filterText.toLowerCase();
        const name = `${s.firstName} ${s.lastName ?? ''}`.toLowerCase();
        const cls = enr ? `${enr.class.name} ${enr.section.name}`.toLowerCase() : '';
        if (!name.includes(q) && !s.admissionNumber.toLowerCase().includes(q) && !cls.includes(q)) return false;
      }
      return true;
    });
  }, [students, filterText, filterAcademicYear, filterClass, filterSection]);

  /** Sorted view (applied after filter, before pagination) */
  const sortedStudents = useMemo(() => {
    if (!sortKey) return filteredStudents;
    const arr = [...filteredStudents];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const enrA = a.enrollments[0];
      const enrB = b.enrollments[0];
      let va = '';
      let vb = '';
      switch (sortKey) {
        case 'rollNumber':
          va = enrA?.rollNumber ?? '';
          vb = enrB?.rollNumber ?? '';
          break;
        case 'name':
          va = `${a.firstName} ${a.lastName ?? ''}`;
          vb = `${b.firstName} ${b.lastName ?? ''}`;
          break;
        case 'classSection':
          va = enrA ? `${enrA.class.name} ${enrA.section.name}` : '';
          vb = enrB ? `${enrB.class.name} ${enrB.section.name}` : '';
          break;
        case 'route': {
          const aa = a.transportAllocations?.[0];
          const bb = b.transportAllocations?.[0];
          va = aa ? `${aa.route.code} ${aa.route.name}` : '';
          vb = bb ? `${bb.route.code} ${bb.route.name}` : '';
          break;
        }
        case 'pickupStop': {
          const aa = a.transportAllocations?.[0];
          const bb = b.transportAllocations?.[0];
          va = aa?.pickupStop?.stop?.name ?? '';
          vb = bb?.pickupStop?.stop?.name ?? '';
          break;
        }
        case 'dropStop': {
          const aa = a.transportAllocations?.[0];
          const bb = b.transportAllocations?.[0];
          va = aa?.dropStop?.stop?.name ?? '';
          vb = bb?.dropStop?.stop?.name ?? '';
          break;
        }
      }
      return dir * va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
    });
    return arr;
  }, [filteredStudents, sortKey, sortDir]);

  /** Pagination derived values */
  const totalFiltered = sortedStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, totalFiltered);
  const pagedStudents = sortedStudents.slice(pageStart, pageEnd);

  // Reset to page 1 when filters or sort changes
  useEffect(() => { setCurrentPage(1); }, [filterText, filterAcademicYear, filterClass, filterSection, sortKey, sortDir, pageSize]);

  /** Toggle sort: click same column flips direction, new column starts ascending */
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

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

          <h1 className="text-2xl font-bold text-slate-800 mb-5">Student Transport Allocations</h1>

          <div className="space-y-6">

          {/* ═══ FILTER CARD ══════════════════════════════════════════════ */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-blue-500 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative w-full sm:w-64">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search name, admission #…"
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />
              </div>
              <select
                aria-label="Filter by Academic Year"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none bg-white min-w-[160px]"
                value={filterAcademicYear}
                onChange={(e) => setFilterAcademicYear(e.target.value)}
              >
                <option value="">All Academic Years</option>
                {filterOptions.academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>{ay.name}</option>
                ))}
              </select>
              <select
                aria-label="Filter by Class"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none bg-white min-w-[140px]"
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="">All Classes</option>
                {filterOptions.classes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Filter by Section"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none bg-white min-w-[130px]"
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
              >
                <option value="">All Sections</option>
                {filterOptions.sections.map((sec) => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
              {(filterAcademicYear || filterClass || filterSection) && (
                <button
                  type="button"
                  className="text-xs text-sky-600 hover:text-sky-700 font-medium px-2 py-2 rounded-lg hover:bg-sky-50 transition-colors"
                  onClick={() => { setFilterAcademicYear(''); setFilterClass(''); setFilterSection(''); }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* ═══ DATA TABLE CARD ══════════════════════════════════════════ */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-purple-500 overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-700">
                Students
                {!loading && (
                  <span className="text-sm text-slate-400 font-normal ml-2">
                    ({filteredStudents.length}{(filterText || filterAcademicYear || filterClass || filterSection) ? ` of ${students.length}` : ''})
                  </span>
                )}
              </h2>
            </div>

            {loading ? (
              <div className="p-10 text-center text-slate-400">Loading students…</div>
            ) : sortedStudents.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                {(filterText || filterAcademicYear || filterClass || filterSection) ? 'No students match your filters.' : 'No students found.'}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] relative">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider sticky top-0 z-10 shadow-[0_1px_0_0_theme(colors.slate.200)]">
                      <tr>
                        <th className="px-4 py-3 w-12 bg-slate-50">Sl No.</th>
                        <SortableHeader label="Roll No." sortKey="rollNumber" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="w-24" />
                        <SortableHeader label="Student Name" sortKey="name" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Class / Section" sortKey="classSection" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Assigned Route" sortKey="route" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Pickup Stop" sortKey="pickupStop" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Drop Stop" sortKey="dropStop" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <th className="px-4 py-3 text-right bg-slate-50">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedStudents.map((s, idx) => {
                        const alloc = s.transportAllocations?.[0] ?? null;
                        const enr = s.enrollments[0];
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3 text-slate-500 tabular-nums">{pageStart + idx + 1}</td>
                            <td className="px-4 py-3 text-slate-600 tabular-nums">
                              {enr?.rollNumber ?? <span className="text-slate-400 italic">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-700">
                                {s.firstName} {s.lastName ?? ''}
                              </div>
                              <div className="text-xs text-slate-400">{s.admissionNumber}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {enr
                                ? `${enr.class.name} – ${enr.section.name}`
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

                {/* ── Sticky Pagination Footer ────────────────────────── */}
                <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm z-10">
                  <span className="text-slate-500">
                    Showing {totalFiltered === 0 ? 0 : pageStart + 1} to {pageEnd} of {totalFiltered}
                  </span>
                  <div className="flex items-center gap-3">
                    <select
                      aria-label="Rows per page"
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-sky-300 outline-none bg-white"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n} / page</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage(1)}
                        className="px-2 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
                        aria-label="First page"
                      >
                        «
                      </button>
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
                        aria-label="Previous page"
                      >
                        ‹ Prev
                      </button>
                      <span className="px-3 py-1.5 text-xs text-slate-600 tabular-nums">
                        Page {safePage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
                        aria-label="Next page"
                      >
                        Next ›
                      </button>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        className="px-2 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
                        aria-label="Last page"
                      >
                        »
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          </div>{/* end space-y-6 */}

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
// ═══  SORTABLE HEADER  ═══════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════

function SortableHeader({
  label,
  sortKey: key,
  activeSortKey,
  sortDir,
  onSort,
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const isActive = activeSortKey === key;
  return (
    <th
      className={`px-4 py-3 bg-slate-50 cursor-pointer select-none hover:text-slate-700 transition-colors ${className}`}
      onClick={() => onSort(key)}
      aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col leading-none text-[10px]" aria-hidden="true">
          <span className={isActive && sortDir === 'asc' ? 'text-sky-600' : 'text-slate-300'}>▲</span>
          <span className={isActive && sortDir === 'desc' ? 'text-sky-600' : 'text-slate-300'}>▼</span>
        </span>
      </span>
    </th>
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
