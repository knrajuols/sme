/**
 * [BFF-AUTH-001] Staff Login proxy — POST only.
 * Proxies to tenant-service /auth/staff/login.
 * Injects tenantCode from the x-sme-subdomain header set by middleware.
 */
import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function err(code: string, msg: string, status: number): NextResponse {
  return NextResponse.json({ message: `${code} ${msg}` }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return err('[ERR-AUTH-5001]', 'Invalid JSON body', 400);
  }

  // Inject tenantCode from subdomain header (set by Next.js middleware)
  const tenantCode = req.headers.get('x-sme-subdomain');
  if (!tenantCode) {
    return err('[ERR-AUTH-5002]', 'Tenant context not available — access via school subdomain', 400);
  }

  payload.tenantCode = tenantCode;

  try {
    const upstream = await fetch(`${TENANT_SVC}/auth/staff/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const b = body as Record<string, unknown>;
      const msg = typeof b?.message === 'string' ? b.message : 'Login failed';
      return NextResponse.json({ message: msg }, { status: upstream.status });
    }
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Authentication service unavailable';
    console.error('[BFF POST /auth/staff/login] fetch failed:', msg);
    return err('[ERR-AUTH-5001]', msg, 503);
  }
}
