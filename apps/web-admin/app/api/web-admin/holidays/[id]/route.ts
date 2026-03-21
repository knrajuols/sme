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

// ── PATCH /api/web-admin/holidays/[id] ──────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const url = `${TENANT_SVC}/web-admin/holidays/${params.id}`;
  try {
    const payload = await req.json();
    const up = await fetch(url, {
      method: 'PATCH',
      headers: upstreamHeaders(req, `PATCH /web-admin/holidays/${params.id}`),
      body: JSON.stringify(payload),
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) {
      console.error('[BFF PATCH /web-admin/holidays/:id] upstream', up.status, JSON.stringify(body));
      return err('[ERR-WA-HOL-5003]', extractMsg(body, 'Failed to update holiday'), up.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF PATCH /web-admin/holidays/:id] fetch failed:', msg);
    return err('[ERR-WA-HOL-5003]', msg, 503);
  }
}

// ── DELETE /api/web-admin/holidays/[id] ─────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const url = `${TENANT_SVC}/web-admin/holidays/${params.id}`;
  try {
    const up = await fetch(url, {
      method: 'DELETE',
      headers: upstreamHeaders(req, `DELETE /web-admin/holidays/${params.id}`),
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) {
      console.error('[BFF DELETE /web-admin/holidays/:id] upstream', up.status, JSON.stringify(body));
      return err('[ERR-WA-HOL-5004]', extractMsg(body, 'Failed to delete holiday'), up.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF DELETE /web-admin/holidays/:id] fetch failed:', msg);
    return err('[ERR-WA-HOL-5004]', msg, 503);
  }
}
