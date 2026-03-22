'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthGuard }  from '../../../../components/AuthGuard';
import { bffFetch }   from '../../../../lib/api';
import type { UserClaims } from '../../../../lib/auth';
import { PremiumCard } from '../../../../components/ui/PremiumCard';

// ── Types (same as V1, reused for backend compatibility) ──────────────────────
interface YearRef    { id: string; name: string; isActive: boolean; }
interface PeriodRef  { id: string; name: string; startTime: string; endTime: string; orderIndex: number; }
interface SectionRef { id: string; name: string; }
interface ClassWithSections { id: string; name: string; code: string; sections: SectionRef[]; }
interface GridRow { classId: string; className: string; sectionId: string | null; sectionName: string | null; }
interface SubjectRef  { id: string; name: string; code: string; }
interface TeacherRef  { id: string; firstName: string | null; lastName: string | null; employeeCode: string; }
interface TeacherWithSubjects extends TeacherRef { subjects: SubjectRef[]; }
interface EntryRef    {
  id:        string;
  classId:   string;
  sectionId: string | null;
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

// ── Stat Pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 ${color}`}>
      <span className="text-lg font-bold">{value}</span>
      <span className="text-[11px] font-medium opacity-80">{label}</span>
    </div>
  );
}

// ── Assignment Modal (Premium Design) ─────────────────────────────────────────
interface ModalState {
  academicYearId: string;
  classId:        string;
  sectionId:      string;
  period:         PeriodRef;
  existing:       EntryRef | null;
  className:      string;
  sectionName:    string | null;
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

  const eligibleTeachers = subjectId
    ? teachers.filter(t => t.subjects.some(s => s.id === subjectId))
    : teachers;

  useEffect(() => {
    if (teacherId && subjectId && !eligibleTeachers.some(t => t.id === teacherId)) {
      setTeacherId('');
    }
  }, [subjectId, eligibleTeachers, teacherId]);

  const teacherDoubleBooked = teacherId
    ? allEntries.some(
        e =>
          e.teacher?.id === teacherId &&
          e.periodId === state.period.id &&
          !(e.classId === state.classId && (e.sectionId ?? '') === state.sectionId),
      )
    : false;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await bffFetch('/api/timetable/upsert', {
        method: 'POST',
        body: JSON.stringify({
          academicYearId: state.academicYearId,
          classId:        state.classId,
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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto border border-slate-200/60 overflow-hidden">

          {/* Header — gradient banner */}
          <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 px-6 pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-white/70 uppercase tracking-wider mb-1">
                  {state.period.name} · {state.period.startTime} – {state.period.endTime}
                </p>
                <h3 className="text-lg font-bold text-white">
                  {state.existing ? 'Reassign Period' : 'Assign Period'}
                </h3>
                <p className="text-sm text-white/70 mt-0.5">
                  {state.className}{state.sectionName ? ` — ${state.sectionName}` : ''}
                </p>
              </div>
              <button type="button" onClick={onClose}
                className="text-white/60 hover:text-white text-2xl font-light leading-none mt-0.5 transition-colors"
                aria-label="Close">×
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span className="text-red-400">⚠</span> {error}
              </div>
            )}

            {/* Current assignment chip */}
            {state.existing && (state.existing.subject || state.existing.teacher) && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="font-semibold text-slate-500">Current:</span>
                {state.existing.subject?.name && <span className="font-medium text-slate-700">{state.existing.subject.name}</span>}
                {state.existing.subject?.name && state.existing.teacher && <span className="text-slate-300">·</span>}
                {state.existing.teacher && <span className="text-emerald-600">{teacherName(state.existing.teacher)}</span>}
              </div>
            )}

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="modal-v2-subject">
                Subject <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select id="modal-v2-subject" value={subjectId} onChange={e => setSubjectId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow">
                <option value="">— None —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>

            {/* Teacher */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="modal-v2-teacher">
                Teacher <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select id="modal-v2-teacher" value={teacherId} onChange={e => setTeacherId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow">
                <option value="">— None —</option>
                {eligibleTeachers.map(t => <option key={t.id} value={t.id}>{teacherName(t)} ({t.employeeCode})</option>)}
              </select>
            </div>

            {/* Double-booking conflict warning */}
            {teacherDoubleBooked && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <span className="text-amber-400">⚠</span>
                This teacher is already assigned to another class for this period.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 pt-1 flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || teacherDoubleBooked}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
              {saving && <Spinner small />}
              {saving ? 'Saving…' : 'Save Assignment'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Period Cell (Premium Redesign) ────────────────────────────────────────────
function PeriodCellV2({
  entry, viewMode, onClick,
}: {
  entry:     EntryRef | null;
  viewMode:  ViewMode;
  onClick:   () => void;
}) {
  const hasContent = entry && (entry.subject || entry.teacher);

  if (!hasContent) {
    return (
      <td className="px-1.5 py-1.5">
        <button type="button" onClick={onClick}
          className="w-full h-[68px] rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all flex items-center justify-center group"
          aria-label="Assign subject/teacher">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-slate-300 group-hover:text-indigo-400 text-xl font-light transition-colors">+</span>
            <span className="text-[9px] text-slate-300 group-hover:text-indigo-400 font-medium transition-colors">Assign</span>
          </div>
        </button>
      </td>
    );
  }

  const subjectName    = entry!.subject?.name          ?? null;
  const subjectCode    = entry!.subject?.code          ?? null;
  const teacherDisplay = entry!.teacher ? teacherName(entry!.teacher) : null;
  const teacherCode    = entry!.teacher?.employeeCode  ?? null;

  const tooltip = [subjectName, teacherDisplay].filter(Boolean).join(' · ');

  const cellGradient =
    viewMode === 'teacher'  ? 'from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border-emerald-200/80 hover:border-emerald-300' :
    viewMode === 'combined' ? 'from-violet-50 to-indigo-50 hover:from-violet-100 hover:to-indigo-100 border-violet-200/80 hover:border-violet-300' :
                              'from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-indigo-200/80 hover:border-indigo-300';

  const iconBg =
    viewMode === 'teacher'  ? 'bg-emerald-500' :
    viewMode === 'combined' ? 'bg-violet-500' :
                              'bg-indigo-500';

  return (
    <td className="px-1.5 py-1.5">
      <button type="button" onClick={onClick} title={tooltip}
        className={`w-full h-[68px] rounded-xl border bg-gradient-to-br px-3 py-2 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 ${cellGradient}`}>

        <div className="flex items-start gap-2 h-full">
          {/* Color indicator dot */}
          <div className={`w-1.5 h-1.5 rounded-full ${iconBg} mt-1 flex-shrink-0`} />

          <div className="flex-1 min-w-0">
            {viewMode === 'subject' && (
              <>
                <p className="text-[11px] font-bold truncate leading-tight text-indigo-800">
                  {subjectName ?? <span className="font-normal italic text-slate-400">No subject</span>}
                </p>
                {subjectCode && <p className="text-[10px] truncate leading-tight mt-0.5 text-indigo-400 font-medium">{subjectCode}</p>}
                {teacherDisplay && <p className="text-[9px] truncate leading-tight mt-1 text-slate-400">{teacherDisplay}</p>}
              </>
            )}

            {viewMode === 'teacher' && (
              <>
                <p className="text-[11px] font-bold truncate leading-tight text-emerald-800">
                  {teacherDisplay ?? <span className="font-normal italic text-slate-400">No teacher</span>}
                </p>
                {subjectName && <p className="text-[9px] truncate leading-tight mt-1 text-slate-400">{subjectName}</p>}
              </>
            )}

            {viewMode === 'combined' && (
              <>
                <p className="text-[11px] font-bold truncate leading-tight text-indigo-800">
                  {subjectName ?? <span className="font-normal italic text-slate-400">No subject</span>}
                </p>
                {teacherDisplay && (
                  <p className="text-[10px] truncate leading-tight mt-0.5 text-emerald-600 font-medium">{teacherDisplay}</p>
                )}
              </>
            )}
          </div>
        </div>
      </button>
    </td>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
function TimetableV2Page({ user: _user }: { user: UserClaims }) {
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
  const [banner,        setBanner]        = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Filter state
  const [filterClassId,   setFilterClassId]   = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [filterSections,  setFilterSections]  = useState<SectionRef[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('');

  function showBanner(type: 'success' | 'error', msg: string) {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 4000);
  }

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

  // ── Flat auto-populated rows ─────────────────────────────────────────────
  const allRows: GridRow[] = useMemo(() => {
    const rows: GridRow[] = [];
    for (const cls of allClasses) {
      const sections = cls.sections ?? [];
      if (sections.length > 0) {
        for (const sec of sections) {
          rows.push({ classId: cls.id, className: cls.name, sectionId: sec.id, sectionName: sec.name });
        }
      } else {
        rows.push({ classId: cls.id, className: cls.name, sectionId: null, sectionName: null });
      }
    }
    return rows;
  }, [allClasses]);

  const visibleRows = useMemo(() => allRows.filter(row => {
    if (filterClassId   && row.classId   !== filterClassId)   return false;
    if (filterSectionId && row.sectionId !== filterSectionId) return false;
    if (filterSubjectId) {
      const found = periods.some(p => {
        const e = entryMap.get(cellKey(row.classId, row.sectionId, p.id));
        return e?.subject?.id === filterSubjectId;
      });
      if (!found) return false;
    }
    if (filterTeacherId) {
      const found = periods.some(p => {
        const e = entryMap.get(cellKey(row.classId, row.sectionId, p.id));
        return e?.teacher?.id === filterTeacherId;
      });
      if (!found) return false;
    }
    return true;
  }), [allRows, filterClassId, filterSectionId, filterSubjectId, filterTeacherId, periods, entryMap]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalSlots = allRows.length * periods.length;
    let assigned = 0;
    let withSubject = 0;
    let withTeacher = 0;
    const uniqueSubjects = new Set<string>();
    const uniqueTeachers = new Set<string>();

    for (const row of allRows) {
      for (const p of periods) {
        const e = entryMap.get(cellKey(row.classId, row.sectionId, p.id));
        if (e && (e.subject || e.teacher)) {
          assigned++;
          if (e.subject) { withSubject++; uniqueSubjects.add(e.subject.id); }
          if (e.teacher) { withTeacher++; uniqueTeachers.add(e.teacher.id); }
        }
      }
    }

    const pct = totalSlots > 0 ? Math.round((assigned / totalSlots) * 100) : 0;
    return { totalSlots, assigned, unassigned: totalSlots - assigned, withSubject, withTeacher, uniqueSubjects: uniqueSubjects.size, uniqueTeachers: uniqueTeachers.size, pct };
  }, [allRows, periods, entryMap]);

  // ── Optimistic cell update ───────────────────────────────────────────────
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
    showBanner('success', 'Period assignment saved successfully.');
    void loadEntries(yearId);
  }

  // ── Active filter count ──────────────────────────────────────────────────
  const activeFilters = [filterClassId, filterSectionId, filterSubjectId, filterTeacherId].filter(Boolean).length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ─── Page Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-800">Timetable</h1>
            <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
              V2
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Assign subjects and teachers to each period across all class-sections.
          </p>
        </div>

        {/* Top-right controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Academic Year selector */}
          <div className="relative">
            <select
              value={yearId}
              onChange={e => setYearId(e.target.value)}
              className="appearance-none rounded-xl border border-slate-300 bg-white pl-4 pr-10 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[200px] transition-shadow"
            >
              <option value="">— Academic Year —</option>
              {years.map(y => (
                <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' ★' : ''}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* View mode toggle — pill-style */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 shadow-inner">
            {(['subject', 'teacher', 'combined'] as ViewMode[]).map(mode => {
              const isActive = viewMode === mode;
              const activeStyle =
                mode === 'subject'  ? 'bg-indigo-600 text-white shadow-md' :
                mode === 'teacher'  ? 'bg-emerald-600 text-white shadow-md' :
                                      'bg-violet-600 text-white shadow-md';
              return (
                <button key={mode} type="button"
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                    isActive ? activeStyle : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {mode}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Banner ─────────────────────────────────────────────────────── */}
      {banner && (
        <div className={`rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2 transition-all ${
          banner.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <span>{banner.type === 'success' ? '✓' : '✕'}</span>
          {banner.msg}
        </div>
      )}

      {/* ─── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 flex items-center gap-2">
          <span className="text-red-400 flex-shrink-0">⚠</span>
          {error}
        </div>
      )}

      {/* ─── Empty year state ───────────────────────────────────────────── */}
      {!yearId && !error && (
        <PremiumCard accentColor="blue" className="px-8 py-16 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 font-medium">Select an Academic Year to view timetable</p>
            <p className="text-xs text-slate-400">Choose from the dropdown above to start managing period assignments</p>
          </div>
        </PremiumCard>
      )}

      {/* ─── Stats Dashboard ────────────────────────────────────────────── */}
      {yearId && !loading && allRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatPill label="Total Slots" value={stats.totalSlots} color="bg-slate-100 text-slate-700" />
          <StatPill label="Assigned" value={stats.assigned} color="bg-emerald-100 text-emerald-700" />
          <StatPill label="Unassigned" value={stats.unassigned} color="bg-amber-100 text-amber-700" />
          <StatPill label="Coverage" value={`${stats.pct}%`} color="bg-blue-100 text-blue-700" />
          <StatPill label="Periods" value={periods.length} color="bg-indigo-100 text-indigo-700" />
          <StatPill label="Subjects" value={stats.uniqueSubjects} color="bg-violet-100 text-violet-700" />
          <StatPill label="Teachers" value={stats.uniqueTeachers} color="bg-teal-100 text-teal-700" />
        </div>
      )}

      {/* ─── Filter Bar ─────────────────────────────────────────────────── */}
      {yearId && !loading && allClasses.length > 0 && (
        <PremiumCard accentColor="purple" className="p-5">
          <div className="flex flex-wrap items-end gap-4">
            {/* Filter icon + label */}
            <div className="flex items-center gap-2 self-center mr-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filters</span>
              {activeFilters > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                  {activeFilters}
                </span>
              )}
            </div>

            {/* Class */}
            <div className="min-w-[150px] flex-1">
              <label className="mb-1 block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Class</label>
              <select
                value={filterClassId}
                onChange={e => setFilterClassId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              >
                <option value="">All Classes</option>
                {allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Section */}
            <div className="min-w-[130px] flex-1">
              <label className="mb-1 block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Section</label>
              <select
                value={filterSectionId}
                onChange={e => setFilterSectionId(e.target.value)}
                disabled={!filterClassId}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-shadow"
              >
                <option value="">All Sections</option>
                {filterSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Subject */}
            <div className="min-w-[150px] flex-1">
              <label className="mb-1 block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Subject</label>
              <select
                value={filterSubjectId}
                onChange={e => setFilterSubjectId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-shadow"
              >
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Teacher */}
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Teacher</label>
              <select
                value={filterTeacherId}
                onChange={e => setFilterTeacherId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
              >
                <option value="">All Teachers</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{teacherName(t)} ({t.employeeCode})</option>)}
              </select>
            </div>

            {/* Clear + row count */}
            <div className="flex items-end gap-3">
              {activeFilters > 0 && (
                <button type="button"
                  onClick={() => { setFilterClassId(''); setFilterSectionId(''); setFilterSubjectId(''); setFilterTeacherId(''); }}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                  Clear All
                </button>
              )}
              <span className="text-xs text-slate-400 whitespace-nowrap py-2">
                {visibleRows.length} / {allRows.length} rows
              </span>
            </div>
          </div>
        </PremiumCard>
      )}

      {/* ─── Progress Bar ───────────────────────────────────────────────── */}
      {yearId && !loading && stats.totalSlots > 0 && (
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Coverage</span>
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                stats.pct >= 80 ? 'bg-gradient-to-r from-emerald-500 to-green-400' :
                stats.pct >= 50 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                                  'bg-gradient-to-r from-red-500 to-orange-400'
              }`}
              style={{ width: `${stats.pct}%` }}
            />
          </div>
          <span className={`text-xs font-bold ${
            stats.pct >= 80 ? 'text-emerald-600' :
            stats.pct >= 50 ? 'text-amber-600' :
                              'text-red-600'
          }`}>{stats.pct}%</span>
        </div>
      )}

      {/* ─── Data Grid ──────────────────────────────────────────────────── */}
      {yearId && (
        loading ? (
          <PremiumCard className="py-16 flex items-center justify-center gap-3">
            <Spinner />
            <span className="text-sm text-slate-500 font-medium">Loading timetable data…</span>
          </PremiumCard>
        ) : allRows.length === 0 ? (
          <PremiumCard className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm text-slate-500 font-medium">No classes or sections configured</p>
              <p className="text-xs text-slate-400">Please configure classes and sections in Academic Setup first.</p>
            </div>
          </PremiumCard>
        ) : (
          <PremiumCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm" style={{ minWidth: `${300 + periods.length * 130}px` }}>
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50">

                    {/* Sticky: Class header */}
                    <th style={{ width: 170, minWidth: 170, left: 0, boxShadow: '2px 0 8px -3px rgba(0,0,0,0.08)' }}
                      className="sticky z-20 px-4 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200/60 bg-gradient-to-r from-slate-50 to-slate-100">
                      Class
                    </th>

                    {/* Sticky: Section header */}
                    <th style={{ width: 120, minWidth: 120, left: 170, boxShadow: '2px 0 8px -3px rgba(0,0,0,0.08)' }}
                      className="sticky z-20 px-3 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200/60 bg-gradient-to-r from-slate-50 to-slate-100">
                      Section
                    </th>

                    {/* Period columns */}
                    {periods.map(p => (
                      <th key={p.id} className="px-2 py-4 text-center" style={{ minWidth: 126 }}>
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="text-xs font-bold text-slate-700">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{p.startTime} – {p.endTime}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100/80">
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={2 + periods.length} className="py-12 text-center text-sm text-slate-400">
                        No rows match the current filters.
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map(row => (
                      <tr key={`${row.classId}::${row.sectionId}`}
                        className="hover:bg-indigo-50/30 transition-colors">

                        {/* Sticky: Class label */}
                        <td style={{ width: 170, minWidth: 170, left: 0, boxShadow: '2px 0 8px -3px rgba(0,0,0,0.05)' }}
                          className="sticky z-10 bg-white px-4 py-3 border-r border-slate-100/80">
                          <span className="text-xs font-bold text-slate-700">{row.className}</span>
                        </td>

                        {/* Sticky: Section label */}
                        <td style={{ width: 120, minWidth: 120, left: 170, boxShadow: '2px 0 8px -3px rgba(0,0,0,0.05)' }}
                          className="sticky z-10 bg-white px-3 py-3 border-r border-slate-100/80">
                          {row.sectionName ? (
                            <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 border border-indigo-100">
                              {row.sectionName}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">—</span>
                          )}
                        </td>

                        {/* Period cells */}
                        {periods.map(period => (
                          <PeriodCellV2
                            key={period.id}
                            entry={entryMap.get(cellKey(row.classId, row.sectionId ?? '', period.id)) ?? null}
                            viewMode={viewMode}
                            onClick={() => {
                              if (!yearId) return;
                              setModal({
                                academicYearId: yearId,
                                classId:        row.classId,
                                sectionId:      row.sectionId ?? '',
                                period,
                                existing: entryMap.get(cellKey(row.classId, row.sectionId ?? '', period.id)) ?? null,
                                className: row.className,
                                sectionName: row.sectionName,
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
          </PremiumCard>
        )
      )}

      {/* ─── Assignment Modal ───────────────────────────────────────────── */}
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
export default function TimetableV2Route() {
  return (
    <AuthGuard>
      {(user: UserClaims) => <TimetableV2Page user={user} />}
    </AuthGuard>
  );
}
