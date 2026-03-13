import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest, label: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) {
    headers['authorization'] = auth;
  } else {
    console.warn(`[BFF ${label}] no Authorization header`);
  }
  const corr = req.headers.get('x-correlation-id');
  if (corr) headers['x-correlation-id'] = corr;
  return headers;
}

function extractMsg(body: unknown, fallback: string): string {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return fallback;
  if (typeof b.detail === 'string' && b.detail) return `${b.title ?? ''}: ${b.detail}`.trim();
  if (typeof b.message === 'string' && b.message) return b.message;
  if (Array.isArray(b.message)) return (b.message as string[]).join('; ');
  return fallback;
}

function err(code: string, msg: string, status: number): NextResponse {
  return NextResponse.json({ message: `${code} ${msg}` }, { status });
}

// ── GET /api/web-admin/exam-schedules ────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${TENANT_SVC}/web-admin/exam-schedules`, {
      method: 'GET',
      headers: upstreamHeaders(req, 'GET /web-admin/exam-schedules'),
      cache: 'no-store',
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF GET /web-admin/exam-schedules] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-WA-EXS-5001]', extractMsg(body, 'Failed to list master exam schedules'), upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF GET /web-admin/exam-schedules] fetch failed:', msg);
    return err('[ERR-WA-EXS-5001]', msg, 503);
  }
}

// ── POST /api/web-admin/exam-schedules ───────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return err('[ERR-WA-EXS-5002]', 'Invalid JSON body', 400);
  }
  try {
    const upstream = await fetch(`${TENANT_SVC}/web-admin/exam-schedules`, {
      method: 'POST',
      headers: upstreamHeaders(req, 'POST /web-admin/exam-schedules'),
      body: JSON.stringify(payload),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF POST /web-admin/exam-schedules] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-WA-EXS-5002]', extractMsg(body, 'Failed to create master exam schedule'), upstream.status);
    }
    return NextResponse.json(body, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF POST /web-admin/exam-schedules] fetch failed:', msg);
    return err('[ERR-WA-EXS-5002]', msg, 503);
  }
}
