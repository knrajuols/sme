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

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  try {
    const up = await fetch(`${TENANT_SVC}/web-admin/transport/routes/${id}`, {
      method: 'GET',
      headers: upstreamHeaders(req, `GET /transport/routes/${id}`),
      cache: 'no-store',
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) return err('[ERR-TR-RT-5005]', extractMsg(body, 'Failed to get route'), up.status);
    return NextResponse.json(body, { status: 200 });
  } catch (e) { return err('[ERR-TR-RT-5005]', e instanceof Error ? e.message : 'Unavailable', 503); }
}

export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  let payload: unknown;
  try { payload = await req.json(); } catch { return err('[ERR-TR-RT-5003]', 'Invalid JSON', 400); }
  try {
    const up = await fetch(`${TENANT_SVC}/web-admin/transport/routes/${id}`, {
      method: 'PUT',
      headers: upstreamHeaders(req, `PUT /transport/routes/${id}`),
      body: JSON.stringify(payload),
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) return err('[ERR-TR-RT-5003]', extractMsg(body, 'Failed to save route'), up.status);
    return NextResponse.json(body, { status: 200 });
  } catch (e) { return err('[ERR-TR-RT-5003]', e instanceof Error ? e.message : 'Unavailable', 503); }
}

export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  try {
    const up = await fetch(`${TENANT_SVC}/web-admin/transport/routes/${id}`, {
      method: 'DELETE',
      headers: upstreamHeaders(req, `DELETE /transport/routes/${id}`),
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) return err('[ERR-TR-RT-5004]', extractMsg(body, 'Failed to delete route'), up.status);
    return NextResponse.json(body, { status: 200 });
  } catch (e) { return err('[ERR-TR-RT-5004]', e instanceof Error ? e.message : 'Unavailable', 503); }
}
