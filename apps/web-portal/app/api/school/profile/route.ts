import { NextRequest, NextResponse } from 'next/server';

// Internal service URL — never exposed to the browser client
const INTERNAL_API = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────
function upstreamHeaders(req: NextRequest, routeLabel: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) {
    headers['authorization'] = auth;
  } else {
    // No Bearer token on the incoming request — the upstream JWT guard will return 401.
    // This is the primary cause of auth regressions: the client failed to attach the token.
    console.warn(`[BFF ${routeLabel}] no Authorization header on incoming request — upstream will reject with 401`);
  }
  const correlationId = req.headers.get('x-correlation-id');
  if (correlationId) headers['x-correlation-id'] = correlationId;
  return headers;
}

/**
 * Extract error message from upstream response body.
 * Handles both RFC 7807 Problem Details (api-gateway format: { detail, title, status })
 * and plain { message } format.
 */
function extractUpstreamError(body: unknown, httpStatus: number, fallback: string): string {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return fallback;

  // RFC 7807 Problem Details (api-gateway HttpExceptionFilter)
  if (typeof b.detail === 'string' && b.detail) {
    const title = typeof b.title === 'string' ? b.title : String(httpStatus);
    return `${title}: ${b.detail}`;
  }

  // Plain message (NestJS default / validation errors)
  if (typeof b.message === 'string' && b.message) return b.message;
  if (Array.isArray(b.message)) return (b.message as string[]).join('; ');

  return fallback;
}

function errorResponse(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ message: `${code} ${message}` }, { status });
}

// ── GET /api/school/profile ───────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${INTERNAL_API}/school/profile`, {
      method: 'GET',
      headers: upstreamHeaders(req, 'GET /school/profile'),
      cache: 'no-store',
    });

    const body: unknown = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const msg = extractUpstreamError(body, upstream.status, 'Failed to fetch school profile');
      console.error(`[BFF GET /school/profile] upstream ${upstream.status}:`, JSON.stringify(body));
      return errorResponse('[ERR-SCH-PROF-5001]', msg, upstream.status);
    }

    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'School profile service unavailable';
    console.error('[BFF GET /school/profile] fetch failed:', msg);
    return errorResponse('[ERR-SCH-PROF-5001]', msg, 503);
  }
}

// ── PATCH /api/school/profile ─────────────────────────────────────────────────
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return errorResponse('[ERR-SCH-PROF-5002]', 'Invalid JSON body', 400);
  }

  try {
    const upstream = await fetch(`${INTERNAL_API}/school/profile`, {
      method: 'PATCH',
      headers: upstreamHeaders(req, 'PATCH /school/profile'),
      body: JSON.stringify(payload),
    });

    const body: unknown = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const msg = extractUpstreamError(body, upstream.status, 'Failed to update school profile');
      console.error(`[BFF PATCH /school/profile] upstream ${upstream.status}:`, JSON.stringify(body));
      // On conflict (409) pass through the machine-readable `code` and `field` so the
      // frontend can display inline field-level errors instead of a generic banner.
      if (upstream.status === 409) {
        const b = body as Record<string, unknown> | null;
        return NextResponse.json(
          {
            message: `[ERR-SCH-PROF-5002] ${msg}`,
            code: b && typeof b.code === 'string' ? b.code : 'CONFLICT',
            field: b && typeof b.field === 'string' ? b.field : undefined,
          },
          { status: 409 },
        );
      }
      return errorResponse('[ERR-SCH-PROF-5002]', msg, upstream.status);
    }

    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'School profile update service unavailable';
    console.error('[BFF PATCH /school/profile] fetch failed:', msg);
    return errorResponse('[ERR-SCH-PROF-5002]', msg, 503);
  }
}
