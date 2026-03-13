'use client';

import { PlatformAdminGuard } from '../../components/PlatformAdminGuard';
import { Navbar } from '../../components/Navbar';

/**
 * Layout for all Platform Admin routes under /web-admin/*.
 *
 * PlatformAdminGuard enforces the PLATFORM_ADMIN role.
 */
export default function WebAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformAdminGuard>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 bg-slate-50">
          <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
            {children}
          </div>
        </main>
      </div>
    </PlatformAdminGuard>
  );
}
