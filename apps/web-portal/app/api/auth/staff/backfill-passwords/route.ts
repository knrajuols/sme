/**
 * [BFF-AUTH-003] Staff Password Backfill proxy — POST only.
 * Proxies to tenant-service /auth/staff/backfill-passwords.
 * Requires valid JWT (passed through from client).
 */
import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) headers['authorization'] = auth;
  return headers;
}

function err(code: string, msg: string, status: number): NextResponse {
  return NextResponse.json({ message: `${code} ${msg}` }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${TENANT_SVC}/auth/staff/backfill-passwords`, {
      method: 'POST',
      headers: upstreamHeaders(req),
      body: JSON.stringify({}),
    });

    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const b = body as Record<string, unknown>;
      const msg = typeof b?.message === 'string' ? b.message : 'Backfill failed';
      return NextResponse.json({ message: msg }, { status: upstream.status });
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Authentication service unavailable';
    console.error('[BFF POST /auth/staff/backfill-passwords] fetch failed:', msg);
    return err('[ERR-AUTH-5004]', msg, 503);
  }
}
