'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { logout } from '../lib/auth';

/**
 * Navigation bar for Parent-role users.
 * Deliberately excludes the School Profile icon (admin-only operation)
 * and any admin-specific links.
 */
const links = [
  { href: '/portal/dashboard', label: 'Dashboard' },
  { href: '/portal/attendance', label: 'Attendance' },
  { href: '/portal/results', label: 'Results' },
  { href: '/portal/analytics', label: 'Analytics' },
];

export function ParentNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
      {links.map((item) => (
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

      <div className="ml-auto">
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
  );
}
