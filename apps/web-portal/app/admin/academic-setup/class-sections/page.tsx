'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../../components/AuthGuard';
import { bffFetch } from '../../../../lib/api';
import type { UserClaims } from '../../../../lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ClassSection {
  id: string;
  name: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
}

interface ClassOption {
  id: string;
  name: string;
}

interface SectionOption {
  id: string;
  name: string;
}

interface ClassSectionForm {
  classId: string;
  sectionId: string;
  name: string;
}

type FormErrors = Partial<Record<keyof ClassSectionForm, string>>;

const EMPTY_FORM: ClassSectionForm = { classId: '', sectionId: '', name: '' };

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm(form: ClassSectionForm): FormErrors {
  const e: FormErrors = {};
  if (!form.classId) e.classId = 'Please select a class.';
  if (!form.sectionId) e.sectionId = 'Please select a section.';
  if (!form.name.trim()) e.name = 'Display name is required.';
  else if (form.name.trim().length > 100) e.name = 'Name must be 100 characters or fewer.';
  return e;
}

// ── Slide-over panel (Add & Edit) ─────────────────────────────────────────────
function ClassSectionPanel({
  open,
  editingItem,
  classOptions,
  sectionOptions,
  onClose,
  onSave,
  saving,
  serverError,
  onClearServerError,
}: {
  open: boolean;
  editingItem: ClassSection | null;
  classOptions: ClassOption[];
  sectionOptions: SectionOption[];
  onClose: () => void;
  onSave: (form: ClassSectionForm) => void;
  saving: boolean;
  serverError: string;
  onClearServerError: () => void;
}) {
  const isEdit = editingItem !== null;
  const [form, setForm] = useState<ClassSectionForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(
        editingItem
          ? { classId: editingItem.classId, sectionId: editingItem.sectionId, name: editingItem.name }
          : EMPTY_FORM,
      );
      setErrors({});
    }
  }, [open, editingItem]);

  function setSelectField(field: keyof ClassSectionForm) {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
      if (serverError) onClearServerError();
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
        aria-label={isEdit ? 'Edit Class-Section' : 'Assign Section to Class'}
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? `Edit: ${editingItem!.name}` : 'Assign Section to Class'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update the display name for this assignment.' : 'Link a section to a class with a unique display name.'}
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
          {/* Class selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Class <span className="text-red-500">*</span>
            </label>
            <select
              className={inputCls(errors.classId)}
              value={form.classId}
              onChange={setSelectField('classId')}
              disabled={isEdit}
            >
              <option value="">- Select a class -</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.classId && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <span aria-hidden="true">&#x26A0;</span>{errors.classId}
              </p>
            )}
          </div>

          {/* Section selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Section <span className="text-red-500">*</span>
            </label>
            <select
              className={inputCls(errors.sectionId)}
              value={form.sectionId}
              onChange={setSelectField('sectionId')}
              disabled={isEdit}
            >
              <option value="">- Select a section -</option>
              {sectionOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.sectionId && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <span aria-hidden="true">&#x26A0;</span>{errors.sectionId}
              </p>
            )}
          </div>

          {/* Display name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputCls(errors.name)}
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                if (serverError) onClearServerError();
              }}
              placeholder="e.g. 10-A, 5-Ganga"
              maxLength={100}
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <span aria-hidden="true">&#x26A0;</span>{errors.name}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">Unique name shown in dropdowns and reports.</p>
          </div>

          {/* Server error (shown inside the form) */}
          {serverError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

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
              ) : (isEdit ? 'Update' : 'Assign Section')}
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
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Class-Section</h3>
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to remove <span className="font-semibold">&ldquo;{label}&rdquo;</span>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={deleting}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
            {deleting ? 'Deleting\u2026' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function ClassSectionsContent({ claims: _claims }: { claims: UserClaims }) {
  const [items, setItems] = useState<ClassSection[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClassSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ClassSection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(
      (cs) =>
        cs.name.toLowerCase().includes(q) ||
        cs.className.toLowerCase().includes(q) ||
        cs.sectionName.toLowerCase().includes(q),
    );
  }, [items, searchTerm]);

  function loadData() {
    setLoading(true);
    Promise.all([
      bffFetch<ClassSection[]>('/api/academic-setup/class-sections'),
      bffFetch<ClassOption[]>('/api/academic-setup/classes'),
      bffFetch<SectionOption[]>('/api/academic-setup/sections'),
    ])
      .then(([cs, cls, sec]) => {
        setItems(Array.isArray(cs) ? cs : []);
        setClasses(Array.isArray(cls) ? cls : []);
        setSections(Array.isArray(sec) ? sec : []);
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Failed to load data');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd() {
    setEditingItem(null);
    setPanelOpen(true);
  }

  function openEdit(cs: ClassSection) {
    setEditingItem(cs);
    setPanelOpen(true);
  }

  function handleClose() {
    setPanelOpen(false);
    setSaveError('');
    setTimeout(() => setEditingItem(null), 300);
  }

  async function handleSave(form: ClassSectionForm) {
    setSaving(true);
    setSaveError('');
    try {
      if (editingItem) {
        await bffFetch<unknown>(`/api/academic-setup/class-sections/${editingItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: form.name.trim() }),
        });
        setItems((prev) =>
          prev.map((cs) =>
            cs.id === editingItem.id ? { ...cs, name: form.name.trim() } : cs,
          ),
        );
        setSuccessMsg(`"${form.name.trim()}" updated successfully.`);
      } else {
        const selectedClass = classes.find((c) => c.id === form.classId);
        const selectedSection = sections.find((s) => s.id === form.sectionId);
        const result = await bffFetch<{ id: string }>('/api/academic-setup/class-sections', {
          method: 'POST',
          body: JSON.stringify({ classId: form.classId, sectionId: form.sectionId, name: form.name.trim() }),
        });
        const newItem: ClassSection = {
          id: result.id,
          name: form.name.trim(),
          classId: form.classId,
          className: selectedClass?.name ?? form.classId,
          sectionId: form.sectionId,
          sectionName: selectedSection?.name ?? form.sectionId,
        };
        setItems((prev) => [...prev, newItem]);
        setSuccessMsg(`"${newItem.name}" assigned successfully.`);
      }
      setSaving(false);
      setPanelOpen(false);
      setTimeout(() => setEditingItem(null), 300);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save class-section');
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bffFetch<unknown>(`/api/academic-setup/class-sections/${deleteTarget.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((cs) => cs.id !== deleteTarget.id));
      setSuccessMsg(`"${deleteTarget.name}" removed.`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to delete class-section');
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
        <span className="text-slate-600 font-medium">Class-Sections</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Class-Section Assignments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Assign a section to each class and give it a unique display name (e.g. 10-A).</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Assign Section
        </button>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{loadError}</p>
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

      {/* Search bar */}
      {!loading && items.length > 0 && (
        <div className="mb-4 relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search class-sections\u2026"
            className="w-full border border-slate-200 rounded-lg pl-9 pr-9 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
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

      {loading && (
        <div className="py-12 text-center text-sm text-slate-400">Loading class-section assignments\u2026</div>
      )}

      {!loading && (
        <>
          {/* Table — desktop */}
          <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="grand-table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Display Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Class</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Section</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((cs) => (
                  <tr key={cs.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-900">{cs.name}</td>
                    <td className="px-5 py-4 text-slate-600">{cs.className}</td>
                    <td className="px-5 py-4 text-slate-600">{cs.sectionName}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => openEdit(cs)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(cs)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-16 text-center text-sm text-slate-400">
                      {searchTerm
                        ? `No results for \u201c${searchTerm}\u201d.`
                        : 'No class-section assignments yet. Click "Assign Section" to get started.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Card stack — mobile */}
          <div className="sm:hidden space-y-3">
            {filteredItems.map((cs) => (
              <div key={cs.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-bold text-slate-900 text-base">{cs.name}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                  <span className="bg-slate-100 px-2 py-0.5 rounded-full">{cs.className}</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded-full">{cs.sectionName}</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(cs)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Edit
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(cs)}
                    className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">
                {searchTerm ? `No results for \u201c${searchTerm}\u201d.` : 'No assignments yet.'}
              </div>
            )}
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-slate-400">
        {searchTerm
          ? `${filteredItems.length} of ${items.length} assignment${items.length !== 1 ? 's' : ''} shown.`
          : `${items.length} assignment${items.length !== 1 ? 's' : ''} configured.`}
      </p>

      <ClassSectionPanel
        open={panelOpen}
        editingItem={editingItem}
        classOptions={classes}
        sectionOptions={sections}
        onClose={handleClose}
        onSave={handleSave}
        saving={saving}
        serverError={saveError}
        onClearServerError={() => setSaveError('')}
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

// ── Page export ───────────────────────────────────────────────────────────────
export default function ClassSectionsPage() {
  return (
    <AuthGuard>
      {(claims) => <ClassSectionsContent claims={claims} />}
    </AuthGuard>
  );
}
