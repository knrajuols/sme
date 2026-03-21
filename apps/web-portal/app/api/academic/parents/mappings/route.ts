// Issue-217: BFF proxy for parent-student mappings — GET (list) and POST (create).
// tenantId isolation is enforced by the upstream tenant-service JWT guard.
import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest, label: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) headers['authorization'] = auth;
  else console.warn(`[BFF ${label}] no Authorization header — upstream will reject with 401`);
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

// ── GET /api/academic/parents/mappings[?parentId=xxx&studentId=xxx] ────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const url = `${TENANT_SVC}/academic/parents/mappings${qs ? `?${qs}` : ''}`;
  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: upstreamHeaders(req, 'GET /academic/parents/mappings'),
      cache: 'no-store',
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF GET /academic/parents/mappings] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-PSM-5001]', extractMsg(body, 'Failed to list parent-student mappings'), upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF GET /academic/parents/mappings] fetch failed:', msg);
    return err('[ERR-PSM-5001]', msg, 503);
  }
}

// ── POST /api/academic/parents/mappings ───────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return err('[ERR-PSM-5002]', 'Invalid JSON body', 400);
  }
  try {
    const upstream = await fetch(`${TENANT_SVC}/academic/parents/mappings`, {
      method: 'POST',
      headers: upstreamHeaders(req, 'POST /academic/parents/mappings'),
      body: JSON.stringify(payload),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF POST /academic/parents/mappings] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-PSM-5003]', extractMsg(body, 'Failed to create parent-student mapping'), upstream.status);
    }
    return NextResponse.json(body, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF POST /academic/parents/mappings] fetch failed:', msg);
    return err('[ERR-PSM-5003]', msg, 503);
  }
}
