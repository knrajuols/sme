'use client';

import { useEffect, useState } from 'react';

import { AuthGuard } from '../../../components/AuthGuard';
import { bffFetch } from '../../../lib/api';
import type { UserClaims } from '../../../lib/auth';
import { PremiumCard } from '../../../components/ui/PremiumCard';
import { StatusPill } from '../../../components/ui/StatusPill';
import { TeacherForm } from '../../../components/forms/TeacherForm';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SubjectRef { id: string; name: string; code: string; }
interface DeptRef { id: string; name: string; code: string; }
interface RoleRef { id: string; name: string; code: string; }

interface Teacher {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  contactPhone: string | null;
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  employeeCode: string;
  designation: string;
  isActive: boolean;
  subjects: SubjectRef[];
}

function fullName(t: Teacher): string {
  return [t.firstName, t.lastName].filter(Boolean).join(' ') || t.employeeCode;
}

// ── Slide-over panel (thin wrapper around reusable TeacherForm) ────────────────
function TeacherPanel({
  open,
  editingTeacher,
  allSubjects,
  allDepts,
  allRoles,
  onClose,
  onSuccess,
  onError,
}: {
  open: boolean;
  editingTeacher: Teacher | null;
  allSubjects: SubjectRef[];
  allDepts: DeptRef[];
  allRoles: RoleRef[];
  onClose: () => void;
  onSuccess: (info: { name: string; action: 'created' | 'updated' }) => void;
  onError: (msg: string) => void;
}) {
  const isEdit = editingTeacher !== null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={isEdit ? 'Edit Teacher' : 'Add Teacher'}
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? `Edit: ${fullName(editingTeacher!)}` : 'Add Faculty Member'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? 'Update this teacher record.' : 'Register a new faculty member.'}
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

        {/* Form body — delegated to reusable TeacherForm */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <TeacherForm
            editing={editingTeacher}
            allSubjects={allSubjects}
            allDepts={allDepts}
            allRoles={allRoles}
            onSuccess={onSuccess}
            onError={onError}
            onCancel={onClose}
          />
        </div>
      </div>
    </>
  );
}

// ── Delete confirmation dialog ─────────────────────────────────────────────────
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
        <h3 className="text-base font-bold text-slate-900 mb-2">Remove Faculty Member</h3>
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
            {deleting ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main content ───────────────────────────────────────────────────────────────
function FacultyContent({ claims: _claims }: { claims: UserClaims }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectRef[]>([]);
  const [allDepts, setAllDepts] = useState<DeptRef[]>([]);
  const [allRoles, setAllRoles] = useState<RoleRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [saveError, setSaveError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [deleting, setDeleting] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  function openAdd() {
    setEditingTeacher(null);
    setPanelOpen(true);
  }

  function openEdit(t: Teacher) {
    setEditingTeacher(t);
    setPanelOpen(true);
  }

  function handleClose() {
    setPanelOpen(false);
    setSaveError('');
    setTimeout(() => setEditingTeacher(null), 300);
  }

  function loadData() {
    setLoading(true);
    Promise.all([
      bffFetch<Teacher[]>('/api/faculty'),
      bffFetch<SubjectRef[]>('/api/academic/subjects').catch(() => [] as SubjectRef[]),
      bffFetch<DeptRef[]>('/api/hr/departments').catch(() => [] as DeptRef[]),
      bffFetch<RoleRef[]>('/api/hr/roles').catch(() => [] as RoleRef[]),
    ])
      .then(([data, subs, depts, roles]) => {
        setTeachers(Array.isArray(data) ? data : []);
        setAllSubjects(Array.isArray(subs) ? subs : []);
        setAllDepts(Array.isArray(depts) ? depts : []);
        setAllRoles(Array.isArray(roles) ? roles : []);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load faculty'))
      .finally(() => setLoading(false));
  }

  function handleFormSuccess(info: { name: string; action: 'created' | 'updated' }) {
    setPanelOpen(false);
    setSaveError('');
    setTimeout(() => setEditingTeacher(null), 300);
    setSuccessMsg(
      info.action === 'created'
        ? `Teacher "${info.name}" added successfully.`
        : `Teacher "${info.name}" updated successfully.`
    );
    setTimeout(() => setSuccessMsg(''), 4000);
    loadData();
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bffFetch<unknown>(`/api/faculty/${deleteTarget.id}`, { method: 'DELETE' });
      setTeachers((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setSuccessMsg(`Teacher "${fullName(deleteTarget)}" removed.`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to remove teacher');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Faculty</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage teachers and staff for your school.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Teacher
        </button>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{loadError}</p>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
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
        <div className="py-12 text-center text-sm text-slate-400">Loading faculty…</div>
      )}

      {!loading && (<>
        {/* Table — desktop */}
        <PremiumCard accentColor="orange" className="hidden sm:block overflow-hidden">
          <table className="grand-table w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Emp. ID</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Designation</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Subjects</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-slate-900">{fullName(t)}</td>
                  <td className="px-5 py-4 text-slate-600">{t.email ?? '—'}</td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{t.employeeCode}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{t.designation}</td>
                  <td className="px-5 py-4">
                    {t.subjects && t.subjects.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.subjects.map(s => (
                          <span key={s.id} className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill status={t.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(t)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                        Edit
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(t)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-slate-400">
                    No faculty members yet. Click &quot;Add Teacher&quot; to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </PremiumCard>

        {/* Card stack — mobile */}
        <div className="sm:hidden space-y-3">
          {teachers.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between mb-1">
                <p className="font-bold text-slate-900 text-base">{fullName(t)}</p>
                <StatusPill status={t.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </div>
              <p className="text-xs text-slate-500">{t.email ?? '—'}</p>
              <p className="text-xs text-slate-500">{t.designation}</p>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => openEdit(t)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  Edit
                </button>
                <button type="button" onClick={() => setDeleteTarget(t)}
                  className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                  Remove
                </button>
              </div>
            </div>
          ))}
          {teachers.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">No faculty members yet.</div>
          )}
        </div>
      </>)}

      <p className="mt-4 text-xs text-slate-400">{teachers.length} faculty member{teachers.length !== 1 ? 's' : ''} registered.</p>

      <TeacherPanel
        open={panelOpen}
        editingTeacher={editingTeacher}
        allSubjects={allSubjects}
        allDepts={allDepts}
        allRoles={allRoles}
        onClose={handleClose}
        onSuccess={handleFormSuccess}
        onError={(msg) => setSaveError(msg)}
      />

      <DeleteDialog
        open={deleteTarget !== null}
        label={deleteTarget ? fullName(deleteTarget) : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}

// ── Page export ────────────────────────────────────────────────────────────────
export default function FacultyPage() {
  return (
    <AuthGuard>
      {(claims) => <FacultyContent claims={claims} />}
    </AuthGuard>
  );
}
