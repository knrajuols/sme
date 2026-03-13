'use client';

import { Navbar } from '../../components/Navbar';

/**
 * Layout for all portal routes under /portal/*.
 *
 * Navbar self-detects the user's role from the JWT and renders the
 * correct link set (Teacher Workspace links or Family Portal links).
 * Pages under portal/ do NOT import Navbar themselves.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-slate-50">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
