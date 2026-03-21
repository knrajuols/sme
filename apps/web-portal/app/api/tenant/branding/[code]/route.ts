/**
 * [PUB-BFF-001] Public tenant branding BFF route.
 *
 * Called by the login page BEFORE the user has authenticated.
 * Proxies to the tenant-service's public `GET /tenants/branding/:code` endpoint.
 * No Authorization header is attached — this is deliberately unauthenticated.
 *
 * IMPORTANT: Targets TENANT_SERVICE_URL (port 3002) directly because the API
 * Gateway does not expose a wildcard proxy — it only has explicitly-declared
 * routes, and `/tenants/branding/:code` is not among them.
 *
 * Returns:
 *   200  { schoolName, tenantCode, logoUrl }
 *   200  { notFound: true }     ← tenant not found or upstream error
 */
import { NextRequest, NextResponse } from 'next/server';

const TENANT_API = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } },
): Promise<NextResponse> {
  const { code } = params;

  // Sanitise: allow only alphanumeric + hyphens to prevent path traversal.
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(code)) {
    return NextResponse.json({ notFound: true }, { status: 200 });
  }

  try {
    const upstream = await fetch(
      `${TENANT_API}/tenants/branding/${encodeURIComponent(code)}`,
      {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
      },
    );

    if (!upstream.ok) {
      return NextResponse.json({ notFound: true }, { status: 200 });
    }

    // The tenant-service wraps every response in a standard envelope:
    //   { status: "success", message: "...", data: { schoolName, tenantCode, logoUrl } }
    // Unwrap the `data` field so the frontend receives a flat branding object.
    const envelope = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;

    const inner = (typeof envelope.data === 'object' && envelope.data !== null ? envelope.data : envelope) as {
      schoolName?: string;
      tenantCode?: string;
      logoUrl?: string | null;
      notFound?: boolean;
    };

    if (inner.notFound || !inner.schoolName) {
      return NextResponse.json({ notFound: true }, { status: 200 });
    }

    return NextResponse.json(
      { schoolName: inner.schoolName, tenantCode: inner.tenantCode, logoUrl: inner.logoUrl ?? null },
      { status: 200 },
    );
  } catch {
    // Upstream unreachable — let the login page degrade gracefully.
    return NextResponse.json({ notFound: true }, { status: 200 });
  }
}
