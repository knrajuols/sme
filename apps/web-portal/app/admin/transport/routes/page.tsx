'use client';

import { useEffect, useState, useCallback } from 'react';
import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import { PremiumCard } from '../../../../components/ui/PremiumCard';
import { StatusPill } from '../../../../components/ui/StatusPill';

// ── Types ────────────────────────────────────────────────────────────────────
interface TripRecord {
  id: string;
  tripType: string;
  startTime: string;
  endTime: string;
  vehicle: { id: string; registrationNo: string; vehicleType: string } | null;
  driver: { id: string; employee: { firstName: string } } | null;
  attendant: { id: string; employee: { firstName: string } } | null;
}

interface RouteStopRecord {
  id: string;
  sequence: number;
  distanceKm: number | null;
  pickupTime: string | null;
  dropTime: string | null;
  stop: { id: string; name: string; landmark: string | null };
}

interface RouteRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  trips: TripRecord[];
  stops: RouteStopRecord[];
}

interface CloneResult {
  vehicles: number;
  stops: number;
  routes: number;
  trips: number;
  routeStops: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function tripLabel(t: TripRecord): string {
  const vehicle = t.vehicle ? t.vehicle.registrationNo : 'No vehicle';
  const driver = t.driver?.employee?.firstName ?? 'Unassigned';
  return `${t.tripType} ${t.startTime}–${t.endTime} · ${vehicle} · ${driver}`;
}

// ── Main Content ─────────────────────────────────────────────────────────────
function TransportRoutesContent() {
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneResult, setCloneResult] = useState<CloneResult | null>(null);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bffFetch<RouteRecord[]>('/api/transport/routes');
      setRoutes(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load transport routes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleClone() {
    if (!confirm('This will clone master fleet, stops, routes, and schedules from the platform template into your school. Existing routes will not be overwritten. Continue?')) return;
    setCloning(true);
    setError('');
    setCloneResult(null);
    try {
      const result = await bffFetch<CloneResult>('/api/transport/clone-from-master', {
        method: 'POST',
        body: '{}',
      });
      setCloneResult(result);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clone master data.');
    } finally {
      setCloning(false);
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedRoute(prev => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Transport Routes</h1>
          <p className="text-sm text-slate-500 mt-1">Manage bus routes, trips, stops, and schedules.</p>
        </div>
        <button
          onClick={handleClone}
          disabled={cloning}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-md transition disabled:opacity-50"
        >
          {cloning ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Generating…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Generate Master Routes &amp; Fleet
            </>
          )}
        </button>
      </div>

      {/* Clone Result Toast */}
      {cloneResult && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          <p className="font-semibold">Master data cloned successfully!</p>
          <p className="text-sm mt-1">
            {cloneResult.vehicles} vehicles · {cloneResult.stops} stops · {cloneResult.routes} routes · {cloneResult.trips} trips · {cloneResult.routeStops} route-stops
          </p>
          <button onClick={() => setCloneResult(null)} className="mt-2 text-xs text-green-600 underline">Dismiss</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p>{error}</p>
          <button onClick={() => setError('')} className="mt-2 text-xs text-red-600 underline">Dismiss</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-400 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Empty State */}
      {!loading && routes.length === 0 && (
        <PremiumCard>
          <div className="flex flex-col items-center justify-center py-16">
            <svg className="h-16 w-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h3 className="text-lg font-semibold text-slate-600 mb-2">No Routes Yet</h3>
            <p className="text-sm text-slate-400 mb-6 text-center max-w-md">
              Click <strong>&quot;Generate Master Routes &amp; Fleet&quot;</strong> above to provision standard routes, vehicles, and stops from the platform template.
            </p>
          </div>
        </PremiumCard>
      )}

      {/* Routes List */}
      {!loading && routes.length > 0 && (
        <div className="space-y-4">
          {routes.map((route) => {
            const isExpanded = expandedRoute === route.id;
            return (
              <PremiumCard key={route.id}>
                {/* Route Header */}
                <button
                  onClick={() => toggleExpand(route.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-md">{route.code}</span>
                    <div>
                      <h3 className="text-base font-semibold text-slate-800">{route.name}</h3>
                      {route.description && <p className="text-xs text-slate-400 mt-0.5">{route.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={route.isActive ? 'Active' : 'Inactive'} />
                    <span className="text-xs text-slate-400">{route.trips.length} trips · {route.stops.length} stops</span>
                    <svg
                      className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                    {/* Trips */}
                    {route.trips.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Trips</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {route.trips.map((trip) => (
                            <div key={trip.id} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg text-sm">
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded ${trip.tripType === 'MORNING' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                                {trip.tripType}
                              </span>
                              <span className="text-slate-600">{trip.startTime} – {trip.endTime}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-600">{trip.vehicle?.registrationNo ?? <span className="text-slate-400 italic">No vehicle</span>}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-600">{trip.driver?.employee?.firstName ?? <span className="text-slate-400 italic">Unassigned</span>}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stops */}
                    {route.stops.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stops</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100">
                                <th className="py-2 pr-4">#</th>
                                <th className="py-2 pr-4">Stop</th>
                                <th className="py-2 pr-4">Landmark</th>
                                <th className="py-2 pr-4">Pickup</th>
                                <th className="py-2 pr-4">Drop</th>
                                <th className="py-2">Distance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {route.stops.map((rs) => (
                                <tr key={rs.id} className="border-b border-slate-50">
                                  <td className="py-2 pr-4 text-slate-500">{rs.sequence}</td>
                                  <td className="py-2 pr-4 font-medium text-slate-700">{rs.stop.name}</td>
                                  <td className="py-2 pr-4 text-slate-400">{rs.stop.landmark ?? '—'}</td>
                                  <td className="py-2 pr-4 text-slate-600">{rs.pickupTime ?? '—'}</td>
                                  <td className="py-2 pr-4 text-slate-600">{rs.dropTime ?? '—'}</td>
                                  <td className="py-2 text-slate-500">{rs.distanceKm != null ? `${rs.distanceKm} km` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </PremiumCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page Export ────────────────────────────────────────────────────────────────
export default function TransportRoutesPage() {
  return (
    <AuthGuard>
      {() => <TransportRoutesContent />}
    </AuthGuard>
  );
}
