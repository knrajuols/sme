'use client';

import { FormEvent, useState } from 'react';

import { decodeTokenClaims, login } from '../../lib/auth';
import { PremiumCard } from '../../components/ui/PremiumCard';
import type { AccentColor } from '../../components/ui/PremiumCard';

// ── Types ─────────────────────────────────────────────────────────────────────
type Gate = 'staff' | 'family';

interface GateState {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  error: string;
}

// ── Announcements data ────────────────────────────────────────────────────────
const ANNOUNCEMENTS = [
  {
    badge: 'URGENT',
    badgeStyle: 'bg-red-50 text-red-600',
    text: 'Tomorrow (11 Mar) is a declared holiday. All classes are cancelled.',
  },
  {
    badge: 'INFO',
    badgeStyle: 'bg-blue-50 text-blue-700',
    text: 'Term 1 Examination schedule has been released. Check the Exams section.',
  },
  {
    badge: 'NOTICE',
    badgeStyle: 'bg-yellow-50 text-yellow-700',
    text: 'Annual Sports Day registrations are open. Last date: 20 Mar 2026.',
  },
] as const;

// ── Login Gate Form ───────────────────────────────────────────────────────────
function LoginGate({
  gate,
  accentColor,
  buttonColor,
  title,
  subtitle,
  submitLabel,
  defaultEmail,
}: {
  gate: Gate;
  accentColor: AccentColor;
  buttonColor: string;
  title: string;
  subtitle: string;
  submitLabel: string;
  defaultEmail: string;
}) {
  const [state, setState] = useState<GateState>({
    email: defaultEmail,
    password: 'password',
    showPassword: false,
    loading: false,
    error: '',
  });

  function set<K extends keyof GateState>(key: K, value: GateState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    set('error', '');
    set('loading', true);
    try {
      const token = await login(state.email, state.password);
      const claims = decodeTokenClaims(token);
      const isAdmin = claims?.roles?.includes('SCHOOL_ADMIN') ?? false;
      if (gate === 'staff') {
        window.location.href = isAdmin ? '/admin/dashboard' : '/portal/dashboard';
      } else {
        window.location.href = '/portal/dashboard';
      }
    } catch (err) {
      set('error', err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      set('loading', false);
    }
  }

  const inputClass =
    'w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors placeholder:text-slate-400';

  return (
    <PremiumCard accentColor={accentColor}>
      <h2 className="text-xl font-bold text-slate-900 mb-1">{title}</h2>
      <p className="text-sm text-slate-500 mb-6">{subtitle}</p>

      <form onSubmit={onSubmit} autoComplete="off" className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide" htmlFor={`${gate}-email`}>
            Email Address
          </label>
          <input
            id={`${gate}-email`}
            type="email"
            className={inputClass}
            value={state.email}
            onChange={(e) => set('email', e.target.value)}
            required
            autoComplete="username"
            placeholder="you@school.edu"
            inputMode="email"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide" htmlFor={`${gate}-password`}>
            Password
          </label>
          <div className="relative">
            <input
              id={`${gate}-password`}
              type={state.showPassword ? 'text' : 'password'}
              className={`${inputClass} pr-11`}
              value={state.password}
              onChange={(e) => set('password', e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              minLength={8}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => set('showPassword', !state.showPassword)}
              tabIndex={-1}
              aria-label={state.showPassword ? 'Hide password' : 'Show password'}
            >
              {state.showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4.03-9-9 0-1.657.42-3.217 1.175-4.575M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.825 4.575A9.96 9.96 0 0021 10c0-5-4.03-9-9-9a9.96 9.96 0 00-4.575 1.175" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {state.error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={state.loading}
          className={`w-full ${buttonColor} text-white font-bold py-3 rounded-xl shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed text-sm mt-2`}
        >
          {state.loading ? 'Signing in…' : submitLabel}
        </button>
      </form>
    </PremiumCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">

      {/* Header */}
      <header className="flex flex-col items-center justify-center text-center px-6 pt-14 pb-10">
        {/* School logo placeholder */}
        <div className="h-20 w-20 rounded-2xl bg-white shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center justify-center mb-5">
          <span className="text-4xl">🏫</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
          Welcome to <span className="text-blue-600">Your School</span>
        </h1>
        <p className="text-slate-500 text-base">Please select your portal to continue.</p>
      </header>

      {/* Dual Login Gates */}
      <section className="px-6 pb-10 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <LoginGate
            gate="staff"
            accentColor="blue"
            buttonColor="bg-blue-600 hover:bg-blue-700 shadow-blue-200"
            title="Staff Portal"
            subtitle="Access attendance, grading, and admin tools."
            submitLabel="Sign In to Workspace"
            defaultEmail="admin@sme.test"
          />
          <LoginGate
            gate="family"
            accentColor="green"
            buttonColor="bg-green-600 hover:bg-green-700 shadow-green-200"
            title="Family Portal"
            subtitle="View report cards, schedules, and fee updates."
            submitLabel="Access Family Dashboard"
            defaultEmail="parent@sme.test"
          />
        </div>
      </section>

      {/* Digital Notice Board */}
      <section className="px-6 pb-16 max-w-4xl mx-auto w-full">
        <PremiumCard accentColor="yellow">
          <h2 className="text-lg font-bold text-slate-900 mb-5">📌 School Announcements</h2>
          <ul className="space-y-4">
            {ANNOUNCEMENTS.map((item) => (
              <li key={item.badge + item.text} className="flex items-start gap-3">
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${item.badgeStyle}`}>
                  {item.badge}
                </span>
                <p className="text-sm text-slate-600 leading-relaxed">{item.text}</p>
              </li>
            ))}
          </ul>
        </PremiumCard>
      </section>

      <footer className="mt-auto bg-slate-900 text-slate-400 text-xs text-center py-5">
        © {new Date().getFullYear()} SME Platform · Powered by Modern School Infrastructure
      </footer>

    </main>
  );
}
