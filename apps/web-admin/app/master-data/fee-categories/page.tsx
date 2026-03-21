'use client';

import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';

// ── Domain types ───────────────────────────────────────────────────────────
interface FeeCategoryEntry {
  id:          string;
  name:        string;
  description: string | null;
  parentId:    string | null;
  createdAt:   string;
  updatedAt:   string;
}

interface FeeCategoryForm {
  name:        string;
  description: string;
}

type FormErrors = Partial<Record<keyof FeeCategoryForm, string>>;

const EMPTY_FORM: FeeCategoryForm = { name: '', description: '' };

// ── Hierarchical seed data: 4 parent categories with items ─────────────────
interface SeedCategory {
  name: string;
  description: string;
  items?: { name: string; description: string }[];
}
const SEED_HIERARCHY: SeedCategory[] = [
  {
    name: 'Admission Fee',
    description: 'One-time fees collected during admissions',
    items: [
      { name: 'Registration Fee',                 description: 'Non-refundable one-time registration fee' },
      { name: 'Admission Fee',                     description: 'One-time fee paid upon student admission' },
      { name: 'Security Deposit/Caution Deposit',  description: 'Refundable security deposit collected at admission' },
    ],
  },
  {
    name: 'Annual Fees',
    description: 'Recurring annual charges billed once per academic year',
    items: [
      { name: 'Infrastructure/Development Fee',  description: 'Annual infrastructure and campus development charge' },
      { name: 'Examination Fee',                 description: 'Annual examination and assessment fee' },
      { name: 'Lab/Library Fee',                 description: 'Annual laboratory and library access charge' },
      { name: 'Student Insurance & Diary',       description: 'Annual student insurance premium and school diary' },
    ],
  },
  {
    name: 'Tuition Fee',
    description: 'Monthly or term-based tuition fee (class-tier pricing)',
  },
  {
    name: 'Utilities Fee',
    description: 'Transport and other utility charges (school defines amount)',
  },
];

// ── Form validation ────────────────────────────────────────────────────────
function validateForm(f: FeeCategoryForm): FormErrors {
  const e: FormErrors = {};
  if (!f.name.trim()) e.name = 'Name is required.';
  else if (f.name.trim().length < 2) e.name = 'Name must be at least 2 characters.';
  return e;
}

// ── FeeCategoryPanel (slide-over) ──────────────────────────────────────────
function FeeCategoryPanel({
  open, editing, onClose, onSave, saving,
}: {
  open:    boolean;
  editing: FeeCategoryEntry | null;
  onClose: () => void;
  onSave:  (form: FeeCategoryForm) => void;
  saving:  boolean;
}) {
  const isEdit = editing !== null;
  const [form, setForm]     = useState<FeeCategoryForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? { name: editing.name, description: editing.description ?? '' }
          : EMPTY_FORM,
      );
      setErrors({});
    }
  }, [open, editing]);

  function setField<K extends keyof FeeCategoryForm>(k: K, v: FeeCategoryForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(form);
  }

  const inputCls = (err?: string) =>
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
        role="dialog" aria-label={isEdit ? 'Edit Fee Category' : 'Add Fee Category'} aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? 'Edit Fee Category' : 'Add Fee Category'}
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
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input type="text" className={inputCls(errors.name)}
              value={form.name} onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Tuition Fee" maxLength={200} autoFocus />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Description
            </label>
            <textarea className={inputCls()}
              value={form.description} onChange={(e) => setField('description', e.target.value)}
              placeholder="Optional description of this fee category" maxLength={500} rows={3} />
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
              ) : (isEdit ? 'Update Category' : 'Create Category')}
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
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Fee Category</h3>
        <p className="text-sm text-slate-600 mb-6">
          Delete fee category <span className="font-semibold">&ldquo;{label}&rdquo;</span> from the master template? This cannot be undone.
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
function FeeCategoriesContent() {
  const [categories,   setCategories]   = useState<FeeCategoryEntry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState('');
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [editing,      setEditing]      = useState<FeeCategoryEntry | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FeeCategoryEntry | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [seeding,      setSeeding]      = useState(false);

  async function loadCategories() {
    const rows = await bffFetch<FeeCategoryEntry[]>('/api/web-admin/fee-categories');
    setCategories(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    loadCategories()
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load fee categories'))
      .finally(() => setLoading(false));
  }, []);

  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  // Build hierarchy: parent categories → children items
  const hierarchy = useMemo(() => {
    const parents = sortedCategories.filter((c) => !c.parentId);
    const childMap = new Map<string, FeeCategoryEntry[]>();
    for (const c of sortedCategories) {
      if (c.parentId) {
        const list = childMap.get(c.parentId) ?? [];
        list.push(c);
        childMap.set(c.parentId, list);
      }
    }
    return parents.map((p) => ({ parent: p, items: childMap.get(p.id) ?? [] }));
  }, [sortedCategories]);

  function openAdd()                        { setEditing(null); setPanelOpen(true); }
  function openEdit(c: FeeCategoryEntry)     { setEditing(c);    setPanelOpen(true); }
  function handleClose()                    { setPanelOpen(false); setSaveError(''); setTimeout(() => setEditing(null), 300); }
  function flash(msg: string)               { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); }

  async function handleSeedCategories() {
    setSeeding(true); setSaveError('');
    try {
      let totalCreated = 0;
      for (const cat of SEED_HIERARCHY) {
        // Create parent category
        const parent = await bffFetch<{ id: string }>('/api/web-admin/fee-categories', {
          method: 'POST',
          body: JSON.stringify({ name: cat.name, description: cat.description }),
        });
        totalCreated++;
        // Create child items under this parent
        if (cat.items) {
          for (const item of cat.items) {
            await bffFetch<{ id: string }>('/api/web-admin/fee-categories', {
              method: 'POST',
              body: JSON.stringify({ name: item.name, description: item.description, parentId: parent.id }),
            });
            totalCreated++;
          }
        }
      }
      await loadCategories();
      flash(`${totalCreated} fee categories & items seeded (${SEED_HIERARCHY.length} categories).`);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Seeding failed');
    } finally {
      setSeeding(false);
    }
  }

  async function handleSave(form: FeeCategoryForm) {
    setSaving(true); setSaveError('');
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || null };
      if (editing) {
        await bffFetch<unknown>(`/api/web-admin/fee-categories/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        await loadCategories();
        flash(`Fee category "${form.name}" updated.`);
      } else {
        await bffFetch<{ id: string }>('/api/web-admin/fee-categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await loadCategories();
        flash(`Fee category "${form.name}" created.`);
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
      await bffFetch<unknown>(`/api/web-admin/fee-categories/${deleteTarget.id}`, { method: 'DELETE' });
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      flash(`Fee category "${deleteTarget.name}" deleted.`);
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
          <h1 className="text-2xl font-bold text-slate-900">Fee Categories</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define fee category types that schools inherit during onboarding (e.g. Tuition, Admission, Annual).
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sortedCategories.length === 0 && (
            <button type="button" onClick={handleSeedCategories} disabled={seeding}
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Seed Standard Categories
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
            Add Category
          </button>
        </div>
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

      {loading && <div className="py-12 text-center text-sm text-slate-400">Loading fee categories&hellip;</div>}

      {!loading && (
        <>
          {/* Hierarchical category display */}
          <div className="space-y-4">
            {hierarchy.length > 0 ? (
              hierarchy.map(({ parent, items }) => (
                <div key={parent.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {/* Parent category header */}
                  <div className="flex items-center justify-between px-5 py-4 bg-violet-50/60 border-b border-violet-100">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center rounded-full bg-violet-600 px-3 py-1 text-sm font-bold text-white">
                        {parent.name}
                      </span>
                      <span className="text-sm text-slate-500">{parent.description ?? ''}</span>
                      {items.length > 0 && (
                        <span className="text-xs text-violet-600 font-medium">
                          {items.length} item{items.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openEdit(parent)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium
                          text-slate-600 hover:bg-slate-50 transition-colors">
                        Edit
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(parent)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium
                          text-red-600 hover:bg-red-100 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                  {/* Child items table (if any) */}
                  {items.length > 0 && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/40">
                          <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 w-8"></th>
                          <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Item Name</th>
                          <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Description</th>
                          <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3 text-xs text-slate-400">{idx + 1}</td>
                            <td className="px-5 py-3">
                              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-sm font-medium text-indigo-700 border border-indigo-100">
                                {item.name}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-slate-600 max-w-xs truncate">{item.description ?? '—'}</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={() => openEdit(item)}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium
                                    text-slate-600 hover:bg-slate-50 transition-colors">
                                  Edit
                                </button>
                                <button type="button" onClick={() => setDeleteTarget(item)}
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium
                                    text-red-600 hover:bg-red-100 transition-colors">
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {items.length === 0 && (
                    <div className="px-5 py-3 text-xs text-slate-400 italic">
                      Standalone category — fee structures link directly to this category.
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-16 text-center text-sm text-slate-400">
                No fee categories in the master template yet.
                Click &ldquo;Seed Standard Categories&rdquo; to load defaults,
                or &ldquo;Add Category&rdquo; to create one manually.
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-400">
            {hierarchy.length} categor{hierarchy.length !== 1 ? 'ies' : 'y'},&nbsp;
            {sortedCategories.filter((c) => c.parentId).length} item(s) in master template.
            Schools inherit these during onboarding.
          </p>
        </>
      )}

      <FeeCategoryPanel
        open={panelOpen}
        editing={editing}
        onClose={handleClose}
        onSave={handleSave}
        saving={saving}
      />

      <DeleteDialog
        open={deleteTarget !== null}
        label={deleteTarget?.name ?? ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}

// ── Page export ────────────────────────────────────────────────────────────
export default function FeeCategoriesPage() {
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
        return <FeeCategoriesContent />;
      }}
    </AuthGuard>
  );
}
