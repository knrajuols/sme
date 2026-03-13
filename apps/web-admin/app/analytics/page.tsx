'use client';

import { useState } from 'react';

import { AuthGuard } from '../../components/AuthGuard';
import { apiRequest } from '../../lib/api';

export default function AnalyticsPage() {
  const [payload, setPayload] = useState<unknown>(null);
  const [message, setMessage] = useState('');

  async function loadAnalytics() {
    setMessage('');
    try {
      const data = await apiRequest<unknown>('/tenant/analytics/overview');
      setPayload(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load analytics');
    }
  }

  return (
    <AuthGuard>
      {() => (
        <main className="mx-auto max-w-5xl p-6">
          <h1 className="mb-6 text-2xl font-bold text-slate-900 tracking-tight">Analytics</h1>
          <button className="mb-3 rounded bg-slate-900 px-4 py-2 text-white" onClick={loadAnalytics}>
            Load Overview
          </button>
          {message ? <p className="mb-3 text-sm text-slate-700">{message}</p> : null}
          <pre className="overflow-auto rounded border border-slate-200 bg-white p-4 text-xs">
            {payload ? JSON.stringify(payload, null, 2) : 'No analytics loaded.'}
          </pre>
        </main>
      )}
    </AuthGuard>
  );
}
