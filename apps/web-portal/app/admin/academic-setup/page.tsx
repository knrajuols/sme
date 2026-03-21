'use client';

import Link from 'next/link';

import { AuthGuard } from '../../../components/AuthGuard';
import type { UserClaims } from '../../../lib/auth';

// ── Hub card definition ───────────────────────────────────────────────────────
interface HubCard {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
  borderHover: string;
}

const YEAR_ICON = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CLASSES_ICON = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const SECTIONS_ICON = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

const SUBJECTS_ICON = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const CLASS_SECTIONS_ICON = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
  </svg>
);

const HUB_CARDS: HubCard[] = [
  {
    href: '/admin/academic-setup/years',
    icon: YEAR_ICON,
    title: 'Academic Years',
    description: 'Define academic sessions, manage term start/end dates, and roll over to new years.',
    accent: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
    borderHover: 'hover:border-blue-300',
  },
  {
    href: '/admin/academic-setup/classes',
    icon: CLASSES_ICON,
    title: 'Classes',
    description: 'Create class levels (Grade 1, Grade 2 …) and manage their attributes.',
    accent: 'bg-violet-50 text-violet-600 group-hover:bg-violet-100',
    borderHover: 'hover:border-violet-300',
  },
  {
    href: '/admin/academic-setup/sections',
    icon: SECTIONS_ICON,
    title: 'Sections',
    description: 'Divide each class into named sections (A, B, C …) and assign class teachers.',
    accent: 'bg-fuchsia-50 text-fuchsia-600 group-hover:bg-fuchsia-100',
    borderHover: 'hover:border-fuchsia-300',
  },
  {
    href: '/admin/academic-setup/class-sections',
    icon: CLASS_SECTIONS_ICON,
    title: 'Class-Sections',
    description: 'Assign a section to each class with a unique display name (e.g. 10-A, 5-Ganga).',
    accent: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100',
    borderHover: 'hover:border-amber-300',
  },
  {
    href: '/admin/academic-setup/subjects',
    icon: SUBJECTS_ICON,
    title: 'Subjects',
    description: 'Define the curriculum subjects per class, assign codes, and link to teacher specialisations.',
    accent: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
    borderHover: 'hover:border-emerald-300',
  },
];

// ── Internal content ──────────────────────────────────────────────────────────
function AcademicSetupContent({ claims }: { claims: UserClaims }) {
  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Academic Setup</h1>
            <p className="text-sm text-slate-500">
              Configure your school&apos;s academic structure — complete the steps in order.
            </p>
          </div>
        </div>

      </div>

      {/* Hub cards grid — all 4 cards are independent, freely-clickable nav links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {HUB_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="block group"
          >
            <div
              className={`flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm
                transition-all duration-200 hover:shadow-md ${card.borderHover}`}
            >
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${card.accent}`}>
                {card.icon}
              </div>

              {/* Text */}
              <div className="flex-1">
                <h2 className="text-base font-semibold text-slate-900 mb-1">{card.title}</h2>
                <p className="text-sm leading-relaxed text-slate-500">{card.description}</p>
              </div>

              {/* Arrow */}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 group-hover:text-blue-600 group-hover:gap-2.5 transition-all">
                <span>Open</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-8 text-xs text-slate-400">
        School: <span className="font-mono">{claims.tenantId}</span>
      </p>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function AcademicSetupPage() {
  return (
    <AuthGuard>
      {(claims) => <AcademicSetupContent claims={claims} />}
    </AuthGuard>
  );
}
