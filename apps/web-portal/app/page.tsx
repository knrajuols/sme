import Link from 'next/link';

// ── Ecosystem feature cards ───────────────────────────────────────────────────
const ECOSYSTEM = [
  {
    accent: 'border-t-blue-500',
    icon: '🎒',
    title: 'Core Academics',
    desc: 'Enrollments, Faculty, and dynamic Class management.',
    badges: ['STUDENTS', 'TEACHERS'],
    badgeStyle: 'bg-blue-50 text-blue-700',
  },
  {
    accent: 'border-t-yellow-500',
    icon: '📋',
    title: 'Daily Operations',
    desc: 'Lightning-fast bulk attendance and timetable tracking.',
    badges: ['ATTENDANCE', 'TIMETABLES'],
    badgeStyle: 'bg-yellow-50 text-yellow-700',
  },
  {
    accent: 'border-t-purple-500',
    icon: '📝',
    title: 'Examination Engine',
    desc: 'Automated grading scales, bulk marks entry, and report cards.',
    badges: ['RESULTS', 'REPORT CARDS'],
    badgeStyle: 'bg-purple-50 text-purple-700',
  },
  {
    accent: 'border-t-green-500',
    icon: '📈',
    title: 'Executive Dashboard',
    desc: "Real-time birds-eye view of your entire school's performance.",
    badges: ['KPIs', 'METRICS'],
    badgeStyle: 'bg-green-50 text-green-700',
  },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-slate-100 shadow-sm px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold text-blue-700">SME</span>
          <span className="text-sm text-slate-500 font-medium">School Management Platform</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg px-4 py-2 hover:bg-slate-100 transition-colors"
          >
            School Login
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 shadow-md shadow-blue-200 transition-colors"
          >
            Register Your School
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24 md:py-32">
        <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-widest mb-6 border border-blue-100">
          Multi-Tenant · Multi-School · One Platform
        </span>

        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-tight max-w-4xl mb-6">
          The Operating System{' '}
          <span className="text-blue-600">for Modern Schools</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-500 max-w-2xl mb-12 leading-relaxed">
          A unified, multi-tenant platform for Academics, Operations, and Analytics.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-blue-200 transition-all hover:shadow-blue-300 hover:-translate-y-0.5 text-base"
          >
            Register Your School
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-8 py-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all text-base"
          >
            School Login
          </Link>
        </div>
      </section>

      {/* ── Ecosystem Grid ──────────────────────────────────────────────────── */}
      <section className="px-6 pb-24 max-w-7xl mx-auto w-full">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 mb-10">
          The Complete School Ecosystem
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {ECOSYSTEM.map((card) => (
            <div
              key={card.title}
              className={`bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border-t-4 ${card.accent} flex flex-col gap-4`}
            >
              <span className="text-4xl">{card.icon}</span>

              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{card.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
              </div>

              <div className="flex flex-wrap gap-2 mt-auto pt-2">
                {card.badges.map((badge) => (
                  <span
                    key={badge}
                    className={`${card.badgeStyle} rounded-full px-3 py-1 text-xs font-semibold`}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="mt-auto bg-slate-900 text-slate-400 text-xs text-center py-5">
        © {new Date().getFullYear()} SME Platform · Built for Modern Schools
      </footer>

    </main>
  );
}
