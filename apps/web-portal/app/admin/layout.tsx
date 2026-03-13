'use client';

import { AdminGuard } from '../../components/AdminGuard';
import { Navbar } from '../../components/Navbar';

/**
 * Layout for all School Admin routes under /admin/*.
 *
 * AdminGuard enforces SCHOOL_ADMIN role; any other authenticated user is
 * immediately redirected to their correct role portal BEFORE seeing this UI.
 * Pages under admin/ do NOT import PortalNav themselves.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 bg-slate-50">
          <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
            {children}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}
