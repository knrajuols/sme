import { NextRequest, NextResponse } from 'next/server';

const API = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';

async function proxy(req: NextRequest, method: string, id: string) {
  const upstream = `${API}/academic/holidays/${id}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) headers['authorization'] = auth;
  const corr = req.headers.get('x-correlation-id');
  if (corr) headers['x-correlation-id'] = corr;

  const opts: RequestInit = { method, headers };
  if (method === 'PATCH') {
    opts.body = await req.text();
  }

  const res = await fetch(upstream, opts);
  const json = await res.json();

  if (!res.ok) {
    const msg = json?.message ?? `[ERR-PT-HOLID-0001] Upstream ${method} failed`;
    return NextResponse.json({ error: msg }, { status: res.status });
  }
  return NextResponse.json(json?.data ?? json);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxy(req, 'PATCH', id);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxy(req, 'DELETE', id);
}
