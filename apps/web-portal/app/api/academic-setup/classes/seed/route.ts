import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest, routeLabel: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) {
    headers['authorization'] = auth;
  } else {
    console.warn(`[BFF ${routeLabel}] no Authorization header on incoming request — upstream will reject with 401`);
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

// ── POST /api/academic-setup/classes/seed ─────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${TENANT_SVC}/academic/classes/seed`, {
      method: 'POST',
      headers: upstreamHeaders(req, 'POST /academic/classes/seed'),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF POST /academic/classes/seed] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-AC-CLS-SEED]', extractMsg(body, 'Failed to seed classes'), upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF POST /academic/classes/seed] fetch failed:', msg);
    return err('[ERR-AC-CLS-SEED]', msg, 503);
  }
}
