'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';

// ── Domain types ───────────────────────────────────────────────────────────
interface FeeStructureEntry {
  id:             string;
  academicYearId: string;
  classId:        string;
  feeCategoryId:  string;
  amount:         number | null;
  dueDate:        string | null;
  createdAt:      string;
  updatedAt:      string;
}

interface AcademicYear { id: string; name: string }
interface ClassEntry   { id: string; name: string; code: string; academicYearId: string }
interface FeeCategory  { id: string; name: string; description: string | null; parentId: string | null }

interface FeeStructureForm {
  academicYearId: string;
  classId:        string;
  feeCategoryId:  string;
  amount:         string;   // text for controlled input; empty = null
  dueDate:        string;   // ISO date string; empty = null
}

type FormErrors = Partial<Record<keyof FeeStructureForm, string>>;

const EMPTY_FORM: FeeStructureForm = {
  academicYearId: '', classId: '', feeCategoryId: '', amount: '', dueDate: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function formatCurrency(v: number | null): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v);
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Validation ─────────────────────────────────────────────────────────────
function validateForm(f: FeeStructureForm): FormErrors {
  const e: FormErrors = {};
  if (!f.academicYearId) e.academicYearId = 'Academic year is required.';
  if (!f.classId)        e.classId        = 'Class is required.';
  if (!f.feeCategoryId)  e.feeCategoryId  = 'Fee category is required.';
  if (f.amount) {
    const n = parseFloat(f.amount);
    if (isNaN(n) || n < 0) e.amount = 'Amount must be zero or positive.';
  }
  return e;
}

// ── FeeStructurePanel (slide-over) ─────────────────────────────────────────
function FeeStructurePanel({
  open, editing, onClose, onSave, saving,
  academicYears, classes, categories,
}: {
  open:          boolean;
  editing:       FeeStructureEntry | null;
  onClose:       () => void;
  onSave:        (form: FeeStructureForm) => void;
  saving:        boolean;
  academicYears: AcademicYear[];
  classes:       ClassEntry[];
  categories:    FeeCategory[];
}) {
  const isEdit = editing !== null;
  const [form, setForm]     = useState<FeeStructureForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              academicYearId: editing.academicYearId,
              classId:        editing.classId,
              feeCategoryId:  editing.feeCategoryId,
              amount:         editing.amount != null ? String(editing.amount) : '',
              dueDate:        editing.dueDate ? editing.dueDate.slice(0, 10) : '',
            }
          : EMPTY_FORM,
      );
      setErrors({});
    }
  }, [open, editing]);

  function setField<K extends keyof FeeStructureForm>(k: K, v: FeeStructureForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  // Filter classes by selected academic year
  const filteredClasses = useMemo(() => {
    if (!form.academicYearId) return classes;
    return classes.filter((c) => c.academicYearId === form.academicYearId);
  }, [classes, form.academicYearId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(form);
  }

  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors
     ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`;

  const selectCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors
     ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300
          ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose} aria-hidden="true"
      />
      <div
        role="dialog" aria-label={isEdit ? 'Edit Fee Structure' : 'Add Fee Structure'} aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? 'Edit Fee Structure' : 'Add Fee Structure'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Changes apply to the <span className="font-semibold text-violet-700">MASTER TEMPLATE</span> only.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          {/* Academic Year */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <select className={selectCls(errors.academicYearId)} value={form.academicYearId}
              onChange={(e) => { setField('academicYearId', e.target.value); setField('classId', ''); }}
              disabled={isEdit}>
              <option value="">— Select —</option>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
            {errors.academicYearId && <p className="mt-1 text-xs text-red-600">{errors.academicYearId}</p>}
          </div>

          {/* Class */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Class <span className="text-red-500">*</span>
            </label>
            <select className={selectCls(errors.classId)} value={form.classId}
              onChange={(e) => setField('classId', e.target.value)} disabled={isEdit}>
              <option value="">— Select —</option>
              {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
            {errors.classId && <p className="mt-1 text-xs text-red-600">{errors.classId}</p>}
          </div>

          {/* Fee Category (only leaf items — items with parentId, or standalone parents without children) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Fee Item <span className="text-red-500">*</span>
            </label>
            <select className={selectCls(errors.feeCategoryId)} value={form.feeCategoryId}
              onChange={(e) => setField('feeCategoryId', e.target.value)} disabled={isEdit}>
              <option value="">— Select —</option>
              {(() => {
                const parentIdsWithChildren = new Set(categories.filter((c) => c.parentId).map((c) => c.parentId!));
                const leafCats = categories.filter((c) => c.parentId !== null || !parentIdsWithChildren.has(c.id));
                const parentName = (c: FeeCategory) => {
                  if (!c.parentId) return '';
                  const p = categories.find((p) => p.id === c.parentId);
                  return p ? `${p.name} › ` : '';
                };
                return leafCats.map((c) => (
                  <option key={c.id} value={c.id}>{parentName(c)}{c.name}</option>
                ));
              })()}
            </select>
            {errors.feeCategoryId && <p className="mt-1 text-xs text-red-600">{errors.feeCategoryId}</p>}
          </div>

          {/* Amount (optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Amount (INR)
            </label>
            <input type="number" min={0} step={0.01} className={inputCls(errors.amount)}
              value={form.amount} onChange={(e) => setField('amount', e.target.value)}
              placeholder="Leave blank for school to define" />
            {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
            <p className="mt-1 text-xs text-slate-400">Optional — schools can override this during onboarding.</p>
          </div>

          {/* Due Date (optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Due Date
            </label>
            <input type="date" className={inputCls(errors.dueDate)}
              value={form.dueDate} onChange={(e) => setField('dueDate', e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">Optional — schools can set their own due dates.</p>
          </div>

          <div className="flex-1" />

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold
                text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white
                hover:bg-violet-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving&hellip;
                </>
              ) : (isEdit ? 'Update Structure' : 'Create Structure')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── DeleteDialog ───────────────────────────────────────────────────────────
function DeleteDialog({ open, label, onCancel, onConfirm, deleting }: {
  open: boolean; label: string; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Fee Structure</h3>
        <p className="text-sm text-slate-600 mb-6">
          Delete fee structure <span className="font-semibold">&ldquo;{label}&rdquo;</span> from the master template? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={deleting}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold
              text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white
              hover:bg-red-700 disabled:opacity-60 transition-colors">
            {deleting ? 'Deleting\u2026' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inner page content ─────────────────────────────────────────────────────
function FeeStructuresContent() {
  // Reference data
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes,       setClasses]       = useState<ClassEntry[]>([]);
  const [categories,    setCategories]    = useState<FeeCategory[]>([]);

  // Structures list
  const [structures,   setStructures]    = useState<FeeStructureEntry[]>([]);
  const [loading,      setLoading]       = useState(true);
  const [loadError,    setLoadError]     = useState('');

  // Panel + CRUD state
  const [panelOpen,    setPanelOpen]     = useState(false);
  const [editing,      setEditing]       = useState<FeeStructureEntry | null>(null);
  const [saving,       setSaving]        = useState(false);
  const [saveError,    setSaveError]     = useState('');
  const [successMsg,   setSuccessMsg]    = useState('');
  const [deleteTarget, setDeleteTarget]  = useState<FeeStructureEntry | null>(null);
  const [deleting,     setDeleting]      = useState(false);
  const [seeding,      setSeeding]       = useState(false);

  // Filters
  const [filterYear,  setFilterYear]  = useState('');
  const [filterClass, setFilterClass] = useState('');

  // ── Load reference data + structures ──
  const loadStructures = useCallback(async () => {
    const qs = new URLSearchParams();
    if (filterYear)  qs.set('academicYearId', filterYear);
    if (filterClass) qs.set('classId', filterClass);
    const q = qs.toString();
    const rows = await bffFetch<FeeStructureEntry[]>(`/api/web-admin/fee-structures${q ? `?${q}` : ''}`);
    setStructures(Array.isArray(rows) ? rows : []);
  }, [filterYear, filterClass]);

  useEffect(() => {
    async function init() {
      const [years, cls, cats] = await Promise.all([
        bffFetch<AcademicYear[]>('/api/web-admin/academic-years').catch(() => [] as AcademicYear[]),
        bffFetch<ClassEntry[]>('/api/web-admin/classes').catch(() => [] as ClassEntry[]),
        bffFetch<FeeCategory[]>('/api/web-admin/fee-categories').catch(() => [] as FeeCategory[]),
      ]);
      setAcademicYears(Array.isArray(years) ? years : []);
      setClasses(Array.isArray(cls) ? cls : []);
      setCategories(Array.isArray(cats) ? cats : []);
      await loadStructures();
    }
    init()
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load fee structures'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when filters change
  useEffect(() => {
    if (!loading) {
      loadStructures().catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterYear, filterClass]);

  // ── Lookup maps for display ──
  const yearMap     = useMemo(() => new Map(academicYears.map((y) => [y.id, y.name])), [academicYears]);
  const classMap    = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  // Build parent-name lookup: for items that have a parentId, resolve parent name
  const parentNameMap = useMemo(() => {
    const m = new Map<string, string>(); // childId → parentName
    const idToName = new Map(categories.map((c) => [c.id, c.name]));
    for (const c of categories) {
      if (c.parentId) {
        const pName = idToName.get(c.parentId);
        if (pName) m.set(c.id, pName);
      }
    }
    return m;
  }, [categories]);

  // Filter classes by selected filter year
  const filterClasses = useMemo(() => {
    if (!filterYear) return classes;
    return classes.filter((c) => c.academicYearId === filterYear);
  }, [classes, filterYear]);

  function openAdd()                        { setEditing(null); setPanelOpen(true); }
  function openEdit(s: FeeStructureEntry)    { setEditing(s);    setPanelOpen(true); }
  function handleClose()                    { setPanelOpen(false); setSaveError(''); setTimeout(() => setEditing(null), 300); }
  function flash(msg: string)               { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); }

  async function handleSeed() {
    setSeeding(true); setSaveError('');
    try {
      const result = await bffFetch<{ created: number; skipped: number }>('/api/web-admin/fee-structures/seed', {
        method: 'POST',
      });
      await loadStructures();
      flash(`Fee structures seeded: ${result.created} created, ${result.skipped} skipped.`);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Seeding failed');
    } finally {
      setSeeding(false);
    }
  }

  function structureLabel(s: FeeStructureEntry): string {
    return `${categoryMap.get(s.feeCategoryId) ?? 'Category'} — ${classMap.get(s.classId) ?? 'Class'}`;
  }

  async function handleSave(form: FeeStructureForm) {
    setSaving(true); setSaveError('');
    try {
      const payload: Record<string, unknown> = {
        academicYearId: form.academicYearId,
        classId:        form.classId,
        feeCategoryId:  form.feeCategoryId,
      };
      if (form.amount) payload.amount = parseFloat(form.amount);
      if (form.dueDate) payload.dueDate = form.dueDate;

      if (editing) {
        await bffFetch<unknown>(`/api/web-admin/fee-structures/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        await loadStructures();
        flash('Fee structure updated.');
      } else {
        await bffFetch<{ id: string }>('/api/web-admin/fee-structures', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await loadStructures();
        flash('Fee structure created.');
      }
      setSaving(false);
      setPanelOpen(false);
      setTimeout(() => setEditing(null), 300);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bffFetch<unknown>(`/api/web-admin/fee-structures/${deleteTarget.id}`, { method: 'DELETE' });
      setStructures((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      flash(`Fee structure deleted.`);
      setDeleteTarget(null);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 border border-violet-200">
              MASTER TEMPLATE
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Fee Structures</h1>
          <p className="text-sm text-slate-500 mt-1">
            Map fee categories to classes and academic years. Amount and due date are optional at the template level.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {structures.length === 0 && categories.length > 0 && (
            <button type="button" onClick={handleSeed} disabled={seeding}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold
                text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors">
              {seeding ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Seeding&hellip;
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Seed Fee Structures
                </>
              )}
            </button>
          )}
          <button type="button" onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold
              text-white hover:bg-violet-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Structure
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          value={filterYear}
          onChange={(e) => { setFilterYear(e.target.value); setFilterClass(''); }}
        >
          <option value="">All Academic Years</option>
          {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </select>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
        >
          <option value="">All Classes</option>
          {filterClasses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
        </select>
      </div>

      {/* Alerts */}
      {loadError  && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      )}
      {saveError  && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
      )}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {loading && <div className="py-12 text-center text-sm text-slate-400">Loading fee structures&hellip;</div>}

      {!loading && (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Academic Year</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Class</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Due Date</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {structures.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5">
                        {parentNameMap.has(s.feeCategoryId) && (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            {parentNameMap.get(s.feeCategoryId)}
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-sm font-bold text-violet-700 border border-violet-100">
                          {categoryMap.get(s.feeCategoryId) ?? s.feeCategoryId.slice(0, 8)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{yearMap.get(s.academicYearId) ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-700">{classMap.get(s.classId) ?? '—'}</td>
                    <td className="px-5 py-4 text-right font-mono text-slate-700">{formatCurrency(s.amount)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(s.dueDate)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => openEdit(s)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium
                            text-slate-600 hover:bg-slate-50 transition-colors">
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(s)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium
                            text-red-600 hover:bg-red-100 transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {structures.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-400">
                      No fee structures in the master template yet.
                      Click &ldquo;Add Structure&rdquo; to define fee mappings for classes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {structures.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-sm font-bold text-violet-700 border border-violet-100">
                    {categoryMap.get(s.feeCategoryId) ?? 'Category'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mb-1">
                  <span className="font-semibold">Year:</span> {yearMap.get(s.academicYearId) ?? '—'}
                </p>
                <p className="text-xs text-slate-600 mb-1">
                  <span className="font-semibold">Class:</span> {classMap.get(s.classId) ?? '—'}
                </p>
                <p className="text-xs text-slate-600 mb-1">
                  <span className="font-semibold">Amount:</span> {formatCurrency(s.amount)}
                </p>
                <p className="text-xs text-slate-600 mb-3">
                  <span className="font-semibold">Due:</span> {formatDate(s.dueDate)}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(s)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium
                      text-slate-600 hover:bg-slate-50 transition-colors">
                    Edit
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(s)}
                    className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium
                      text-red-600 hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {structures.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">No fee structures yet.</div>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-400">
            {structures.length} fee structure{structures.length !== 1 ? 's' : ''} in master template.
            Schools inherit these structures during onboarding.
          </p>
        </>
      )}

      <FeeStructurePanel
        open={panelOpen}
        editing={editing}
        onClose={handleClose}
        onSave={handleSave}
        saving={saving}
        academicYears={academicYears}
        classes={classes}
        categories={categories}
      />

      <DeleteDialog
        open={deleteTarget !== null}
        label={deleteTarget ? structureLabel(deleteTarget) : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}

// ── Page export ────────────────────────────────────────────────────────────
export default function FeeStructuresPage() {
  return (
    <AuthGuard>
      {(claims) => {
        if (!claims.roles.includes('PLATFORM_ADMIN')) {
          return (
            <div className="py-16 text-center text-sm text-slate-400">
              Access restricted to Platform Admins.
            </div>
          );
        }
        return <FeeStructuresContent />;
      }}
    </AuthGuard>
  );
}
