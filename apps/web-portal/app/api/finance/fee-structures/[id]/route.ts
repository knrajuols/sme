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

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  try {
    const up = await fetch(`${TENANT_SVC}/finance/fee-structures/${id}`, {
      method: 'GET', headers: upstreamHeaders(req, `GET /finance/fee-structures/${id}`), cache: 'no-store',
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) return err('[ERR-FIN-STRUCT-5003]', extractMsg(body, 'Fee structure not found'), up.status);
    return NextResponse.json(body, { status: 200 });
  } catch (e) { return err('[ERR-FIN-STRUCT-5003]', e instanceof Error ? e.message : 'Unavailable', 503); }
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  let payload: unknown;
  try { payload = await req.json(); } catch { return err('[ERR-FIN-STRUCT-5004]', 'Invalid JSON body', 400); }
  try {
    const up = await fetch(`${TENANT_SVC}/finance/fee-structures/${id}`, {
      method: 'PATCH', headers: upstreamHeaders(req, `PATCH /finance/fee-structures/${id}`), body: JSON.stringify(payload),
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) return err('[ERR-FIN-STRUCT-5004]', extractMsg(body, 'Failed to update fee structure'), up.status);
    return NextResponse.json(body, { status: 200 });
  } catch (e) { return err('[ERR-FIN-STRUCT-5004]', e instanceof Error ? e.message : 'Unavailable', 503); }
}

export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  try {
    const up = await fetch(`${TENANT_SVC}/finance/fee-structures/${id}`, {
      method: 'DELETE', headers: upstreamHeaders(req, `DELETE /finance/fee-structures/${id}`),
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) return err('[ERR-FIN-STRUCT-5005]', extractMsg(body, 'Failed to delete fee structure'), up.status);
    return NextResponse.json(body, { status: 200 });
  } catch (e) { return err('[ERR-FIN-STRUCT-5005]', e instanceof Error ? e.message : 'Unavailable', 503); }
}
