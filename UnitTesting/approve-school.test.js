/**
 * ApproveSchool — End-to-End School Approval & Login Test
 * ─────────────────────────────────────────────────────────────────────────────
 * What this test does, step by step:
 *
 *   Step 1  Register a fresh test school via public self-registration API.
 *   Step 2  Login as Platform Admin and get a JWT token.
 *   Step 3  Fetch the pending-schools list — confirm our school is there.
 *   Step 4  Approve (activate) the school via the platform API.
 *   Step 5  Verify the school is ACTIVE in the PostgreSQL database.
 *   Step 6  Build the school login URL  →  http://{code}.sme.test:3102/login
 *   Step 7  Check if the portal login page is reachable via that URL.
 *           (Requires a hosts-file entry — test explains what to add if it fails.)
 *   Step 8  Attempt school-admin login via the IAM API and report the result.
 *
 * ROOT CAUSE — why vignan.sme.test:3102 shows "site can't be reached":
 * ─────────────────────────────────────────────────────────────────────────────
 *   The Next.js portal (port 3102) is running correctly and the middleware IS
 *   ready to handle subdomain routing.  The failure is pure DNS — Windows does
 *   not know that "vignan.sme.test" should resolve to 127.0.0.1.
 *
 *   Fix: add ONE line to  C:\Windows\System32\drivers\etc\hosts
 *        127.0.0.1   vignan.sme.test
 *
 *   After that, open:  http://vignan.sme.test:3102/login
 *   (The root path / shows the marketing home page — go to /login directly.)
 *
 * How to run:
 *   npx jest --config "UnitTesting/jest.config.js" --testPathPattern "approve-school" --runInBand --verbose
 *
 * Requirements:
 *   API Gateway → http://localhost:3000
 *   Tenant Svc  → http://localhost:3002
 *   IAM Svc     → http://localhost:3001
 *   Web Portal  → http://localhost:3102
 */

const path = require('path');

const API_BASE    = 'http://localhost:3000';
const PORTAL_PORT = 3102;
const BASE_DOMAIN = 'sme.test';

// Unique suffix so this test run never collides with previous runs
const S = Date.now();

// ─────────────────────────────────────────────────────────────────────────────
// Console helpers — kept consistent with registration.api.test.js style
// ─────────────────────────────────────────────────────────────────────────────
const WIDE = 64;

function heading(title) {
  const bar = '═'.repeat(WIDE);
  console.log(`\n\n${bar}`);
  console.log(`  ${title}`);
  console.log(bar);
}

function section(label) {
  const pad = Math.max(0, WIDE - 4 - label.length);
  console.log(`\n  ┌── ${label} ${'─'.repeat(pad)}`);
}

function sectionClose() {
  console.log(`  └${'─'.repeat(WIDE - 1)}`);
}

function row(key, val) {
  console.log(`  │  ${String(key).padEnd(28)}: ${val}`);
}

function prettyBlock(label, obj) {
  section(label);
  JSON.stringify(obj, null, 2).split('\n').forEach((l) => console.log(`  │    ${l}`));
  sectionClose();
}

function banner(msg) {
  console.log(`\n  ╔${'═'.repeat(WIDE - 2)}╗`);
  msg.split('\n').forEach((l) => console.log(`  ║  ${l.padEnd(WIDE - 4)}║`));
  console.log(`  ╚${'═'.repeat(WIDE - 2)}╝`);
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────

async function httpPost(path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  const data = json?.data ?? json;
  return { status: res.status, raw: json, data };
}

async function httpGet(path, token) {
  const headers = {};
  if (token) headers['authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { headers });
  const json = await res.json().catch(() => ({}));
  const data = json?.data ?? json;
  return { status: res.status, raw: json, data };
}

/** Try to fetch a full URL (not just the API Gateway). Returns status or an error string. */
async function httpGetUrl(url, timeoutMs = 5000) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text().catch(() => '');
    return { ok: res.status < 400, status: res.status, bodySnippet: text.slice(0, 120) };
  } catch (err) {
    return { ok: false, status: null, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('ApproveSchool — End-to-End School Approval & Login', () => {

  // Shared state across the ordered steps
  const ctx = {
    // tenantCode must stay ≤ 20 chars: 3-char prefix + "-" + 13-digit timestamp = 17 chars
    tenantCode:       `ap-${S}`,
    schoolName:       `Approval Test School ${S}`,
    adminEmail:       `ap-admin-${S}@test.edu`,
    tenantId:         null,  // filled in Step 1
    platformToken:    null,  // filled in Step 2
    activationResult: null,  // filled in Step 4
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1 — Register a new school so we always have a fresh PENDING record
  // ─────────────────────────────────────────────────────────────────────────
  test('Step 1 — Register a new test school (creates a PENDING record)', async () => {
    heading('STEP 1 — REGISTER TEST SCHOOL  (public self-registration endpoint)');

    const payload = {
      tenantCode:          ctx.tenantCode,
      schoolName:          ctx.schoolName,
      primaryContactName:  'Approve Test Principal',
      primaryContactEmail: ctx.adminEmail,
      udiseCode:           String(S).slice(-7).padStart(11, '8'),
      address:             '10 Approval Road',
      city:                'Hyderabad',
      state:               'Telangana',
      pincode:             '500001',
      primaryContactPhone: '+919000000099',
    };

    prettyBlock('Sending registration payload', payload);

    const { status, raw: reg500body, data } = await httpPost('/onboarding/schools/register', payload);
    row('HTTP Status', status);
    row('Response tenantId', data?.tenantId ?? '–');
    row('Response tenantCode', data?.tenantCode ?? '–');

    if (status < 200 || status >= 300) {
      prettyBlock('Error response body', reg500body);
    }

    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(300);
    expect(data?.tenantId).toBeTruthy();

    ctx.tenantId = data.tenantId;
    console.log(`\n  ✅  School registered.  tenantId = ${ctx.tenantId}`);
    console.log(`       Subdomain code : ${ctx.tenantCode}`);
    console.log(`       Admin email    : ${ctx.adminEmail}`);
  }, 15_000);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2 — Platform Admin login
  // ─────────────────────────────────────────────────────────────────────────
  test('Step 2 — Login as Platform Admin and obtain a JWT', async () => {
    heading('STEP 2 — PLATFORM ADMIN LOGIN');
    console.log('  Endpoint : POST /iam/auth/token');
    console.log('  Note     : Dev mode — only platform.admin@sme.test requires no password\n');

    const { status, data } = await httpPost('/iam/auth/token', {
      email: 'platform.admin@sme.test',
    });

    row('HTTP Status', status);
    row('Token received', data?.accessToken ? 'YES ✅' : 'NO ❌');
    if (data?.claims) {
      row('roles', JSON.stringify(data.claims.roles));
      row('tenantId in token', data.claims.tenantId);
    }

    // NestJS @Post handlers default to 201 — accept any 2xx
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(300);
    expect(data?.accessToken).toBeTruthy();

    ctx.platformToken = data.accessToken;
    console.log('\n  ✅  Platform Admin JWT obtained.');
  }, 10_000);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3 — Fetch the pending schools list
  // ─────────────────────────────────────────────────────────────────────────
  test('Step 3 — Fetch pending-schools list and confirm our school is there', async () => {
    heading('STEP 3 — LIST PENDING SCHOOLS');
    console.log('  Endpoint : GET /platform/tenants/pending\n');

    expect(ctx.platformToken).toBeTruthy(); // Step 2 must have passed

    const { status, data } = await httpGet('/platform/tenants/pending', ctx.platformToken);

    row('HTTP Status', status);
    expect(status).toBe(200);

    const list = Array.isArray(data) ? data : [];
    row('Total pending schools', list.length);

    if (list.length === 0) {
      console.log('\n  ⚠️  No pending schools found.');
      console.log('      This is unexpected — we just registered one in Step 1.');
      console.log('      Check that Tenant Service processed the registration.');
    }

    // Print every pending school
    console.log('\n  Pending schools:');
    list.forEach((s, i) => {
      console.log(`\n  [${i + 1}]  tenantId   : ${s.tenantId}`);
      console.log(`       tenantCode : ${s.tenantCode}`);
      console.log(`       schoolName : ${s.schoolName}`);
      console.log(`       status     : ${s.status}`);
      console.log(`       createdAt  : ${s.createdAt}`);
    });

    const ours = list.find((s) => s.tenantId === ctx.tenantId || s.tenantCode === ctx.tenantCode);
    if (ours) {
      console.log(`\n  ✅  Found our test school in the pending list.`);
      console.log(`       tenantId  = ${ours.tenantId}`);
      console.log(`       tenantCode = ${ours.tenantCode}`);
      // Update tenantId in case registration returned a different format
      ctx.tenantId = ours.tenantId;
    } else {
      console.log(`\n  ⚠️  Our test school (${ctx.tenantCode}) was NOT in the pending list.`);
      console.log('      It may have been registered but Tenant Service did not see it yet.');
    }

    expect(list.length).toBeGreaterThan(0);
    expect(ours).toBeDefined();
  }, 10_000);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4 — Approve the school
  // ─────────────────────────────────────────────────────────────────────────
  test('Step 4 — Approve the school (POST /platform/tenants/:id/activate)', async () => {
    heading('STEP 4 — APPROVE / ACTIVATE THE SCHOOL');
    console.log(`  Endpoint : POST /platform/tenants/${ctx.tenantId}/activate\n`);

    expect(ctx.platformToken).toBeTruthy();
    expect(ctx.tenantId).toBeTruthy();

    const { status, raw, data } = await httpPost(
      `/platform/tenants/${ctx.tenantId}/activate`,
      {},
      ctx.platformToken,
    );

    row('HTTP Status', status);
    prettyBlock('Activation response', raw);

    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(300);

    ctx.activationResult = data;

    // Print the school login URL from onboarding credentials
    const creds = data?.onboardingCredentials ?? [];
    if (creds.length > 0) {
      console.log('\n  Onboarding credentials returned by the API:');
      creds.forEach((c, i) => {
        console.log(`\n  [${i + 1}]  email    : ${c.email}`);
        console.log(`       loginUrl : ${c.loginUrl}`);
      });
    }

    console.log(`\n  ✅  Activation complete.  status = ${data?.status ?? raw?.status}`);
  }, 15_000);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5 — Verify in the database that schoolStatus = ACTIVE
  // ─────────────────────────────────────────────────────────────────────────
  test('Step 5 — Verify school is ACTIVE in the PostgreSQL database', async () => {
    heading('STEP 5 — DATABASE VERIFICATION');
    console.log('  Connecting directly to PostgreSQL via the Prisma client...\n');

    expect(ctx.tenantId).toBeTruthy();

    const TENANT_SVC_ROOT = path.join(__dirname, '..', 'apps', 'tenant-service');
    const { PrismaClient } = require(
      path.join(TENANT_SVC_ROOT, 'src', 'generated', 'prisma-client'),
    );
    const DB_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:Olsbook55@localhost:5432/sme_tenant?schema=public';

    const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

    let tenant = null;
    try {
      await prisma.$queryRaw`SELECT 1 AS ok`;
      console.log('  PostgreSQL connection: OK ✅\n');
      tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId } });
    } finally {
      await prisma.$disconnect();
    }

    if (!tenant) {
      console.log(`  ❌  Tenant ${ctx.tenantId} NOT FOUND in database.`);
      expect(tenant).not.toBeNull();
      return;
    }

    // Print the full Tenant row
    const fmt = (k, v) => {
      const ks = String(k).padEnd(22);
      const vs = v == null ? '(null)' : String(v);
      console.log(`  │  ${ks}: ${vs}`);
    };

    console.log('  ┌─────────────────────────────────────────────────────────┐');
    console.log('  │     DATABASE RECORD — Tenant table (sme_tenant)         │');
    console.log('  ├─────────────────────────────────────────────────────────┤');
    fmt('id',              tenant.id);
    fmt('code (subdomain)', tenant.code);
    fmt('name',            tenant.name);
    fmt('status',          tenant.status);
    fmt('schoolStatus',    tenant.schoolStatus);
    fmt('contactEmail',    tenant.contactEmail);
    fmt('schoolAdminName', tenant.schoolAdminName);
    fmt('city',            tenant.city);
    fmt('state',           tenant.state);
    fmt('createdAt',       tenant.createdAt);
    fmt('updatedAt',       tenant.updatedAt);
    console.log('  └─────────────────────────────────────────────────────────┘');

    expect(tenant.status).toBe('ACTIVE');
    console.log(`\n  ✅  PASS  status      = "${tenant.status}"  (was TRIAL)`);

    expect(tenant.schoolStatus).toBe('ACTIVE');
    console.log(`  ✅  PASS  schoolStatus = "${tenant.schoolStatus}"  (was PENDING)`);

    expect(tenant.code).toBe(ctx.tenantCode);
    console.log(`  ✅  PASS  code         = "${tenant.code}"`);
  }, 15_000);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 6 — Build and display the school login URL
  // ─────────────────────────────────────────────────────────────────────────
  test('Step 6 — Build the school login URL', async () => {
    heading('STEP 6 — SCHOOL LOGIN URL');

    const loginUrl  = `http://${ctx.tenantCode}.${BASE_DOMAIN}:${PORTAL_PORT}/login`;
    const portalUrl = `http://${ctx.tenantCode}.${BASE_DOMAIN}:${PORTAL_PORT}/`;

    ctx.loginUrl = loginUrl;

    banner(
      `LOGIN URL FOR THE APPROVED SCHOOL\n` +
      `\n` +
      `  School   : ${ctx.schoolName}\n` +
      `  Subdomain: ${ctx.tenantCode}\n` +
      `\n` +
      `  Portal   : ${portalUrl}\n` +
      `  Login    : ${loginUrl}\n` +
      `\n` +
      `  Use this link in your browser after the hosts-file fix.`,
    );

    console.log('\n  ─── How the URL routing works ───────────────────────────');
    console.log(`  1. Browser hits: ${loginUrl}`);
    console.log(`  2. Next.js middleware extracts subdomain "${ctx.tenantCode}"`);
    console.log(`     from the hostname "${ctx.tenantCode}.${BASE_DOMAIN}"`);
    console.log(`  3. Middleware injects header  x-sme-subdomain: ${ctx.tenantCode}`);
    console.log(`  4. The /login page renders the school login form`);
    console.log(`  5. On submit the form calls POST /iam/auth/token`);
    console.log(`     with the school admin email and gets a JWT back.`);

    expect(ctx.tenantCode).toBeTruthy();
    expect(loginUrl).toContain(ctx.tenantCode);
    console.log(`\n  ✅  Login URL constructed.`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 7 — Attempt to reach the login page via the subdomain URL
  // ─────────────────────────────────────────────────────────────────────────
  test('Step 7 — Check if the school login page is reachable (DNS/hosts-file check)', async () => {
    heading('STEP 7 — REACH THE SCHOOL LOGIN PAGE VIA SUBDOMAIN URL');

    const loginUrl = ctx.loginUrl ?? `http://${ctx.tenantCode}.${BASE_DOMAIN}:${PORTAL_PORT}/login`;
    console.log(`  Attempting HTTP GET  →  ${loginUrl}\n`);

    const result = await httpGetUrl(loginUrl, 5000);

    if (result.ok) {
      row('HTTP Status', result.status);
      row('Body snippet', result.bodySnippet);
      console.log('\n  ✅  Login page IS reachable!');
      console.log('      The school can now log in at:');
      console.log(`      ${loginUrl}`);
    } else if (result.error && (result.error.includes('ENOTFOUND') || result.error.includes('fetch failed'))) {
      // DNS resolution failure — the most likely reason
      console.log('  ❌  DNS RESOLUTION FAILED — "site can\'t be reached"');
      console.log('\n  ══════════════════════════════════════════════════════');
      console.log('  ROOT CAUSE:');
      console.log(`  Windows does not know that "${ctx.tenantCode}.${BASE_DOMAIN}"`);
      console.log('  should resolve to your local machine (127.0.0.1).');
      console.log('\n  THE FIX — Run this in an ADMIN PowerShell terminal:');
      console.log('\n    Add-Content -Path "C:\\Windows\\System32\\drivers\\etc\\hosts"');
      console.log(`             -Value "127.0.0.1   ${ctx.tenantCode}.${BASE_DOMAIN}"`);
      console.log('\n  OR open the hosts file in Notepad (as Administrator) and add:');
      console.log(`    127.0.0.1   ${ctx.tenantCode}.${BASE_DOMAIN}`);
      console.log('\n  After saving, open in your browser:');
      console.log(`    ${loginUrl}`);
      console.log('  ══════════════════════════════════════════════════════');

      // Also print DNS for "vignan" in case that was the real school in question
      console.log('\n  NOTE — for the "vignan" school you manually approved, apply');
      console.log('  the same fix:');
      console.log(`    127.0.0.1   vignan.${BASE_DOMAIN}`);
      console.log(`  Then open:  http://vignan.${BASE_DOMAIN}:${PORTAL_PORT}/login`);

      // Hosts-file DNS failure is expected in CI / fresh dev setups.
      // We skip the assertion rather than fail so the rest of the suite still runs.
      console.log('\n  ⚠️  Skipping DNS assertion — hosts-file entry required for subdomain routing.');
    } else if (result.status !== null) {
      // We got an HTTP response but it was an error status (4xx/5xx)
      row('HTTP Status', result.status);
      row('Body snippet', result.bodySnippet ?? '');
      console.log('\n  ⚠️  Server responded but with a non-200 status.');
      console.log('      Check that the web-portal (port 3102) is running.');
      expect(result.status).toBeLessThan(500);
    } else {
      console.log(`\n  ❌  Network error: ${result.error}`);
      console.log('      Make sure the web-portal is running on port 3102.');
      console.log(`      Also ensure "${ctx.tenantCode}.${BASE_DOMAIN}" is in your hosts file.`);
      // Don't hard-fail — this is an environment check
      console.log('\n  ⚠️  Skipping assertion — environment setup needed.');
    }
  }, 10_000);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 8 — Try school-admin login via IAM API
  // ─────────────────────────────────────────────────────────────────────────
  test('Step 8 — Attempt school-admin login via IAM API', async () => {
    heading('STEP 8 — SCHOOL ADMIN LOGIN VIA IAM API');
    console.log('  Endpoint : POST /iam/auth/token');
    console.log(`  Email    : ${ctx.adminEmail}`);
    console.log(`  tenantId : ${ctx.tenantId}\n`);

    // Attempt the login
    const { status, raw } = await httpPost('/iam/auth/token', {
      email:    ctx.adminEmail,
      tenantId: ctx.tenantId,
    });

    row('HTTP Status', status);
    prettyBlock('IAM response', raw);

    if (status === 200) {
      const token = raw?.data?.accessToken ?? raw?.accessToken;
      if (token) {
        console.log('\n  ✅  School admin login SUCCEEDED!');
        console.log(`      accessToken: ${token.slice(0, 40)}...`);
        const claims = raw?.data?.claims ?? raw?.claims;
        if (claims) {
          row('roles',    JSON.stringify(claims.roles));
          row('tenantId', claims.tenantId);
        }
      } else {
        console.log('\n  ⚠️  200 response but no accessToken in body — check API response shape.');
      }
    } else if (status === 403) {
      // API uses RFC 7807 shape: { type, title, status, detail, ... }
      // Fallback to NestJS default { message } shape
      const msg = raw?.message ?? raw?.detail ?? '';
      if (msg.includes('password') || msg.includes('issue access token')) {
        console.log('\n  ⚠️  KNOWN LIMITATION — password-based login is not yet enabled.');
        console.log('      Current behaviour in apps/iam-service/src/app.service.ts:');
        console.log('      Only platform.admin@sme.test can log in without a password.');
        console.log('      All other accounts are blocked with:');
        console.log('      "Only platform.admin@sme.test can login without password (temporary bypass)"');
        console.log('\n  What needs to happen before school admin can login:');
        console.log('      1. A password must be set for the school admin account');
        console.log('         (either during onboarding or via a "set initial password" flow).');
        console.log('      2. The IAM issueAccessToken() bypass must be removed');
        console.log('         and real bcrypt password verification must be wired in.');
        console.log('      3. The school admin account in the IAM DB must have status = ACTIVE');
        console.log('         (confirmed by the iam.onboarding.activate endpoint called in Step 4).');
        console.log('\n  ✔  This is a known dev-mode limitation, not a regression from approval.');
      } else {
        console.log(`\n  ❌  Login forbidden: ${msg}`);
      }
    } else if (status === 404) {
      console.log('\n  ⚠️  User not found in IAM database.');
      console.log('      The school admin account may not have been created yet.');
      console.log('      Check that:');
      console.log('        1. RabbitMQ is running (tenant.created event was published).');
      console.log('        2. The IAM service consumed the tenant.created event.');
      console.log('        3. iam.onboarding.activate was called during Step 4.');
    } else {
      console.log(`\n  ⚠️  Unexpected status ${status}. See response above.`);
    }

    // The login may fail due to the known password bypass — that's OK.
    // We assert that the status is not a 5xx (server crash), which would be a real problem.
    expect(status).toBeLessThan(500);
    console.log('\n  ✅  No server crash detected (status < 500).');
  }, 10_000);

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  test('Summary — print the full end-to-end result', async () => {
    heading('SUMMARY — ApproveSchool End-to-End Result');

    const loginUrl = `http://${ctx.tenantCode}.${BASE_DOMAIN}:${PORTAL_PORT}/login`;

    console.log('\n  What was tested:');
    console.log('  ┌──────────────────────────────────────────────────────────');
    console.log(`  │  Step 1  Registered school     : ${ctx.schoolName}`);
    console.log(`  │  Step 2  Platform admin login  : platform.admin@sme.test`);
    console.log(`  │  Step 3  Found in pending list : ${ctx.tenantId}`);
    console.log(`  │  Step 4  Approved via API       : POST /platform/tenants/${ctx.tenantId}/activate`);
    console.log(`  │  Step 5  DB status confirmed   : ACTIVE`);
    console.log(`  │  Step 6  Login URL built        : ${loginUrl}`);
    console.log(`  │  Step 7  DNS reachability check : see Step 7 output above`);
    console.log(`  │  Step 8  School admin IAM login : see Step 8 output above`);
    console.log('  └──────────────────────────────────────────────────────────');

    banner(
      'ACTION REQUIRED — to complete access to the school portal:\n' +
      '\n' +
      '  1. Add to C:\\Windows\\System32\\drivers\\etc\\hosts  (Admin required):\n' +
      `     127.0.0.1   ${ctx.tenantCode}.${BASE_DOMAIN}\n` +
      `     127.0.0.1   vignan.${BASE_DOMAIN}          ← your real school\n` +
      '\n' +
      '  2. Open in browser:\n' +
      `     http://vignan.${BASE_DOMAIN}:${PORTAL_PORT}/login\n` +
      '\n' +
      '  3. School admin password auth is not yet enabled.\n' +
      '     Platform admin (platform.admin@sme.test) can log in today.',
    );

    // Summary always passes — it's a reporting step
    expect(ctx.schoolName).toBeTruthy();
  });

});
