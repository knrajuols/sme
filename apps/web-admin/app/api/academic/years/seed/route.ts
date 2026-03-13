import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://sme.test:3000';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = req.headers.get('x-tenant-id');
  const correlationId =
    req.headers.get('x-correlation-id') ?? crypto.randomUUID();

  const forwardHeaders: Record<string, string> = {
    Authorization: authHeader,
    'Content-Type': 'application/json',
    'x-correlation-id': correlationId,
  };
  if (tenantId) {
    forwardHeaders['x-tenant-id'] = tenantId;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/tenant/academic/years/seed`, {
      method: 'POST',
      headers: forwardHeaders,
    });
  } catch {
    return NextResponse.json(
      { message: 'Failed to reach backend service' },
      { status: 502 },
    );
  }

  const data: unknown = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
