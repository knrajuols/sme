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

/** POST — Lock or unlock attendance log. Path param: [id], query: lock=true|false */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const lock = new URL(req.url).searchParams.get('lock') ?? 'true';
  const url = `${TENANT_SVC}/academic/attendance/log/${params.id}/lock?lock=${lock}`;
  try {
    const up = await fetch(url, {
      method: 'POST',
      headers: upstreamHeaders(req, `POST /academic/attendance/log/${params.id}/lock`),
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) return err('[ERR-ATL-5004]', extractMsg(body, 'Failed to lock attendance'), up.status);
    return NextResponse.json(body, { status: up.status });
  } catch (e) {
    return err('[ERR-ATL-5004]', e instanceof Error ? e.message : 'Unavailable', 503);
  }
}
