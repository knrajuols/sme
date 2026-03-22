'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────
interface Department {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  division: string | null;
  parentId: string | null;
  children?: { id: string; name: string; code: string; isActive: boolean; division: string | null }[];
}

interface EmployeeRole {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  systemCategory: string;
  department?: { id: string; name: string; code: string; division: string | null };
}

interface OrgData {
  departments: Department[];
  roles: EmployeeRole[];
}

/** Flat row for the grouped DataGrid */
interface OrgRow {
  division: string;
  departmentName: string;
  departmentCode: string;
  roleName: string;
  roleCode: string;
  systemCategory: string;
}

type SortField = 'departmentName' | 'departmentCode' | 'roleName' | 'systemCategory';
type SortDir = 'asc' | 'desc';

const PAGE_SIZES = [10, 25, 50, 100] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build flat rows from hierarchical department + role data, resolving division via forward-fill */
function buildRows(data: OrgData): OrgRow[] {
  const rows: OrgRow[] = [];
  // Build a lookup: departmentId → Department
  const deptMap = new Map<string, Department>();
  for (const d of data.departments) deptMap.set(d.id, d);

  // Resolve division for a department: use its own, or its parent's, or 'Ungrouped'
  function resolveDivision(dept: Department): string {
    if (dept.division) return dept.division;
    if (dept.parentId) {
      const parent = deptMap.get(dept.parentId);
      if (parent?.division) return parent.division;
    }
    return 'Ungrouped';
  }

  for (const role of data.roles) {
    const dept = role.department ? deptMap.get(role.department.id) : undefined;
    const division = dept ? resolveDivision(dept) : (role.department?.division ?? 'Ungrouped');
    rows.push({
      division,
      departmentName: role.department?.name ?? '—',
      departmentCode: role.department?.code ?? '—',
      roleName: role.name,
      roleCode: role.code,
      systemCategory: role.systemCategory,
    });
  }
  return rows;
}

function matchesFilter(value: string, filter: string): boolean {
  if (!filter) return true;
  return value.toLowerCase().includes(filter.toLowerCase());
}

// ── Chevron Icon ───────────────────────────────────────────────────────────
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ── Sort Header Button ─────────────────────────────────────────────────────
function SortableHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 transition-colors"
    >
      {label}
      <span className={active ? 'text-teal-600' : 'text-slate-300'}>
        {active && sortDir === 'desc' ? '▼' : '▲'}
      </span>
    </button>
  );
}

// ── Main Content Component ─────────────────────────────────────────────────
function OrgStructureContent() {
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [seeding, setSeeding] = useState(false);

  // Collapse state: keyed by division name
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Column filters
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('departmentName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await bffFetch<OrgData>('/api/web-admin/org-structure');
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load org structure');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSeed() {
    setSeeding(true);
    setError('');
    try {
      const res = await bffFetch<{ departments: number; roles: number }>(
        '/api/web-admin/org-structure/seed',
        { method: 'POST' },
      );
      setSuccessMsg(
        `Seeded ${res.departments} department${res.departments !== 1 ? 's' : ''} and ${res.roles} role${res.roles !== 1 ? 's' : ''}.`,
      );
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  }

  // ── Row computation ───────────────────────────────────────────────────────
  const allRows = useMemo(() => (data ? buildRows(data) : []), [data]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return allRows.filter(
      (r) =>
        matchesFilter(r.departmentName, filterDept) &&
        matchesFilter(r.roleName, filterRole) &&
        matchesFilter(r.systemCategory, filterCategory),
    );
  }, [allRows, filterDept, filterRole, filterCategory]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      const aVal = a[sortField].toLowerCase();
      const bVal = b[sortField].toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRows, sortField, sortDir]);

  // Group by division (preserving sort order within groups)
  const groupedRows = useMemo(() => {
    const groups: { division: string; rows: OrgRow[] }[] = [];
    const groupMap = new Map<string, OrgRow[]>();
    const divisionOrder: string[] = [];
    for (const row of sortedRows) {
      if (!groupMap.has(row.division)) {
        groupMap.set(row.division, []);
        divisionOrder.push(row.division);
      }
      groupMap.get(row.division)!.push(row);
    }
    for (const div of divisionOrder) {
      groups.push({ division: div, rows: groupMap.get(div)! });
    }
    return groups;
  }, [sortedRows]);

  // Pagination is across visible (non-collapsed) rows
  const visibleRows = useMemo(() => {
    const rows: { type: 'header'; division: string; count: number }[] | { type: 'data'; row: OrgRow }[] = [];
    const result: ({ type: 'header'; division: string; count: number } | { type: 'data'; row: OrgRow })[] = [];
    for (const g of groupedRows) {
      result.push({ type: 'header', division: g.division, count: g.rows.length });
      if (!collapsed[g.division]) {
        for (const row of g.rows) {
          result.push({ type: 'data', row });
        }
      }
    }
    return result;
  }, [groupedRows, collapsed]);

  const totalVisible = visibleRows.length;
  const totalPages = Math.max(1, Math.ceil(totalVisible / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = visibleRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset page when filters/sort/collapse change
  useEffect(() => { setPage(1); }, [filterDept, filterRole, filterCategory, sortField, sortDir, collapsed]);

  // ── Toggle handlers ───────────────────────────────────────────────────────
  function toggleDivision(div: string) {
    setCollapsed((prev) => ({ ...prev, [div]: !prev[div] }));
  }

  function expandAll() {
    setCollapsed({});
  }

  function collapseAll() {
    const all: Record<string, boolean> = {};
    for (const g of groupedRows) all[g.division] = true;
    setCollapsed(all);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  // ── Division color palette ────────────────────────────────────────────────
  const divisionColors: Record<string, { bg: string; text: string; border: string; headerBg: string }> = {
    'Core Academics':   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   headerBg: 'bg-blue-100' },
    'Administration':   { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200', headerBg: 'bg-purple-100' },
    'Ops & Finance':    { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  headerBg: 'bg-amber-100' },
    'Growth & Outreach':{ bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',headerBg: 'bg-emerald-100' },
    'Campus Services':  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200', headerBg: 'bg-orange-100' },
    'Student Life':     { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',   headerBg: 'bg-rose-100' },
  };
  const defaultColor = { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', headerBg: 'bg-slate-100' };

  function getDivisionColor(div: string) {
    return divisionColors[div] ?? defaultColor;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[90rem] mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Org Structure</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Master template — Organizational Divisions, Departments, Roles &amp; System Categories.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={expandAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 16l-4-4m0 0l4-4m-4 4H4m16 0H4" /></svg>
            Collapse All
          </button>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
          >
            {seeding ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Seeding…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Seed Master Org Structure
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
      )}

      {!loading && data && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* DataGrid Table */}
          <div className="overflow-x-auto max-h-[calc(100vh-16rem)] overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              {/* Sticky Header */}
              <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left w-56">
                    <SortableHeader label="Department" field="departmentName" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left w-32">
                    <SortableHeader label="Dept Code" field="departmentCode" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left w-56">
                    <SortableHeader label="Role" field="roleName" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left w-48">
                    <SortableHeader label="System Category" field="systemCategory" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                </tr>
                {/* Filter row */}
                <tr className="border-b border-slate-200 bg-white">
                  <th className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Filter departments…"
                      value={filterDept}
                      onChange={(e) => setFilterDept(e.target.value)}
                      className="w-full rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </th>
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Filter roles…"
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="w-full rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </th>
                  <th className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Filter categories…"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </th>
                </tr>
              </thead>

              <tbody>
                {pagedRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-16 text-center text-sm text-slate-400">
                      {allRows.length === 0
                        ? 'No org structure seeded yet. Click "Seed Master Org Structure" to populate.'
                        : 'No rows match your filters.'}
                    </td>
                  </tr>
                )}
                {pagedRows.map((item, idx) => {
                  if (item.type === 'header') {
                    const colors = getDivisionColor(item.division);
                    const isCollapsed = collapsed[item.division] ?? false;
                    return (
                      <tr
                        key={`hdr-${item.division}`}
                        className={`${colors.headerBg} ${colors.border} border-t cursor-pointer hover:brightness-95 transition-all`}
                        onClick={() => toggleDivision(item.division)}
                      >
                        <td colSpan={4} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`${colors.text}`}>
                              <ChevronIcon expanded={!isCollapsed} />
                            </span>
                            <span className={`font-bold text-sm ${colors.text}`}>
                              {item.division}
                            </span>
                            <span className={`ml-2 text-xs font-medium ${colors.text} opacity-60`}>
                              ({item.count} role{item.count !== 1 ? 's' : ''})
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const row = item.row;
                  return (
                    <tr
                      key={`row-${idx}-${row.roleCode}`}
                      className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-slate-900 font-medium">{row.departmentName}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {row.departmentCode}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-800">{row.roleName}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                          {row.systemCategory}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sticky Footer — Pagination */}
          <div className="sticky bottom-0 z-10 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/95 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                {filteredRows.length} role{filteredRows.length !== 1 ? 's' : ''} across{' '}
                {groupedRows.length} division{groupedRows.length !== 1 ? 's' : ''}
                {data && <> &middot; {data.departments.length} dept{data.departments.length !== 1 ? 's' : ''} total</>}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <label htmlFor="org-page-size">Rows:</label>
                <select
                  id="org-page-size"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  ← Prev
                </button>
                <span className="px-2 text-xs text-slate-600 font-medium">
                  {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrgStructurePage() {
  return <AuthGuard>{() => <OrgStructureContent />}</AuthGuard>;
}
