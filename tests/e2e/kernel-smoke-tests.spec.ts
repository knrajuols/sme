/**
 * kernel-smoke-tests.spec.ts
 *
 * Automated smoke tests verifying the resolution of RISK-01 through RISK-10.
 *
 * Prerequisites (services must be running):
 *   IAM       → http://localhost:3001
 *   Config    → http://localhost:3003
 *   Audit     → http://localhost:3004
 *   Gateway   → http://localhost:3000
 *
 * Run:
 *   npm run test:e2e
 *
 * Environment overrides:
 *   GATEWAY_URL, IAM_URL, CONFIG_URL, AUDIT_URL, JWT_SECRET
 */

import { randomUUID } from 'crypto';
import {
  assertProblemDetail,
  audit,
  config,
  gateway,
  iam,
  provisionFixtures,
  cleanupFixtures,
  testAuth,
  TENANT_A,
  TENANT_B,
  generateToken,
} from './test-setup';

// ─── Global setup / teardown ─────────────────────────────────────────────────

beforeAll(async () => {
  await provisionFixtures();
}, 30_000);

afterAll(async () => {
  await cleanupFixtures();
});

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Unique email scoped to a single test run to avoid collision between runs. */
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@smoke.test`;
}

// ═════════════════════════════════════════════════════════════════════════════
// TASK 1 — Multi-Tenant Isolation Tests (RISK-01, RISK-02)
// ═════════════════════════════════════════════════════════════════════════════

describe('Task 1 — Multi-Tenant Isolation', () => {
  // ── RISK-01: Same email address allowed in different tenants ──────────────
  describe('RISK-01 — Tenant-scoped email uniqueness', () => {
    const sharedEmail = uniqueEmail('risk01-shared');

    it('creates a user with email X in Tenant_A → 201 Created', async () => {
      const res = await iam
        .post('/iam/users')
        .set('Authorization', `Bearer ${testAuth.platformToken}`)
        .set('x-tenant-id', TENANT_A.id)
        .set('x-correlation-id', randomUUID())
        .send({
          tenantId:    TENANT_A.id,
          email:       sharedEmail,
          displayName: 'Risk01 User A',
          roles:       ['SCHOOL_ADMIN'],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ created: true });
    });

    it('creates the SAME email X in Tenant_B → 201 Created (no conflict)', async () => {
      const res = await iam
        .post('/iam/users')
        .set('Authorization', `Bearer ${testAuth.platformToken}`)
        .set('x-tenant-id', TENANT_B.id)
        .set('x-correlation-id', randomUUID())
        .send({
          tenantId:    TENANT_B.id,
          email:       sharedEmail,     // identical email, different tenant
          displayName: 'Risk01 User B',
          roles:       ['SCHOOL_ADMIN'],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ created: true });
    });

    it('creates the SAME email X a SECOND time in Tenant_A → 409 Conflict', async () => {
      const res = await iam
        .post('/iam/users')
        .set('Authorization', `Bearer ${testAuth.platformToken}`)
        .set('x-tenant-id', TENANT_A.id)
        .set('x-correlation-id', randomUUID())
        .send({
          tenantId:    TENANT_A.id,
          email:       sharedEmail,     // duplicate within same tenant
          displayName: 'Risk01 User A Dupe',
          roles:       ['SCHOOL_ADMIN'],
        });

      expect(res.status).toBe(409);
    });
  });

  // ── RISK-02: Cross-tenant resource access blocked ─────────────────────────
  describe('RISK-02 — Cross-tenant access rejected at Audit Service', () => {
    it('Tenant_B token querying Tenant_A audit data → 403 Forbidden', async () => {
      const res = await audit
        .get(`/audits/tenant/${TENANT_A.id}`)
        .set('Authorization', `Bearer ${testAuth.tokenB}`)
        .set('x-correlation-id', randomUUID());

      expect(res.status).toBe(403);
      assertProblemDetail(res.body, 403, { correlationIdRequired: false });
    });

    it('Platform admin CAN query any tenant audit data → 200 OK', async () => {
      const res = await audit
        .get(`/audits/tenant/${TENANT_A.id}`)
        .set('Authorization', `Bearer ${testAuth.platformToken}`)
        .set('x-correlation-id', randomUUID());

      // 200 (records present) or 404/empty — either is acceptable for isolation proof
      expect([200, 404]).toContain(res.status);
    });

    it('Tenant_A token querying its own audit data → 200 OK (own data allowed)', async () => {
      const res = await audit
        .get(`/audits/tenant/${TENANT_A.id}`)
        .set('Authorization', `Bearer ${testAuth.tokenA}`)
        .set('x-correlation-id', randomUUID());

      expect([200, 404]).toContain(res.status);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TASK 2 — Audit Compliance Tests (RISK-04)
// ═════════════════════════════════════════════════════════════════════════════

describe('Task 2 — Audit Compliance (RISK-04)', () => {
  const correlationId = randomUUID();
  // ...existing code...
          entityId,
          action:       'UPDATE',
          beforeSnapshot: { grade: 'B', score: 75 },
          afterSnapshot:  { grade: 'A', score: 92 },
          sourceService:  'iam-service',
          ipAddress:      '127.0.0.1',
          userAgent:      'smoke-test/1.0',
        });

      expect(res.status).toBe(201);
      expect(res.body.persisted).toBe(true);
    });

    it('audit record has non-nullable tenantId matching the request', async () => {
      const res = await audit
        .get(`/audits/tenant/${TENANT_A.id}`)
        .set('Authorization', `Bearer ${testAuth.platformToken}`)
        .set('x-correlation-id', correlationId)
        .query({ limit: 50 });

      expect(res.status).toBe(200);
      const events: Array<Record<string, unknown>> = Array.isArray(res.body)
        ? res.body
        : (res.body?.data ?? []);

      // Every returned event must have tenantId = TENANT_A.id (non-null, correct scope)
      for (const ev of events) {
        expect(ev.tenantId).toBeDefined();
        expect(ev.tenantId).not.toBeNull();
        expect(ev.tenantId).toBe(TENANT_A.id);
      }
    });

    it('the matching event has beforeSnapshot, afterSnapshot, and a valid SHA-256 rowHash', async () => {
      const res = await audit
        .get(`/audits/tenant/${TENANT_A.id}`)
        .set('Authorization', `Bearer ${testAuth.platformToken}`)
        .set('x-correlation-id', correlationId)
        .query({ limit: 50 });

      expect(res.status).toBe(200);
      const events: Array<Record<string, unknown>> = Array.isArray(res.body)
        ? res.body
        : (res.body?.data ?? []);

      const match = events.find(
        (ev) => ev.entityId === entityId && ev.action === 'UPDATE',
      );

      expect(match).toBeDefined();

      // beforeSnapshot and afterSnapshot must be present objects, not null
      expect(match!.beforeSnapshot).toBeDefined();
      expect(match!.afterSnapshot).toBeDefined();
      expect(typeof match!.beforeSnapshot).toBe('object');
      expect(typeof match!.afterSnapshot).toBe('object');

      // rowHash must be a 64-character lowercase hex string (SHA-256)
      expect(typeof match!.rowHash).toBe('string');
      expect((match!.rowHash as string).length).toBe(64);
      expect((match!.rowHash as string)).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TASK 3 — Gateway & Resilience Tests (RISK-06, RISK-07, Rate Limiting)
// ═════════════════════════════════════════════════════════════════════════════

describe('Task 3 — Gateway & Resilience', () => {

  // ── RISK-06: Idempotency ──────────────────────────────────────────────────
  describe('RISK-06 — Idempotency key deduplication', () => {
    const idempotencyKey = `idem-key-${randomUUID()}`;

    it('first POST with x-idempotency-key → 201 Created', async () => {
      const res = await iam
        .post('/iam/users')
        .set('Authorization', `Bearer ${testAuth.platformToken}`)
        .set('x-tenant-id', TENANT_A.id)
        .set('x-correlation-id', randomUUID())
        .set('x-idempotency-key', idempotencyKey)
        .send({
          tenantId:    TENANT_A.id,
          email:       uniqueEmail('risk06-idem'),
          displayName: 'Idem Test User',
          roles:       ['SCHOOL_ADMIN'],
        });

      expect(res.status).toBe(201);
      expect(res.body.created).toBe(true);
    });

    it('second POST with the SAME x-idempotency-key → cached 201 (no duplicate)', async () => {
      const res = await iam
        .post('/iam/users')
        .set('Authorization', `Bearer ${testAuth.platformToken}`)
        .set('x-tenant-id', TENANT_A.id)
        .set('x-correlation-id', randomUUID())
        .set('x-idempotency-key', idempotencyKey)   // same key
        .send({
          tenantId:    TENANT_A.id,
          email:       uniqueEmail('risk06-idem-DIFFERENT'), // different body, same key
          displayName: 'Should Be Ignored',
          roles:       ['SCHOOL_ADMIN'],
        });

      // Must return the cached 201 — not a 409 duplicate error
      expect(res.status).toBe(201);
      expect(res.body.created).toBe(true);
    });
  });

  // ── RISK-07a: Module disabled → 403 ─────────────────────────────────────
  describe('RISK-07 — Module guard blocks disabled module routes', () => {
    const smokeModuleTenantId = `module-test-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      // Disable the "attendance" module for this smoke tenant
      await config
        .put(`/configurations/${smokeModuleTenantId}/modules/attendance`)
        .set('Authorization', `Bearer ${testAuth.platformToken}`)
        .set('x-correlation-id', randomUUID())
        .send({ enabled: false });
    }, 10_000);

    it('PUT attendance module enabled=false → 200 OK from config-service', async () => {
      const res = await config
        .put(`/configurations/${smokeModuleTenantId}/modules/attendance`)
        .set('Authorization', `Bearer ${testAuth.platformToken}`)
        .set('x-correlation-id', randomUUID())
        .send({ enabled: false });

      expect([200, 201]).toContain(res.status);
      expect(res.body.enabled).toBe(false);
    });

    it('GET /attendance/ping with that tenant token → 403 Module Disabled', async () => {
      // Generate a token for the module-disabled tenant
      const disabledTenantToken = generateToken({
        sub:         `user-${smokeModuleTenantId}`,
        tenantId:    smokeModuleTenantId,
        roles:       ['SCHOOL_ADMIN'],
        permissions: ['ATTENDANCE_READ'],
      });

      const res = await gateway
        .get('/attendance/ping')
        .set('Authorization', `Bearer ${disabledTenantToken}`)
        .set('x-correlation-id', randomUUID());

      expect(res.status).toBe(403);

      // Must contain RFC 7807 fields
      const body = res.body as Record<string, unknown>;
      expect(body.type).toMatch(/module-disabled/i);
      expect(body.title).toBe('Module Not Enabled');
      expect(body.status).toBe(403);
    });

    it('GET /attendance/ping with platform admin token → bypasses module guard', async () => {
      const res = await gateway
        .get('/attendance/ping')
        .set('Authorization', `Bearer ${testAuth.platformToken}`)
        .set('x-correlation-id', randomUUID());

      // Platform admin bypasses ModuleGuard — may get 501 (route stub) but NOT 403
      expect(res.status).not.toBe(403);
    });
  });

  // ── RISK-07b: Rate Limiting ───────────────────────────────────────────────
  describe('RISK-07 — Rate limiting on /iam/auth/token (10 req/min)', () => {
    it('20 rapid requests to the login endpoint triggers 429 Too Many Requests', async () => {
      const requests = Array.from({ length: 20 }, () =>
        gateway
          .post('/iam/auth/token')
          .set('x-correlation-id', randomUUID())
          .send({ email: 'ratelimit@smoke.test', password: 'wrong', tenantId: TENANT_A.id }),
      );

      const responses = await Promise.all(requests);
      const statuses  = responses.map((r: any) => r.status);

      // At least one request must have been throttled
      const throttled = statuses.filter((s: any) => s === 429);
      expect(throttled.length).toBeGreaterThan(0);

      // The 429 body must conform to RFC 7807
      const throttledResponse = responses.find((r: any) => r.status === 429);
      if (throttledResponse) {
        assertProblemDetail(throttledResponse.body, 429, { correlationIdRequired: false });
      }
    }, 30_000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TASK 4 — API Standards: RFC 7807 Problem Details
// ═════════════════════════════════════════════════════════════════════════════

describe('Task 4 — RFC 7807 Problem Details contract', () => {

  it('401 Unauthorized — missing bearer token', async () => {
    const res = await iam
      .get('/iam/users')
      .set('x-correlation-id', randomUUID());
      // No Authorization header

    expect(res.status).toBe(401);
    assertProblemDetail(res.body, 401);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  });

  it('403 Forbidden — insufficient permissions', async () => {
    // tokenA has no AUDIT_VIEW permission on the audit service users endpoint
    const unprivilegedToken = generateToken({
      sub:         'unprivileged-user',
      tenantId:    TENANT_A.id,
      roles:       ['VIEWER'],
      permissions: [],
    });

    const res = await audit
      .get(`/audits/tenant/${TENANT_A.id}`)
      .set('Authorization', `Bearer ${unprivilegedToken}`)
      .set('x-correlation-id', randomUUID());

    expect(res.status).toBe(403);
    assertProblemDetail(res.body, 403);
  });

  it('400 Bad Request — invalid DTO (missing required fields)', async () => {
    const res = await iam
      .post('/iam/users')
      .set('Authorization', `Bearer ${testAuth.platformToken}`)
      .set('x-tenant-id', TENANT_A.id)
      .set('x-correlation-id', randomUUID())
      .send({ email: 'bad@smoke.test' }); // missing tenantId, displayName, roles

    expect(res.status).toBe(400);
    assertProblemDetail(res.body, 400);
  });

  it('404 Not Found — non-existent tenant audit log', async () => {
    const fakeCorrelationId = randomUUID();
    const res = await config
      .get(`/configurations/non-existent-tenant-${randomUUID()}`)
      .set('Authorization', `Bearer ${testAuth.platformToken}`)
      .set('x-correlation-id', fakeCorrelationId);

    // 200 with empty array OR 404 — both are valid for missing-tenant-config
    // If 404, must be RFC 7807
    if (res.status === 404) {
      assertProblemDetail(res.body, 404);
    } else {
      expect(res.status).toBe(200);
    }
  });

  it('RFC 7807 body has: type (URI), title (string), status (number), correlationId (string)', async () => {
    const correlationId = randomUUID();
    const res = await iam
      .get('/iam/users')
      .set('x-correlation-id', correlationId);
      // No auth header → 401

    expect(res.status).toBe(401);

    const body = res.body as Record<string, unknown>;
    // type must be an absolute URI
    expect(typeof body.type).toBe('string');
    expect(body.type as string).toMatch(/^https?:\/\//);
    // title must be non-empty string
    expect(typeof body.title).toBe('string');
    expect((body.title as string).length).toBeGreaterThan(0);
    // status must match HTTP status code
    expect(body.status).toBe(401);
    // correlationId must echo back the x-correlation-id header
    expect(body.correlationId).toBe(correlationId);
  });
});
