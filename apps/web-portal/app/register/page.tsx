'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://sme.test:3000';

interface FormState {
  schoolName: string;
  adminName: string;
  adminEmail: string;
  subdomain: string;
  udiseCode: string;
  address: string;
  city: string;
  dist: string;
  state: string;
  pincode: string;
  password: string;
  primaryContactPhone: string;
}

export default function RegisterPage() {
  const [form, setForm] = useState<FormState>({
    schoolName: '',
    adminName: '',
    adminEmail: '',
    subdomain: '',
    udiseCode: '',
    address: '',
    city: '',
    dist: '',
    state: '',
    pincode: '',
    password: '',
    primaryContactPhone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubdomainBlur() {
    if (!form.subdomain && form.schoolName) {
      setForm((prev) => ({
        ...prev,
        subdomain: form.schoolName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      }));
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Send all fields collected on the form to the registration endpoint.
      const body: Record<string, string> = {
        tenantCode:           form.subdomain,
        schoolName:           form.schoolName,
        primaryContactName:   form.adminName,
        primaryContactEmail:  form.adminEmail,
        primaryContactPhone:  form.primaryContactPhone,
      };
      // Optional fields — only include when the user filled them in
      if (form.udiseCode)  body.udiseCode = form.udiseCode;
      if (form.address)    body.address   = form.address;
      if (form.city)       body.city      = form.city;
      if (form.dist)       body.district  = form.dist;
      if (form.state)      body.state     = form.state;
      if (form.pincode)    body.pincode   = form.pincode;

      const response = await fetch(`${API_BASE_URL}/onboarding/schools/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      let data: Record<string, unknown> = {};
      try {
        data = await response.json();
      } catch {}

      if (!response.ok) {
        // Try every possible field the server might use for the human-readable message
        const d = data as { detail?: unknown; message?: unknown; error?: unknown; title?: unknown };
        const parts: string[] = [];
        if (typeof d.detail  === 'string' && d.detail)  parts.push(d.detail);
        if (typeof d.message === 'string' && d.message) parts.push(d.message);
        if (Array.isArray(d.message)) parts.push((d.message as string[]).join(', '));
        if (typeof d.error   === 'string' && d.error)   parts.push(d.error);
        // Last resort: dump the raw JSON so nothing is hidden from the user
        const errorMsg = parts.length > 0
          ? parts[0]
          : `HTTP ${response.status} — ${JSON.stringify(data) || response.statusText}`;
        throw new Error(errorMsg);
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-blue-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl border border-green-200 shadow-lg p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Application Received!</h1>
          <p className="text-slate-600 mb-4">
            <span className="font-semibold text-blue-700">{form.schoolName}</span> has been submitted
            for approval.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm mb-6">
            Registration submitted for approval.
          </div>
          <p className="text-xs text-slate-500 mb-6">
            Our platform team will review your school at{' '}
            <span className="font-mono text-blue-600">{form.subdomain}.sme.test</span> and notify{' '}
            <span className="font-semibold">{form.adminEmail}</span> once approved.
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2 rounded-lg transition-colors text-sm"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-blue-50 flex items-center justify-center px-6 py-12">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 w-full max-w-lg p-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-sm text-blue-700 hover:underline mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Register Your School</h1>
          <p className="text-sm text-slate-500 mt-1">
            Fill in the details below. Your application will be reviewed by the SME platform team.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* School Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              School Name <span className="text-red-500">*</span>
            </label>
            <input
              name="schoolName"
              value={form.schoolName}
              onChange={handleChange}
              onBlur={handleSubdomainBlur}
              placeholder="Greenwood Academy"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* UDISE Code */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              UDISE Code <span className="text-red-500">*</span>
            </label>
            <input
              name="udiseCode"
              value={form.udiseCode}
              onChange={handleChange}
              placeholder="29150400615"
              required
              minLength={11}
              maxLength={11}
              pattern="\d{11}"
              title="UDISE code must be exactly 11 digits"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">11-digit Unified District Information System for Education code</p>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="123 Main St, Near Park"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* City + District row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Bhopal"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">District</label>
              <input
                name="dist"
                value={form.dist}
                onChange={handleChange}
                placeholder="Bhopal District"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* State + Pincode row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <input
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="Madhya Pradesh"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PIN Code</label>
              <input
                name="pincode"
                value={form.pincode}
                onChange={handleChange}
                placeholder="462001"
                maxLength={6}
                pattern="\d{6}"
                title="6-digit PIN code"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* School Admin Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              School Admin Name <span className="text-red-500">*</span>
            </label>
            <input
              name="adminName"
              value={form.adminName}
              onChange={handleChange}
              placeholder="Dr. Priya Sharma"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Admin Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Admin Email <span className="text-red-500">*</span>
            </label>
            <input
              name="adminEmail"
              type="email"
              value={form.adminEmail}
              onChange={handleChange}
              placeholder="admin@greenwoodacademy.edu"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Contact Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Contact Number <span className="text-red-500">*</span>
            </label>
            <input
              name="primaryContactPhone"
              type="tel"
              value={form.primaryContactPhone}
              onChange={handleChange}
              placeholder="+919876543210"
              required
              pattern="^\+?\d{7,15}$"
              title="Contact number must be 7–15 digits, optional leading +"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Enter a valid phone number (7–15 digits, optional +).</p>
          </div>

          {/* Admin Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Admin Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4.03-9-9 0-1.657.42-3.217 1.175-4.575M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.825 4.575A9.96 9.96 0 0021 10c0-5-4.03-9-9-9a9.96 9.96 0 00-4.575 1.175" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm2.25 2.25l3.75 3.75M4.5 4.5l15 15" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* Requested Subdomain */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Requested Subdomain <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-0">
              <input
                name="subdomain"
                value={form.subdomain}
                onChange={handleChange}
                placeholder="greenwood-academy"
                required
                pattern="^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$"
                title="Lowercase letters, numbers and hyphens only (3–32 chars)"
                className="flex-1 rounded-l-lg border border-r-0 border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="bg-slate-100 border border-slate-300 rounded-r-lg px-3 py-2 text-sm text-slate-500 select-none">
                .sme.test
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Lowercase letters, numbers and hyphens only. Auto-filled from school name.
            </p>
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm mt-2"
          >
            {loading ? 'Submitting…' : 'Submit Registration'}
          </button>
        </form>
      </div>
    </main>
  );
}
