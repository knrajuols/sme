'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import type { UserClaims } from '../../../../lib/auth';
import { PremiumCard } from '../../../../components/ui/PremiumCard';

// ── Reference types ───────────────────────────────────────────────────────────
interface YearRef       { id: string; name: string; }
interface ClassRef      { id: string; name: string; code: string; academicYearId: string; }
interface StructureRef  { id: string; feeCategoryId: string; amount: number; dueDate: string; classId: string; academicYearId: string; }
interface CategoryRef   { id: string; name: string; }

// ── Invoice list type ─────────────────────────────────────────────────────────
interface Invoice {
  id: string;
  studentId: string;
  studentName: string;
  feeStructureId: string;
  categoryName: string;
  amountDue: number;
  amountPaid: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';
  dueDate: string;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(d: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-800 border border-yellow-300' },
  PARTIAL:  { label: 'Partial',  cls: 'bg-blue-100   text-blue-800   border border-blue-300'   },
  PAID:     { label: 'Paid',     cls: 'bg-green-100  text-green-800  border border-green-300'  },
  OVERDUE:  { label: 'Overdue',  cls: 'bg-red-100    text-red-800    border border-red-300'    },
  WAIVED:   { label: 'Waived',   cls: 'bg-slate-100  text-slate-600  border border-slate-300'  },
};

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.PENDING;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ── Inner page ────────────────────────────────────────────────────────────────
function InvoicesPage({ user: _user }: { user: UserClaims }) {
  // Reference data
  const [years, setYears]           = useState<YearRef[]>([]);
  const [classes, setClasses]       = useState<ClassRef[]>([]);
  const [structures, setStructures] = useState<StructureRef[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);

  // Filter selections
  const [yearId, setYearId]       = useState('');
  const [classId, setClassId]     = useState('');
  const [structId, setStructId]   = useState('');

  // Invoice list
  const [invoices, setInvoices]           = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Generate action
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult]   = useState<{ created: number; skipped: number } | null>(null);
  const [genError, setGenError]     = useState<string | null>(null);

  // Load reference data on mount
  useEffect(() => {
    Promise.all([
      bffFetch<YearRef[]>('/api/academic-setup/years'),
      bffFetch<ClassRef[]>('/api/academic-setup/classes'),
      bffFetch<CategoryRef[]>('/api/finance/fee-categories'),
    ]).then(([y, c, cat]) => {
      setYears(y ?? []);
      setClasses(c ?? []);
      setCategories(cat ?? []);
    }).catch(console.error);
  }, []);

  // Load fee structures when year+class are selected
  useEffect(() => {
    if (!yearId || !classId) { setStructures([]); setStructId(''); return; }
    bffFetch<StructureRef[]>(`/api/finance/fee-structures?academicYearId=${yearId}&classId=${classId}`)
      .then((s) => setStructures(s ?? []))
      .catch(console.error);
  }, [yearId, classId]);

  // Reload invoices when class changes
  const loadInvoices = useCallback(() => {
    if (!classId) { setInvoices([]); return; }
    setLoadingInvoices(true);
    bffFetch<Invoice[]>(`/api/finance/invoices?classId=${classId}`)
      .then((rows) => setInvoices(rows ?? []))
      .catch(console.error)
      .finally(() => setLoadingInvoices(false));
  }, [classId]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  function handleYearChange(id: string) {
    setYearId(id);
    setClassId('');
    setStructId('');
    setGenResult(null);
    setGenError(null);
  }

  function handleClassChange(id: string) {
    setClassId(id);
    setStructId('');
    setGenResult(null);
    setGenError(null);
  }

  async function handleGenerate() {
    if (!yearId || !classId || !structId) return;
    setGenerating(true);
    setGenResult(null);
    setGenError(null);
    try {
      const res = await bffFetch<{ created: number; skipped: number }>('/api/finance/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({ academicYearId: yearId, classId, feeStructureId: structId }),
      });
      setGenResult(res);
      loadInvoices();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  }

  const filteredClasses = useMemo(
    () => classes.filter((c) => !yearId || c.academicYearId === yearId),
    [classes, yearId],
  );

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const canGenerate = !!yearId && !!classId && !!structId;

  const selectedStructure = structures.find((s) => s.id === structId);

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Generate Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">Bulk-generate fee invoices for all enrolled students in a class.</p>
        </div>
      </div>

      {/* ── Configuration card ─────────────────────────────────────────────── */}
      <PremiumCard accentColor="purple" className="p-6">
        <h2 className="text-base font-bold text-slate-800 mb-4">Invoice Configuration</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Academic Year */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <select
              value={yearId}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">— Select year —</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Class <span className="text-red-500">*</span>
            </label>
            <select
              value={classId}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={!yearId}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            >
              <option value="">— Select class —</option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          {/* Fee Structure */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Fee Structure <span className="text-red-500">*</span>
            </label>
            <select
              value={structId}
              onChange={(e) => setStructId(e.target.value)}
              disabled={!classId || structures.length === 0}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            >
              <option value="">— Select fee structure —</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {categoryMap[s.feeCategoryId] ?? s.feeCategoryId} — {formatCurrency(s.amount)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview & action */}
        {selectedStructure && (
          <div className="mt-4 rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-800 flex items-center gap-3">
            <span className="font-semibold">Due:</span>
            <span>{formatDate(selectedStructure.dueDate)}</span>
            <span className="mx-2 text-purple-300">|</span>
            <span className="font-semibold">Amount:</span>
            <span>{formatCurrency(selectedStructure.amount)}</span>
          </div>
        )}

        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 text-sm font-semibold text-white transition-colors"
          >
            {generating && <Spinner />}
            {generating ? 'Generating…' : 'Generate Invoices for Class'}
          </button>

          {genResult && (
            <span className="text-sm text-green-700 font-medium">
              ✓ {genResult.created} invoices created, {genResult.skipped} skipped (already existed).
            </span>
          )}
          {genError && (
            <span className="text-sm text-red-600 font-medium">✗ {genError}</span>
          )}
        </div>
      </PremiumCard>

      {/* ── Invoices table ──────────────────────────────────────────────────── */}
      <PremiumCard accentColor="green" className="p-6">
        <h2 className="text-base font-bold text-slate-800 mb-4">Invoices{classId ? ' — Selected Class' : ''}</h2>
        {loadingInvoices ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading invoices…</div>
        ) : !classId ? (
          <div className="py-12 text-center text-slate-400 text-sm">Select a class above to view its invoices.</div>
        ) : invoices.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No invoices found for this class. Use the form above to generate.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="grand-table w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Student Name', 'Fee Category', 'Amount Due', 'Amount Paid', 'Balance', 'Status', 'Due Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {invoices.map((inv) => {
                  const balance = inv.amountDue - inv.amountPaid;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{inv.studentName}</td>
                      <td className="px-4 py-3 text-slate-600">{inv.categoryName}</td>
                      <td className="px-4 py-3 text-slate-800 tabular-nums">{formatCurrency(inv.amountDue)}</td>
                      <td className="px-4 py-3 text-slate-800 tabular-nums">{formatCurrency(inv.amountPaid)}</td>
                      <td className={`px-4 py-3 tabular-nums font-medium ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(balance)}
                      </td>
                      <td className="px-4 py-3"><StatusPill status={inv.status} /></td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(inv.dueDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumCard>
    </div>
  );
}

// ── Auth wrapper ──────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <AuthGuard>{(user) => <InvoicesPage user={user} />}</AuthGuard>
  );
}
