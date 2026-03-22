import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) h['authorization'] = auth;
  const corr = req.headers.get('x-correlation-id');
  if (corr) h['x-correlation-id'] = corr;
  return h;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const up = await fetch(`${TENANT_SVC}/web-admin/transport/routes`, {
      method: 'GET',
      headers: upstreamHeaders(req),
      cache: 'no-store',
    });
    const body: unknown = await up.json().catch(() => null);
    if (!up.ok) {
      console.error('[BFF GET /transport/routes] Backend error:', up.status, body);
      return NextResponse.json(body ?? { message: 'Failed to list routes' }, { status: up.status });
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unavailable';
    console.error('[BFF GET /transport/routes] Fetch error:', msg);
    return NextResponse.json({ message: msg }, { status: 503 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown;
  try { payload = await req.json(); } catch { return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 }); }
  try {
    const up = await fetch(`${TENANT_SVC}/web-admin/transport/routes`, {
      method: 'POST',
      headers: upstreamHeaders(req),
      body: JSON.stringify(payload),
    });
    const body: unknown = await up.json().catch(() => null);
    if (!up.ok) {
      console.error('[BFF POST /transport/routes] Backend error:', up.status, body);
      return NextResponse.json(body ?? { message: 'Failed to create route' }, { status: up.status });
    }
    return NextResponse.json(body, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unavailable';
    console.error('[BFF POST /transport/routes] Fetch error:', msg);
    return NextResponse.json({ message: msg }, { status: 503 });
  }
}
