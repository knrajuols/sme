import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest, label: string): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) h['authorization'] = auth;
  const corr = req.headers.get('x-correlation-id');
  if (corr) h['x-correlation-id'] = corr;
  return h;
}

function extractMsg(body: unknown, fallback: string): string {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return fallback;
  if (typeof b.message === 'string' && b.message) return b.message;
  if (Array.isArray(b.message)) return (b.message as string[]).join('; ');
  return fallback;
}

function err(code: string, msg: string, status: number): NextResponse {
  return NextResponse.json({ message: `${code} ${msg}` }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const up = await fetch(`${TENANT_SVC}/web-admin/transport/stops`, {
      method: 'GET',
      headers: upstreamHeaders(req, 'GET /transport/stops'),
      cache: 'no-store',
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) return err('[ERR-TR-ST-5001]', extractMsg(body, 'Failed to list stops'), up.status);
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    return err('[ERR-TR-ST-5001]', e instanceof Error ? e.message : 'Unavailable', 503);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown;
  try { payload = await req.json(); } catch { return err('[ERR-TR-ST-5002]', 'Invalid JSON', 400); }
  try {
    const up = await fetch(`${TENANT_SVC}/web-admin/transport/stops`, {
      method: 'POST',
      headers: upstreamHeaders(req, 'POST /transport/stops'),
      body: JSON.stringify(payload),
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) return err('[ERR-TR-ST-5002]', extractMsg(body, 'Failed to create stop'), up.status);
    return NextResponse.json(body, { status: 201 });
  } catch (e) {
    return err('[ERR-TR-ST-5002]', e instanceof Error ? e.message : 'Unavailable', 503);
  }
}
