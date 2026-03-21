'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import type { UserClaims } from '../../../../lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Section {
  id: string;
  name: string;
}

interface SectionForm {
  name: string;
}

type FormErrors = Partial<Record<keyof SectionForm, string>>;

const EMPTY_FORM: SectionForm = { name: '' };

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm(form: SectionForm): FormErrors {
  const e: FormErrors = {};
  if (!form.name.trim()) e.name = 'Section name is required.';
  else if (form.name.trim().length < 1) e.name = 'Name must be at least 1 character.';
  else if (form.name.trim().length > 20) e.name = 'Name must be 20 characters or fewer.';
  return e;
}

// ── Slide-over panel (Add & Edit) ─────────────────────────────────────────────
function SectionPanel({
  open,
  editingSection,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  editingSection: Section | null;
  onClose: () => void;
  onSave: (form: SectionForm) => void;
  saving: boolean;
}) {
  const isEdit = editingSection !== null;
  const [form, setForm] = useState<SectionForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(
        editingSection
          ? { name: editingSection.name }
          : EMPTY_FORM
      );
      setErrors({});
    }
  }, [open, editingSection]);

  function setTextField(field: keyof SectionForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(form);
  }

  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors
     ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={isEdit ? 'Edit Section' : 'Add Section'}
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? `Edit: ${editingSection!.name}` : 'Add Section'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update this section record.' : 'Create a new section template.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          {/* Section name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Section Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputCls(errors.name)}
              value={form.name}
              onChange={setTextField('name')}
              placeholder="e.g. A, B, Rose, Sunflower"
              maxLength={20}
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <span aria-hidden="true">&#x26A0;</span>{errors.name}
              </p>
            )}
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving&hellip;
                </>
              ) : (isEdit ? 'Update Section' : 'Save Section')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Delete confirmation dialog ────────────────────────────────────────────────
function DeleteDialog({
  open,
  label,
  onCancel,
  onConfirm,
  deleting,
}: {
  open: boolean;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Section</h3>
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <span className="font-semibold">&ldquo;{label}&rdquo;</span>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={deleting}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function SectionsContent({ claims: _claims }: { claims: UserClaims }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Section | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [seeding, setSeedingState] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSections = useMemo(() => {
    if (!searchTerm.trim()) return sections;
    const q = searchTerm.toLowerCase();
    return sections.filter(
      (s) => s.name.toLowerCase().includes(q)
    );
  }, [sections, searchTerm]);

  useEffect(() => {
    setLoading(true);
    bffFetch<Section[]>('/api/academic-setup/sections')
      .then((sec) => {
        setSections(Array.isArray(sec) ? sec : []);
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Failed to load data');
      })
      .finally(() => setLoading(false));
  }, []);

  function openAdd() {
    setEditingSection(null);
    setPanelOpen(true);
  }

  function openEdit(s: Section) {
    setEditingSection(s);
    setPanelOpen(true);
  }

  function handleClose() {
    setPanelOpen(false);
    setSaveError('');
    setTimeout(() => setEditingSection(null), 300);
  }

  async function handleSeed() {
    setSeedingState(true);
    setSaveError('');
    try {
      const result = await bffFetch<{ seeded: number }>('/api/academic-setup/sections/seed-from-master', {
        method: 'POST',
      });
      setSuccessMsg(`✅ ${result.seeded} sections generated from master template.`);
      const fresh = await bffFetch<Section[]>('/api/academic-setup/sections');
      setSections(Array.isArray(fresh) ? fresh : []);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to generate sections from master template');
    } finally {
      setSeedingState(false);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  }

  async function handleSave(form: SectionForm) {
    setSaving(true);
    setSaveError('');
    try {
      if (editingSection) {
        await bffFetch<unknown>(`/api/academic-setup/sections/${editingSection.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: form.name.trim() }),
        });
        setSections((prev) =>
          prev.map((s) =>
            s.id === editingSection.id
              ? { ...s, name: form.name.trim() }
              : s
          )
        );
        setSuccessMsg(`Section "${form.name.trim()}" updated successfully.`);
      } else {
        const result = await bffFetch<{ id: string }>('/api/academic-setup/sections', {
          method: 'POST',
          body: JSON.stringify({ name: form.name.trim() }),
        });
        const newSection: Section = {
          id: result.id,
          name: form.name.trim(),
        };
        setSections((prev) => [...prev, newSection]);
        setSuccessMsg(`Section "${newSection.name}" added successfully.`);
      }
      setSaving(false);
      setPanelOpen(false);
      setTimeout(() => setEditingSection(null), 300);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save section');
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bffFetch<unknown>(`/api/academic-setup/sections/${deleteTarget.id}`, { method: 'DELETE' });
      setSections((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setSuccessMsg(`Section "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to delete section');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-400 mb-6" aria-label="Breadcrumb">
        <Link href="/admin/academic-setup" className="hover:text-slate-600 transition-colors">
          Academic Setup
        </Link>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-600 font-medium">Sections</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sections</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage reusable section templates that can be assigned to any class.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {sections.length === 0 && !loading && (
            <button
              type="button"
              onClick={() => void handleSeed()}
              disabled={seeding}
              className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 shadow-sm disabled:opacity-60 transition-colors flex-shrink-0"
            >
              {seeding ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Generating&hellip;
                </>
              ) : (
                <>✅ Generate from Master Data</>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Section
          </button>
        </div>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{loadError}</p>
        </div>
      )}

      {/* Save error */}
      {/* Search bar */}
      {!loading && sections.length > 0 && (
        <div className="mb-4 relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search sections…"
            className="w-full border border-slate-200 rounded-lg pl-9 pr-9 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {saveError && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{saveError}</p>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-sm text-slate-400">Loading sections…</div>
      )}

      {!loading && (
      <>
      {/* Table — desktop */}
      <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="grand-table w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Section</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSections.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-4 font-semibold text-slate-900">{s.name}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => openEdit(s)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                      Edit
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(s)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredSections.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-16 text-center text-sm text-slate-400">
                  {searchTerm
                    ? `No results for "${searchTerm}".`
                    : 'No sections yet. Click “Add Section” to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Card stack — mobile */}
      <div className="sm:hidden space-y-3">
        {filteredSections.map((s) => (
          <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <p className="font-bold text-slate-900 text-base">{s.name}</p>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => openEdit(s)}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Edit
              </button>
              <button type="button" onClick={() => setDeleteTarget(s)}
                className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                Delete
              </button>
            </div>
          </div>
        ))}
        {filteredSections.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            {searchTerm ? `No results for "${searchTerm}".` : 'No sections yet.'}
          </div>
        )}
      </div>
      </>
      )}

      <p className="mt-4 text-xs text-slate-400">
        {searchTerm
          ? `${filteredSections.length} of ${sections.length} section${sections.length !== 1 ? 's' : ''} shown.`
          : `${sections.length} section${sections.length !== 1 ? 's' : ''} configured.`}
      </p>

      <SectionPanel
        open={panelOpen}
        editingSection={editingSection}
        onClose={handleClose}
        onSave={handleSave}
        saving={saving}
      />

      <DeleteDialog
        open={deleteTarget !== null}
        label={deleteTarget ? deleteTarget.name : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function SectionsPage() {
  return (
    <AuthGuard>
      {(claims) => <SectionsContent claims={claims} />}
    </AuthGuard>
  );
}
