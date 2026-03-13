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

function err(code: string, msg: string, status: number): NextResponse {
  return NextResponse.json({ message: `${code} ${msg}` }, { status });
}

// ── GET /api/timetable/matrix ─────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const academicYearId = searchParams.get('academicYearId') ?? '';
    const classId        = searchParams.get('classId') ?? '';
    const sectionId      = searchParams.get('sectionId') ?? '';

    const qs = new URLSearchParams({ academicYearId, classId, sectionId }).toString();
    const upstream = await fetch(`${TENANT_SVC}/timetable/matrix?${qs}`, {
      method: 'GET',
      headers: upstreamHeaders(req, 'GET /timetable/matrix'),
    });
    const body: unknown = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error(`[BFF GET /timetable/matrix] upstream ${upstream.status}:`, JSON.stringify(body));
      const b = body as Record<string, unknown> | null;
      const msg = (b && typeof b.message === 'string') ? b.message : 'Failed to load timetable matrix';
      return err('[ERR-TT-5004]', msg, upstream.status);
    }
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tenant service unavailable';
    console.error('[BFF GET /timetable/matrix] fetch failed:', msg);
    return err('[ERR-TT-5004]', msg, 503);
  }
}
