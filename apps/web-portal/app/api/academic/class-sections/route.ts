import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest, routeLabel: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) {
    headers['authorization'] = auth;
  } else {
    console.warn(`[BFF ${routeLabel}] no Authorization header — upstream will reject with 401`);
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

// ── GET /api/academic/class-sections?classId=... ──────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const url = `${TENANT_SVC}/academic/class-sections${qs ? `?${qs}` : ''}`;
  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: upstreamHeaders(req, 'GET /academic/class-sections'),
      cache: 'no-store',
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF GET /academic/class-sections] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-CSC-5001]', extractMsg(body, 'Failed to list class-sections'), upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF GET /academic/class-sections] fetch failed:', msg);
    return err('[ERR-CSC-5001]', msg, 503);
  }
}

// ── POST /api/academic/class-sections ─────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const url = `${TENANT_SVC}/academic/class-sections`;
  try {
    const payload = await req.json();
    const upstream = await fetch(url, {
      method: 'POST',
      headers: upstreamHeaders(req, 'POST /academic/class-sections'),
      body: JSON.stringify(payload),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF POST /academic/class-sections] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-CSC-5002]', extractMsg(body, 'Failed to create class-section'), upstream.status);
    }
    return NextResponse.json(body, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF POST /academic/class-sections] fetch failed:', msg);
    return err('[ERR-CSC-5002]', msg, 503);
  }
}
