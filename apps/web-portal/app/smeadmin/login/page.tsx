'use client';

import { FormEvent, useState } from 'react';

/**
 * Platform Admin Login — served at http://sme.test:3102/smeadmin/login
 *
 * DEV MODE: Password field is shown in the UI but the backend ignores it.
 * Just enter the email and click Sign In.
 *
 * Default seeded Platform Admin email: platform.admin@sme.test
 *
 * TODO (Production Migration):
 *   - Backend password check must be re-enabled before going live (see iam-service TODO)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://sme.test:3000';
const TOKEN_KEY = 'sme_platform_token';

async function platformLogin(email: string): Promise<string> {
  const res = await fetch(`${API_BASE}/iam/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message ?? 'Login failed');
  const token = body?.data?.accessToken ?? body?.accessToken;
  if (!token) throw new Error('No access token in response');
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

export default function PlatformAdminLoginPage() {
  const [email, setEmail] = useState('platform.admin@sme.test');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await platformLogin(email);
      window.location.href = '/smeadmin/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
        <div className="mb-6 text-center">
          <div className="text-3xl font-extrabold text-slate-900">SME</div>
          <div className="text-sm text-slate-500 mt-1 font-medium">Platform Administration</div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Admin Email
            </label>
            <input
              type="email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Dev mode: password check is bypassed. Email only.
          </p>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}
