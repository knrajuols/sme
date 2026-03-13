'use client';

import { FormEvent, useState } from 'react';

import { AuthGuard } from '../../components/AuthGuard';
import { apiRequest } from '../../lib/api';

export default function AttendancePage() {
  const [sessionId, setSessionId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [status, setStatus] = useState('PRESENT');
  const [message, setMessage] = useState('');

  async function onMark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    try {
      await apiRequest('/tenant/attendance/records', {
        method: 'POST',
        body: JSON.stringify({ sessionId, studentId, status }),
      });
      setMessage('Attendance saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save attendance');
    }
  }

  return (
    <AuthGuard>
      {() => (
        <main className="mx-auto max-w-4xl p-6">
          <h1 className="mb-6 text-2xl font-bold text-slate-900 tracking-tight">Attendance</h1>
          <form className="space-y-3 rounded border border-slate-200 bg-white p-4" onSubmit={onMark}>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              placeholder="Session ID"
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
            />
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              placeholder="Student ID"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
            />
            <select
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
            </select>
            <button className="rounded bg-slate-900 px-4 py-2 text-white" type="submit">
              Save Attendance
            </button>
            {message ? <p className="text-sm text-slate-700">{message}</p> : null}
          </form>
        </main>
      )}
    </AuthGuard>
  );
}
