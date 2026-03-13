export function Sidebar({ modules, onMenuClick }: {
  modules: { key: string; label: string; enabled: boolean }[];
  onMenuClick: (key: string) => void;
}) {
  return (
    <aside className="h-screen w-56 bg-slate-900 text-white flex flex-col py-6 px-4">
      <div className="mb-8 text-2xl font-bold tracking-tight">School Admin</div>
      <nav className="flex-1 space-y-2">
        {modules.filter(m => m.enabled).map(m => (
          <button
            key={m.key}
            className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 focus:bg-indigo-700 focus:outline-none"
            onClick={() => onMenuClick(m.key)}
          >
            {m.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export function GlobalHeader({ onSearch, onCreate, profileName }: {
  onSearch: (q: string) => void;
  onCreate: () => void;
  profileName: string;
}) {
  return (
    <header className="flex items-center justify-between bg-white border-b border-slate-200 px-6 py-3">
      <div className="flex items-center gap-2 w-1/2">
        <span className="text-slate-400">🔎</span>
        <input
          className="w-full px-2 py-1 border-none outline-none bg-transparent text-slate-700"
          placeholder="Search..."
          onChange={e => onSearch(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-4">
        <button
          className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          onClick={onCreate}
        >
          <span>＋</span> Create
        </button>
        <div className="relative group">
          <button className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 text-slate-700">
            <span>👤</span>
            <span className="font-medium">{profileName}</span>
          </button>
          {/* Dropdown can be implemented here */}
        </div>
      </div>
    </header>
  );
}
