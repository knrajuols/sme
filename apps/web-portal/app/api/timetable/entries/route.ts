import { NextRequest, NextResponse } from 'next/server';

const TENANT_SVC = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

function upstreamHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) headers['authorization'] = auth;
  const corr = req.headers.get('x-correlation-id');
  if (corr) headers['x-correlation-id'] = corr;
  return headers;
}

// ── GET /api/timetable/entries?academicYearId= ─────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const academicYearId = searchParams.get('academicYearId') ?? '';

    const upstream = await fetch(
      `${TENANT_SVC}/timetable/entries?academicYearId=${encodeURIComponent(academicYearId)}`,
      { headers: upstreamHeaders(req) },
    );
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ message: 'BFF error fetching timetable entries' }, { status: 502 });
  }
}
