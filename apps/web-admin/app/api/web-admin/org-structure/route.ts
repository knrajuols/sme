/**
 * [BFF-WA-ORG-001] Org Structure proxy — GET.
 * Proxies to tenant-service GET /web-admin/org-structure.
 */
import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest, label: string): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) h['authorization'] = auth;
  else console.warn(`[BFF ${label}] no Authorization header — upstream will reject with 401`);
  const corr = req.headers.get('x-correlation-id');
  if (corr) h['x-correlation-id'] = corr;
  return h;
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

// ── GET /api/web-admin/org-structure ──────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const up = await fetch(`${TENANT_SVC}/web-admin/org-structure`, {
      method: 'GET',
      headers: upstreamHeaders(req, 'GET /web-admin/org-structure'),
      cache: 'no-store',
    });
    const body: unknown = await up.json().catch(() => ({}));
    if (!up.ok) {
      console.error(`[BFF GET /web-admin/org-structure] upstream ${up.status}:`, JSON.stringify(body));
      return err('[ERR-WA-ORG-5001]', extractMsg(body, 'Failed to list org structure'), up.status);
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF GET /web-admin/org-structure] fetch failed:', msg);
    return err('[ERR-WA-ORG-5001]', msg, 503);
  }
}
