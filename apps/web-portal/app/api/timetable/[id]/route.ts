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

// ── PATCH /api/timetable/[id] ─────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const payload = await req.json().catch(() => ({}));
    const upstream = await fetch(`${TENANT_SVC}/timetable/${params.id}`, {
      method: 'PATCH',
      headers: upstreamHeaders(req, `PATCH /timetable/${params.id}`),
      body: JSON.stringify(payload),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF PATCH /timetable/${params.id}] upstream ${upstream.status}:`, JSON.stringify(body));
      // Surface 409 Conflict exactly — UI needs the teacher conflict message
      return NextResponse.json(body, { status: upstream.status });
    }
    return NextResponse.json(body, { status: upstream.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error(`[BFF PATCH /timetable/${params.id}] fetch failed:`, msg);
    return err('[ERR-TT-5002]', msg, 503);
  }
}

// ── DELETE /api/timetable/[id] ────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${TENANT_SVC}/timetable/${params.id}`, {
      method: 'DELETE',
      headers: upstreamHeaders(req, `DELETE /timetable/${params.id}`),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF DELETE /timetable/${params.id}] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-TT-5003]', extractMsg(body, 'Failed to delete timetable entry'), upstream.status);
    }
    return NextResponse.json(body, { status: upstream.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error(`[BFF DELETE /timetable/${params.id}] fetch failed:`, msg);
    return err('[ERR-TT-5003]', msg, 503);
  }
}
