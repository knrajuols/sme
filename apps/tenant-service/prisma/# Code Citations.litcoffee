# Code Citations

## License: unknown
https://github.com/shaho/react-redux-saga-hooks-boilerplate/blob/3c3245f6e78c08828978d54d3f42dd552c7e2392/src/components/post/Posts.js

```
<parameter name="newString">}

// ── Main page component ───────────────────────────────────────────────────────
function TimetablePage({ user: _user }: { user: UserClaims }) {
  const [years,         setYears]         = useState<YearRef[]>([]);
  const [yearId,        setYearId]        = useState('');
  const [periods,       setPeriods]       = useState<PeriodRef[]>([]);
  const [allClasses,    setAllClasses]    = useState<ClassWithSections[]>([]);
  const [entryMap,      setEntryMap]      = useState<Map<string, EntryRef>>(new Map());
  const [subjects,      setSubjects]      = useState<SubjectRef[]>([]);
  const [teachers,      setTeachers]      = useState<TeacherRef[]>([]);
  const [viewMode,      setViewMode]      = useState<ViewMode>('subject');
  const [modal,         setModal]         = useState<ModalState | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  // Filters — only hide/show pre-populated rows
  const [filterClassId,   setFilterClassId]   = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [filterSections,  setFilterSections]  = useState<SectionRef[]>([]);

  // ── Bootstrap: years + subjects + teachers ───────────────────────────────
  useEffect(() => {
    void Promise.all([
      bffFetch<YearRef[]>('/api/academic/years'),
      bffFetch<SubjectRef[]>('/api/academic/subjects'),
      bffFetch<TeacherRef[]>('/api/academic/teachers'),
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
      // Reset the class filter when the year changes
      setFilterClassId('');
      setFilterSectionId('');
      setFilterSections([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadEntries(yearId); }, [yearId, loadEntries]);

  // ── Load sections for the class filter dropdown ───────────────────────────
  useEffect(() => {
    if (!filterClassId) {
      setFilterSections([]);
      setFilterSectionId('');
      return;
    }
    // Sections come embedded in allClasses from the entries response
    const cls = allClasses.find(c => c.id === filterClassId);
    if (cls) {
      setFilterSections(cls.sections);
    } else {
      // Fallback: fetch from BFF if not embedded
      void bffFetch<SectionRef[]>(`/api/academic/sections?classId=${filterClassId}`)
        .then(setFilterSections)
        .catch(() => setFilterSections([]));
    }
    setFilterSectionId('');
  }, [filterClassId, allClasses]);

  // ── Build the flat list of all class+section rows ─────────────────────────
  const allRows: Array<{ classId: string; className: string; sectionId: string; sectionName: string }> =
    allClasses.flatMap(cls =>
      cls.sections.map(sec => ({
        classId:     cls.id,
        className:   cls.name,
        sectionId:   sec.id,
        sectionName: sec.name,
      })),
    );

  // Apply filters (just visual — no data refetch)
  const visibleRows = allRows.filter(row => {
    if (filterClassId   && row.classId   !== filterClassId)   return false;
    if (filterSectionId && row.sectionId !== filterSectionId) return false;
    return true;
  });

  // ── Optimistic cell update after save ─────────────────────────────────────
  function handleSaved(savedModal: ModalState, savedSubjectId: string, savedTeacherId: string) {
    // Build a synthetic optimistic entry so the cell re-renders instantly
    const key = cellKey(savedModal.classId, savedModal.sectionId, savedModal.period.id);
    setEntryMap(prev => {
      const next = new Map(prev);
      if (!savedSubjectId && !savedTeacherId) {
        // Both cleared — remove visually
        next.delete(key);
      } else {
        const subject = subjects.find(s => s.id === savedSubjectId) ?? null;
        const teacher = teachers.find(t => t.id === savedTeacherId) ?? null;
        const existing = prev.get(key);
        next.set(key, {
          id:        existing?.id ?? key,
          classId:   savedModal.classId,
          sectionId: savedModal.sectionId,
          periodId:  savedModal.period.id,
          subject,
          teacher,
        });
      }
      return next;
    });
    // Background sync to get the real id from the server
    void loadEntries(yearId);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
```


## License: unknown
https://github.com/shaho/react-redux-saga-hooks-boilerplate/blob/3c3245f6e78c08828978d54d3f42dd552c7e2392/src/components/post/Posts.js

```
<parameter name="newString">}

// ── Main page component ───────────────────────────────────────────────────────
function TimetablePage({ user: _user }: { user: UserClaims }) {
  const [years,         setYears]         = useState<YearRef[]>([]);
  const [yearId,        setYearId]        = useState('');
  const [periods,       setPeriods]       = useState<PeriodRef[]>([]);
  const [allClasses,    setAllClasses]    = useState<ClassWithSections[]>([]);
  const [entryMap,      setEntryMap]      = useState<Map<string, EntryRef>>(new Map());
  const [subjects,      setSubjects]      = useState<SubjectRef[]>([]);
  const [teachers,      setTeachers]      = useState<TeacherRef[]>([]);
  const [viewMode,      setViewMode]      = useState<ViewMode>('subject');
  const [modal,         setModal]         = useState<ModalState | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  // Filters — only hide/show pre-populated rows
  const [filterClassId,   setFilterClassId]   = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [filterSections,  setFilterSections]  = useState<SectionRef[]>([]);

  // ── Bootstrap: years + subjects + teachers ───────────────────────────────
  useEffect(() => {
    void Promise.all([
      bffFetch<YearRef[]>('/api/academic/years'),
      bffFetch<SubjectRef[]>('/api/academic/subjects'),
      bffFetch<TeacherRef[]>('/api/academic/teachers'),
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
      // Reset the class filter when the year changes
      setFilterClassId('');
      setFilterSectionId('');
      setFilterSections([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadEntries(yearId); }, [yearId, loadEntries]);

  // ── Load sections for the class filter dropdown ───────────────────────────
  useEffect(() => {
    if (!filterClassId) {
      setFilterSections([]);
      setFilterSectionId('');
      return;
    }
    // Sections come embedded in allClasses from the entries response
    const cls = allClasses.find(c => c.id === filterClassId);
    if (cls) {
      setFilterSections(cls.sections);
    } else {
      // Fallback: fetch from BFF if not embedded
      void bffFetch<SectionRef[]>(`/api/academic/sections?classId=${filterClassId}`)
        .then(setFilterSections)
        .catch(() => setFilterSections([]));
    }
    setFilterSectionId('');
  }, [filterClassId, allClasses]);

  // ── Build the flat list of all class+section rows ─────────────────────────
  const allRows: Array<{ classId: string; className: string; sectionId: string; sectionName: string }> =
    allClasses.flatMap(cls =>
      cls.sections.map(sec => ({
        classId:     cls.id,
        className:   cls.name,
        sectionId:   sec.id,
        sectionName: sec.name,
      })),
    );

  // Apply filters (just visual — no data refetch)
  const visibleRows = allRows.filter(row => {
    if (filterClassId   && row.classId   !== filterClassId)   return false;
    if (filterSectionId && row.sectionId !== filterSectionId) return false;
    return true;
  });

  // ── Optimistic cell update after save ─────────────────────────────────────
  function handleSaved(savedModal: ModalState, savedSubjectId: string, savedTeacherId: string) {
    // Build a synthetic optimistic entry so the cell re-renders instantly
    const key = cellKey(savedModal.classId, savedModal.sectionId, savedModal.period.id);
    setEntryMap(prev => {
      const next = new Map(prev);
      if (!savedSubjectId && !savedTeacherId) {
        // Both cleared — remove visually
        next.delete(key);
      } else {
        const subject = subjects.find(s => s.id === savedSubjectId) ?? null;
        const teacher = teachers.find(t => t.id === savedTeacherId) ?? null;
        const existing = prev.get(key);
        next.set(key, {
          id:        existing?.id ?? key,
          classId:   savedModal.classId,
          sectionId: savedModal.sectionId,
          periodId:  savedModal.period.id,
          subject,
          teacher,
        });
      }
      return next;
    });
    // Background sync to get the real id from the server
    void loadEntries(yearId);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
```


## License: unknown
https://github.com/shaho/react-redux-saga-hooks-boilerplate/blob/3c3245f6e78c08828978d54d3f42dd552c7e2392/src/components/post/Posts.js

```
<parameter name="newString">}

// ── Main page component ───────────────────────────────────────────────────────
function TimetablePage({ user: _user }: { user: UserClaims }) {
  const [years,         setYears]         = useState<YearRef[]>([]);
  const [yearId,        setYearId]        = useState('');
  const [periods,       setPeriods]       = useState<PeriodRef[]>([]);
  const [allClasses,    setAllClasses]    = useState<ClassWithSections[]>([]);
  const [entryMap,      setEntryMap]      = useState<Map<string, EntryRef>>(new Map());
  const [subjects,      setSubjects]      = useState<SubjectRef[]>([]);
  const [teachers,      setTeachers]      = useState<TeacherRef[]>([]);
  const [viewMode,      setViewMode]      = useState<ViewMode>('subject');
  const [modal,         setModal]         = useState<ModalState | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  // Filters — only hide/show pre-populated rows
  const [filterClassId,   setFilterClassId]   = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [filterSections,  setFilterSections]  = useState<SectionRef[]>([]);

  // ── Bootstrap: years + subjects + teachers ───────────────────────────────
  useEffect(() => {
    void Promise.all([
      bffFetch<YearRef[]>('/api/academic/years'),
      bffFetch<SubjectRef[]>('/api/academic/subjects'),
      bffFetch<TeacherRef[]>('/api/academic/teachers'),
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
      // Reset the class filter when the year changes
      setFilterClassId('');
      setFilterSectionId('');
      setFilterSections([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadEntries(yearId); }, [yearId, loadEntries]);

  // ── Load sections for the class filter dropdown ───────────────────────────
  useEffect(() => {
    if (!filterClassId) {
      setFilterSections([]);
      setFilterSectionId('');
      return;
    }
    // Sections come embedded in allClasses from the entries response
    const cls = allClasses.find(c => c.id === filterClassId);
    if (cls) {
      setFilterSections(cls.sections);
    } else {
      // Fallback: fetch from BFF if not embedded
      void bffFetch<SectionRef[]>(`/api/academic/sections?classId=${filterClassId}`)
        .then(setFilterSections)
        .catch(() => setFilterSections([]));
    }
    setFilterSectionId('');
  }, [filterClassId, allClasses]);

  // ── Build the flat list of all class+section rows ─────────────────────────
  const allRows: Array<{ classId: string; className: string; sectionId: string; sectionName: string }> =
    allClasses.flatMap(cls =>
      cls.sections.map(sec => ({
        classId:     cls.id,
        className:   cls.name,
        sectionId:   sec.id,
        sectionName: sec.name,
      })),
    );

  // Apply filters (just visual — no data refetch)
  const visibleRows = allRows.filter(row => {
    if (filterClassId   && row.classId   !== filterClassId)   return false;
    if (filterSectionId && row.sectionId !== filterSectionId) return false;
    return true;
  });

  // ── Optimistic cell update after save ─────────────────────────────────────
  function handleSaved(savedModal: ModalState, savedSubjectId: string, savedTeacherId: string) {
    // Build a synthetic optimistic entry so the cell re-renders instantly
    const key = cellKey(savedModal.classId, savedModal.sectionId, savedModal.period.id);
    setEntryMap(prev => {
      const next = new Map(prev);
      if (!savedSubjectId && !savedTeacherId) {
        // Both cleared — remove visually
        next.delete(key);
      } else {
        const subject = subjects.find(s => s.id === savedSubjectId) ?? null;
        const teacher = teachers.find(t => t.id === savedTeacherId) ?? null;
        const existing = prev.get(key);
        next.set(key, {
          id:        existing?.id ?? key,
          classId:   savedModal.classId,
          sectionId: savedModal.sectionId,
          periodId:  savedModal.period.id,
          subject,
          teacher,
        });
      }
      return next;
    });
    // Background sync to get the real id from the server
    void loadEntries(yearId);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
```


## License: MIT
https://github.com/mrozilla/mrozilla.cz/blob/b3fa715b7759650406316124387f6aaf29d0eb1b/src/components/interactive/TextAreaInput.js

```
<parameter name="newString">}

// ── Main page component ───────────────────────────────────────────────────────
function TimetablePage({ user: _user }: { user: UserClaims }) {
  const [years,         setYears]         = useState<YearRef[]>([]);
  const [yearId,        setYearId]        = useState('');
  const [periods,       setPeriods]       = useState<PeriodRef[]>([]);
  const [allClasses,    setAllClasses]    = useState<ClassWithSections[]>([]);
  const [entryMap,      setEntryMap]      = useState<Map<string, EntryRef>>(new Map());
  const [subjects,      setSubjects]      = useState<SubjectRef[]>([]);
  const [teachers,      setTeachers]      = useState<TeacherRef[]>([]);
  const [viewMode,      setViewMode]      = useState<ViewMode>('subject');
  const [modal,         setModal]         = useState<ModalState | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  // Filters — only hide/show pre-populated rows
  const [filterClassId,   setFilterClassId]   = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [filterSections,  setFilterSections]  = useState<SectionRef[]>([]);

  // ── Bootstrap: years + subjects + teachers ───────────────────────────────
  useEffect(() => {
    void Promise.all([
      bffFetch<YearRef[]>('/api/academic/years'),
      bffFetch<SubjectRef[]>('/api/academic/subjects'),
      bffFetch<TeacherRef[]>('/api/academic/teachers'),
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
      // Reset the class filter when the year changes
      setFilterClassId('');
      setFilterSectionId('');
      setFilterSections([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadEntries(yearId); }, [yearId, loadEntries]);

  // ── Load sections for the class filter dropdown ───────────────────────────
  useEffect(() => {
    if (!filterClassId) {
      setFilterSections([]);
      setFilterSectionId('');
      return;
    }
    // Sections come embedded in allClasses from the entries response
    const cls = allClasses.find(c => c.id === filterClassId);
    if (cls) {
      setFilterSections(cls.sections);
    } else {
      // Fallback: fetch from BFF if not embedded
      void bffFetch<SectionRef[]>(`/api/academic/sections?classId=${filterClassId}`)
        .then(setFilterSections)
        .catch(() => setFilterSections([]));
    }
    setFilterSectionId('');
  }, [filterClassId, allClasses]);

  // ── Build the flat list of all class+section rows ─────────────────────────
  const allRows: Array<{ classId: string; className: string; sectionId: string; sectionName: string }> =
    allClasses.flatMap(cls =>
      cls.sections.map(sec => ({
        classId:     cls.id,
        className:   cls.name,
        sectionId:   sec.id,
        sectionName: sec.name,
      })),
    );

  // Apply filters (just visual — no data refetch)
  const visibleRows = allRows.filter(row => {
    if (filterClassId   && row.classId   !== filterClassId)   return false;
    if (filterSectionId && row.sectionId !== filterSectionId) return false;
    return true;
  });

  // ── Optimistic cell update after save ─────────────────────────────────────
  function handleSaved(savedModal: ModalState, savedSubjectId: string, savedTeacherId: string) {
    // Build a synthetic optimistic entry so the cell re-renders instantly
    const key = cellKey(savedModal.classId, savedModal.sectionId, savedModal.period.id);
    setEntryMap(prev => {
      const next = new Map(prev);
      if (!savedSubjectId && !savedTeacherId) {
        // Both cleared — remove visually
        next.delete(key);
      } else {
        const subject = subjects.find(s => s.id === savedSubjectId) ?? null;
        const teacher = teachers.find(t => t.id === savedTeacherId) ?? null;
        const existing = prev.get(key);
        next.set(key, {
          id:        existing?.id ?? key,
          classId:   savedModal.classId,
          sectionId: savedModal.sectionId,
          periodId:  savedModal.period.id,
          subject,
          teacher,
        });
      }
      return next;
    });
    // Background sync to get the real id from the server
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

          {/* Subject / Teacher view toggle */}
          <div className="inline-flex rounded-lg border border-slate-300 bg-white overflow-hidden shadow-sm">
            <button type="button"
              onClick={() => setViewMode('subject')}
              className={`px-4 py-2 text-xs font-semibold transition-colors ${
                viewMode === 'subject' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              Subject View
            </button>
            <button type="button"
              onClick={() => setViewMode('teacher')}
              className={`px-4 py-2 text-xs font-semibold transition-colors ${
                viewMode === 'teacher' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              Teacher View
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

      {/* Filters row — only visible once a year is selected */}
      {yearId && !loading && allClasses.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Filter</span>

          {/* Class filter */}
          <select
            value={filterClassId}
            onChange={e => setFilterClassId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[140px]"
          >
            <option value="">All Classes</option>
            {allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Section filter */}
          <select
            value={filterSectionId}
            onChange={e => setFilterSectionId(e.target.value)}
            disabled={!filterClassId}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[130px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="">All Sections</option>
            {filterSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {(filterClassId || filterSectionId) && (
            <button type="button"
              onClick={() => { setFilterClassId(''); setFilterSectionId(''); }}
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
              <table className="w-full border-collapse text-sm" style={{ minWidth: `${308 + periods.length * 108}px` }}>
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">

                    {/* Sticky: Class header */}
                    <th style={{ width: 160, minWidth: 160, left: 0, boxShadow: '2px 0 6px -2px rgba(0,0,0,0.06)' }}
                      className="sticky z-20 px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
                      Class
                    </th>

                    {/* Sticky: Section header */}
                    <th style={{ width: 120, minWidth: 120, left: 160, boxShadow: '2px 0 6px -2px rgba(0,0,0,0.06)' }}
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
                      <td colSpan={2 + periods.length}
                        className="py-10 text-center text-sm text-slate-400">
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
                        <td style={{ width: 120, minWidth: 120, left: 160, boxShadow: '2px 0 6px -2px rgba(0,0,0,0.04)' }}
                          className="sticky z-10 bg-white px-3 py-2 border-r border-slate-100">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {row.sectionName}
                          </span>
                        </td>

                        {/* Period cells */}
                        {periods.map(period => (
                          <PeriodCell
                            key={period.id}
                            entry={entryMap.get(cellKey(row.classId, row.sectionId, period.id)) ?? null}
                            viewMode={viewMode}
                            disabled={false}
                            onClick={() => {
                              if (!yearId) return;
                              setModal({
                                academicYearId: yearId,
                                classId:        row.classId,
                                sectionId:      row.sectionId,
                                period,
                                existing: entryMap.get(cellKey(row.classId, row.sectionId, period.id)) ?? null,
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
          onClose={() => setModal(null)}
          onSaved={(subjectId, teacherId) => {
            setModal(prev => {
              if (prev) handleSaved(prev, subjectId, teacherId);
              return null;
            });
          }}
        />
      )}
    </div>
  );
}

// ── Route export ──────────────────────────────────────────────────────────────
export default function TimetableRoute
```

