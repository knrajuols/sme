'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { bffFetch } from '../../../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaymentReceipt {
  id: string;
  tenantId: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string | null;
  remarks: string | null;
  createdAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
  };
  invoice: {
    id: string;
    amountDue: number;
    amountPaid: number;
    status: string;
    dueDate: string;
    feeStructure: {
      id: string;
      amount: number;
      feeCategory: { id: string; name: string };
    };
  };
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
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ── Receipt Component ─────────────────────────────────────────────────────────

function ReceiptView({ payment }: { payment: PaymentReceipt }) {
  const balance = payment.invoice.amountDue - payment.invoice.amountPaid;

  return (
    <div className="min-h-screen bg-white print:bg-white">
      {/* ── Screen-only toolbar ─────────────────────────────────────────── */}
      <div className="print:hidden bg-slate-800 text-white px-6 py-3 flex items-center justify-between no-print">
        <Link
          href="/admin/finance/collection"
          className="text-sm text-slate-300 hover:text-white transition-colors"
        >
          ← Back to Fee Collection
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
          </svg>
          Print Receipt
        </button>
      </div>

      {/* ── Receipt paper ───────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto my-8 print:my-0 px-4 print:px-0">
        <div className="border border-slate-300 rounded-lg print:border-0 p-8 print:p-0 bg-white shadow-lg print:shadow-none">

          {/* Header */}
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <div className="flex justify-center mb-2">
              {/* Placeholder logo */}
              <div className="w-16 h-16 rounded-full bg-slate-200 border-2 border-slate-400 flex items-center justify-center print:border-slate-500">
                <span className="text-2xl font-black text-slate-600 print:text-black">S</span>
              </div>
            </div>
            <h1 className="text-xl font-black uppercase tracking-widest text-black">School Management Enterprise</h1>
            <p className="text-sm text-slate-500 print:text-black mt-0.5">123 Education Road, City — Phone: +91-XXXXXXXXXX</p>
            <div className="mt-3 inline-block border-2 border-black px-6 py-1">
              <span className="text-sm font-bold uppercase tracking-wider text-black">Official Fee Receipt</span>
            </div>
          </div>

          {/* Meta: receipt no + date */}
          <div className="flex justify-between text-sm mb-6">
            <div>
              <span className="font-semibold text-black">Receipt No:</span>
              <span className="ml-2 font-mono text-black">{payment.referenceNumber ?? payment.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div>
              <span className="font-semibold text-black">Date:</span>
              <span className="ml-2 text-black">{formatDate(payment.paymentDate)}</span>
            </div>
          </div>

          {/* Student details */}
          <div className="border border-black rounded p-4 mb-6 grid grid-cols-2 gap-y-2 text-sm print:rounded-none">
            <div>
              <span className="font-semibold text-black">Student Name:</span>
              <span className="ml-2 text-black">{payment.student.firstName} {payment.student.lastName}</span>
            </div>
            <div>
              <span className="font-semibold text-black">Admission No:</span>
              <span className="ml-2 font-mono text-black">{payment.student.admissionNumber}</span>
            </div>
            <div>
              <span className="font-semibold text-black">Invoice No:</span>
              <span className="ml-2 font-mono text-black">{payment.invoiceId.slice(0, 8).toUpperCase()}</span>
            </div>
            <div>
              <span className="font-semibold text-black">Fee Due Date:</span>
              <span className="ml-2 text-black">{formatDate(payment.invoice.dueDate)}</span>
            </div>
          </div>

          {/* Payment table */}
          <table className="w-full border-collapse border border-black text-sm mb-6">
            <thead>
              <tr className="bg-black text-white print:bg-black print:text-white">
                <th className="border border-black px-4 py-2 text-left font-semibold w-1/2">Fee Description</th>
                <th className="border border-black px-4 py-2 text-right font-semibold">Fee Amount</th>
                <th className="border border-black px-4 py-2 text-right font-semibold">Amount Paid</th>
                <th className="border border-black px-4 py-2 text-center font-semibold">Method</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-4 py-3 text-black">
                  {payment.invoice.feeStructure.feeCategory.name}
                </td>
                <td className="border border-black px-4 py-3 text-right font-mono text-black">
                  {formatCurrency(payment.invoice.amountDue)}
                </td>
                <td className="border border-black px-4 py-3 text-right font-mono font-bold text-black">
                  {formatCurrency(payment.amount)}
                </td>
                <td className="border border-black px-4 py-3 text-center text-black">
                  {payment.paymentMethod}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="border border-black px-4 py-2 text-black" colSpan={1}>Summary</td>
                <td className="border border-black px-4 py-2 text-right font-mono text-black">
                  Total Due: {formatCurrency(payment.invoice.amountDue)}
                </td>
                <td className="border border-black px-4 py-2 text-right font-mono text-black">
                  Paid: {formatCurrency(payment.invoice.amountPaid)}
                </td>
                <td className={`border border-black px-4 py-2 text-center font-bold ${balance > 0 ? 'text-red-700 print:text-black' : 'text-green-700 print:text-black'}`}>
                  Bal: {formatCurrency(balance)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Amount in words row */}
          <div className="border border-black rounded px-4 py-2 text-sm mb-6 print:rounded-none">
            <span className="font-semibold text-black">Amount Paid (in words):</span>
            <span className="ml-2 italic text-black">
              {/* Simple number-to-words placeholder */}
              {formatCurrency(payment.amount)} (see amount above)
            </span>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-end mt-10 pt-4 border-t border-black text-sm">
            <div className="text-slate-500 print:text-black space-y-1">
              <p className="text-xs">Generated by System · {new Date(payment.createdAt).toLocaleString('en-IN')}</p>
              {payment.remarks && (
                <p className="text-xs italic">Remarks: {payment.remarks}</p>
              )}
            </div>
            <div className="text-center">
              <div className="w-40 border-b border-black mb-1" />
              <p className="text-xs font-semibold text-black">Authorised Signatory</p>
              <p className="text-xs text-slate-500 print:text-black">Principal / Accounts</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReceiptPage({ params }: { params: { id: string } }) {
  const [receipt, setReceipt]   = useState<PaymentReceipt | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bffFetch<PaymentReceipt>(`/api/finance/payments/${params.id}`)
      .then((data) => { if (!cancelled) setReceipt(data); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load receipt'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-500">
        Loading receipt…
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 text-slate-700">
        <p className="text-red-600 font-semibold">{error ?? 'Receipt not found.'}</p>
        <Link href="/admin/finance/collection" className="text-sm text-blue-600 underline">
          ← Return to Fee Collection
        </Link>
      </div>
    );
  }

  return <ReceiptView payment={receipt} />;
}
