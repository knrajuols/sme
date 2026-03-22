'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import { PremiumCard } from '../../../../components/ui/PremiumCard';
import { StatusPill } from '../../../../components/ui/StatusPill';

// -- Types ---------------------------------------------------------------------
interface DeptRef { id: string; name: string; code: string }
interface RoleRef { id: string; name: string; code: string }

interface EmployeeRecord {
  id: string;
  firstName: string;
  lastName: string | null;
  contactPhone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  isActive: boolean;
  createdAt: string;
  department: DeptRef;
  role: RoleRef;
}

// -- Derivation helpers --------------------------------------------------------
function fullName(e: EmployeeRecord): string {
  return [e.firstName, e.lastName].filter(Boolean).join(' ');
}

function deriveEmpId(e: EmployeeRecord): string {
  const prefix = (e.department?.code ?? e.department?.name ?? 'EMP')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 4)
    .toUpperCase();
  const suffix = e.id.replace(/-/g, '').slice(0, 5).toUpperCase();
  return `${prefix}-${suffix}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// -- Sort helpers --------------------------------------------------------------
type SortCol = 'empId' | 'name' | 'dept' | 'role' | 'status' | 'joinDate';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-slate-300 text-xs">&#x2195;</span>;
  return <span className="ml-1 text-indigo-500 text-xs">{dir === 'asc' ? '↑' : '↓'}</span>;
}

// -- Main Content --------------------------------------------------------------
function EmployeeDirectoryContent() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [allDepts, setAllDepts] = useState<DeptRef[]>([]);
  const [allRoles, setAllRoles] = useState<RoleRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [search, setSearch] = useState('');

  // Sort
  const [sortCol, setSortCol] = useState<SortCol>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = useCallback((col: SortCol) => {
    setSortCol((prev) => {
      if (prev === col) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return col; }
      setSortDir('asc');
      return col;
    });
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [empRes, depRes, rolRes] = await Promise.all([
          bffFetch<EmployeeRecord[]>('/api/hr/employees'),
          bffFetch<DeptRef[]>('/api/hr/departments'),
          bffFetch<RoleRef[]>('/api/hr/roles'),
        ]);
        setEmployees(empRes ?? []);
        setAllDepts(depRes ?? []);
        setAllRoles(rolRes ?? []);
      } catch {
        setError('Failed to load employee directory.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Pipeline: filter -> sort
  const displayed = useMemo(() => {
    let list = employees;
    if (filterDept) list = list.filter(e => e.department?.id === filterDept);
    if (filterRole) list = list.filter(e => e.role?.id === filterRole);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e =>
        fullName(e).toLowerCase().includes(q) ||
        (e.email ?? '').toLowerCase().includes(q) ||
        (e.contactPhone ?? '').includes(q)
      );
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'empId':    cmp = deriveEmpId(a).localeCompare(deriveEmpId(b)); break;
        case 'name':     cmp = fullName(a).toLowerCase().localeCompare(fullName(b).toLowerCase()); break;
        case 'dept':     cmp = (a.department?.name ?? '').toLowerCase().localeCompare((b.department?.name ?? '').toLowerCase()); break;
        case 'role':     cmp = (a.role?.name ?? '').toLowerCase().localeCompare((b.role?.name ?? '').toLowerCase()); break;
        case 'status':   cmp = Number(b.isActive) - Number(a.isActive); break;
        case 'joinDate': cmp = new Date(a.dateOfJoining ?? a.createdAt ?? 0).getTime() - new Date(b.dateOfJoining ?? b.createdAt ?? 0).getTime(); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [employees, filterDept, filterRole, search, sortCol, sortDir]);

  const hasFilters = filterDept || filterRole || search;

  // Sortable header helper
  const Th = ({ col, label, className = '' }: { col: SortCol; label: string; className?: string }) => (
    <th className={`px-4 py-3 ${className}`}>
      <button
        onClick={() => toggleSort(col)}
        className="flex items-center gap-0.5 font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
      >
        {label}<SortIcon active={sortCol === col} dir={sortDir} />
      </button>
    </th>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Employee Directory</h1>
        <p className="text-sm text-slate-500 mt-1">
          Unified view of all staff across departments - Teachers, Drivers, Attendants, and more
        </p>
      </div>

      {/* Context Banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <span className="text-base leading-5 shrink-0">&#x1F4A1;</span>
        <span>
          This directory provides a <strong>unified, read-only view</strong> of all staff.
          To onboard a new employee, please use their respective domain module
          (e.g., <strong>People &rsaquo; Faculty</strong>, or <strong>Transport &rsaquo; Staff</strong>)
          to ensure proper role assignments and specialised data are captured correctly.
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
          <button className="ml-3 underline text-red-600" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Search</label>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
            placeholder="Name, email, or phone..." />
        </div>

        {/* Department filter */}
        <div className="min-w-[180px]">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white">
            <option value="">All Departments</option>
            {allDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* Role filter */}
        <div className="min-w-[180px]">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white">
            <option value="">All Roles</option>
            {allRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {/* Reset */}
        {hasFilters && (
          <button onClick={() => { setFilterDept(''); setFilterRole(''); setSearch(''); }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold underline pb-2">
            Reset
          </button>
        )}
      </div>

      {/* Summary */}
      <p className="text-sm text-slate-500">
        Showing <span className="font-semibold text-slate-700">{displayed.length}</span> of{' '}
        <span className="font-semibold text-slate-700">{employees.length}</span> employees
      </p>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <PremiumCard>
          {displayed.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-lg font-semibold">
                {employees.length === 0 ? 'No employees in this school yet' : 'No employees match your filters'}
              </p>
              <p className="text-sm mt-1">
                {employees.length === 0
                  ? 'Employees are automatically created when you add Teachers, Drivers, or Attendants.'
                  : 'Try adjusting your department, role, or search criteria.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <Th col="empId"    label="Employee ID" />
                    <Th col="name"     label="Employee Name" />
                    <th className="px-4 py-3 font-semibold text-slate-600">Contact</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Date of Birth</th>
                    <Th col="joinDate" label="Date of Joining" />
                    <Th col="dept"     label="Department" />
                    <Th col="role"     label="Role" />
                    <Th col="status"   label="Status" />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(emp => (
                    <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">
                        {deriveEmpId(emp)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{fullName(emp)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{emp.contactPhone ?? '-'}</div>
                        {emp.email && <div className="text-xs text-slate-400">{emp.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(emp.dateOfBirth)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(emp.dateOfJoining ?? emp.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {emp.department?.name ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {emp.role?.name ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={emp.isActive ? 'Active' : 'Inactive'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PremiumCard>
      )}
    </div>
  );
}

// -- Page Export ----------------------------------------------------------------
export default function EmployeeDirectoryPage() {
  return (
    <AuthGuard>
      {() => <EmployeeDirectoryContent />}
    </AuthGuard>
  );
}

