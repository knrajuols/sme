'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import type { UserClaims } from '../../../../lib/auth';
import { PremiumCard } from '../../../../components/ui/PremiumCard';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FeeCategory {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CategoryForm {
  name: string;
  description: string;
}

type FormErrors = Partial<Record<keyof CategoryForm, string>>;

const EMPTY_FORM: CategoryForm = { name: '', description: '' };

function validateForm(f: CategoryForm): FormErrors {
  const e: FormErrors = {};
  if (!f.name.trim()) e.name = 'Name is required.';
  if (f.name.trim().length > 200) e.name = 'Name must be 200 characters or fewer.';
  if (f.description.length > 500) e.description = 'Description must be 500 characters or fewer.';
  return e;
}

// ── Slide-over panel ──────────────────────────────────────────────────────────
function CategoryPanel({
  open,
  editing,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  editing: FeeCategory | null;
  onClose: () => void;
  onSave: (form: CategoryForm) => void;
  saving: boolean;
}) {
  const [form, setForm]     = useState<CategoryForm>(EMPTY_FORM);
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

  function set<K extends keyof CategoryForm>(k: K, v: CategoryForm[K]) {
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
        aria-label={editing ? 'Edit Fee Category' : 'Add Fee Category'}
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {editing ? 'Edit Fee Category' : 'New Fee Category'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {editing ? 'Update the fee category details.' : 'Create a new fee category for this school.'}
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
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputCls(errors.name)}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Tuition Fee"
              maxLength={200}
              autoFocus
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              className={inputCls(errors.description)}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Brief description of this fee category…"
              maxLength={500}
              rows={3}
            />
            {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
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
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function FeeCategoriesPage({ user: _user }: { user: UserClaims }) {
  const [rows, setRows]           = useState<FeeCategory[]>([]);
  const [loading, setLoading]     = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing]     = useState<FeeCategory | null>(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [banner, setBanner]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  function showBanner(type: 'success' | 'error', msg: string) {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 4000);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const data = await bffFetch<FeeCategory[]>('/api/finance/fee-categories');
      setRows(data);
    } catch {
      showBanner('error', 'Failed to load fee categories.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleGenerateFromMaster() {
    setGenerating(true);
    try {
      const result = await bffFetch<{ categoriesCreated: number; categoriesSkipped: number }>(
        '/api/finance/generate-from-master',
        { method: 'POST' },
      );
      const msg = `Generated ${result.categoriesCreated} categories (${result.categoriesSkipped} skipped).`;
      showBanner('success', msg);
      await loadAll();
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Generation from master failed.');
    } finally {
      setGenerating(false);
    }
  }

  function openCreate() { setEditing(null); setPanelOpen(true); }
  function openEdit(r: FeeCategory) { setEditing(r); setPanelOpen(true); }
  function closePanel() { setPanelOpen(false); setEditing(null); }

  async function handleSave(form: CategoryForm) {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
      };
      if (editing) {
        await bffFetch(`/api/finance/fee-categories/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showBanner('success', 'Fee category updated.');
      } else {
        await bffFetch('/api/finance/fee-categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showBanner('success', 'Fee category created.');
      }
      closePanel();
      await loadAll();
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this fee category? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await bffFetch(`/api/finance/fee-categories/${id}`, { method: 'DELETE' });
      showBanner('success', 'Fee category deleted.');
      await loadAll();
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Fee Categories</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define the types of fees charged to students (e.g. Tuition, Transport, Library).
          </p>
        </div>
        <div className="flex items-center gap-3">
          {rows.length === 0 && !loading && (
            <button
              onClick={handleGenerateFromMaster}
              disabled={generating}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {generating ? 'Generating…' : 'Generate from Master Data'}
            </button>
          )}
          <button
            onClick={openCreate}
            className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-green-700 transition-colors"
          >
            + New Category
          </button>
        </div>
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

      {/* Table */}
      <PremiumCard accentColor="green" className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-10 rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="text-4xl mb-3">🏷️</p>
            <p className="font-medium">No fee categories yet.</p>
            <p className="text-xs mt-1">Click &quot;+ New Category&quot; to get started.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="grand-table hidden md:table w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">{r.name}</td>
                    <td className="px-5 py-3 text-slate-500">{r.description ?? <span className="text-slate-300 italic">—</span>}</td>
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
                  <p className="font-semibold text-slate-800">{r.name}</p>
                  {r.description && <p className="text-xs text-slate-500 mt-1">{r.description}</p>}
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

      <CategoryPanel
        open={panelOpen}
        editing={editing}
        onClose={closePanel}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}

export default function Page() {
  return <AuthGuard>{(user) => <FeeCategoriesPage user={user} />}</AuthGuard>;
}
