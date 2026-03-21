import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest, label: string): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) h['authorization'] = auth;
  else console.warn(`[BFF ${label}] no Authorization header — upstream will reject with 401`);
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

// ── GET /api/web-admin/fee-structures ────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const qs = new URL(req.url).searchParams.toString();
  const url = `${TENANT_SVC}/web-admin/fee-structures${qs ? `?${qs}` : ''}`;
  try {
    const up = await fetch(url, {
      method: 'GET',
      headers: upstreamHeaders(req, 'GET /web-admin/fee-structures'),
      cache: 'no-store',
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) {
      console.error(`[BFF GET /web-admin/fee-structures] upstream ${up.status}:`, JSON.stringify(body));
      return err('[ERR-WA-FS-5001]', extractMsg(body, 'Failed to list fee structures'), up.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF GET /web-admin/fee-structures] fetch failed:', msg);
    return err('[ERR-WA-FS-5001]', msg, 503);
  }
}

// ── POST /api/web-admin/fee-structures ───────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown;
  try { payload = await req.json(); } catch { return err('[ERR-WA-FS-5002]', 'Invalid JSON body', 400); }
  try {
    const up = await fetch(`${TENANT_SVC}/web-admin/fee-structures`, {
      method: 'POST',
      headers: upstreamHeaders(req, 'POST /web-admin/fee-structures'),
      body: JSON.stringify(payload),
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) {
      console.error(`[BFF POST /web-admin/fee-structures] upstream ${up.status}:`, JSON.stringify(body));
      return err('[ERR-WA-FS-5002]', extractMsg(body, 'Failed to create fee structure'), up.status);
    }
    return NextResponse.json(body, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF POST /web-admin/fee-structures] fetch failed:', msg);
    return err('[ERR-WA-FS-5002]', msg, 503);
  }
}
