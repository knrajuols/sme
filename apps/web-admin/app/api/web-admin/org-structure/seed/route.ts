/**
 * [BFF-WA-ORG-002] Org Structure seed proxy — POST.
 * Proxies to tenant-service POST /web-admin/org-structure/seed.
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

// ── POST /api/web-admin/org-structure/seed ────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${TENANT_SVC}/web-admin/org-structure/seed`, {
      method: 'POST',
      headers: upstreamHeaders(req, 'POST /web-admin/org-structure/seed'),
      body: '{}',
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('[BFF POST /web-admin/org-structure/seed] upstream', upstream.status, JSON.stringify(body));
      return err('[ERR-WA-ORG-5002]', extractMsg(body, 'Failed to seed org structure'), upstream.status);
    }
    return NextResponse.json(body, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF POST /web-admin/org-structure/seed] fetch failed:', msg);
    return err('[ERR-WA-ORG-5002]', msg, 503);
  }
}
