import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) h['authorization'] = auth;
  else console.warn('[BFF POST /finance/generate-from-master] no Authorization header — upstream will reject with 401');
  const corr = req.headers.get('x-correlation-id');
  if (corr) h['x-correlation-id'] = corr;
  return h;
}

// ── POST /api/finance/generate-from-master ──────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const up = await fetch(`${TENANT_SVC}/finance/generate-from-master`, {
      method: 'POST',
      headers: upstreamHeaders(req),
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) {
      const b = body as Record<string, unknown> | null;
      const msg = (b && typeof b === 'object' && typeof b.message === 'string') ? b.message : 'Generation failed';
      return NextResponse.json({ message: `[ERR-GEN-5001] ${msg}` }, { status: up.status });
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { message: `[ERR-GEN-5001] ${e instanceof Error ? e.message : 'Unavailable'}` },
      { status: 503 },
    );
  }
}
