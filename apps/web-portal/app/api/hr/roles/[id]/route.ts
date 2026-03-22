/**
 * [BFF-HR-004] HR Roles by ID proxy — PATCH (update) + DELETE (soft-delete).
 * Proxies to tenant-service /hr/roles/:id.
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

interface RouteParams { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  let payload: unknown;
  try { payload = await req.json(); } catch { return err('[ERR-ROL-5003]', 'Invalid JSON body', 400); }
  try {
    const upstream = await fetch(`${TENANT_SVC}/hr/roles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: upstreamHeaders(req, `PATCH /hr/roles/${id}`),
      body: JSON.stringify(payload),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF PATCH /hr/roles/${id}] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-ROL-5003]', extractMsg(body, 'Failed to update role'), upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    return err('[ERR-ROL-5003]', msg, 503);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  try {
    const upstream = await fetch(`${TENANT_SVC}/hr/roles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: upstreamHeaders(req, `DELETE /hr/roles/${id}`),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF DELETE /hr/roles/${id}] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-ROL-5004]', extractMsg(body, 'Failed to delete role'), upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    return err('[ERR-ROL-5004]', msg, 503);
  }
}
