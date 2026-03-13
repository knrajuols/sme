'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import type { UserClaims } from '../../../../lib/auth';
import { PremiumCard } from '../../../../components/ui/PremiumCard';

// ── Reference types ───────────────────────────────────────────────────────────
interface YearRef  { id: string; name: string; }
interface ClassRef { id: string; name: string; code: string; academicYearId: string; }

// ── Invoice type ──────────────────────────────────────────────────────────────
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

const PAYMENT_METHODS = ['CASH', 'ONLINE', 'CHEQUE', 'DD', 'UPI'] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

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

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ── Collect Payment slide-over ────────────────────────────────────────────────
interface CollectPanelProps {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSuccess: (paymentId: string) => void;
}

function CollectPanel({ open, invoice, onClose, onSuccess }: CollectPanelProps) {
  const [amount, setAmount]     = useState('');
  const [method, setMethod]     = useState<PaymentMethod>('CASH');
  const [ref, setRef]           = useState('');
  const [remarks, setRemarks]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (open && invoice) {
      const remaining = invoice.amountDue - invoice.amountPaid;
      setAmount(remaining > 0 ? String(remaining) : '');
      setMethod('CASH');
      setRef('');
      setRemarks('');
      setError(null);
    }
  }, [open, invoice]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid positive amount.');
      return;
    }
    const remaining = invoice.amountDue - invoice.amountPaid;
    if (parsed > remaining) {
      setError(`Amount cannot exceed the outstanding balance of ${formatCurrency(remaining)}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await bffFetch<{ paymentId: string; newStatus: string; newAmountPaid: number }>(
        '/api/finance/payments',
        {
          method: 'POST',
          body: JSON.stringify({
            invoiceId: invoice.id,
            studentId: invoice.studentId,
            amount: parsed,
            paymentMethod: method,
            referenceNumber: ref || undefined,
            remarks: remarks || undefined,
          }),
        },
      );
      onSuccess(res.paymentId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to collect payment');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (hasErr?: boolean) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors ${
      hasErr ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'
    }`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">Collect Payment</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {invoice && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-sm space-y-1">
            <div className="font-semibold text-slate-800">{invoice.studentName}</div>
            <div className="text-slate-500">{invoice.categoryName} · Due: {formatDate(invoice.dueDate)}</div>
            <div className="flex gap-4 text-xs mt-1">
              <span className="text-slate-600">Total: <span className="font-medium text-slate-800">{formatCurrency(invoice.amountDue)}</span></span>
              <span className="text-slate-600">Paid: <span className="font-medium text-green-700">{formatCurrency(invoice.amountPaid)}</span></span>
              <span className="text-slate-600">Balance: <span className="font-medium text-red-600">{formatCurrency(invoice.amountDue - invoice.amountPaid)}</span></span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-6 overflow-y-auto max-h-[calc(100vh-200px)]">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null); }}
              placeholder="Enter amount"
              className={inputCls(!!error && error.toLowerCase().includes('amount'))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className={inputCls()}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Reference Number <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Cheque no., transaction ID, etc."
              className={inputCls()}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Remarks <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any notes…"
              className={`${inputCls()} resize-none`}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              {saving && <Spinner />}
              {saving ? 'Processing…' : 'Confirm Payment'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 hover:border-slate-400 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Inner page ────────────────────────────────────────────────────────────────
function CollectionPage({ user: _user }: { user: UserClaims }) {
  // Reference data
  const [years, setYears]     = useState<YearRef[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);

  // Filters
  const [yearId, setYearId]         = useState('');
  const [classId, setClassId]       = useState('');
  const [nameFilter, setNameFilter] = useState('');

  // Invoice list
  const [invoices, setInvoices]               = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Slide-over state
  const [panelOpen, setPanelOpen]         = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [successMsg, setSuccessMsg]       = useState<string | null>(null);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);

  // Load years + classes on mount
  useEffect(() => {
    Promise.all([
      bffFetch<YearRef[]>('/api/academic-setup/years'),
      bffFetch<ClassRef[]>('/api/academic-setup/classes'),
    ]).then(([y, c]) => {
      setYears(y ?? []);
      setClasses(c ?? []);
    }).catch(console.error);
  }, []);

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
    setSuccessMsg(null);
  }

  function handleClassChange(id: string) {
    setClassId(id);
    setNameFilter('');
    setSuccessMsg(null);
  }

  function openCollect(inv: Invoice) {
    setActiveInvoice(inv);
    setPanelOpen(true);
  }

  function handlePaymentSuccess(paymentId: string) {
    setLastPaymentId(paymentId);
    setSuccessMsg(`Payment recorded for ${activeInvoice?.studentName ?? 'student'}.`);
    loadInvoices();
  }

  const filteredClasses = useMemo(
    () => classes.filter((c) => !yearId || c.academicYearId === yearId),
    [classes, yearId],
  );

  const displayedInvoices = useMemo(() => {
    if (!nameFilter.trim()) return invoices;
    const lc = nameFilter.toLowerCase();
    return invoices.filter((inv) => inv.studentName.toLowerCase().includes(lc));
  }, [invoices, nameFilter]);

  const canCollect = (status: string) => status === 'PENDING' || status === 'PARTIAL' || status === 'OVERDUE';

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Fee Collection</h1>
        <p className="text-sm text-slate-500 mt-1">View outstanding invoices and record payments for students.</p>
      </div>

      {/* ── Filters card ───────────────────────────────────────────────────── */}
      <PremiumCard accentColor="yellow" className="p-6">
        <h2 className="text-base font-bold text-slate-800 mb-4">Filter</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Academic Year */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Academic Year</label>
            <select
              value={yearId}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">— All years —</option>
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
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">— Select class —</option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          {/* Student name search */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Search Student</label>
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Type student name…"
              disabled={!classId}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50"
            />
          </div>
        </div>
      </PremiumCard>

      {/* Success banner */}
      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center justify-between">
          <span className="flex items-center gap-3">
            <span>✓ {successMsg}</span>
            {lastPaymentId && (
              <Link
                href={`/admin/finance/receipt/${lastPaymentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-green-700 hover:bg-green-800 px-3 py-1 text-xs font-semibold text-white transition-colors"
              >
                View Receipt
              </Link>
            )}
          </span>
          <button onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-800 font-medium">Dismiss</button>
        </div>
      )}

      {/* ── Invoices table ──────────────────────────────────────────────────── */}
      <PremiumCard accentColor="green" className="p-6">
        <h2 className="text-base font-bold text-slate-800 mb-4">Outstanding Invoices</h2>
        {loadingInvoices ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading invoices…</div>
        ) : !classId ? (
          <div className="py-12 text-center text-slate-400 text-sm">Select a class above to view outstanding invoices.</div>
        ) : displayedInvoices.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            {nameFilter ? 'No invoices match the search.' : 'No invoices found for this class.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="grand-table w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Student Name', 'Fee Category', 'Amount Due', 'Amount Paid', 'Balance', 'Status', 'Due Date', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {displayedInvoices.map((inv) => {
                  const balance = inv.amountDue - inv.amountPaid;
                  const collectible = canCollect(inv.status);
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
                      <td className="px-4 py-3">
                        {collectible ? (
                          <button
                            onClick={() => openCollect(inv)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                          >
                            Collect Payment
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumCard>

      <CollectPanel
        open={panelOpen}
        invoice={activeInvoice}
        onClose={() => setPanelOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}

// ── Auth wrapper ──────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <AuthGuard>{(user) => <CollectionPage user={user} />}</AuthGuard>
  );
}
