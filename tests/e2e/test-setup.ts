/**
 * test-setup.ts
 *
 * Shared bootstrap helpers for the SME Backend Kernel smoke tests.
 *
 * Responsibilities:
 *  1. Build valid JWT tokens signed with the same HS256 algorithm used by
 *     JwtTokenService (no external `jsonwebtoken` dependency — pure crypto).
 *  2. Export typed supertest agents for each microservice and the API Gateway.
 *  3. Provide fixture builders that create test tenants / users via HTTP and
 *     return their IDs and tokens.
 *  4. Export assertion helpers for RFC 7807 Problem Detail bodies.
 *
 * Prerequisites:
 *  - All services must be running (or accessible via the ports below).
 *  - Environment variable JWT_SECRET must match what the running services use.
 *    Default fallback: 'super-secret-dev-jwt-key-change-in-production'
 *
 * The helper exposes two top-level lifecycle functions:
 *   provisionFixtures()  — call in jest `beforeAll`
 *   cleanupFixtures()    — call in jest `afterAll` (best-effort)
 */

import { createHmac } from 'crypto';
import * as supertest from 'supertest';

// ─── Service URLs ─────────────────────────────────────────────────────────────

export const GATEWAY_URL  = process.env.GATEWAY_URL   ?? 'http://localhost:3000';
export const IAM_URL      = process.env.IAM_URL        ?? 'http://localhost:3001';
export const TENANT_URL   = process.env.TENANT_URL     ?? 'http://localhost:3002';
export const CONFIG_URL   = process.env.CONFIG_URL     ?? 'http://localhost:3003';
export const AUDIT_URL    = process.env.AUDIT_URL      ?? 'http://localhost:3004';

// ─── Supertest agents ─────────────────────────────────────────────────────────

export const gateway = supertest(GATEWAY_URL);
export const iam      = supertest(IAM_URL);
export const tenant   = supertest(TENANT_URL);
export const config   = supertest(CONFIG_URL);
export const audit    = supertest(AUDIT_URL);

// ─── JWT helpers ──────────────────────────────────────────────────────────────

const JWT_SECRET =
  process.env.JWT_SECRET ?? 'super-secret-dev-jwt-key-change-in-production';

function b64url(value: unknown): string {
  const json = typeof value === 'string' ? value : JSON.stringify(value);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export interface TokenClaims {
  sub: string;
  tenantId: string;
  roles: string[];
  permissions?: string[];
  sessionId?: string;
  expiresInSeconds?: number;
}

/**
 * Generates a HS256 JWT that exactly matches the format produced by
 * `JwtTokenService.issueToken()`.  Uses Node's built-in `crypto` module
 * so there are no extra test dependencies.
 */
export function generateToken(claims: TokenClaims): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresIn = claims.expiresInSeconds ?? 3600;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: claims.sub,
    tenantId: claims.tenantId,
    roles: claims.roles,
    permissions: claims.permissions ?? [],
    sessionId: claims.sessionId ?? `test-session-${Date.now()}`,
    iat: issuedAt,
    exp: issuedAt + expiresIn,
  };

  const encodedHeader  = b64url(header);
  const encodedPayload = b64url(payload);
  const signingInput   = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac('sha256', JWT_SECRET)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// ─── Well-known test-fixture identifiers ──────────────────────────────────────

export const TENANT_A = {
  id:   'aaaaaaaa-0000-0000-0000-000000000001',
  code: 'SMOKE-A',
// ...existing code...
  displayName: 'Admin B',
};

// Pre-built tokens (populated after provisionFixtures())
export let tokenA = '';
export let tokenB = '';
export let platformToken = '';

/** Shared mutable auth object — use this in test files to avoid CommonJS live-binding issues. */
export const testAuth: { platformToken: string; tokenA: string; tokenB: string } = {
  platformToken: '',
  tokenA:        '',
  tokenB:        '',
};

// ─── RFC 7807 assertion helper ────────────────────────────────────────────────

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  correlationId?: string;
  [key: string]: unknown;
}

/**
 * Asserts that `body` conforms to RFC 7807 Problem Details.
 * Validates the four mandatory fields from the task requirement:
 *   type, title, status, correlationId
 */
export function assertProblemDetail(
  body: unknown,
  expectedStatus: number,
  opts: { correlationIdRequired?: boolean } = {},
): void {
  const b = body as ProblemDetail;
  expect(typeof b.type).toBe('string');
  expect(b.type).toMatch(/^https?:\/\//);                 // must be URI
  expect(typeof b.title).toBe('string');
  expect(b.title.length).toBeGreaterThan(0);
  expect(b.status).toBe(expectedStatus);
  if (opts.correlationIdRequired !== false) {
    // correlationId is present when the CorrelationMiddleware has run
    expect(typeof b.correlationId).toBe('string');
  }
}

// ─── Fixture lifecycle ────────────────────────────────────────────────────────

/**
 * Seeds the minimum data required by the smoke tests.
 *
 * Strategy:
 *  - Attempts to create tenants and users through the IAM service's internal
 *    API using the PLATFORM_ADMIN token.
 *  - All calls are idempotent (services respond 409 if the resource already
 *    exists; we treat that as success).
 *  - Builds pre-signed JWT tokens for both school tenants and the platform.
 */
export async function provisionFixtures(): Promise<void> {
  // 1. Build static platform admin token (no DB round-trip needed for tests).
  platformToken = generateToken({
    sub:       'platform-admin-user',
    tenantId:  'platform',
    roles:     ['PLATFORM_ADMIN'],
    permissions: [
      'TENANT_CREATE', 'TENANT_MANAGE',
      'USER_CREATE', 'USER_MANAGE', 'USER_DELETE',
      'ROLE_CREATE', 'ROLE_ASSIGN',
      'CONFIG_READ', 'CONFIG_WRITE', 'CONFIG_UPDATE',
      'MODULE_ENABLE',
      'AUDIT_READ', 'AUDIT_VIEW',
      'PERMISSION_MANAGE',
    ],
    sessionId: 'platform-smoke-session',
  });

  // 2. Build school-specific tokens (used whether or not the users exist in DB)
  // ...existing code...

  // Sync into the shared mutable object so spec files always see updated values
  testAuth.platformToken = platformToken;
  testAuth.tokenA        = tokenA;
  testAuth.tokenB        = tokenB;

  // Sync to shared mutable auth object (readable across test files)
  testAuth.platformToken = platformToken;
  testAuth.tokenA        = tokenA;
  testAuth.tokenB        = tokenB;

  // 3. Ensure tenants exist in tenant-service (best-effort; tests still run)
  for (const t of [TENANT_A, TENANT_B]) {
    await tenant
      .post('/tenants')
      .set('Authorization', `Bearer ${platformToken}`)
      .set('x-correlation-id', `provision-${t.code}`)
      .send({ tenantId: t.id, tenantCode: t.code, legalName: t.name })
      .then(() => {})   // ignore result — 201 or 409 both acceptable
      .catch(() => {}); // network error means service isn't up; tests handle it
  }

  // 4. Ensure test users exist in IAM service (best-effort)
  for (const [u, t] of [[USER_A, TENANT_A], [USER_B, TENANT_B]] as const) {
    await iam
      .post('/users')
      .set('Authorization', `Bearer ${platformToken}`)
      .set('x-internal-secret', process.env.INTERNAL_SERVICE_SECRET ?? 'internal-secret-dev')
      .set('x-correlation-id', `provision-user-${t.code}`)
      .send({
        tenantId:    t.id,
        email:       u.email,
        displayName: u.displayName,
        roles:       ['SCHOOL_ADMIN'],
      })
      .then(() => {})
      .catch(() => {});
  }

  // 5. Ensure module entitlements are seeded in config-service (best-effort)
  await config
    .post(`/${TENANT_A.id}/toggle/attendance`)
    .set('Authorization', `Bearer ${platformToken}`)
    .set('x-correlation-id', 'provision-module-a')
    .send({ enabled: true })
    .then(() => {})
    .catch(() => {});
}

/**
 * Best-effort cleanup.  Failures are silently ignored because the test data
 * uses deterministic IDs and re-running the suite will simply re-use them.
 */
export async function cleanupFixtures(): Promise<void> {
  // No destructive cleanup required for smoke tests — the deterministic IDs
  // ensure idempotent re-runs.  Physical deletion would require admin APIs
  // that are out of scope for the smoke suite.
}
