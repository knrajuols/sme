import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest, routeLabel: string): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) h['authorization'] = auth;
  else console.warn(`[BFF ${routeLabel}] no Authorization header — upstream will reject with 401`);
  const corr = req.headers.get('x-correlation-id');
  if (corr) h['x-correlation-id'] = corr;
  return h;
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

// ── GET /api/academic/holidays?academicYearId=... ──────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const qs = req.nextUrl.searchParams.toString();
  const url = `${TENANT_SVC}/academic/holidays${qs ? `?${qs}` : ''}`;
  try {
    const up = await fetch(url, {
      method: 'GET',
      headers: upstreamHeaders(req, 'GET /academic/holidays'),
      cache: 'no-store',
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) {
      console.error('[BFF GET /academic/holidays] upstream', up.status, JSON.stringify(body));
      return err('[ERR-PT-HOL-5001]', extractMsg(body, 'Failed to list holidays'), up.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF GET /academic/holidays] fetch failed:', msg);
    return err('[ERR-PT-HOL-5001]', msg, 503);
  }
}

// ── POST /api/academic/holidays (create manual holiday) ─────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const url = `${TENANT_SVC}/academic/holidays`;
  try {
    const payload = await req.json();
    const up = await fetch(url, {
      method: 'POST',
      headers: upstreamHeaders(req, 'POST /academic/holidays'),
      body: JSON.stringify(payload),
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) {
      console.error('[BFF POST /academic/holidays] upstream', up.status, JSON.stringify(body));
      return err('[ERR-PT-HOL-5002]', extractMsg(body, 'Failed to create holiday'), up.status);
    }
    return NextResponse.json(body, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF POST /academic/holidays] fetch failed:', msg);
    return err('[ERR-PT-HOL-5002]', msg, 503);
  }
}
