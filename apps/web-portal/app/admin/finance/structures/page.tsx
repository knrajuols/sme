'use client';

import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import type { UserClaims } from '../../../../lib/auth';
import { PremiumCard } from '../../../../components/ui/PremiumCard';

// ── Reference types ───────────────────────────────────────────────────────────
interface YearRef     { id: string; name: string; }
interface ClassRef    { id: string; name: string; code: string; academicYearId: string; }
interface CategoryRef { id: string; name: string; }

// ── Domain types ──────────────────────────────────────────────────────────────
interface FeeStructure {
  id: string;
  academicYearId: string;
  classId: string;
  feeCategoryId: string;
  amount: number;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

interface StructureForm {
  academicYearId: string;
  classId: string;
  feeCategoryId: string;
  amount: string;
  dueDate: string;
}

interface UpdateForm {
  amount: string;
  dueDate: string;
}

type FormErrors = Partial<Record<keyof StructureForm, string>>;

const EMPTY_CREATE: StructureForm = {
  academicYearId: '',
  classId: '',
  feeCategoryId: '',
  amount: '',
  dueDate: '',
};

function validateCreate(f: StructureForm): FormErrors {
  const e: FormErrors = {};
  if (!f.academicYearId)            e.academicYearId = 'Academic year is required.';
  if (!f.classId)                   e.classId        = 'Class is required.';
  if (!f.feeCategoryId)             e.feeCategoryId  = 'Fee category is required.';
  if (!f.amount || isNaN(parseFloat(f.amount)) || parseFloat(f.amount) <= 0)
                                    e.amount         = 'Enter a valid positive amount.';
  if (!f.dueDate)                   e.dueDate        = 'Due date is required.';
  return e;
}

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

// ── Slide-over panel ──────────────────────────────────────────────────────────
function StructurePanel({
  open,
  editing,
  years,
  classes,
  categories,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  editing: FeeStructure | null;
  years: YearRef[];
  classes: ClassRef[];
  categories: CategoryRef[];
  onClose: () => void;
  onSave: (form: StructureForm | UpdateForm) => void;
  saving: boolean;
}) {
  const isEdit = editing !== null;

  const [createForm, setCreateForm] = useState<StructureForm>(EMPTY_CREATE);
  const [updateForm, setUpdateForm] = useState<UpdateForm>({ amount: '', dueDate: '' });
  const [errors, setErrors]         = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      if (editing) {
        setUpdateForm({
          amount: String(editing.amount),
          dueDate: editing.dueDate?.slice(0, 10) ?? '',
        });
      } else {
        setCreateForm(EMPTY_CREATE);
      }
      setErrors({});
    }
  }, [open, editing]);

  const filteredClasses = useMemo(
    () => classes.filter((c) => !createForm.academicYearId || c.academicYearId === createForm.academicYearId),
    [classes, createForm.academicYearId],
  );

  function setCreate<K extends keyof StructureForm>(k: K, v: StructureForm[K]) {
    setCreateForm((p) => ({ ...p, [k]: v, ...(k === 'academicYearId' ? { classId: '' } : {}) }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit) {
      const errs: FormErrors = {};
      if (!updateForm.amount || isNaN(parseFloat(updateForm.amount)) || parseFloat(updateForm.amount) <= 0)
        errs.amount = 'Enter a valid positive amount.';
      if (!updateForm.dueDate) errs.dueDate = 'Due date is required.';
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
      onSave(updateForm);
      return;
    }
    const errs = validateCreate(createForm);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(createForm);
  }

  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors ${
      err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'
    }`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={isEdit ? 'Edit Fee Structure' : 'Add Fee Structure'}
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? 'Edit Fee Structure' : 'New Fee Structure'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update amount or due date.' : 'Assign a fee to a class for an academic year.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          {!isEdit && (
            <>
              {/* Academic Year */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Academic Year <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputCls(errors.academicYearId)}
                  value={createForm.academicYearId}
                  onChange={(e) => setCreate('academicYearId', e.target.value)}
                >
                  <option value="">— select year —</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
                {errors.academicYearId && <p className="mt-1 text-xs text-red-600">{errors.academicYearId}</p>}
              </div>

              {/* Class */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Class <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputCls(errors.classId)}
                  value={createForm.classId}
                  onChange={(e) => setCreate('classId', e.target.value)}
                  disabled={!createForm.academicYearId}
                >
                  <option value="">— select class —</option>
                  {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
                {errors.classId && <p className="mt-1 text-xs text-red-600">{errors.classId}</p>}
              </div>

              {/* Fee Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Fee Category <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputCls(errors.feeCategoryId)}
                  value={createForm.feeCategoryId}
                  onChange={(e) => setCreate('feeCategoryId', e.target.value)}
                >
                  <option value="">— select category —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.feeCategoryId && <p className="mt-1 text-xs text-red-600">{errors.feeCategoryId}</p>}
              </div>
            </>
          )}

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              className={inputCls(errors.amount)}
              value={isEdit ? updateForm.amount : createForm.amount}
              onChange={(e) =>
                isEdit
                  ? setUpdateForm((p) => ({ ...p, amount: e.target.value }))
                  : setCreate('amount', e.target.value)
              }
              placeholder="e.g. 1500.00"
            />
            {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className={inputCls(errors.dueDate)}
              value={isEdit ? updateForm.dueDate : createForm.dueDate}
              onChange={(e) =>
                isEdit
                  ? setUpdateForm((p) => ({ ...p, dueDate: e.target.value }))
                  : setCreate('dueDate', e.target.value)
              }
            />
            {errors.dueDate && <p className="mt-1 text-xs text-red-600">{errors.dueDate}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Structure'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function FeeStructuresPage({ user: _user }: { user: UserClaims }) {
  const [rows, setRows]             = useState<FeeStructure[]>([]);
  const [years, setYears]           = useState<YearRef[]>([]);
  const [classes, setClasses]       = useState<ClassRef[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [loading, setLoading]       = useState(true);
  const [panelOpen, setPanelOpen]   = useState(false);
  const [editing, setEditing]       = useState<FeeStructure | null>(null);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [banner, setBanner]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Filter state
  const [filterYear, setFilterYear]   = useState('');
  const [filterClass, setFilterClass] = useState('');

  function showBanner(type: 'success' | 'error', msg: string) {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 4000);
  }

  async function loadAll(yearId?: string, classId?: string) {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (yearId)  qs.set('academicYearId', yearId);
      if (classId) qs.set('classId', classId);
      const qsStr = qs.toString();

      const [data, y, c, cats] = await Promise.all([
        bffFetch<FeeStructure[]>(`/api/finance/fee-structures${qsStr ? `?${qsStr}` : ''}`),
        bffFetch<YearRef[]>('/api/academic-setup/years'),
        bffFetch<ClassRef[]>('/api/academic-setup/classes'),
        bffFetch<CategoryRef[]>('/api/finance/fee-categories'),
      ]);
      setRows(data);
      setYears(y);
      setClasses(c);
      setCategories(cats);
    } catch {
      showBanner('error', 'Failed to load fee structures.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const filteredClassesForFilter = useMemo(
    () => classes.filter((c) => !filterYear || c.academicYearId === filterYear),
    [classes, filterYear],
  );

  function applyFilters(yearId: string, classId: string) {
    setFilterYear(yearId);
    setFilterClass(classId);
    void loadAll(yearId || undefined, classId || undefined);
  }

  function openCreate() { setEditing(null); setPanelOpen(true); }
  function openEdit(r: FeeStructure) { setEditing(r); setPanelOpen(true); }
  function closePanel() { setPanelOpen(false); setEditing(null); }

  function categoryName(id: string): string {
    return categories.find((c) => c.id === id)?.name ?? '—';
  }
  function className(id: string): string {
    const c = classes.find((cl) => cl.id === id);
    return c ? `${c.name} (${c.code})` : '—';
  }
  function yearName(id: string): string {
    return years.find((y) => y.id === id)?.name ?? '—';
  }

  async function handleSave(form: StructureForm | UpdateForm) {
    setSaving(true);
    try {
      if (editing) {
        const f = form as UpdateForm;
        await bffFetch(`/api/finance/fee-structures/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            amount: parseFloat(f.amount),
            dueDate: f.dueDate,
          }),
        });
        showBanner('success', 'Fee structure updated.');
      } else {
        const f = form as StructureForm;
        await bffFetch('/api/finance/fee-structures', {
          method: 'POST',
          body: JSON.stringify({
            academicYearId: f.academicYearId,
            classId: f.classId,
            feeCategoryId: f.feeCategoryId,
            amount: parseFloat(f.amount),
            dueDate: f.dueDate,
          }),
        });
        showBanner('success', 'Fee structure created.');
      }
      closePanel();
      await loadAll(filterYear || undefined, filterClass || undefined);
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this fee structure? This cannot be undone if invoices exist.')) return;
    setDeleting(id);
    try {
      await bffFetch(`/api/finance/fee-structures/${id}`, { method: 'DELETE' });
      showBanner('success', 'Fee structure deleted.');
      await loadAll(filterYear || undefined, filterClass || undefined);
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Fee Structures</h1>
          <p className="text-sm text-slate-500 mt-1">
            Assign fee amounts and due dates to classes for each academic year.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-green-700 transition-colors"
        >
          + New Structure
        </button>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border ${
            banner.type === 'success'
              ? 'bg-green-50 border-green-300 text-green-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}
        >
          {banner.msg}
        </div>
      )}

      {/* Filter Bar */}
      <PremiumCard accentColor="yellow" className="p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-xs font-semibold text-slate-600">Academic Year</label>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              value={filterYear}
              onChange={(e) => {
                const y = e.target.value;
                setFilterYear(y);
                setFilterClass('');
                applyFilters(y, '');
              }}
            >
              <option value="">All Years</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-xs font-semibold text-slate-600">Class</label>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              value={filterClass}
              onChange={(e) => {
                const c = e.target.value;
                setFilterClass(c);
                applyFilters(filterYear, c);
              }}
              disabled={!filterYear}
            >
              <option value="">All Classes</option>
              {filteredClassesForFilter.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          {(filterYear || filterClass) && (
            <button
              onClick={() => applyFilters('', '')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </PremiumCard>

      {/* Table */}
      <PremiumCard accentColor="green" className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse h-10 rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="text-4xl mb-3">💰</p>
            <p className="font-medium">No fee structures found.</p>
            <p className="text-xs mt-1">
              {filterYear || filterClass ? 'Try clearing the filters, or click ' : 'Click '}
              &quot;+ New Structure&quot; to get started.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="grand-table hidden md:table w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Year</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Due Date</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-slate-600">{yearName(r.academicYearId)}</td>
                    <td className="px-5 py-3 text-slate-700 font-medium">{className(r.classId)}</td>
                    <td className="px-5 py-3 text-slate-700">{categoryName(r.feeCategoryId)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(r.amount)}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(r.dueDate)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={deleting === r.id}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          {deleting === r.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {rows.map((r) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{categoryName(r.feeCategoryId)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{className(r.classId)} · {yearName(r.academicYearId)}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatCurrency(r.amount)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Due: {formatDate(r.dueDate)}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => openEdit(r)}
                      className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deleting === r.id}
                      className="flex-1 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      {deleting === r.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </PremiumCard>

      <StructurePanel
        open={panelOpen}
        editing={editing}
        years={years}
        classes={classes}
        categories={categories}
        onClose={closePanel}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}

export default function Page() {
  return <AuthGuard>{(user) => <FeeStructuresPage user={user} />}</AuthGuard>;
}
