'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { decodeTokenClaims, getToken, logout, type UserClaims } from '../lib/auth';
import { ProfilePanel } from './ProfilePanel';

// ── Nav group / link definitions ─────────────────────────────────────────────

interface NavLink  { href: string; label: string }
interface NavGroup { label: string; links: NavLink[] }

// School Admin — full ERP grouped menu
const ADMIN_GROUPS: NavGroup[] = [
  {
    label: 'HR & Staff',
    links: [
      { href: '/admin/hr/onboard',        label: 'Onboard Employee' },
      { href: '/admin/hr/departments',    label: 'Departments'     },
      { href: '/admin/hr/roles',          label: 'Employee Roles'  },
      { href: '/admin/hr/employees',      label: 'Employee Directory' },
    ],
  },
  {
    label: 'People',
    links: [
      { href: '/admin/faculty',        label: 'Faculty'       },
      { href: '/admin/class-teachers', label: 'Class Teachers'},
      { href: '/admin/students',       label: 'Students'      },
      { href: '/admin/parents',        label: 'Parents'       },
      { href: '/admin/enrollments',    label: 'Enrollments'   },
    ],
  },
  {
    label: 'Academics',
    links: [
      { href: '/admin/academic-setup',                label: 'Academic Setup'     },
      { href: '/admin/academics/academic-calendar',   label: 'Academic Calendar'  },
      { href: '/admin/academics/holidays',            label: 'Holiday Management' },
      { href: '/admin/periods',                       label: 'Periods'            },
      { href: '/admin/grade-scales',                  label: 'Grade Scales'       },
      { href: '/admin/exam-subjects',                 label: 'Exam Subjects'      },
    ],
  },
  {
    label: 'Operations',
    links: [
      { href: '/admin/attendance',        label: 'Attendance'        },
      { href: '/admin/attendance-report',  label: 'Attendance Report' },
      { href: '/admin/exams',         label: 'Exams'          },
      { href: '/admin/examinations',  label: 'Exam Schedule'  },
      { href: '/admin/marks',         label: 'Marks Entry'    },
      { href: '/admin/results',       label: 'Results'        },
      { href: '/admin/analytics',     label: 'Analytics'      },
      { href: '/admin/marks-ranks',   label: 'Marks & Ranks'  },
    ],
  },
  {
    label: 'Finance',
    links: [
      { href: '/admin/finance/categories',  label: 'Fee Categories'    },
      { href: '/admin/finance/structures',  label: 'Fee Structures'    },
      { href: '/admin/finance/invoices',    label: 'Generate Invoices' },
      { href: '/admin/finance/collection',  label: 'Fee Collection'    },
    ],
  },
  {
    label: 'Scheduling',
    links: [
      { href: '/admin/scheduling/timetable', label: 'Timetable' },
      { href: '/admin/scheduling/timetable-v2', label: 'Timetable V2' },
    ],
  },
  {
    label: 'Transport',
    links: [
      { href: '/admin/transport/staff', label: 'Drivers & Attendants' },
      { href: '/admin/transport/routes', label: 'Routes & Fleet' },
      { href: '/admin/transport/allocations', label: 'Student Allocations' },
      { href: '/admin/transport/analytics', label: 'Fleet Analytics' },
    ],
  },
];

// Teacher — operational workspace
const TEACHER_LINKS: NavLink[] = [
  { href: '/portal/teacher',            label: 'My Dashboard' },
  { href: '/portal/teacher/attendance', label: 'Attendance'   },
  { href: '/portal/teacher/marks',      label: 'Marks Entry'  },
];

// Parent / Student family portal
const FAMILY_LINKS: NavLink[] = [
  { href: '/portal/family',            label: 'Family Dashboard' },
  { href: '/portal/family/results',    label: 'Report Cards'     },
  { href: '/portal/family/attendance', label: 'Attendance'       },
];

// Platform Admin — master data management
const PLATFORM_GROUPS: NavGroup[] = [
  {
    label: 'Platform',
    links: [
      { href: '/web-admin/registered-schools', label: 'Registered Schools' },
    ],
  },
  {
    label: 'Master Data',
    links: [
      { href: '/web-admin/master-data/periods', label: 'Periods' },
    ],
  },
];

// ── Dropdown component ───────────────────────────────────────────────────────

function NavDropdown({ label, links }: NavGroup) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAnyActive = links.some(
    (l) => pathname === l.href || pathname.startsWith(l.href + '/'),
  );

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
        <svg
          className="w-3 h-3 opacity-50 mt-px"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
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

// ── Flat link strip (Teacher / Family) ───────────────────────────────────────

function FlatLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <>
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(link.href + '/');
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-4 py-2 text-sm font-medium transition-all rounded-lg ${
              active
                ? 'text-white bg-teal-600/20 border-b-2 border-teal-400'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

// ── Root Navbar ──────────────────────────────────────────────────────────────

export function Navbar() {
  const [claims, setClaims]           = useState<UserClaims | null>(null);
  const [loaded, setLoaded]           = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (token) setClaims(decodeTokenClaims(token));
    setLoaded(true);
  }, []);

  const isPlatformAdmin = claims?.roles.includes('PLATFORM_ADMIN') ?? false;
  const isAdmin   = claims?.roles.includes('SCHOOL_ADMIN') ?? false;
  const isTeacher = claims?.roles.includes('TEACHER')      ?? false;

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

  // Determine home route based on role
  const homeHref = isPlatformAdmin
    ? '/web-admin/master-data/periods'
    : isAdmin ? '/admin/dashboard' : isTeacher ? '/portal/teacher' : '/portal/family';

  return (
    <>
      <header className="h-16 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 sticky top-0 z-50 border-b-2 border-teal-500/30 shadow-lg flex items-center gap-2 px-6 lg:px-10 shrink-0">
        {/* ── Brand ── */}
        <Link href={homeHref} className="flex items-baseline gap-2 mr-4 flex-shrink-0">
          <span className="text-base font-extrabold tracking-tight text-teal-400">SME</span>
          <span className="text-sm font-semibold text-white">
            {isPlatformAdmin ? 'Platform Admin' : isAdmin ? 'School Admin' : isTeacher ? 'Teacher Portal' : 'Family Portal'}
          </span>
        </Link>

        {/* ── Divider ── */}
        <div className="h-5 w-px bg-white/20 mr-2 flex-shrink-0" />

        {/* ── Dashboard / Home direct link ── */}
        <Link
          href={homeHref}
          className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
        >
          Dashboard
        </Link>

        {/* ── Role-scoped navigation ── */}
        {loaded && isPlatformAdmin && PLATFORM_GROUPS.map((g) => (
          <NavDropdown key={g.label} label={g.label} links={g.links} />
        ))}
        {loaded && !isPlatformAdmin && isAdmin && ADMIN_GROUPS.map((g) => (
          <NavDropdown key={g.label} label={g.label} links={g.links} />
        ))}
        {loaded && !isPlatformAdmin && !isAdmin && isTeacher  && <FlatLinks links={TEACHER_LINKS} />}
        {loaded && !isPlatformAdmin && !isAdmin && !isTeacher && <FlatLinks links={FAMILY_LINKS}  />}

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Right side ── */}
        <div className="flex items-center gap-3">
          {/* School Profile icon — admin only */}
          {isAdmin && (
            <button
              type="button"
              title="School Profile"
              onClick={() => setProfileOpen(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 hover:border-teal-400 text-slate-300 hover:text-teal-400 transition-colors flex-shrink-0 bg-white/10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
            </button>
          )}

          {claims?.email && (
            <span className="hidden lg:block text-xs text-slate-300 max-w-[180px] truncate" title={claims.email}>
              {claims.email}
            </span>
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

      {isAdmin && (
        <ProfilePanel isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      )}
    </>
  );
}
