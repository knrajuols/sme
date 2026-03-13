import Link from 'next/link';

/**
 * Shown when a user tries to access /login or /dashboard on the main domain.
 * School login is only available via the school's subdomain.
 */
export default function SchoolNotFoundPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center px-6 text-center">
      <div className="bg-white rounded-2xl shadow-md p-10 max-w-md w-full">
        <div className="text-5xl mb-4">🏫</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">
          Use Your School&apos;s Link
        </h1>
        <p className="text-slate-600 mb-2 text-sm leading-relaxed">
          School login is only available through your school&apos;s unique address.
          You cannot log in from the main SME site.
        </p>
        <p className="text-slate-500 text-sm mb-6 bg-slate-50 rounded-lg px-4 py-3 font-mono border border-slate-200">
          http://<span className="text-blue-700 font-semibold">yourschool</span>.sme.test:3102/login
        </p>
        <p className="text-slate-500 text-sm mb-8">
          Contact your School Administrator if you do not know your school&apos;s link.
        </p>
        <Link
          href="/register"
          className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2 rounded-lg transition-colors text-sm"
        >
          Register a New School
        </Link>
      </div>
    </main>
  );
}
