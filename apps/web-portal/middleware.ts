/**
 * Next.js Edge Middleware — SME subdomain routing (Zero-Nginx / port-based)
 *
 * URL structure (local dev):
 *   http://sme.test:3102/register         → School self-registration (main domain only)
 *   http://sme.test:3102/smeadmin         → Platform Admin login (secret, unlinked)
 *   http://SCHOOL.sme.test:3102/login     → School login (subdomain only)
 *   http://SCHOOL.sme.test:3102/dashboard → School dashboard (subdomain only)
 *
 * Guards enforced by this middleware:
 *   - Main domain /login or /dashboard     → redirected to /school-not-found
 *   - School subdomain /register           → redirected to main domain /register
 *   - School subdomain /smeadmin           → redirected to main domain /smeadmin
 *
 * TODO (Production Migration):
 *   - Change BASE_DOMAIN env var to your real domain (e.g. 'yourplatform.com')
 *   - Remove port logic — production runs on port 80/443, no port in URLs
 *   - Wildcard DNS (*.yourplatform.com) replaces the Windows hosts file entirely
 */

import { NextRequest, NextResponse } from 'next/server';

// ── Config ────────────────────────────────────────────────────────────────────
// TODO (Production): change to your real domain via NEXT_PUBLIC_BASE_DOMAIN env var
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'sme.test';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';

  // Split host into hostname and port
  // e.g. "greenvalley.sme.test:3102" → hostname="greenvalley.sme.test", port="3102"
  const [hostname, port = ''] = host.split(':');

  // Reconstruct port suffix for use in redirect URLs
  // e.g. port="3102" → portSuffix=":3102"  |  port="" → portSuffix=""
  const portSuffix = port ? `:${port}` : '';

  // ── Detect subdomain ──────────────────────────────────────────────────────
  let subdomain: string | null = null;

  if (hostname.endsWith(`.${BASE_DOMAIN}`)) {
    // "greenvalley.sme.test" → subdomain = "greenvalley"
    subdomain = hostname.slice(0, hostname.length - BASE_DOMAIN.length - 1);
  }

  // Reject empty or obviously invalid subdomains
  if (subdomain !== null && subdomain.trim() === '') {
    subdomain = null;
  }

  const requestHeaders = new Headers(request.headers);

  if (subdomain) {
    // School portal request — inject tenant context
    requestHeaders.set('x-sme-subdomain', subdomain);
    requestHeaders.set('x-sme-context', 'school');
  } else {
    // Main site (sme.test) — clear any stale headers
    requestHeaders.delete('x-sme-subdomain');
    requestHeaders.set('x-sme-context', 'main');
  }

  // ── Route guards ─────────────────────────────────────────────────────────
  const pathname = request.nextUrl.pathname;

  // Guard: school subdomain must not access /register or /smeadmin
  // Redirect them to the main site, preserving the port
  if (subdomain && (pathname.startsWith('/register') || pathname.startsWith('/smeadmin'))) {
    return NextResponse.redirect(
      new URL(pathname, `http://${BASE_DOMAIN}${portSuffix}`)
    );
  }

  // School subdomain root → serve admin dashboard content at / (URL stays clean)
  if (subdomain && pathname === '/') {
    return NextResponse.rewrite(new URL('/admin/dashboard', request.url), { request: { headers: requestHeaders } });
  }

  // Guard: main site must not access school-only routes
  if (!subdomain && (pathname.startsWith('/login') || pathname.startsWith('/admin') || pathname.startsWith('/portal'))) {
    return NextResponse.redirect(new URL('/school-not-found', request.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
