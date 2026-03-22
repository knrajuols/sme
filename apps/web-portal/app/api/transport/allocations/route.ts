/**
 * [BFF-TRA-001] Transport Allocations proxy — GET (list) + POST (create).
 * Proxies to tenant-service /transport/allocations.
 * Prompt #285 — Tenant-scoped via JWT (no x-tenant-id header needed).
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${TENANT_SVC}/transport/allocations`, {
      method: 'GET',
      headers: upstreamHeaders(req, 'GET /transport/allocations'),
      cache: 'no-store',
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF GET /transport/allocations] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-TRA-6001]', extractMsg(body, 'Failed to list allocations'), upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF GET /transport/allocations] fetch failed:', msg);
    return err('[ERR-TRA-6001]', msg, 503);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown;
  try { payload = await req.json(); } catch { return err('[ERR-TRA-6002]', 'Invalid JSON body', 400); }
  try {
    const upstream = await fetch(`${TENANT_SVC}/transport/allocations`, {
      method: 'POST',
      headers: upstreamHeaders(req, 'POST /transport/allocations'),
      body: JSON.stringify(payload),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF POST /transport/allocations] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-TRA-6002]', extractMsg(body, 'Failed to create allocation'), upstream.status);
    }
    return NextResponse.json(body, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF POST /transport/allocations] fetch failed:', msg);
    return err('[ERR-TRA-6002]', msg, 503);
  }
}
