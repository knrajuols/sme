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

// ── POST /api/academic-setup/classes/seed-from-master ─────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Read optional academicYearId from request body
    let payload = '{}';
    try {
      const parsed = (await req.json()) as Record<string, unknown>;
      if (parsed?.academicYearId && typeof parsed.academicYearId === 'string') {
        payload = JSON.stringify({ academicYearId: parsed.academicYearId });
      }
    } catch { /* empty body is fine — service defaults to active year */ }

    const upstream = await fetch(`${TENANT_SVC}/academic/classes/seed-from-master`, {
      method: 'POST',
      headers: upstreamHeaders(req, 'POST /academic/classes/seed-from-master'),
      body: payload,
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF POST /academic/classes/seed-from-master] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-AC-CLS-SEED-MASTER]', extractMsg(body, 'Failed to generate Classes from master template'), upstream.status);
    }
    return NextResponse.json(body, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF POST /academic/classes/seed-from-master] fetch failed:', msg);
    return err('[ERR-AC-CLS-SEED-MASTER-503]', msg, 503);
  }
}
