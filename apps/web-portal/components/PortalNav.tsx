'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { getMeClaims, logout } from '../lib/auth';
import { ProfilePanel } from './ProfilePanel';

// ── Role-scoped link sets ─────────────────────────────────────────────────────

/** Full School Admin menu — all ERP modules. */
const ADMIN_LINKS = [
  { href: '/admin/dashboard',       label: 'Dashboard' },
  { href: '/admin/academic-setup',  label: 'Academic Setup' },
  { href: '/admin/periods',         label: 'Periods' },
  { href: '/admin/faculty',         label: 'Faculty' },
  { href: '/admin/class-teachers',  label: 'Class Teachers' },
  { href: '/admin/students',        label: 'Students' },
  { href: '/admin/parents',         label: 'Parents' },
  { href: '/admin/enrollments',     label: 'Enrollments' },
  { href: '/admin/attendance',      label: 'Attendance' },
  { href: '/admin/grade-scales',    label: 'Grade Scales' },
  { href: '/admin/exams',           label: 'Exams' },
  { href: '/admin/exam-subjects',   label: 'Exam Subjects' },
  { href: '/admin/marks',           label: 'Marks Entry' },
  { href: '/admin/results',         label: 'Results' },
  { href: '/admin/analytics',       label: 'Analytics' },
  // ── Finance ────────────────────────────────────────────────────────────────
  { href: '/admin/finance/categories',  label: 'Fee Categories'    },
  { href: '/admin/finance/structures',  label: 'Fee Structures'    },
  { href: '/admin/finance/invoices',    label: 'Generate Invoices' },
  { href: '/admin/finance/collection',  label: 'Fee Collection'    },
  // ── Scheduling ─────────────────────────────────────────────────────────────
  { href: '/admin/scheduling/matrix',   label: 'Timetable Matrix'  },
];

/** Teacher workspace — strictly operational, NO admin links. */
const TEACHER_LINKS = [
  { href: '/portal/teacher',            label: 'My Dashboard' },
  { href: '/portal/teacher/attendance', label: 'Attendance' },
  { href: '/portal/teacher/marks',      label: 'Marks Entry' },
];

/** Parent / Student family portal — read-only academic views. */
const FAMILY_LINKS = [
  { href: '/portal/family',            label: 'Family Dashboard' },
  { href: '/portal/family/results',    label: 'Report Cards' },
  { href: '/portal/family/attendance', label: 'Attendance' },
];

function resolveLinks(roles: string[]) {
  if (roles.includes('SCHOOL_ADMIN')) return ADMIN_LINKS;
  if (roles.includes('TEACHER'))      return TEACHER_LINKS;
  return FAMILY_LINKS; // PARENT, STUDENT, or any unknown role
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PortalNav() {
  const pathname = usePathname();
  const [roles, setRoles]           = useState<string[] | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    void getMeClaims().then((claims) => setRoles(claims?.roles ?? []));
  }, []);

  const activeLinks  = roles ? resolveLinks(roles) : [];
  const isAdmin      = roles?.includes('SCHOOL_ADMIN') ?? false;

  return (
    <>
      <nav className="mb-6 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
        {activeLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded px-3 py-2 text-sm ${
              pathname === item.href
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-300'
            }`}
          >
            {item.label}
          </Link>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {/* School Profile icon — SCHOOL_ADMIN only */}
          {isAdmin && (
            <button
              type="button"
              title="School Profile"
              onClick={() => setProfileOpen(true)}
              className="flex items-center justify-center w-9 h-9 rounded-full border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-400 text-slate-600 hover:text-blue-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
            </button>
          )}

          <button
            type="button"
            className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      {isAdmin && <ProfilePanel isOpen={profileOpen} onClose={() => setProfileOpen(false)} />}
    </>
  );
}
