'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { decodeTokenClaims, getToken, logout, type UserClaims } from '../lib/auth';
import { apiRequest } from '../lib/api';

// ── Nav group definitions ────────────────────────────────────────────────────

interface NavLink { href: string; label: string }
interface NavGroup { label: string; links: NavLink[] }

const SCHOOL_GROUPS: NavGroup[] = [
  {
    label: 'People',
    links: [
      { href: '/students', label: 'Students' },
    ],
  },
  {
    label: 'Academics',
    links: [
      { href: '/academic/setup', label: 'Academic Setup' },
    ],
  },
  {
    label: 'Operations',
    links: [
      { href: '/attendance', label: 'Attendance' },
      { href: '/exams',      label: 'Exams' },
      { href: '/analytics',  label: 'Analytics' },
    ],
  },
];

const PLATFORM_GROUPS: NavGroup[] = [
  {
    label: 'Platform',
    links: [
      { href: '/platform/registered-schools', label: 'Registered Schools' },
    ],
  },
  {
    label: 'Master Data',
    links: [
      { href: '/master-data/academic-years',    label: 'Academic Years'   },
      { href: '/master-data/classes',           label: 'Classes'          },
      { href: '/master-data/sections',          label: 'Sections'         },
      { href: '/master-data/subjects',          label: 'Subjects'         },
      { href: '/master-data/periods',           label: 'Periods'          },
      { href: '/master-data/grading-system',    label: 'Grading System'   },
      { href: '/exams',                         label: 'Exam Schedules'   },
      { href: '/master-data/fee-categories',    label: 'Fee Categories'   },
      { href: '/master-data/fee-structures',    label: 'Fee Structures'   },
      { href: '/master-data/academic-calendar', label: 'Academic Calendar'},
      { href: '/master-data/holidays',          label: 'Holiday Management'},
      { href: '/master-data/org-structure',     label: 'Org Structure'     },
    ],
  },
  {
    label: 'Transport',
    links: [
      { href: '/transport/routes',      label: 'Route Builder'         },
      { href: '/transport/stops',       label: 'Stop Master'           },
      { href: '/transport/staff',       label: 'Transport Staff'       },
      { href: '/transport/vehicles',    label: 'Fleet Management'      },
      { href: '/transport/allocations', label: 'Student Allocations'   },
    ],
  },
];

// ── Dropdown item ────────────────────────────────────────────────────────────

function NavDropdown({ label, links }: NavGroup) {
  const pathname  = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAnyActive = links.some(
    (l) => pathname === l.href || pathname.startsWith(l.href + '/'),
  );

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`flex items-center gap-1 px-4 py-2 text-sm font-medium transition-all ${
          isAnyActive
            ? 'text-white bg-teal-600/20 border-b-2 border-teal-400'
            : 'text-slate-300 hover:text-white hover:bg-white/10 rounded-lg'
        }`}
      >
        {label}
        <svg className="w-3 h-3 opacity-50 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className={`absolute top-full left-0 pt-4 w-52 z-50 transition-all duration-200 ${open ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-2">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-2.5 text-sm transition-colors rounded-sm ${
                  active
                    ? 'bg-teal-50 text-teal-700 font-semibold'
                    : 'text-slate-600 hover:bg-teal-50 hover:text-teal-700'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Root Navbar ──────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname();
  const [claims, setClaims]         = useState<UserClaims | null>(null);
  const [loaded, setLoaded]         = useState(false);
  const [schoolName, setSchoolName] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (token) setClaims(decodeTokenClaims(token));
    setLoaded(true);
  }, []);

  const isPlatformAdmin = claims?.roles.includes('PLATFORM_ADMIN') ?? false;
  const isSchoolAdmin   = claims?.roles.includes('SCHOOL_ADMIN')   ?? false;

  useEffect(() => {
    if (isSchoolAdmin) {
      apiRequest<{ schoolName: string }>('/school/profile')
        .then((r) => setSchoolName(r?.schoolName ?? null))
        .catch(() => {});
    }
  }, [isSchoolAdmin]);

  const groups = isPlatformAdmin ? PLATFORM_GROUPS : SCHOOL_GROUPS;

  let initials = '';
  if (claims?.sub) {
    const part = claims.sub.split('@')[0];
    initials = part
      .split(/[._-]/)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('');
    if (!initials) initials = claims.sub[0]?.toUpperCase() ?? '';
  }

  const dashActive = pathname === '/dashboard';

  return (
    <header className="h-16 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 sticky top-0 z-50 border-b-2 border-teal-500/30 shadow-lg flex items-center gap-2 px-6 lg:px-10 shrink-0">
      {/* ── Brand ── */}
      <Link href="/dashboard" className="flex items-baseline gap-2 mr-4 flex-shrink-0">
        <span className="text-base font-extrabold tracking-tight text-teal-400">SME</span>
        <span className="text-sm font-semibold text-white max-w-[180px] truncate">
          {schoolName ?? (isPlatformAdmin ? 'Platform Admin' : 'Administration')}
        </span>
      </Link>

      {/* ── Divider ── */}
      <div className="h-5 w-px bg-white/20 mr-2 flex-shrink-0" />

      {/* ── Dashboard direct link ── */}
      <Link
        href="/dashboard"
        className={`px-4 py-2 text-sm font-medium transition-all rounded-lg ${
          dashActive
            ? 'text-white bg-teal-600/20 border-b-2 border-teal-400'
            : 'text-slate-300 hover:text-white hover:bg-white/10'
        }`}
      >
        Dashboard
      </Link>

      {/* ── Grouped dropdowns ── */}
      {loaded && groups.map((g) => (
        <NavDropdown key={g.label} label={g.label} links={g.links} />
      ))}

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Profile + Logout ── */}
      <div className="flex items-center gap-3">
        {claims?.sub && (
          <>
            <span
              title={claims.sub}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white text-xs font-bold border border-white/20 flex-shrink-0"
            >
              {initials}
            </span>
            <span className="hidden lg:block text-xs text-slate-300 max-w-[140px] truncate">
              {claims.sub}
            </span>
          </>
        )}
        <button
          type="button"
          onClick={() => { logout(); window.location.href = '/login'; }}
          className="text-xs text-slate-300 hover:text-red-400 border border-white/20 hover:border-red-400/50 bg-white/10 rounded-md px-3 py-1.5 transition-colors flex-shrink-0"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
