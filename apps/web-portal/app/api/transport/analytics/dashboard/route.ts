/**
 * [BFF-TRA-010] Transport Analytics Dashboard proxy — GET.
 * Proxies to tenant-service /transport/analytics/dashboard.
 * Returns aggregated fleet utilization at overall, vehicle, route, stop levels.
 * Prompt #288 — Tenant-scoped via JWT.
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
    const upstream = await fetch(`${TENANT_SVC}/transport/analytics/dashboard`, {
      method: 'GET',
      headers: upstreamHeaders(req, 'GET /transport/analytics/dashboard'),
      cache: 'no-store',
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF GET /transport/analytics/dashboard] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-TRA-7001]', 'Failed to load analytics dashboard', upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF GET /transport/analytics/dashboard] fetch failed:', msg);
    return err('[ERR-TRA-7001]', msg, 503);
  }
}
