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

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── PATCH /api/academic-setup/subjects/[id]/status ───────────────────────────
export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return err('[ERR-AC-SUBJ-STATUS]', 'Invalid JSON body', 400);
  }
  try {
    const upstream = await fetch(`${TENANT_SVC}/academic/subjects/${id}/status`, {
      method: 'PATCH',
      headers: upstreamHeaders(req, `PATCH /academic/subjects/${id}/status`),
      body: JSON.stringify(payload),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF PATCH /academic/subjects/${id}/status] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-AC-SUBJ-STATUS]', extractMsg(body, 'Failed to update subject status'), upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error(`[BFF PATCH /academic/subjects/${id}/status] fetch failed:`, msg);
    return err('[ERR-AC-SUBJ-STATUS]', msg, 503);
  }
}
