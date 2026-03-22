'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';

// ── Constants ────────────────────────────────────────────────────────────────

const STOPS_BFF = '/api/web-admin/transport/stops';

// ── Types ────────────────────────────────────────────────────────────────────

interface RouteRef { id: string; code: string; name: string; }
interface Stop {
  id: string;
  name: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  routeStops: { route: RouteRef }[];
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function StopMasterPage() {
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const flash = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
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
              <h1 className="text-2xl font-bold text-slate-800">Stop Master</h1>
              <p className="text-sm text-slate-500 mt-1">Manage physical bus stops. Assign stops to routes in the Route Builder.</p>
            </div>
            <StopMasterGrid flash={flash} />
          </div>
        </div>
      )}
    </AuthGuard>
  );
}

// ── Sort helpers ─────────────────────────────────────────────────────────────

type SortColumn = 'index' | 'name' | 'landmark';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-slate-300 text-xs">↕</span>;
  return <span className="ml-1 text-indigo-500 text-xs">{dir === 'asc' ? '↑' : '↓'}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══  STOP MASTER GRID  ════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

function StopMasterGrid({ flash }: { flash: (t: 'success' | 'error', m: string) => void }) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Filter state ────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('');

  // ── Sort state ──────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState<SortColumn>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Modal state ─────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', landmark: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bffFetch<Stop[]>(STOPS_BFF);
      setStops(Array.isArray(data) ? data : []);
    } catch {
      setStops([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Unique sorted route options derived from loaded data ─────────────────
  const routeOptions = useMemo<RouteRef[]>(() => {
    const map = new Map<string, RouteRef>();
    stops.forEach((s) => s.routeStops.forEach(({ route }) => {
      if (!map.has(route.id)) map.set(route.id, route);
    }));
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [stops]);

  // ── Pipeline: search → route filter → sort ──────────────────────────────
  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = stops;

    // 1. Text search on name
    if (q) result = result.filter((s) => s.name.toLowerCase().includes(q));

    // 2. Route filter
    if (routeFilter) {
      result = result.filter((s) =>
        s.routeStops.some((rs) => rs.route.id === routeFilter),
      );
    }

    // 3. Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'name') {
        cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      } else if (sortCol === 'landmark') {
        cmp = (a.landmark ?? '').toLowerCase().localeCompare((b.landmark ?? '').toLowerCase());
      }
      // 'index' sort keeps natural (insertion) order — cmp stays 0, stable sort rules
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [stops, search, routeFilter, sortCol, sortDir]);

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const setField = (f: 'name' | 'landmark', v: string) => setForm((p) => ({ ...p, [f]: v }));

  const openAdd = () => { setEditId(null); setForm({ name: '', landmark: '' }); setModalOpen(true); };
  const openEdit = (s: Stop) => { setEditId(s.id); setForm({ name: s.name, landmark: s.landmark ?? '' }); setModalOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { flash('error', 'Stop name is required.'); return; }
    setSaving(true);
    const payload: Record<string, string> = { name: form.name.trim() };
    if (form.landmark.trim()) payload.landmark = form.landmark.trim();
    try {
      if (editId) {
        await bffFetch(`${STOPS_BFF}/${editId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        flash('success', 'Stop updated');
      } else {
        await bffFetch(STOPS_BFF, { method: 'POST', body: JSON.stringify(payload) });
        flash('success', 'Stop created');
      }
      setModalOpen(false); load();
    } catch { flash('error', 'Failed to save stop'); }
    setSaving(false);
  };

  const del = async (id: string) => {
    if (!confirm('Delete this stop?')) return;
    try {
      await bffFetch(`${STOPS_BFF}/${id}`, { method: 'DELETE' });
      flash('success', 'Stop deleted'); load();
    } catch { flash('error', 'Failed to delete stop'); }
  };

  const hasFilters = search.trim() !== '' || routeFilter !== '';

  return (
    <>
      {/* ── Toolbar: Search + Route Filter + Add ──────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          {/* Text search */}
          <div className="relative w-full sm:w-72">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stops by name…"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-shadow"
            />
          </div>

          {/* Route filter dropdown */}
          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            className="w-full sm:w-48 py-2.5 pl-3 pr-8 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-shadow appearance-none"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.25rem' }}
          >
            <option value="">All Routes</option>
            {routeOptions.map((r) => (
              <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
            ))}
          </select>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setRouteFilter(''); }}
              className="text-xs text-slate-500 hover:text-slate-800 underline whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <p className="text-sm text-slate-500">{displayed.length} of {stops.length} stop{stops.length !== 1 ? 's' : ''}</p>
          <button onClick={openAdd}
            className="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
            + Add Stop
          </button>
        </div>
      </div>

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {loading && <p className="text-sm text-slate-500 py-8 text-center">Loading…</p>}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!loading && stops.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">No stops defined. Click &ldquo;+ Add Stop&rdquo; to create one.</p>
        </div>
      )}

      {/* ── No filter results ──────────────────────────────────────────── */}
      {!loading && stops.length > 0 && displayed.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">No stops match the current filters.</p>
        </div>
      )}

      {/* ── Data Table ─────────────────────────────────────────────────── */}
      {!loading && displayed.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {/* # — sortable (natural order) */}
                  <th className="text-left px-4 py-3 w-12">
                    <button
                      onClick={() => toggleSort('index')}
                      className="flex items-center font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                    >
                      #<SortIcon col="index" active={sortCol === 'index'} dir={sortDir} />
                    </button>
                  </th>

                  {/* Routes — not sortable (badge column) */}
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Routes</th>

                  {/* Name — sortable */}
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => toggleSort('name')}
                      className="flex items-center font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                    >
                      Name<SortIcon col="name" active={sortCol === 'name'} dir={sortDir} />
                    </button>
                  </th>

                  {/* Landmark — sortable */}
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => toggleSort('landmark')}
                      className="flex items-center font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                    >
                      Landmark<SortIcon col="landmark" active={sortCol === 'landmark'} dir={sortDir} />
                    </button>
                  </th>

                  <th className="text-right px-4 py-3 font-medium text-slate-600 w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((s, i) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      {s.routeStops.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.routeStops.map((rs) => (
                            <span
                              key={rs.route.id}
                              title={rs.route.name}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700"
                            >
                              {rs.route.code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unlinked</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{s.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{s.landmark ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => openEdit(s)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mr-3">Edit</button>
                      <button onClick={() => del(s.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ──────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">{editId ? 'Edit Stop' : 'Add Stop'}</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Landmark</label>
              <input type="text" value={form.landmark} onChange={(e) => setField('landmark', e.target.value)}
                placeholder="Optional nearby landmark"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
