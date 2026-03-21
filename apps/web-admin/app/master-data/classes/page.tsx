'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SchoolClass {
  id: string;
  name: string;
  code: string;
  academicYearId: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

interface ClassForm {
  name: string;
  code: string;
  academicYearId: string;
}

type FormErrors = Partial<Record<keyof ClassForm, string>>;
type SortKey = 'name' | 'code';
type SortDirection = 'asc' | 'desc';

const EMPTY_FORM: ClassForm = { name: '', code: '', academicYearId: '' };

// ── Sort header component ─────────────────────────────────────────────────────
function SortHeader({
  label,
  sortKey,
  current,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  current: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = current.key === sortKey;
  return (
    <th
      className={`px-5 py-3.5 text-${align} text-xs font-semibold uppercase tracking-wide text-slate-500`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors
          hover:bg-slate-100 ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
      >
        {label}
        <svg
          className={`w-3.5 h-3.5 transition-transform ${
            isActive ? 'text-blue-500' : 'text-slate-300'
          } ${isActive && current.direction === 'desc' ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </th>
  );
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm(form: ClassForm): FormErrors {
  const e: FormErrors = {};
  if (!form.name.trim()) e.name = 'Class name is required.';
  else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters.';
  else if (form.name.trim().length > 50) e.name = 'Name must be 50 characters or fewer.';
  if (!form.code.trim()) e.code = 'Class code is required.';
  else if (form.code.trim().length > 10) e.code = 'Code must be 10 characters or fewer.';
  if (!form.academicYearId) e.academicYearId = 'Academic year is required.';
  return e;
}

// ── Slide-over panel ──────────────────────────────────────────────────────────
function ClassPanel({
  open,
  editingClass,
  years,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  editingClass: SchoolClass | null;
  years: AcademicYear[];
  onClose: () => void;
  onSave: (form: ClassForm) => void;
  saving: boolean;
}) {
  const isEdit = editingClass !== null;
  const [form, setForm] = useState<ClassForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(
        editingClass
          ? { name: editingClass.name, code: editingClass.code, academicYearId: editingClass.academicYearId }
          : EMPTY_FORM
      );
      setErrors({});
    }
  }, [open, editingClass]);

  function setField(field: keyof ClassForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const val = field === 'code' ? e.target.value.toUpperCase() : e.target.value;
      setForm((prev) => ({ ...prev, [field]: val }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave({ ...form, name: form.name.trim(), code: form.code.trim().toUpperCase() });
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
        aria-label={isEdit ? 'Edit Class' : 'Add Class'}
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? `Edit: ${editingClass!.name}` : 'Add Class'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update this master template class.' : 'Create a new master template class.'}
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Class Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputCls(errors.name)}
              value={form.name}
              onChange={setField('name')}
              placeholder="e.g. Grade 1, Form 4, Class 10A"
              maxLength={50}
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <span aria-hidden="true">&#x26A0;</span>{errors.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Class Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputCls(errors.code)}
              value={form.code}
              onChange={setField('code')}
              placeholder="e.g. G1, C10, F4"
              maxLength={10}
            />
            {errors.code && (
              <p className="mt-1 text-xs text-red-600">{errors.code}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">Short uppercase identifier. Auto-uppercased.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <select
              className={inputCls(errors.academicYearId)}
              value={form.academicYearId}
              onChange={setField('academicYearId')}
            >
              <option value="">Select academic year&hellip;</option>
              {(Array.isArray(years) ? years : []).map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
            {errors.academicYearId && (
              <p className="mt-1 text-xs text-red-600">{errors.academicYearId}</p>
            )}
          </div>

          <div className="flex-1" />

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
              ) : (isEdit ? 'Update Class' : 'Save Class')}
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
  className: clsName,
  onCancel,
  onConfirm,
  deleting,
}: {
  open: boolean;
  className: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Class</h3>
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <span className="font-semibold">&ldquo;{clsName}&rdquo;</span>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {deleting ? 'Deleting\u2026' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function MasterClassesContent() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SchoolClass | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>(
    { key: 'name', direction: 'asc' }
  );
  const [searchTerm, setSearchTerm] = useState('');

  const collator = useMemo(
    () => new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }),
    []
  );

  const sortedClasses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? (Array.isArray(classes) ? classes : []).filter(
          (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
        )
      : (Array.isArray(classes) ? classes : []);
    return [...filtered].sort((a, b) => {
      const cmp = collator.compare(a[sortConfig.key], b[sortConfig.key]);
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [classes, sortConfig, collator, searchTerm]);

  function toggleSort(key: SortKey) {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  }

  useEffect(() => {
    void Promise.all([fetchClasses(), fetchYears()]);
  }, []);

  async function fetchClasses() {
    try {
      setLoading(true);
      setLoadError('');
      const data = await bffFetch<SchoolClass[]>('/api/web-admin/classes');
      setClasses(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }

  async function fetchYears() {
    try {
      const data = await bffFetch<AcademicYear[]>('/api/web-admin/academic-years');
      setYears(data);
    } catch {
      // Years are used for the dropdown only; silent fail is acceptable
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setErrorMsg('');
    try {
      await bffFetch<{ seeded: number }>('/api/web-admin/classes/seed', { method: 'POST' });
      setSuccessMsg('12 classes (Class 1 \u2013 Class 12) generated successfully.');
      await fetchClasses();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to generate sample classes');
    } finally {
      setSeeding(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  }

  function openAdd() {
    setEditingClass(null);
    setPanelOpen(true);
  }

  function openEdit(sc: SchoolClass) {
    setEditingClass(sc);
    setPanelOpen(true);
  }

  function handleClose() {
    setPanelOpen(false);
    setTimeout(() => setEditingClass(null), 300);
  }

  async function handleSave(form: ClassForm) {
    setSaving(true);
    setErrorMsg('');
    try {
      if (editingClass) {
        await bffFetch(`/api/web-admin/classes/${editingClass.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: form.name, code: form.code }),
        });
        setSuccessMsg(`Class "${form.name}" updated successfully.`);
      } else {
        await bffFetch('/api/web-admin/classes', {
          method: 'POST',
          body: JSON.stringify({ name: form.name, code: form.code, academicYearId: form.academicYearId }),
        });
        setSuccessMsg(`Class "${form.name}" created successfully.`);
      }
      setPanelOpen(false);
      setTimeout(() => setEditingClass(null), 300);
      await fetchClasses();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to save class');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  }

  function confirmDelete(sc: SchoolClass) {
    setDeleteTarget(sc);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorMsg('');
    try {
      await bffFetch(`/api/web-admin/classes/${deleteTarget.id}`, { method: 'DELETE' });
      setSuccessMsg(`Class "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      await fetchClasses();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to delete class');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  }

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-400 mb-6" aria-label="Breadcrumb">
        <Link href="/master-data" className="hover:text-slate-600 transition-colors">
          Master Data
        </Link>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-600 font-medium">Classes</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Classes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage master template class levels.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {classes.length === 0 && !loading && (
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
                <>&#x2728; Generate Sample Data</>
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
            Add Class
          </button>
        </div>
      </div>

      {/* Search bar */}
      {!loading && !loadError && classes.length > 0 && (
        <div className="mb-4 relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search classes\u2026"
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

      {successMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-8 text-center text-sm text-slate-400">
          Loading classes&hellip;
        </div>
      )}

      {!loading && loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-600">
          {loadError} &mdash;{' '}
          <button type="button" onClick={() => void fetchClasses()} className="underline">Retry</button>
        </div>
      )}

      {!loading && !loadError && (
      <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="grand-table w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <SortHeader label="Class Name" sortKey="name" current={sortConfig} onSort={toggleSort} />
              <SortHeader label="Code" sortKey="code" current={sortConfig} onSort={toggleSort} />
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Academic Year</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedClasses.map((sc) => (
              <tr key={sc.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-4 font-semibold text-slate-900">{sc.name}</td>
                <td className="px-5 py-4">
                  <span className="rounded px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs">{sc.code}</span>
                </td>
                <td className="px-5 py-4 text-slate-500">
                  {years.find((y) => y.id === sc.academicYearId)?.name ?? sc.academicYearId}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(sc)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDelete(sc)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedClasses.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center text-sm text-slate-400">
                  {searchTerm
                    ? `No results for "${searchTerm}".`
                    : 'No classes yet. Click \u201c\u2728 Generate Sample Data\u201d or \u201cAdd Class\u201d to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {!loading && !loadError && (
      <div className="sm:hidden space-y-3">
        {sortedClasses.map((sc) => (
          <div key={sc.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-slate-900 text-base">{sc.name}</p>
              <span className="rounded px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs">{sc.code}</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">{years.find((y) => y.id === sc.academicYearId)?.name ?? ''}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openEdit(sc)}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(sc)}
                className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {sortedClasses.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            {searchTerm
              ? `No results for "${searchTerm}".`
              : 'No classes yet. Tap \u201c\u2728 Generate Sample Data\u201d to create Class 1\u201312.'}
          </div>
        )}
      </div>
      )}

      {!loading && !loadError && (
        <p className="mt-4 text-xs text-slate-400">
          {searchTerm
            ? `${sortedClasses.length} of ${classes.length} class${classes.length !== 1 ? 'es' : ''} shown.`
            : `${classes.length} class${classes.length !== 1 ? 'es' : ''} configured.`}
        </p>
      )}

      <ClassPanel
        open={panelOpen}
        editingClass={editingClass}
        years={years}
        onClose={handleClose}
        onSave={handleSave}
        saving={saving}
      />

      <DeleteDialog
        open={deleteTarget !== null}
        className={deleteTarget?.name ?? ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function MasterClassesPage() {
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
        return <MasterClassesContent />;
      }}
    </AuthGuard>
  );
}
