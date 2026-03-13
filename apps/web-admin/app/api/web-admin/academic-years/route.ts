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

// ── GET /api/web-admin/academic-years ────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${TENANT_SVC}/web-admin/academic-years`, {
      method: 'GET',
      headers: upstreamHeaders(req),
      cache: 'no-store',
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return NextResponse.json(
        { message: (body as { message?: string })?.message ?? 'Failed to list master academic years' },
        { status: upstream.status },
      );
    }
    return NextResponse.json(body, { status: 200 });
  } catch {
    return NextResponse.json({ message: 'Tenant service unavailable' }, { status: 503 });
  }
}
