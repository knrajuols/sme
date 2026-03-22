'use client';

/**
 * Fleet Analytics Dashboard — Web-Portal (School Admin)
 * ──────────────────────────────────────────────────────────────────────────────
 * Prompt #288 — Premium transport analytics dashboard with 4 data nodes:
 *   1. Overall Fleet Utilization  (hero card with progress ring)
 *   2. Vehicle Utilization         (sortable table + pagination)
 *   3. Route Utilization           (sortable table + pagination)
 *   4. Stop Utilization            (sortable table + pagination)
 *
 * All data fetched from BFF /api/transport/analytics/dashboard.
 * Tenant-scoped via JWT forwarding.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface VehicleRow {
  vehicleId: string;
  registrationNo: string;
  vehicleType: string;
  capacity: number;
  allocatedSeats: number;
  utilizationPercent: number;
}
interface RouteRow {
  routeId: string;
  routeCode: string;
  routeName: string;
  vehicleCount: number;
  totalCapacity: number;
  allocatedStudents: number;
  utilizationPercent: number;
}
interface StopRow {
  stopId: string;
  stopName: string;
  pickupCount: number;
  dropCount: number;
}
interface OverallFleet {
  totalVehicles: number;
  totalCapacity: number;
  totalAllocated: number;
  utilizationPercent: number;
}
interface DashboardPayload {
  overall: OverallFleet;
  vehicles: VehicleRow[];
  routes: RouteRow[];
  stops: StopRow[];
}

// ── Sort helpers ─────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc';

function useSortedTable<T>(data: T[], defaultKey: keyof T & string) {
  const [sortKey, setSortKey] = useState<keyof T & string>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggle = useCallback(
    (key: keyof T & string) => {
      if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else { setSortKey(key); setSortDir('asc'); }
    },
    [sortKey],
  );

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      const sa = String(av).toLowerCase();
      const sb = String(bv).toLowerCase();
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return copy;
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggle };
}

// ── Pagination helpers ───────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

function usePagination(totalItems: number) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  const changePageSize = useCallback((s: number) => { setPageSize(s); setPage(1); }, []);

  return { page: safePage, setPage, pageSize, changePageSize, totalPages };
}

// ── Utilization colour helpers ───────────────────────────────────────────────

function utilizationColor(pct: number): string {
  if (pct >= 90) return 'text-red-600';
  if (pct >= 70) return 'text-amber-600';
  if (pct >= 40) return 'text-blue-600';
  return 'text-emerald-600';
}
function utilizationBarColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-500';
  if (pct >= 40) return 'bg-blue-500';
  return 'bg-emerald-500';
}
function utilizationBg(pct: number): string {
  if (pct >= 90) return 'bg-red-50';
  if (pct >= 70) return 'bg-amber-50';
  if (pct >= 40) return 'bg-blue-50';
  return 'bg-emerald-50';
}

// ── Sortable Header ──────────────────────────────────────────────────────────

function SortableHeader<K extends string>({
  label, colKey, sortKey, sortDir, onToggle,
}: {
  label: string; colKey: K; sortKey: string; sortDir: SortDir; onToggle: (k: K) => void;
}) {
  const active = colKey === sortKey;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-800 whitespace-nowrap"
      onClick={() => onToggle(colKey)}
    >
      {label}
      <span className="ml-1 inline-block w-4 text-center">
        {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div className={`rounded-xl p-5 ${accent} border border-slate-200 shadow-sm flex flex-col gap-1 min-w-[160px]`}>
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-slate-800">{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

// ── Pagination Footer ────────────────────────────────────────────────────────

function PaginationFooter({ page, totalPages, pageSize, onPageChange, onPageSizeChange, totalItems }: {
  page: number; totalPages: number; pageSize: number; totalItems: number;
  onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500 border-t border-slate-200 bg-slate-50 rounded-b-xl">
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <select
          className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-white"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-slate-400 ml-2">{totalItems} total</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <span>
          Page <strong>{page}</strong> of <strong>{totalPages}</strong>
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ═══  MAIN PAGE  ═════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════

export default function FleetAnalyticsPage() {
  return (
    <AuthGuard>
      {() => <FleetAnalyticsDashboard />}
    </AuthGuard>
  );
}

function FleetAnalyticsDashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await bffFetch<DashboardPayload>('/api/transport/analytics/dashboard');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Loading / Error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">Failed to load analytics</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fleet Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time transport utilization overview</p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Overall Fleet Stats */}
      <OverallSection overall={data.overall} />

      {/* Vehicle Utilization */}
      <VehicleUtilizationSection vehicles={data.vehicles} />

      {/* Route Utilization */}
      <RouteUtilizationSection routes={data.routes} />

      {/* Stop Utilization */}
      <StopUtilizationSection stops={data.stops} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ═══  OVERALL FLEET SECTION  ═════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════

function OverallSection({ overall }: { overall: OverallFleet }) {
  const { totalVehicles, totalCapacity, totalAllocated, utilizationPercent } = overall;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-indigo-500 p-6">
      <h2 className="text-lg font-semibold text-slate-700 mb-4">Overall Fleet Utilization</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard label="Total Vehicles" value={totalVehicles} accent="bg-indigo-50" />
        <StatCard label="Total Capacity" value={totalCapacity} sub="seats" accent="bg-blue-50" />
        <StatCard label="Allocated" value={totalAllocated} sub="students" accent="bg-emerald-50" />
        <div className={`rounded-xl p-5 ${utilizationBg(utilizationPercent)} border border-slate-200 shadow-sm flex flex-col gap-1`}>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Utilization</span>
          <span className={`text-3xl font-bold ${utilizationColor(utilizationPercent)}`}>
            {utilizationPercent}%
          </span>
        </div>
      </div>
      {/* Progress Bar */}
      <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${utilizationBarColor(utilizationPercent)}`}
          style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>0%</span>
        <span>{totalAllocated} / {totalCapacity} seats filled</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ═══  VEHICLE UTILIZATION TABLE  ═════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════

function VehicleUtilizationSection({ vehicles }: { vehicles: VehicleRow[] }) {
  const { sorted, sortKey, sortDir, toggle } = useSortedTable(vehicles, 'registrationNo');
  const pag = usePagination(sorted.length);
  const page = sorted.slice((pag.page - 1) * pag.pageSize, pag.page * pag.pageSize);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-blue-500 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-700">Vehicle Utilization</h2>
        <p className="text-xs text-slate-400 mt-0.5">Seats allocated vs. capacity per vehicle</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">#</th>
              <SortableHeader label="Registration" colKey="registrationNo" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortableHeader label="Type" colKey="vehicleType" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortableHeader label="Capacity" colKey="capacity" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortableHeader label="Allocated" colKey="allocatedSeats" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortableHeader label="Utilization %" colKey="utilizationPercent" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Bar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {page.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No vehicles found</td></tr>
            )}
            {page.map((v, i) => (
              <tr key={v.vehicleId} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-400 text-xs">{(pag.page - 1) * pag.pageSize + i + 1}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{v.registrationNo}</td>
                <td className="px-4 py-3 text-slate-600">{v.vehicleType}</td>
                <td className="px-4 py-3 text-slate-600">{v.capacity}</td>
                <td className="px-4 py-3 text-slate-600">{v.allocatedSeats}</td>
                <td className={`px-4 py-3 font-semibold ${utilizationColor(v.utilizationPercent)}`}>{v.utilizationPercent}%</td>
                <td className="px-4 py-3 w-36">
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`h-full rounded-full ${utilizationBarColor(v.utilizationPercent)}`}
                      style={{ width: `${Math.min(v.utilizationPercent, 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationFooter
        page={pag.page} totalPages={pag.totalPages} pageSize={pag.pageSize}
        onPageChange={pag.setPage} onPageSizeChange={pag.changePageSize} totalItems={sorted.length}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ═══  ROUTE UTILIZATION TABLE  ═══════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════

function RouteUtilizationSection({ routes }: { routes: RouteRow[] }) {
  const { sorted, sortKey, sortDir, toggle } = useSortedTable(routes, 'routeCode');
  const pag = usePagination(sorted.length);
  const page = sorted.slice((pag.page - 1) * pag.pageSize, pag.page * pag.pageSize);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-purple-500 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-700">Route Utilization</h2>
        <p className="text-xs text-slate-400 mt-0.5">Students allocated vs. fleet capacity per route</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">#</th>
              <SortableHeader label="Route Code" colKey="routeCode" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortableHeader label="Route Name" colKey="routeName" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortableHeader label="Vehicles" colKey="vehicleCount" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortableHeader label="Capacity" colKey="totalCapacity" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortableHeader label="Allocated" colKey="allocatedStudents" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortableHeader label="Utilization %" colKey="utilizationPercent" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Bar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {page.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No routes found</td></tr>
            )}
            {page.map((r, i) => (
              <tr key={r.routeId} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-400 text-xs">{(pag.page - 1) * pag.pageSize + i + 1}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{r.routeCode}</td>
                <td className="px-4 py-3 text-slate-600">{r.routeName}</td>
                <td className="px-4 py-3 text-slate-600">{r.vehicleCount}</td>
                <td className="px-4 py-3 text-slate-600">{r.totalCapacity}</td>
                <td className="px-4 py-3 text-slate-600">{r.allocatedStudents}</td>
                <td className={`px-4 py-3 font-semibold ${utilizationColor(r.utilizationPercent)}`}>{r.utilizationPercent}%</td>
                <td className="px-4 py-3 w-36">
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`h-full rounded-full ${utilizationBarColor(r.utilizationPercent)}`}
                      style={{ width: `${Math.min(r.utilizationPercent, 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationFooter
        page={pag.page} totalPages={pag.totalPages} pageSize={pag.pageSize}
        onPageChange={pag.setPage} onPageSizeChange={pag.changePageSize} totalItems={sorted.length}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ═══  STOP UTILIZATION TABLE  ════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════

function StopUtilizationSection({ stops }: { stops: StopRow[] }) {
  const { sorted, sortKey, sortDir, toggle } = useSortedTable(stops, 'stopName');
  const pag = usePagination(sorted.length);
  const page = sorted.slice((pag.page - 1) * pag.pageSize, pag.page * pag.pageSize);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-emerald-500 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-700">Stop Utilization</h2>
        <p className="text-xs text-slate-400 mt-0.5">Pickup and drop-off counts per stop</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">#</th>
              <SortableHeader label="Stop Name" colKey="stopName" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortableHeader label="Pickup Count" colKey="pickupCount" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortableHeader label="Drop Count" colKey="dropCount" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {page.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No stops found</td></tr>
            )}
            {page.map((s, i) => (
              <tr key={s.stopId} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-400 text-xs">{(pag.page - 1) * pag.pageSize + i + 1}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{s.stopName}</td>
                <td className="px-4 py-3 text-blue-600 font-medium">{s.pickupCount}</td>
                <td className="px-4 py-3 text-orange-600 font-medium">{s.dropCount}</td>
                <td className="px-4 py-3 text-slate-700 font-semibold">{s.pickupCount + s.dropCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationFooter
        page={pag.page} totalPages={pag.totalPages} pageSize={pag.pageSize}
        onPageChange={pag.setPage} onPageSizeChange={pag.changePageSize} totalItems={sorted.length}
      />
    </div>
  );
}
