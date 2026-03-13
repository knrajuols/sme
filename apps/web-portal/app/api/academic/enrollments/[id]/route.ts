import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest, routeLabel: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) {
    headers['authorization'] = auth;
  } else {
    console.warn(`[BFF ${routeLabel}] no Authorization header — upstream will reject with 401`);
  }
  const corr = req.headers.get('x-correlation-id');
  if (corr) headers['x-correlation-id'] = corr;
  return headers;
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── GET /api/academic/enrollments/[id] ───────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  try {
    const upstream = await fetch(`${TENANT_SVC}/academic/enrollments/${id}`, {
      method: 'GET',
      headers: upstreamHeaders(req, `GET /academic/enrollments/${id}`),
      cache: 'no-store',
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF GET /academic/enrollments/${id}] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-ENR-5003]', extractMsg(body, 'Enrollment not found'), upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error(`[BFF GET /academic/enrollments/${id}] fetch failed:`, msg);
    return err('[ERR-ENR-5003]', msg, 503);
  }
}

// ── PATCH /api/academic/enrollments/[id] ─────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return err('[ERR-ENR-5004]', 'Invalid JSON body', 400);
  }
  try {
    const upstream = await fetch(`${TENANT_SVC}/academic/enrollments/${id}`, {
      method: 'PATCH',
      headers: upstreamHeaders(req, `PATCH /academic/enrollments/${id}`),
      body: JSON.stringify(payload),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF PATCH /academic/enrollments/${id}] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-ENR-5004]', extractMsg(body, 'Failed to update enrollment'), upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error(`[BFF PATCH /academic/enrollments/${id}] fetch failed:`, msg);
    return err('[ERR-ENR-5004]', msg, 503);
  }
}

// ── DELETE /api/academic/enrollments/[id] ────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  try {
    const upstream = await fetch(`${TENANT_SVC}/academic/enrollments/${id}`, {
      method: 'DELETE',
      headers: upstreamHeaders(req, `DELETE /academic/enrollments/${id}`),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF DELETE /academic/enrollments/${id}] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-ENR-5005]', extractMsg(body, 'Failed to delete enrollment'), upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error(`[BFF DELETE /academic/enrollments/${id}] fetch failed:`, msg);
    return err('[ERR-ENR-5005]', msg, 503);
  }
}
