// Issue-217: BFF proxy for DELETE /api/academic/parents/mappings/:id
// tenantId isolation is enforced by the upstream tenant-service JWT guard.
import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest, label: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) headers['authorization'] = auth;
  else console.warn(`[BFF ${label}] no Authorization header — upstream will reject with 401`);
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

// ── DELETE /api/academic/parents/mappings/:id ─────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const { id } = params;
  if (!id) return err('[ERR-PSM-5004]', 'Mapping id is required', 400);
  try {
    const upstream = await fetch(`${TENANT_SVC}/academic/parents/mappings/${id}`, {
      method: 'DELETE',
      headers: upstreamHeaders(req, `DELETE /academic/parents/mappings/${id}`),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF DELETE /academic/parents/mappings/${id}] upstream ${upstream.status}:`, JSON.stringify(body));
      return err('[ERR-PSM-5004]', extractMsg(body, 'Failed to delete parent-student mapping'), upstream.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error(`[BFF DELETE /academic/parents/mappings/${id}] fetch failed:`, msg);
    return err('[ERR-PSM-5004]', msg, 503);
  }
}
