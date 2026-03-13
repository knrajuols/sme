import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) headers['authorization'] = auth;
  const corr = req.headers.get('x-correlation-id');
  if (corr) headers['x-correlation-id'] = corr;
  return headers;
}

/**
 * GET /api/portal/family/summary
 *
 * Proxies to tenant-service GET /portal/family/summary.
 * The Bearer token must carry a PARENT or STUDENT role — the backend derives
 * the parent profile from the JWT sub claim, never from a request parameter.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${TENANT_SVC}/portal/family/summary`, {
      method: 'GET',
      headers: upstreamHeaders(req),
      cache: 'no-store',
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = (body as Record<string, unknown>)?.message ?? 'Failed to load family summary';
      return NextResponse.json({ message: msg }, { status: upstream.status });
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    return NextResponse.json({ message: msg }, { status: 503 });
  }
}
