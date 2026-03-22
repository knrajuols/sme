/**
 * [BFF-TRA-005] Transport Allocations Lookup proxy — GET.
 * Proxies to tenant-service /transport/allocations/lookup.
 * Returns routes/trips/stops/academic years for the allocation form.
 * Prompt #285 — Tenant-scoped via JWT.
 */
import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest, label: string): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) h['authorization'] = auth;
  else console.warn(`[BFF ${label}] no Authorization header — upstream will reject with 401`);
  const cid = req.headers.get('x-correlation-id');
  if (cid) h['x-correlation-id'] = cid;
  return h;
}

function err(code: string, msg: string, status: number): NextResponse {
  return NextResponse.json({ message: `${code} ${msg}` }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${TENANT_SVC}/transport/allocations/lookup`, {
      method: 'GET',
      headers: upstreamHeaders(req, 'GET /transport/allocations/lookup'),
      cache: 'no-store',
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF GET /transport/allocations/lookup] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-TRA-6005]', 'Failed to load lookup data', upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF GET /transport/allocations/lookup] fetch failed:', msg);
    return err('[ERR-TRA-6005]', msg, 503);
  }
}
