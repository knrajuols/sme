'use client';

/**
 * /staff/setup-password — First-time password setup page.
 * ──────────────────────────────────────────────────────────────────────────────
 * Traps staff members who have `requiresPasswordChange === true` on first login.
 * They MUST set a secure password before accessing the platform.
 */
import { FormEvent, useEffect, useState } from 'react';

import { changeStaffPassword, decodeTokenClaims, getToken } from '../../../lib/auth';

interface FormState {
  newPassword: string;
  confirmPassword: string;
  showPassword: boolean;
  loading: boolean;
  error: string;
  success: boolean;
}

export default function SetupPasswordPage() {
  const [employeeName, setEmployeeName] = useState<string>('');
  const [form, setForm] = useState<FormState>({
    newPassword: '',
    confirmPassword: '',
    showPassword: false,
    loading: false,
    error: '',
    success: false,
  });

  useEffect(() => {
    // Read the staff member's name from the JWT for a personalised welcome.
    const token = getToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    const claims = decodeTokenClaims(token);
    if (!claims) {
      window.location.href = '/login';
      return;
    }
    // The `sub` is the employee ID — name was stored in localStorage during login.
    const stored = localStorage.getItem('sme_staff_name');
    if (stored) setEmployeeName(stored);
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Password strength ──────────────────────────────────────────────────────
  const pw = form.newPassword;
  const rules = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /\d/.test(pw),
  };
  const strength = Object.values(rules).filter(Boolean).length;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength] ?? '';
  const strengthColor = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'][strength] ?? '';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    set('error', '');

    if (form.newPassword !== form.confirmPassword) {
      set('error', 'Passwords do not match');
      return;
    }
    if (strength < 4) {
      set('error', 'Password does not meet all requirements');
      return;
    }

    set('loading', true);
    try {
      await changeStaffPassword(form.newPassword);
      set('success', true);
      // Redirect to dashboard after brief success message
      setTimeout(() => {
        const token = getToken();
        const claims = token ? decodeTokenClaims(token) : null;
        const isAdmin = claims?.roles?.includes('SCHOOL_ADMIN') ?? false;
        window.location.href = isAdmin ? '/admin/dashboard' : '/staff/dashboard';
      }, 1500);
    } catch (err) {
      set('error', err instanceof Error ? err.message : 'Password change failed');
    } finally {
      set('loading', false);
    }
  }

  const inputClass =
    'w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors placeholder:text-slate-400';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">
              Welcome{employeeName ? `, ${employeeName}` : ''}!
            </h1>
            <p className="text-sm text-slate-500">
              For security, please set a new password to continue.
            </p>
          </div>

          {form.success ? (
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-green-700 mb-1">Password Set Successfully!</h2>
              <p className="text-sm text-slate-500">Redirecting to your dashboard…</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide" htmlFor="new-pw">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-pw"
                    type={form.showPassword ? 'text' : 'password'}
                    className={`${inputClass} pr-11`}
                    value={form.newPassword}
                    onChange={(e) => set('newPassword', e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Enter a strong password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => set('showPassword', !form.showPassword)}
                    tabIndex={-1}
                    aria-label={form.showPassword ? 'Hide' : 'Show'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d={form.showPassword
                          ? 'M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4.03-9-9 0-1.657.42-3.217 1.175-4.575M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.825 4.575A9.96 9.96 0 0021 10c0-5-4.03-9-9-9a9.96 9.96 0 00-4.575 1.175'
                          : 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                        }
                      />
                    </svg>
                  </button>
                </div>

                {/* Strength meter */}
                {pw.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Strength: <span className="font-semibold">{strengthLabel}</span></p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide" htmlFor="confirm-pw">
                  Confirm Password
                </label>
                <input
                  id="confirm-pw"
                  type={form.showPassword ? 'text' : 'password'}
                  className={inputClass}
                  value={form.confirmPassword}
                  onChange={(e) => set('confirmPassword', e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                />
                {form.confirmPassword && form.newPassword !== form.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Requirements */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-semibold text-slate-600 mb-1">Password Requirements:</p>
                {[
                  { ok: rules.length, label: 'At least 8 characters' },
                  { ok: rules.upper, label: 'One uppercase letter (A-Z)' },
                  { ok: rules.lower, label: 'One lowercase letter (a-z)' },
                  { ok: rules.digit, label: 'One digit (0-9)' },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className={`text-xs ${r.ok ? 'text-green-600' : 'text-slate-400'}`}>
                      {r.ok ? '✓' : '○'}
                    </span>
                    <span className={`text-xs ${r.ok ? 'text-green-700' : 'text-slate-500'}`}>{r.label}</span>
                  </div>
                ))}
              </div>

              {form.error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {form.error}
                </p>
              )}

              <button
                type="submit"
                disabled={form.loading || strength < 4 || form.newPassword !== form.confirmPassword}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md shadow-blue-200 transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              >
                {form.loading ? 'Setting Password…' : 'Set Password & Continue'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} SME Platform · Enterprise School Management
        </p>
      </div>
    </main>
  );
}
