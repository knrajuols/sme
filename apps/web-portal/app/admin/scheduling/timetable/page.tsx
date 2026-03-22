'use client';

import { useCallback, useEffect, useState } from 'react';

import { AuthGuard }  from '../../../../components/AuthGuard';
import { bffFetch }   from '../../../../lib/api';
import type { UserClaims } from '../../../../lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────
interface YearRef    { id: string; name: string; isActive: boolean; }
interface PeriodRef  { id: string; name: string; startTime: string; endTime: string; orderIndex: number; }
interface SectionRef { id: string; name: string; }
interface ClassWithSections { id: string; name: string; code: string; sections: SectionRef[]; }
// A rendered grid row — sectionId/sectionName are null for classes that have no sections
interface GridRow { classId: string; className: string; sectionId: string | null; sectionName: string | null; }
interface SubjectRef  { id: string; name: string; code: string; }
interface TeacherRef  { id: string; firstName: string | null; lastName: string | null; employeeCode: string; }
interface TeacherWithSubjects extends TeacherRef { subjects: SubjectRef[]; }
interface EntryRef    {
  id:        string;
  classId:   string;
  sectionId: string | null;  // null for classes with no sections
  periodId:  string;
  subject:   SubjectRef | null;
  teacher:   TeacherRef | null;
}
interface EntriesResponse { periods: PeriodRef[]; classes: ClassWithSections[]; entries: EntryRef[]; }
type ViewMode = 'subject' | 'teacher' | 'combined';

// ── Helpers ───────────────────────────────────────────────────────────────────
function teacherName(t: TeacherRef): string {
  const parts = [t.firstName, t.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : t.employeeCode;
}
// sectionId is normalised to '' for section-less classes so keys stay consistent
// whether the value originates from the grid row ('' via ??) or the server (null).
function cellKey(classId: string, sectionId: string | null, periodId: string): string {
  return `${classId}::${sectionId ?? ''}::${periodId}`;
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ small = false }: { small?: boolean }) {
  return (
    <svg className={`animate-spin ${small ? 'h-3.5 w-3.5' : 'h-5 w-5'} text-slate-400`}
      fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ── Assignment Modal ──────────────────────────────────────────────────────────
interface ModalState {
  academicYearId: string;
  classId:        string;
  sectionId:      string;
  period:         PeriodRef;
  existing:       EntryRef | null;
}

function AssignModal({
  state, subjects, teachers, allEntries, onClose, onSaved,
}: {
  state:      ModalState;
  subjects:   SubjectRef[];
  teachers:   TeacherWithSubjects[];
  allEntries: EntryRef[];
  onClose:    () => void;
  onSaved:    (subjectId: string, teacherId: string) => void;
}) {
  const [subjectId, setSubjectId] = useState(state.existing?.subject?.id ?? '');
  const [teacherId, setTeacherId] = useState(state.existing?.teacher?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // Cascading: only teachers qualified to teach the selected subject
  const eligibleTeachers = subjectId
    ? teachers.filter(t => t.subjects.some(s => s.id === subjectId))
    : teachers;

  // Auto-clear teacher when subject changes and chosen teacher is no longer eligible
  useEffect(() => {
    if (teacherId && subjectId && !eligibleTeachers.some(t => t.id === teacherId)) {
      setTeacherId('');
    }
  }, [subjectId, eligibleTeachers, teacherId]);

  // Inline conflict warning: teacher already assigned to another class in this period
  const teacherDoubleBooked = teacherId
    ? allEntries.some(
        e =>
          e.teacher?.id === teacherId &&
          e.periodId === state.period.id &&
          !(e.classId === state.classId && (e.sectionId ?? '') === state.sectionId),
      )
    : false;
  const conflictWarning = teacherDoubleBooked
    ? 'This teacher is already assigned to another class for this period.'
    : null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await bffFetch('/api/timetable/upsert', {
        method: 'POST',
        body: JSON.stringify({
          academicYearId: state.academicYearId,
          classId:        state.classId,
          // Explicitly send null (not empty string) when there is no section
          sectionId:      state.sectionId || null,
          periodId:       state.period.id,
          subjectId:      subjectId || null,
          teacherId:      teacherId || null,
        }),
      });
      onSaved(subjectId, teacherId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto">

          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                {state.period.name}
              </p>
              <h3 className="text-base font-bold text-slate-800">
                {state.existing ? 'Reassign Period' : 'Assign Period'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {state.period.startTime} – {state.period.endTime}
              </p>
            </div>
            <button type="button" onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-2xl font-light leading-none mt-0.5"
              aria-label="Close">×
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* Current assignment chip */}
            {state.existing && (state.existing.subject || state.existing.teacher) && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold">Current: </span>
                {state.existing.subject?.name && <span>{state.existing.subject.name}</span>}
                {state.existing.subject?.name && state.existing.teacher && <span className="text-slate-400"> · </span>}
                {state.existing.teacher && <span>{teacherName(state.existing.teacher)}</span>}
              </div>
            )}

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="modal-subject">
                Subject <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select id="modal-subject" value={subjectId} onChange={e => setSubjectId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— None —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>

            {/* Teacher */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="modal-teacher">
                Teacher <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select id="modal-teacher" value={teacherId} onChange={e => setTeacherId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— None —</option>
                {eligibleTeachers.map(t => <option key={t.id} value={t.id}>{teacherName(t)} ({t.employeeCode})</option>)}
              </select>
            </div>

            {/* Double-booking conflict warning */}
            {conflictWarning && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{conflictWarning}</p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 pt-1 flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || !!conflictWarning}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {saving && <Spinner small />}
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Period Cell ───────────────────────────────────────────────────────────────
function PeriodCell({
  entry, viewMode, disabled, onClick,
}: {
  entry:     EntryRef | null;
  viewMode:  ViewMode;
  disabled:  boolean;
  onClick:   () => void;
}) {
  const hasContent = entry && (entry.subject || entry.teacher);

  if (disabled) {
    return (
      <td className="px-1 py-1 min-w-[104px]">
        <div className="h-14 rounded-lg bg-slate-50 border border-slate-100" />
      </td>
    );
  }

  if (!hasContent) {
    return (
      <td className="px-1 py-1 min-w-[104px]">
        <button type="button" onClick={onClick}
          className="w-full h-14 rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/60 transition-all flex items-center justify-center group"
          aria-label="Assign subject/teacher">
          <span className="text-slate-300 group-hover:text-blue-400 text-xl font-light">+</span>
        </button>
      </td>
    );
  }

  const subjectName    = entry!.subject?.name          ?? null;
  const subjectCode    = entry!.subject?.code          ?? null;
  const teacherDisplay = entry!.teacher ? teacherName(entry!.teacher) : null;
  const teacherCode    = entry!.teacher?.employeeCode  ?? null;

  const tooltip = [subjectName, teacherDisplay].filter(Boolean).join(' · ');

  const cellStyle =
    viewMode === 'teacher'  ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100' :
    viewMode === 'combined' ? 'border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100' :
                              'border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100';

  return (
    <td className="px-1 py-1 min-w-[104px]">
      <button type="button" onClick={onClick} title={tooltip}
        className={`w-full h-14 rounded-lg border px-2 py-1.5 text-left transition-all hover:shadow-md ${cellStyle}`}>

        {viewMode === 'subject' && (
          <>
            <p className="text-[11px] font-bold truncate leading-tight text-indigo-800">
              {subjectName ?? <span className="font-normal italic text-slate-400">No subject</span>}
            </p>
            {subjectCode && <p className="text-[10px] truncate leading-tight mt-0.5 text-indigo-400">{subjectCode}</p>}
          </>
        )}

        {viewMode === 'teacher' && (
          <>
            <p className="text-[11px] font-bold truncate leading-tight text-emerald-800">
              {teacherDisplay ?? <span className="font-normal italic text-slate-400">No teacher</span>}
            </p>
          </>
        )}

        {viewMode === 'combined' && (
          <>
            <p className="text-[11px] font-bold truncate leading-tight text-indigo-800">
              {subjectName ?? <span className="font-normal italic text-slate-400">No subject</span>}
            </p>
            {teacherDisplay && (
              <p className="text-[10px] truncate leading-tight mt-0.5 text-emerald-600">{teacherDisplay}</p>
            )}
          </>
        )}

      </button>
    </td>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
function TimetablePage({ user: _user }: { user: UserClaims }) {
  const [years,         setYears]         = useState<YearRef[]>([]);
  const [yearId,        setYearId]        = useState('');
  const [periods,       setPeriods]       = useState<PeriodRef[]>([]);
  const [allClasses,    setAllClasses]    = useState<ClassWithSections[]>([]);
  const [entryMap,      setEntryMap]      = useState<Map<string, EntryRef>>(new Map());
  const [subjects,      setSubjects]      = useState<SubjectRef[]>([]);
  const [teachers,      setTeachers]      = useState<TeacherWithSubjects[]>([]);
  const [viewMode,      setViewMode]      = useState<ViewMode>('combined');
  const [modal,         setModal]         = useState<ModalState | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  // Filter state — purely visual, no data refetch
  const [filterClassId,   setFilterClassId]   = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [filterSections,  setFilterSections]  = useState<SectionRef[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('');

  // ── Bootstrap: years + subjects + teachers ───────────────────────────────
  useEffect(() => {
    void Promise.all([
      bffFetch<YearRef[]>('/api/academic/years'),
      bffFetch<SubjectRef[]>('/api/academic/subjects'),
      bffFetch<TeacherWithSubjects[]>('/api/academic/teachers'),
    ]).then(([y, s, t]) => {
      setYears(y);
      setSubjects(s);
      setTeachers(t);
      const active = y.find(yr => yr.isActive);
      if (active) setYearId(active.id);
    }).catch(() => setError('Failed to load reference data'));
  }, []);

  // ── Load grid data when year changes ─────────────────────────────────────
  const loadEntries = useCallback(async (yId: string) => {
    if (!yId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await bffFetch<EntriesResponse>(`/api/timetable/entries?academicYearId=${yId}`);
      setPeriods(data.periods);
      setAllClasses(data.classes);
      const map = new Map<string, EntryRef>();
      for (const e of data.entries) map.set(cellKey(e.classId, e.sectionId, e.periodId), e);
      setEntryMap(map);
      setFilterClassId('');
      setFilterSectionId('');
      setFilterSections([]);
      setFilterSubjectId('');
      setFilterTeacherId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadEntries(yearId); }, [yearId, loadEntries]);

  // ── Populate section filter when class filter changes ────────────────────
  useEffect(() => {
    if (!filterClassId) {
      setFilterSections([]);
      setFilterSectionId('');
      return;
    }
    const cls = allClasses.find(c => c.id === filterClassId);
    if (cls) {
      setFilterSections(cls.sections);
    } else {
      void bffFetch<SectionRef[]>(`/api/academic/sections?classId=${filterClassId}`)
        .then(setFilterSections)
        .catch(() => setFilterSections([]));
    }
    setFilterSectionId('');
  }, [filterClassId, allClasses]);

  // ── Flat auto-populated rows: every class × section ──────────────────────
  // Classes with no sections still appear as a single class-only row.
  const allRows: GridRow[] = [];
  for (const cls of allClasses) {
    const sections = cls.sections ?? [];
    if (sections.length > 0) {
      for (const sec of sections) {
        allRows.push({ classId: cls.id, className: cls.name, sectionId: sec.id, sectionName: sec.name });
      }
    } else {
      allRows.push({ classId: cls.id, className: cls.name, sectionId: null, sectionName: null });
    }
  }

  const visibleRows = allRows.filter(row => {
    if (filterClassId   && row.classId   !== filterClassId)   return false;
    if (filterSectionId && row.sectionId !== filterSectionId) return false;
    // Subject filter: row must have at least one period with that subject
    if (filterSubjectId) {
      const found = periods.some(p => {
        const e = entryMap.get(cellKey(row.classId, row.sectionId, p.id));
        return e?.subject?.id === filterSubjectId;
      });
      if (!found) return false;
    }
    // Teacher filter: row must have at least one period with that teacher
    if (filterTeacherId) {
      const found = periods.some(p => {
        const e = entryMap.get(cellKey(row.classId, row.sectionId, p.id));
        return e?.teacher?.id === filterTeacherId;
      });
      if (!found) return false;
    }
    return true;
  });

  // ── Optimistic cell update — instant re-render, background sync ───────────
  function handleSaved(savedModal: ModalState, savedSubjectId: string, savedTeacherId: string) {
    const key = cellKey(savedModal.classId, savedModal.sectionId, savedModal.period.id);
    setEntryMap(prev => {
      const next = new Map(prev);
      if (!savedSubjectId && !savedTeacherId) {
        next.delete(key);
      } else {
        const subject = subjects.find(s => s.id === savedSubjectId) ?? null;
        const teacher = teachers.find(t => t.id === savedTeacherId) ?? null;
        next.set(key, {
          id:        prev.get(key)?.id ?? key,
          classId:   savedModal.classId,
          sectionId: savedModal.sectionId,
          periodId:  savedModal.period.id,
          subject,
          teacher,
        });
      }
      return next;
    });
    void loadEntries(yearId);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Timetable</h1>
          <p className="text-sm text-slate-500 mt-1">
            Assign subjects and teachers to each period across all class-sections.
          </p>
        </div>

        {/* Top-right controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Year selector */}
          <select
            value={yearId}
            onChange={e => setYearId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[170px]"
          >
            <option value="">— Academic Year —</option>
            {years.map(y => (
              <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' ★' : ''}</option>
            ))}
          </select>

          {/* Triple view toggle */}
          <div className="inline-flex rounded-lg border border-slate-300 bg-white overflow-hidden shadow-sm">
            <button type="button"
              onClick={() => setViewMode('subject')}
              className={`px-3 py-2 text-xs font-semibold transition-colors border-r border-slate-300 ${
                viewMode === 'subject' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              Subject
            </button>
            <button type="button"
              onClick={() => setViewMode('teacher')}
              className={`px-3 py-2 text-xs font-semibold transition-colors border-r border-slate-300 ${
                viewMode === 'teacher' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              Teacher
            </button>
            <button type="button"
              onClick={() => setViewMode('combined')}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${
                viewMode === 'combined' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              Combined
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      )}

      {/* Empty year state */}
      {!yearId && !error && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm text-slate-400">
          Select an Academic Year above to start building the timetable.
        </div>
      )}

      {/* Filter bar — visible once data is loaded */}
      {yearId && !loading && allClasses.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Filter</span>

          <select
            value={filterClassId}
            onChange={e => setFilterClassId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[140px]"
          >
            <option value="">All Classes</option>
            {allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={filterSectionId}
            onChange={e => setFilterSectionId(e.target.value)}
            disabled={!filterClassId}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[130px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="">All Sections</option>
            {filterSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select
            value={filterSubjectId}
            onChange={e => setFilterSubjectId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[140px]"
          >
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select
            value={filterTeacherId}
            onChange={e => setFilterTeacherId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-[150px]"
          >
            <option value="">All Teachers</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{teacherName(t)} ({t.employeeCode})</option>)}
          </select>

          {(filterClassId || filterSectionId || filterSubjectId || filterTeacherId) && (
            <button type="button"
              onClick={() => { setFilterClassId(''); setFilterSectionId(''); setFilterSubjectId(''); setFilterTeacherId(''); }}
              className="text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors">
              Clear
            </button>
          )}

          <span className="ml-auto text-xs text-slate-400">
            {visibleRows.length} of {allRows.length} rows
          </span>
        </div>
      )}

      {/* Grid */}
      {yearId && (
        loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
            <Spinner /> Loading timetable data…
          </div>
        ) : allRows.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
            No classes or sections configured for this academic year.
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm" style={{ minWidth: `${280 + periods.length * 108}px` }}>
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">

                    {/* Sticky: Class header */}
                    <th style={{ width: 160, minWidth: 160, left: 0, boxShadow: '2px 0 6px -2px rgba(0,0,0,0.06)' }}
                      className="sticky z-20 px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
                      Class
                    </th>

                    {/* Sticky: Section header */}
                    <th style={{ width: 110, minWidth: 110, left: 160, boxShadow: '2px 0 6px -2px rgba(0,0,0,0.06)' }}
                      className="sticky z-20 px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
                      Section
                    </th>

                    {/* Period columns */}
                    {periods.map(p => (
                      <th key={p.id} className="px-2 py-3 text-center" style={{ minWidth: 104 }}>
                        <p className="text-xs font-bold text-slate-700">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-normal whitespace-nowrap">
                          {p.startTime}–{p.endTime}
                        </p>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={2 + periods.length} className="py-10 text-center text-sm text-slate-400">
                        No rows match the current filter.
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map(row => (
                      <tr key={`${row.classId}::${row.sectionId}`}
                        className="hover:bg-slate-50/60 transition-colors">

                        {/* Sticky: Class label */}
                        <td style={{ width: 160, minWidth: 160, left: 0, boxShadow: '2px 0 6px -2px rgba(0,0,0,0.04)' }}
                          className="sticky z-10 bg-white px-3 py-2 border-r border-slate-100">
                          <span className="text-xs font-semibold text-slate-700">{row.className}</span>
                        </td>

                        {/* Sticky: Section label */}
                        <td style={{ width: 110, minWidth: 110, left: 160, boxShadow: '2px 0 6px -2px rgba(0,0,0,0.04)' }}
                          className="sticky z-10 bg-white px-3 py-2 border-r border-slate-100">
                          {row.sectionName ? (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {row.sectionName}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">—</span>
                          )}
                        </td>

                        {/* Period cells — always clickable */}
                        {periods.map(period => (
                          <PeriodCell
                            key={period.id}
                            entry={entryMap.get(cellKey(row.classId, row.sectionId ?? '', period.id)) ?? null}
                            viewMode={viewMode}
                            disabled={false}
                            onClick={() => {
                              if (!yearId) return;
                              setModal({
                                academicYearId: yearId,
                                classId:        row.classId,
                                sectionId:      row.sectionId ?? '',
                                period,
                                existing: entryMap.get(cellKey(row.classId, row.sectionId ?? '', period.id)) ?? null,
                              });
                            }}
                          />
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Assignment Modal */}
      {modal && (
        <AssignModal
          state={modal}
          subjects={subjects}
          teachers={teachers}
          allEntries={Array.from(entryMap.values())}
          onClose={() => setModal(null)}
          onSaved={(subjectId, teacherId) => {
            const saved = modal;
            setModal(null);
            handleSaved(saved, subjectId, teacherId);
          }}
        />
      )}
    </div>
  );
}

// ── Route export ──────────────────────────────────────────────────────────────
export default function TimetableRoute() {
  return (
    <AuthGuard>
      {(user: UserClaims) => <TimetablePage user={user} />}
    </AuthGuard>
  );
}
