'use client';

import { useEffect, useMemo, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PremiumCard } from '../../../components/ui/PremiumCard';

// ── Reference types ────────────────────────────────────────────────────────────
interface StudentRef  { id: string; admissionNumber: string; firstName: string; lastName: string; }
interface YearRef     { id: string; name: string; }
interface ClassRef    { id: string; name: string; code: string; academicYearId: string; }
interface SectionRef  { id: string; name: string; classId: string; className: string; }

// ── Enrollment row ─────────────────────────────────────────────────────────────
interface Enrollment {
  id: string;
  studentId: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
  rollNumber: string;
}

interface EnrollmentForm {
  studentId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  rollNumber: string;
}

interface UpdateForm {
  rollNumber: string;
}

type FormErrors = Partial<Record<keyof EnrollmentForm, string>>;

const EMPTY_FORM: EnrollmentForm = {
  studentId: '',
  academicYearId: '',
  classId: '',
  sectionId: '',
  rollNumber: '',
};

function validateCreate(f: EnrollmentForm): FormErrors {
  const e: FormErrors = {};
  if (!f.studentId)       e.studentId      = 'Student is required.';
  if (!f.academicYearId)  e.academicYearId = 'Academic year is required.';
  if (!f.classId)         e.classId        = 'Class is required.';
  if (!f.sectionId)       e.sectionId      = 'Section is required.';
  if (!f.rollNumber.trim()) e.rollNumber   = 'Roll number is required.';
  return e;
}

// ── Slide-over panel ───────────────────────────────────────────────────────────
function EnrollmentPanel({
  open, editing, students, years, classes, sections,
  onClose, onSave, saving,
}: {
  open: boolean;
  editing: Enrollment | null;
  students: StudentRef[];
  years: YearRef[];
  classes: ClassRef[];
  sections: SectionRef[];
  onClose: () => void;
  onSave: (data: EnrollmentForm | UpdateForm) => void;
  saving: boolean;
}) {
  const isEdit = editing !== null;

  const [form, setForm]         = useState<EnrollmentForm>(EMPTY_FORM);
  const [updateForm, setUpdateForm] = useState<UpdateForm>({ rollNumber: '' });
  const [errors, setErrors]     = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      if (editing) {
        setUpdateForm({ rollNumber: editing.rollNumber });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
    }
  }, [open, editing]);

  const filteredSections = useMemo(
    () => sections.filter((s) => !form.classId || s.classId === form.classId),
    [sections, form.classId],
  );

  function setField<K extends keyof EnrollmentForm>(k: K, v: EnrollmentForm[K]) {
    setForm((p) => ({
      ...p,
      [k]: v,
      ...(k === 'classId' ? { sectionId: '' } : {}),
    }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit) {
      if (!updateForm.rollNumber.trim()) {
        setErrors({ rollNumber: 'Roll number is required.' });
        return;
      }
      onSave(updateForm);
      return;
    }
    const errs = validateCreate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(form);
  }

  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
     ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-slate-400'}`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose} aria-hidden="true"
      />
      <div
        role="dialog" aria-label={isEdit ? 'Edit Enrollment' : 'Add Enrollment'} aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">{isEdit ? 'Edit Enrollment' : 'New Enrollment'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update roll number only.' : 'Enroll a student into a class and section.'}
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
          {isEdit ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Roll Number <span className="text-red-500">*</span>
              </label>
              <input type="text" className={inputCls(errors.rollNumber)}
                value={updateForm.rollNumber}
                onChange={(e) => { setUpdateForm({ rollNumber: e.target.value }); setErrors({}); }}
                placeholder="e.g. 42" maxLength={20} autoFocus />
              {errors.rollNumber && <p className="mt-1 text-xs text-red-600">{errors.rollNumber}</p>}
            </div>
          ) : (
            <>
              {/* Student */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Student <span className="text-red-500">*</span>
                </label>
                <select className={inputCls(errors.studentId)} value={form.studentId}
                  onChange={(e) => setField('studentId', e.target.value)}>
                  <option value="">— select student —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.admissionNumber} — {s.firstName} {s.lastName}
                    </option>
                  ))}
                </select>
                {errors.studentId && <p className="mt-1 text-xs text-red-600">{errors.studentId}</p>}
              </div>

              {/* Academic Year */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Academic Year <span className="text-red-500">*</span>
                </label>
                <select className={inputCls(errors.academicYearId)} value={form.academicYearId}
                  onChange={(e) => setField('academicYearId', e.target.value)}>
                  <option value="">— select year —</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
                {errors.academicYearId && <p className="mt-1 text-xs text-red-600">{errors.academicYearId}</p>}
              </div>

              {/* Class */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Class <span className="text-red-500">*</span>
                </label>
                <select className={inputCls(errors.classId)} value={form.classId}
                  onChange={(e) => setField('classId', e.target.value)}>
                  <option value="">— select class —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
                {errors.classId && <p className="mt-1 text-xs text-red-600">{errors.classId}</p>}
              </div>

              {/* Section */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Section <span className="text-red-500">*</span>
                </label>
                <select className={inputCls(errors.sectionId)} value={form.sectionId}
                  onChange={(e) => setField('sectionId', e.target.value)}
                  disabled={!form.classId}>
                  <option value="">— select section —</option>
                  {filteredSections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {errors.sectionId && <p className="mt-1 text-xs text-red-600">{errors.sectionId}</p>}
                {!form.classId && <p className="mt-1 text-xs text-slate-400">Select a class first.</p>}
              </div>

              {/* Roll Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Roll Number <span className="text-red-500">*</span>
                </label>
                <input type="text" className={inputCls(errors.rollNumber)}
                  value={form.rollNumber} onChange={(e) => setField('rollNumber', e.target.value)}
                  placeholder="e.g. 12" maxLength={20} />
                {errors.rollNumber && <p className="mt-1 text-xs text-red-600">{errors.rollNumber}</p>}
              </div>
            </>
          )}

          <div className="flex-1" />
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>Saving&hellip;</>
              ) : (isEdit ? 'Update' : 'Enroll')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Delete dialog ──────────────────────────────────────────────────────────────
function DeleteDialog({ open, label, onCancel, onConfirm, deleting }: {
  open: boolean; label: string; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Enrollment</h3>
        <p className="text-sm text-slate-600 mb-6">
          Remove enrollment <span className="font-semibold">&ldquo;{label}&rdquo;</span>? This cannot be undone.
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

// ── Main content ───────────────────────────────────────────────────────────────
function EnrollmentsContent({ claims: _claims }: { claims: UserClaims }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students,   setStudents]     = useState<StudentRef[]>([]);
  const [years,      setYears]        = useState<YearRef[]>([]);
  const [classes,    setClasses]      = useState<ClassRef[]>([]);
  const [sections,   setSections]     = useState<SectionRef[]>([]);

  const [loading,    setLoading]      = useState(true);
  const [loadError,  setLoadError]    = useState('');
  const [panelOpen,  setPanelOpen]    = useState(false);
  const [editing,    setEditing]      = useState<Enrollment | null>(null);
  const [saving,     setSaving]       = useState(false);
  const [saveError,  setSaveError]    = useState('');
  const [successMsg, setSuccessMsg]   = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Enrollment | null>(null);
  const [deleting,   setDeleting]     = useState(false);

  useEffect(() => {
    Promise.all([
      bffFetch<Enrollment[]>('/api/academic/enrollments'),
      bffFetch<StudentRef[]>('/api/academic/students'),
      bffFetch<YearRef[]>('/api/academic-setup/years'),
      bffFetch<ClassRef[]>('/api/academic-setup/classes'),
      bffFetch<SectionRef[]>('/api/academic-setup/sections'),
    ])
      .then(([enrs, studs, yrs, cls, secs]) => {
        setEnrollments(Array.isArray(enrs)  ? enrs  : []);
        setStudents(   Array.isArray(studs) ? studs : []);
        setYears(      Array.isArray(yrs)   ? yrs   : []);
        setClasses(    Array.isArray(cls)   ? cls   : []);
        setSections(   Array.isArray(secs)  ? secs  : []);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  // ── lookup helpers ─────────────────────────────────────────────────────────
  const studentMap   = useMemo(() => new Map(students.map((s) => [s.id, s])),  [students]);
  const yearMap      = useMemo(() => new Map(years.map((y) => [y.id, y.name])), [years]);
  const classMap     = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const sectionMap   = useMemo(() => new Map(sections.map((s) => [s.id, s.name])), [sections]);

  function studentLabel(id: string) {
    const s = studentMap.get(id);
    if (!s) return id.slice(0, 8) + '…';
    return `${s.admissionNumber} — ${s.firstName} ${s.lastName}`;
  }

  function openAdd()           { setEditing(null); setPanelOpen(true); }
  function openEdit(e: Enrollment) { setEditing(e); setPanelOpen(true); }
  function handleClose()       { setPanelOpen(false); setSaveError(''); setTimeout(() => setEditing(null), 300); }
  function flash(msg: string)  { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); }

  async function handleSave(data: EnrollmentForm | UpdateForm) {
    setSaving(true); setSaveError('');
    try {
      if (editing) {
        await bffFetch<unknown>(`/api/academic/enrollments/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        const u = data as UpdateForm;
        setEnrollments((prev) =>
          prev.map((e) => e.id === editing.id ? { ...e, rollNumber: u.rollNumber } : e),
        );
        flash('Enrollment updated.');
      } else {
        const d = data as EnrollmentForm;
        const result = await bffFetch<{ id: string }>('/api/academic/enrollments', {
          method: 'POST',
          body: JSON.stringify(d),
        });
        setEnrollments((prev) => [...prev, { ...d, id: result.id }]);
        flash('Student enrolled successfully.');
      }
      setSaving(false); setPanelOpen(false); setTimeout(() => setEditing(null), 300);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save'); setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bffFetch<unknown>(`/api/academic/enrollments/${deleteTarget.id}`, { method: 'DELETE' });
      setEnrollments((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      flash('Enrollment deleted.');
      setDeleteTarget(null);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to delete');
    } finally { setDeleting(false); }
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Student Enrollments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Enroll students into classes and sections for each academic year.</p>
        </div>
        <button type="button" onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Enroll Student
        </button>
      </div>

      {loadError  && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}
      {saveError  && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {loading && <div className="py-12 text-center text-sm text-slate-400">Loading enrollments…</div>}

      {!loading && (
        <>
          {/* Desktop table */}
          <PremiumCard accentColor="green" className="hidden sm:block overflow-hidden">
            <table className="grand-table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Student</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Year</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Class</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Section</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Roll</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrollments.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-medium text-slate-900">{studentLabel(e.studentId)}</td>
                    <td className="px-5 py-4 text-slate-600">{yearMap.get(e.academicYearId) ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-600">{classMap.get(e.classId) ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-600">{sectionMap.get(e.sectionId) ?? '—'}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-700">{e.rollNumber}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => openEdit(e)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(e)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {enrollments.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-400">
                    No enrollments yet. Click &ldquo;Enroll Student&rdquo; to get started.
                  </td></tr>
                )}
              </tbody>
            </table>
          </PremiumCard>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {enrollments.map((e) => (
              <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-bold text-slate-900 mb-1">{studentLabel(e.studentId)}</p>
                <p className="text-xs text-slate-500 mb-3">
                  {yearMap.get(e.academicYearId) ?? '—'} &bull; {classMap.get(e.classId) ?? '—'} &bull; {sectionMap.get(e.sectionId) ?? '—'} &bull; Roll {e.rollNumber}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(e)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">Edit</button>
                  <button type="button" onClick={() => setDeleteTarget(e)}
                    className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">Delete</button>
                </div>
              </div>
            ))}
            {enrollments.length === 0 && <div className="py-12 text-center text-sm text-slate-400">No enrollments yet.</div>}
          </div>

          <p className="mt-4 text-xs text-slate-400">{enrollments.length} enrollment{enrollments.length !== 1 ? 's' : ''}.</p>
        </>
      )}

      <EnrollmentPanel
        open={panelOpen} editing={editing}
        students={students} years={years} classes={classes} sections={sections}
        onClose={handleClose} onSave={handleSave} saving={saving}
      />
      <DeleteDialog
        open={deleteTarget !== null}
        label={deleteTarget ? studentLabel(deleteTarget.studentId) : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}

export default function EnrollmentsPage() {
  return (
    <AuthGuard>
      {(claims) => <EnrollmentsContent claims={claims} />}
    </AuthGuard>
  );
}
