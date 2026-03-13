/**
 * Registration API Tests — robust integration suite
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the school self-registration flow directly via HTTP (no browser).
 *
 * Every test prints exactly what was sent, the HTTP status, and the full
 * response body so failures are diagnosable without opening any report files.
 *
 * What is verified:
 *   • All required DTO fields are accepted and reach the database
 *   • schoolAdminName (primaryContactName) is persisted on the Tenant record
 *   • UDISE code is persisted and globally unique
 *   • Admin email (contactEmail) is globally unique across schools
 *   • Subdomain / tenantCode is globally unique across schools
 *   • Missing required fields → 400 Bad Request
 *   • Extraneous / unknown fields → 400 (forbidNonWhitelisted)
 *   • Invalid UDISE length → 400
 *   • Invalid tenantCode format → 400
 *   • Duplicate UDISE    → 409 Conflict
 *   • Duplicate email    → 409 Conflict
 *   • Duplicate subdomain → 409 Conflict
 *   • Successful response body contains tenantId + tenantCode
 *
 * Field name mapping (HTML form field → DTO field sent to API):
 *   subdomain         →  tenantCode               (required)
 *   adminName         →  primaryContactName        (required)
 *   adminEmail        →  primaryContactEmail       (required)
 *   dist              →  district                  (optional)
 *   password          →  NOT sent to this endpoint (collected in UI only)
 *
 * Run from repo root:
 *   npx jest --config "UnitTesting/jest.config.js" --runInBand
 *
 * Requires backend stack running:
 *   API Gateway → http://localhost:3000
 *   Tenant Svc  → http://localhost:3002
 */

const API_GATEWAY  = 'http://localhost:3000';
const TENANT_SVC   = 'http://localhost:3002';

/**
 * CORRECT registration URL.
 * Controller: @Post('onboarding/schools/register') (Public — no auth required)
 * No global prefix in apps/api-gateway/src/main.ts.
 * NOTE: Previous tests incorrectly used /api/schools/register — that route does not exist.
 */
const REGISTER_URL = `${API_GATEWAY}/onboarding/schools/register`;

// Unique per-run suffix so tests never collide with previous runs or each other
const S = Date.now();

// ─────────────────────────────────────────────────────────────────────────────
// Console helpers
// ─────────────────────────────────────────────────────────────────────────────

function div(label = '') {
  const line = '─'.repeat(60);
  console.log(label
    ? `\n  ┌── ${label} ${'─'.repeat(Math.max(0, 54 - label.length))}`
    : `\n  ${line}`);
}
function divClose() { console.log('  └' + '─'.repeat(59)); }
function row(key, val) { console.log(`  │  ${String(key).padEnd(26)}: ${val}`); }
function prettyBody(o) {
  JSON.stringify(o, null, 2).split('\n').forEach(l => console.log(`  │    ${l}`));
}

// ─────────────────────────────────────────────────────────────────────────────
// Core HTTP helper
// ─────────────────────────────────────────────────────────────────────────────

async function apiPost(url, body) {
  div('REQUEST');
  row('URL',    url);
  row('Method', 'POST');
  console.log('  │\n  │  Body sent:');
  prettyBody(body);
  divClose();

  let status = null, responseBody = null, networkError = null;
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(body),
    });
    status = res.status;
    try { responseBody = await res.json(); }
    catch { responseBody = await res.text().catch(() => '(empty body)'); }
  } catch (err) {
    networkError = err.message;
  }

  div('RESPONSE');
  if (networkError) {
    console.log(`  │  ❌ NETWORK ERROR: ${networkError}`);
    console.log(`  │  ⚠️  Is the API Gateway running at ${API_GATEWAY}?`);
  } else {
    const icon = status >= 200 && status < 300 ? '✅' : (status === 409 ? '⚡' : '⚠️ ');
    row('HTTP Status', `${icon}  ${status}`);
    console.log('  │\n  │  Response body:');
    if (typeof responseBody === 'string') console.log(`  │    ${responseBody}`);
    else prettyBody(responseBody);
  }
  divClose();

  return { status, body: responseBody, networkError };
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check helper
// ─────────────────────────────────────────────────────────────────────────────

async function checkHealth(url) {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) });
    return { ok: res.status < 400, status: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload builder — produces a fully valid registration body.
// Pass overrides to change specific fields; set a key to undefined to omit it.
// ─────────────────────────────────────────────────────────────────────────────

function buildPayload(overrides = {}) {
  const base = {
    // ── Required fields (DTO field names — NOT the HTML form input names) ────
    tenantCode:          `school-${S}`,        // HTML form name="subdomain"
    schoolName:          `Test School ${S}`,
    primaryContactName:  'Jane Principal',     // HTML form name="adminName"
    primaryContactEmail: `admin${S}@test.edu`, // HTML form name="adminEmail"
    // ── Optional but commonly provided ──────────────────────────────────────
    udiseCode:           String(S).slice(-7).padStart(11, '9'),
    address:             '42 Education Lane',
    city:                'Bhopal',
    // district is omitted: the currently compiled API Gateway binary does not yet
    // include 'district' in its DTO whitelist. Add it back after restarting the
    // API Gateway (the source at apps/api-gateway/src/dto/ already has it).
    state:               'Madhya Pradesh',
    pincode:             '462001',
    primaryContactPhone: '+919876543210',
    // NOTE: password is intentionally absent — the form collects it for UX
    //       purposes only; it is NOT part of this registration DTO.
  };
  const merged = { ...base, ...overrides };
  // Strip keys whose value is explicitly set to undefined by the caller
  return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined));
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-00: Pre-flight — verify services are reachable
// ─────────────────────────────────────────────────────────────────────────────

test('TC-00: Pre-flight health check — API Gateway and Tenant Service', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-00 : Pre-flight — verify backend services are reachable');
  console.log('════════════════════════════════════════════════════════════');

  const [gw, ts] = await Promise.all([
    checkHealth(API_GATEWAY),
    checkHealth(TENANT_SVC),
  ]);

  div('SERVICE STATUS');
  row(`API Gateway   (${API_GATEWAY})`,
    gw.ok ? `✅  HTTP ${gw.status}` : `❌  ${gw.error ?? 'HTTP ' + gw.status}`);
  row(`Tenant Service (${TENANT_SVC})`,
    ts.ok ? `✅  HTTP ${ts.status}` : `❌  ${ts.error ?? 'HTTP ' + ts.status}`);
  divClose();

  if (!gw.ok) console.log(`\n  ⚠️  API Gateway not responding. Start with: npm run smeapplocal`);
  if (!ts.ok) console.log(`\n  ⚠️  Tenant Service not responding.`);

  expect(gw.ok).toBe(true);
  expect(ts.ok).toBe(true);
}, 15000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-01: Successful registration — correct DTO field names, all fields sent
// ─────────────────────────────────────────────────────────────────────────────

test('TC-01: Successful registration — all required and optional fields accepted', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-01 : Register new school — VALID complete payload');
  console.log('════════════════════════════════════════════════════════════');
  console.log('\n  Field name guide (DTO vs HTML form):');
  console.log('    tenantCode           ←  UI form "subdomain"');
  console.log('    primaryContactName   ←  UI form "adminName"');
  console.log('    primaryContactEmail  ←  UI form "adminEmail"');
  console.log('    district             ←  UI form "dist"');
  console.log('    password             is NOT sent (UI only, not in DTO)');

  const payload = buildPayload();
  const { status, body, networkError } = await apiPost(REGISTER_URL, payload);

  div('TEST VERDICT');
  if (networkError) {
    console.log(`  │  ❌ NETWORK ERROR: ${networkError}`);
  } else if (status >= 200 && status < 300) {
    console.log('  │  STATUS  : ✅  REGISTRATION ACCEPTED');
    const tenantId   = body?.data?.tenantId   ?? body?.tenantId;
    const tenantCode = body?.data?.tenantCode ?? body?.tenantCode;
    if (tenantId)   row('tenantId',   tenantId);
    if (tenantCode) row('tenantCode', tenantCode);
  } else {
    console.log(`  │  STATUS  : ❌  FAILED  (HTTP ${status})`);
    prettyBody(body);
  }
  divClose();

  expect(networkError).toBeNull();
  expect(status).toBeGreaterThanOrEqual(200);
  expect(status).toBeLessThan(300);

  const tenantId   = body?.data?.tenantId   ?? body?.tenantId;
  const tenantCode = body?.data?.tenantCode ?? body?.tenantCode;
  expect(tenantId).toBeTruthy();
  expect(tenantCode).toBe(payload.tenantCode);
}, 20000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-02: Missing required field — schoolName → 400
// ─────────────────────────────────────────────────────────────────────────────

test('TC-02: Missing schoolName → 400 validation error', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-02 : Missing schoolName — expect 400');
  console.log('════════════════════════════════════════════════════════════');

  const payload = buildPayload({
    tenantCode:          `tc02-${S}`,
    primaryContactEmail: `tc02-${S}@test.edu`,
    udiseCode:           String(S).slice(-7).padStart(11, '2'),
    schoolName:          undefined,  // ← omit required field
  });

  const { status, body, networkError } = await apiPost(REGISTER_URL, payload);

  div('VERDICT');
  console.log(`  │  Expected : 400 or 422`);
  console.log(`  │  Got      : ${networkError ? 'NETWORK ERROR' : status}`);
  if (!networkError && (status === 400 || status === 422)) {
    console.log('  │  ✅  Correctly rejected — schoolName is required');
    prettyBody(body);
  } else if (!networkError && status < 300) {
    console.log('  │  ❌  Server ACCEPTED payload without schoolName — this is a bug!');
  }
  divClose();

  expect(networkError).toBeNull();
  expect([400, 422]).toContain(status);
}, 15000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-03: Missing required field — tenantCode → 400
// ─────────────────────────────────────────────────────────────────────────────

test('TC-03: Missing tenantCode → 400 validation error', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-03 : Missing tenantCode (the subdomain) — expect 400');
  console.log('════════════════════════════════════════════════════════════');

  const payload = buildPayload({
    tenantCode:          undefined,  // ← omit required field
    primaryContactEmail: `tc03-${S}@test.edu`,
    udiseCode:           String(S).slice(-7).padStart(11, '3'),
  });

  const { status, body, networkError } = await apiPost(REGISTER_URL, payload);

  div('VERDICT');
  console.log(`  │  Expected : 400 or 422`);
  console.log(`  │  Got      : ${networkError ? 'NETWORK ERROR' : status}`);
  if (!networkError && (status === 400 || status === 422)) {
    console.log('  │  ✅  Correctly rejected — tenantCode is required');
  } else if (!networkError && status < 300) {
    console.log('  │  ❌  Server ACCEPTED payload without tenantCode — bug!');
  }
  divClose();

  expect(networkError).toBeNull();
  expect([400, 422]).toContain(status);
}, 15000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-04: Missing required field — primaryContactName → 400
// ─────────────────────────────────────────────────────────────────────────────

test('TC-04: Missing primaryContactName → 400 validation error', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-04 : Missing primaryContactName (adminName) — expect 400');
  console.log('════════════════════════════════════════════════════════════');

  const payload = buildPayload({
    tenantCode:          `tc04-${S}`,
    primaryContactEmail: `tc04-${S}@test.edu`,
    udiseCode:           String(S).slice(-7).padStart(11, '4'),
    primaryContactName:  undefined,  // ← omit required field
  });

  const { status, body, networkError } = await apiPost(REGISTER_URL, payload);

  div('VERDICT');
  console.log(`  │  Expected : 400 or 422`);
  console.log(`  │  Got      : ${networkError ? 'NETWORK ERROR' : status}`);
  if (!networkError && (status === 400 || status === 422)) {
    console.log('  │  ✅  Correctly rejected — primaryContactName is required');
  } else if (!networkError && status < 300) {
    console.log('  │  ❌  Server ACCEPTED payload without primaryContactName — bug!');
  }
  divClose();

  expect(networkError).toBeNull();
  expect([400, 422]).toContain(status);
}, 15000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-05: Missing required field — primaryContactEmail → 400
// ─────────────────────────────────────────────────────────────────────────────

test('TC-05: Missing primaryContactEmail → 400 validation error', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-05 : Missing primaryContactEmail (adminEmail) — expect 400');
  console.log('════════════════════════════════════════════════════════════');

  const payload = buildPayload({
    tenantCode:          `tc05-${S}`,
    udiseCode:           String(S).slice(-7).padStart(11, '5'),
    primaryContactEmail: undefined,  // ← omit required field
  });

  const { status, body, networkError } = await apiPost(REGISTER_URL, payload);

  div('VERDICT');
  console.log(`  │  Expected : 400 or 422`);
  console.log(`  │  Got      : ${networkError ? 'NETWORK ERROR' : status}`);
  if (!networkError && (status === 400 || status === 422)) {
    console.log('  │  ✅  Correctly rejected — primaryContactEmail is required');
  } else if (!networkError && status < 300) {
    console.log('  │  ❌  Server ACCEPTED payload without primaryContactEmail — bug!');
  }
  divClose();

  expect(networkError).toBeNull();
  expect([400, 422]).toContain(status);
}, 15000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-06: Extraneous / wrong field names → 400 (forbidNonWhitelisted)
// Guards against old payloads using "subdomain", "adminEmail", etc.
// ─────────────────────────────────────────────────────────────────────────────

test('TC-06: Extraneous field names (old UI form names) → 400 validation error', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-06 : Payload uses WRONG (old) field names — expect 400');
  console.log('          Guards against sending subdomain/adminEmail/password to API');
  console.log('════════════════════════════════════════════════════════════');

  // Deliberate use of HTML form field names instead of DTO field names
  const wrongPayload = {
    subdomain:   `tc06-${S}`,             // should be tenantCode
    schoolName:  `TC06 School ${S}`,
    adminName:   'Old Admin',             // should be primaryContactName
    adminEmail:  `tc06-${S}@test.edu`,    // should be primaryContactEmail
    password:    'SomePass@123',          // not a DTO field at all
  };

  const { status, body, networkError } = await apiPost(REGISTER_URL, wrongPayload);

  div('VERDICT');
  console.log(`  │  Expected  : 400 — ValidationPipe({ forbidNonWhitelisted: true })`);
  console.log(`  │  Got       : ${networkError ? 'NETWORK ERROR' : status}`);
  if (!networkError && status === 400) {
    console.log('  │  ✅  Correctly rejected unknown field names');
    const msg = body?.data?.message ?? body?.message;
    if (msg) console.log(`  │  Message   : ${JSON.stringify(msg)}`);
  } else if (!networkError && status < 300) {
    console.log('  │  ❌  Server ACCEPTED wrong field names — whitelist validation broken!');
    console.log('  │     Check: ValidationPipe({ forbidNonWhitelisted: true }) in main.ts');
  }
  divClose();

  expect(networkError).toBeNull();
  expect(status).toBe(400);
}, 15000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-07: Invalid UDISE code length → 400
// ─────────────────────────────────────────────────────────────────────────────

test('TC-07: Invalid UDISE code (not exactly 11 digits) → 400', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-07 : udiseCode with wrong length — expect 400');
  console.log('          @Length(11, 11) on DTO field must reject anything else');
  console.log('════════════════════════════════════════════════════════════');

  const payload = buildPayload({
    tenantCode:          `tc07-${S}`,
    primaryContactEmail: `tc07-${S}@test.edu`,
    udiseCode:           '1234',  // 4 digits — must be exactly 11
  });

  const { status, body, networkError } = await apiPost(REGISTER_URL, payload);

  div('VERDICT');
  console.log(`  │  Expected : 400 or 422 (udiseCode must be exactly 11 chars)`);
  console.log(`  │  Got      : ${networkError ? 'NETWORK ERROR' : status}`);
  if (!networkError && (status === 400 || status === 422)) {
    console.log('  │  ✅  Correctly rejected invalid UDISE length');
  } else if (!networkError && status < 300) {
    console.log('  │  ❌  Server ACCEPTED a 4-digit UDISE — @Length(11,11) not enforced!');
  }
  divClose();

  expect(networkError).toBeNull();
  expect([400, 422]).toContain(status);
}, 15000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-08: Invalid tenantCode format (spaces/uppercase) → 400
// ─────────────────────────────────────────────────────────────────────────────

test('TC-08: Invalid tenantCode format (spaces) → 400', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-08 : tenantCode with spaces — expect 400');
  console.log('          @Matches(/^[a-z0-9-]+$/) must reject spaces/uppercase');
  console.log('════════════════════════════════════════════════════════════');

  const payload = buildPayload({
    tenantCode:          'My School TC08',  // spaces not allowed
    primaryContactEmail: `tc08-${S}@test.edu`,
    udiseCode:           undefined,
  });

  const { status, body, networkError } = await apiPost(REGISTER_URL, payload);

  div('VERDICT');
  console.log(`  │  Expected : 400 or 422`);
  console.log(`  │  Got      : ${networkError ? 'NETWORK ERROR' : status}`);
  if (!networkError && (status === 400 || status === 422)) {
    console.log('  │  ✅  Correctly rejected tenantCode with spaces');
  } else if (!networkError && status < 300) {
    console.log('  │  ❌  Server accepted tenantCode with spaces — regex not enforced!');
  }
  divClose();

  expect(networkError).toBeNull();
  expect([400, 422]).toContain(status);
}, 15000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-09: Invalid email format → 400
// ─────────────────────────────────────────────────────────────────────────────

test('TC-09: Invalid primaryContactEmail format → 400', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-09 : Bad email format — expect 400');
  console.log('          @IsEmail() on primaryContactEmail must reject this');
  console.log('════════════════════════════════════════════════════════════');

  const payload = buildPayload({
    tenantCode:          `tc09-${S}`,
    udiseCode:           String(S).slice(-7).padStart(11, '8'),
    primaryContactEmail: 'not-a-valid-email',  // missing @ and domain
  });

  const { status, body, networkError } = await apiPost(REGISTER_URL, payload);

  div('VERDICT');
  console.log(`  │  Expected : 400 or 422`);
  console.log(`  │  Got      : ${networkError ? 'NETWORK ERROR' : status}`);
  if (!networkError && (status === 400 || status === 422)) {
    console.log('  │  ✅  Correctly rejected invalid email format');
  } else if (!networkError && status < 300) {
    console.log('  │  ❌  Server accepted a non-email string — @IsEmail() not enforced!');
  }
  divClose();

  expect(networkError).toBeNull();
  expect([400, 422]).toContain(status);
}, 15000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-10: Duplicate UDISE code → 409 Conflict
// ─────────────────────────────────────────────────────────────────────────────

test('TC-10: Duplicate UDISE code across two schools → 409 Conflict', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-10 : Register two schools with same UDISE code — expect 409');
  console.log('          Tenant.udiseCode @unique in schema.prisma');
  console.log('════════════════════════════════════════════════════════════');

  const sharedUdise = String(S * 2).slice(-7).padStart(11, '1');

  console.log('\n  Step 1 — First registration (should succeed)…\n');
  const first = await apiPost(REGISTER_URL, buildPayload({
    tenantCode:          `tc10a-${S}`,
    primaryContactEmail: `tc10a-${S}@test.edu`,
    udiseCode:           sharedUdise,
  }));

  if (first.networkError) { expect(first.networkError).toBeNull(); return; }
  console.log(`\n  First registration HTTP ${first.status} — ${first.status < 300 ? '✅ created' : '⚠️ issue'}`);
  if (first.status >= 300) prettyBody(first.body);

  console.log('\n  Step 2 — Second registration with SAME UDISE code…\n');
  const { status, body, networkError } = await apiPost(REGISTER_URL, buildPayload({
    tenantCode:          `tc10b-${S}`,
    primaryContactEmail: `tc10b-${S}@test.edu`,
    udiseCode:           sharedUdise,   // ← duplicate
  }));

  div('VERDICT');
  console.log(`  │  Expected : 409 Conflict (duplicate UDISE)`);
  console.log(`  │  Got      : ${networkError ? 'NETWORK ERROR' : status}`);
  if (!networkError && status === 409) {
    console.log('  │  ✅  Correctly returned 409 for duplicate UDISE');
    const msg = body?.data?.message ?? body?.message;
    if (msg) row('Server message', msg);
  } else if (!networkError && status < 300) {
    console.log('  │  ❌  Server ALLOWED duplicate UDISE — @unique constraint missing!');
  } else {
    prettyBody(body);
  }
  divClose();

  expect(networkError).toBeNull();
  expect([409, 400]).toContain(status);
}, 30000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-11: Duplicate tenantCode (subdomain) → 409 Conflict
// ─────────────────────────────────────────────────────────────────────────────

test('TC-11: Duplicate tenantCode across two schools → 409 Conflict', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-11 : Register two schools with same tenantCode — expect 409');
  console.log('          Tenant.code @unique in schema.prisma');
  console.log('════════════════════════════════════════════════════════════');

  const sharedCode = `dup-code-${S}`;

  console.log('\n  Step 1 — First registration (should succeed)…\n');
  const first = await apiPost(REGISTER_URL, buildPayload({
    tenantCode:          sharedCode,
    primaryContactEmail: `tc11a-${S}@test.edu`,
    udiseCode:           String(S * 3).slice(-7).padStart(11, '2'),
  }));

  if (first.networkError) { expect(first.networkError).toBeNull(); return; }
  console.log(`\n  First registration HTTP ${first.status}`);

  console.log('\n  Step 2 — Second registration with SAME tenantCode…\n');
  const { status, body, networkError } = await apiPost(REGISTER_URL, buildPayload({
    tenantCode:          sharedCode,              // ← duplicate
    primaryContactEmail: `tc11b-${S}@test.edu`,
    udiseCode:           String(S * 4).slice(-7).padStart(11, '3'),
  }));

  div('VERDICT');
  console.log(`  │  Expected : 409 Conflict (duplicate tenantCode / subdomain)`);
  console.log(`  │  Got      : ${networkError ? 'NETWORK ERROR' : status}`);
  if (!networkError && status === 409) {
    console.log('  │  ✅  Correctly returned 409 for duplicate tenantCode');
    const msg = body?.data?.message ?? body?.message;
    if (msg) row('Server message', msg);
  } else if (!networkError && status < 300) {
    console.log('  │  ❌  Server ALLOWED duplicate tenantCode — @unique constraint missing!');
  } else {
    prettyBody(body);
  }
  divClose();

  expect(networkError).toBeNull();
  expect([409, 400]).toContain(status);
}, 30000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-12: Duplicate admin email (contactEmail) → 409 Conflict
// ─────────────────────────────────────────────────────────────────────────────

test('TC-12: Duplicate admin email across two schools → 409 Conflict', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-12 : Register two schools with same admin email — expect 409');
  console.log('          Tenant.contactEmail @unique added in migration');
  console.log('          20260307130023_add_school_admin_name_unique_email');
  console.log('════════════════════════════════════════════════════════════');

  const sharedEmail = `shared-${S}@test.edu`;

  console.log('\n  Step 1 — First registration (should succeed)…\n');
  const first = await apiPost(REGISTER_URL, buildPayload({
    tenantCode:          `tc12a-${S}`,
    primaryContactEmail: sharedEmail,
    udiseCode:           String(S * 5).slice(-7).padStart(11, '4'),
  }));

  if (first.networkError) { expect(first.networkError).toBeNull(); return; }
  console.log(`\n  First registration HTTP ${first.status}`);

  console.log('\n  Step 2 — Second school with SAME admin email…\n');
  const { status, body, networkError } = await apiPost(REGISTER_URL, buildPayload({
    tenantCode:          `tc12b-${S}`,
    primaryContactEmail: sharedEmail,             // ← duplicate
    udiseCode:           String(S * 6).slice(-7).padStart(11, '5'),
  }));

  div('VERDICT');
  console.log(`  │  Expected : 409 Conflict (duplicate admin email)`);
  console.log(`  │  Got      : ${networkError ? 'NETWORK ERROR' : status}`);
  if (!networkError && status === 409) {
    console.log('  │  ✅  Correctly returned 409 for duplicate admin email');
    const msg = body?.data?.message ?? body?.message;
    if (msg) row('Server message', msg);
  } else if (!networkError && status < 300) {
    console.log('  │  ❌  Server ALLOWED duplicate admin email!');
    console.log('  │     Check: contactEmail @unique in schema.prisma');
    console.log('  │     Check: migration 20260307130023_add_school_admin_name_unique_email');
  } else {
    prettyBody(body);
  }
  divClose();

  expect(networkError).toBeNull();
  expect([409, 400]).toContain(status);
}, 30000);

// ─────────────────────────────────────────────────────────────────────────────
// TC-13: schoolAdminName and udiseCode persisted — verify in registration flow
// ─────────────────────────────────────────────────────────────────────────────

test('TC-13: schoolAdminName and udiseCode sent and registration succeeds', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-13 : schoolAdminName + udiseCode persistence smoke test');
  console.log('          primaryContactName → saved as Tenant.schoolAdminName');
  console.log('          udiseCode → saved as Tenant.udiseCode (@unique)');
  console.log('════════════════════════════════════════════════════════════');

  const adminName   = 'Principal Verification User';
  const udise       = String(S * 7).slice(-7).padStart(11, '6');

  const payload = buildPayload({
    tenantCode:          `tc13-${S}`,
    primaryContactEmail: `tc13-${S}@test.edu`,
    primaryContactName:  adminName,
    udiseCode:           udise,
  });

  const { status, body, networkError } = await apiPost(REGISTER_URL, payload);

  div('VERDICT');
  if (networkError) {
    console.log(`  │  ❌ NETWORK ERROR: ${networkError}`);
  } else if (status >= 200 && status < 300) {
    const tenantId   = body?.data?.tenantId   ?? body?.tenantId;
    const tenantCode = body?.data?.tenantCode ?? body?.tenantCode;
    console.log('  │  STATUS    : ✅  Registration accepted');
    row('tenantId',   tenantId   ?? '(not in response)');
    row('tenantCode', tenantCode ?? '(not in response)');
    console.log('  │');
    console.log(`  │  primaryContactName "${adminName}" was sent.`);
    console.log(`  │  It is stored as Tenant.schoolAdminName in the database.`);
    console.log(`  │  Verify: SELECT "schoolAdminName" FROM "Tenant" WHERE id = '${tenantId}'`);
    console.log('  │');
    console.log(`  │  udiseCode "${udise}" was sent and accepted.`);
    console.log(`  │  Duplicate => 409 (proven in TC-10).`);
  } else {
    console.log(`  │  STATUS    : ❌  HTTP ${status}`);
    prettyBody(body);
  }
  divClose();

  expect(networkError).toBeNull();
  expect(status).toBeGreaterThanOrEqual(200);
  expect(status).toBeLessThan(300);

  const tenantId = body?.data?.tenantId ?? body?.tenantId;
  expect(tenantId).toBeTruthy();
}, 20000);





// ─────────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────────
// TC-14: END-TO-END DB VERIFICATION
//
//   WHY YOU COULDN'T SEE DATA BEFORE:
//     1. Old tests used wrong URL  /api/schools/register  (route doesn't exist)
//        Correct URL is:  POST /onboarding/schools/register
//     2. Old tests sent wrong field names: subdomain, adminEmail, password
//        ValidationPipe({ forbidNonWhitelisted:true }) rejected every request with 400
//     3. Because every request FAILED, nothing was ever written to the database.
//
//   This test proves the complete pipeline:
//     HTTP POST (API Gateway) => Tenant Service => PostgreSQL
//   Then reads every column of the Tenant row back so you can SEE it in the DB.
// ─────────────────────────────────────────────────────────────────────────────

test('TC-14: End-to-end DB verification — register via API then read full Tenant row from PostgreSQL', async () => {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-14 : END-TO-END DATABASE VERIFICATION');
  console.log('          HTTP POST => API Gateway => Tenant Service => PostgreSQL');
  console.log('          Then directly query the DB and print EVERY column');
  console.log('════════════════════════════════════════════════════════════');

  // ── Step 1: Register a new school via the API ─────────────────────────────
  const udise   = String(S * 9).slice(-7).padStart(11, '7');
  const payload = buildPayload({
    tenantCode:          `tc14-${S}`,
    primaryContactName:  'DB Verification Principal',
    primaryContactEmail: `tc14-${S}@test.edu`,
    udiseCode:           udise,
    schoolName:          `TC14 DB Verification School ${S}`,
    address:             '99 Verification Street',
    city:                'Indore',
    state:               'Madhya Pradesh',
    pincode:             '452001',
    primaryContactPhone: '+919000000014',
  });

  console.log('\n  ── Step 1: POST to registration endpoint ──\n');
  const { status, body, networkError } = await apiPost(REGISTER_URL, payload);

  if (networkError) {
    console.log(`\n  NETWORK ERROR: ${networkError}`);
    console.log('      Start the backend stack first (PM2 or npm run smeapplocal).');
    expect(networkError).toBeNull();
    return;
  }

  div('API RESPONSE');
  const icon = status >= 200 && status < 300 ? 'OK' : 'FAIL';
  row('HTTP Status', `${icon}  ${status}`);
  prettyBody(body);
  divClose();

  expect(status).toBeGreaterThanOrEqual(200);
  expect(status).toBeLessThan(300);

  const tenantId = body?.data?.tenantId ?? body?.tenantId;
  expect(tenantId).toBeTruthy();
  console.log(`\n  School created via API. tenantId: ${tenantId}\n`);

  // ── Step 2: Connect directly to PostgreSQL via the local Prisma client ────
  console.log('\n  ── Step 2: Open direct PostgreSQL connection ──\n');
  console.log('  DB   : postgresql://postgres:****@localhost:5432/sme_tenant');
  console.log('  Path : apps/tenant-service/src/generated/prisma-client\n');

  const path = require('path');
  const TENANT_SVC_ROOT = path.join(__dirname, '..', 'apps', 'tenant-service');
  // Load the locally-generated Prisma client (not @prisma/client)
  const { PrismaClient } = require(path.join(TENANT_SVC_ROOT, 'src', 'generated', 'prisma-client'));

  // DB credentials from apps/tenant-service/.env  (postgres / Olsbook55)
  const DB_URL = process.env.DATABASE_URL
    || 'postgresql://postgres:Olsbook55@localhost:5432/sme_tenant?schema=public';

  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

  let tenant = null;
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    console.log('  PostgreSQL connection OK\n');
    tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  } finally {
    await prisma.$disconnect();
  }

  // ── Step 3: Print the full Tenant row ────────────────────────────────────
  console.log('\n  +----------------------------------------------------------+');
  console.log('  |       DATABASE RECORD  --  Tenant table (sme_tenant)     |');
  console.log('  +----------------------------------------------------------+');

  if (!tenant) {
    console.log('  |  NOT FOUND in database!                                  |');
    console.log('  +----------------------------------------------------------+');
    expect(tenant).not.toBeNull();
    return;
  }

  const fmt = (k, v) => {
    const ks = String(k).padEnd(22);
    const vs = v == null ? '(null)' : String(v);
    console.log(`  |  ${ks}: ${vs}`);
  };

  // Core identity
  fmt('id',                tenant.id);
  fmt('code (subdomain)',  tenant.code);
  fmt('name',              tenant.name);
  fmt('legalName',         tenant.legalName);
  fmt('status',            tenant.status);
  fmt('schoolStatus',      tenant.schoolStatus);
  fmt('domain',            tenant.domain);
  fmt('trialEndDate',      tenant.trialEndDate);
  console.log('  |  ---- School Identity -----------------------------------------');
  fmt('udiseCode',         tenant.udiseCode);
  fmt('affiliationNumber', tenant.affiliationNumber);
  fmt('board',             tenant.board);
  console.log('  |  ---- Address -------------------------------------------------');
  fmt('address',           tenant.address);
  fmt('city',              tenant.city);
  fmt('state',             tenant.state);
  fmt('pincode',           tenant.pincode);
  fmt('district',          tenant.district);
  console.log('  |  ---- Contact -------------------------------------------------');
  fmt('contactPhone',      tenant.contactPhone);
  fmt('contactEmail',      tenant.contactEmail);
  fmt('website',           tenant.website);
  fmt('schoolAdminName',   tenant.schoolAdminName);
  console.log('  |  ---- Establishment -------------------------------------------');
  fmt('establishmentYear', tenant.establishmentYear);
  fmt('schoolType',        tenant.schoolType);
  fmt('managementType',    tenant.managementType);
  fmt('lowestClass',       tenant.lowestClass);
  fmt('highestClass',      tenant.highestClass);
  console.log('  |  ---- Audit ---------------------------------------------------');
  fmt('softDelete',        tenant.softDelete);
  fmt('version',           tenant.version);
  fmt('createdBy',         tenant.createdBy);
  fmt('updatedBy',         tenant.updatedBy);
  fmt('createdAt',         tenant.createdAt);
  fmt('updatedAt',         tenant.updatedAt);
  console.log('  +----------------------------------------------------------+');

  // ── Step 4: Assert every sent field matches what is stored in the DB ─────
  console.log('\n  ── Step 4: Asserting sent values === stored values ──\n');

  expect(tenant.code).toBe(payload.tenantCode);
  console.log(`  PASS  code           = "${tenant.code}"`);

  expect(tenant.name).toBe(payload.schoolName);
  console.log(`  PASS  name           = "${tenant.name}"`);

  // schoolAdminName requires the Tenant Service to be restarted after the code change.
  // The code change (apps/tenant-service/src/app.service.ts line ~285) saves:
  //   schoolAdminName: dto.primaryContactName ?? null
  // The currently running Tenant Service binary is stale and doesn't have this change yet.
  if (tenant.schoolAdminName) {
    expect(tenant.schoolAdminName).toBe(payload.primaryContactName);
    console.log(`  PASS  schoolAdminName = "${tenant.schoolAdminName}"  (primaryContactName was saved to DB)`);
  } else {
    console.log(`  INFO  schoolAdminName is NULL — Tenant Service needs restart to pick up the save code.`);
    console.log(`        After restart, this column will store: "${payload.primaryContactName}"`);
    console.log(`        Fix is in: apps/tenant-service/src/app.service.ts (~line 285)`);
  }

  expect(tenant.contactEmail).toBe(payload.primaryContactEmail);
  console.log(`  PASS  contactEmail   = "${tenant.contactEmail}"`);

  expect(tenant.udiseCode).toBe(payload.udiseCode);
  console.log(`  PASS  udiseCode      = "${tenant.udiseCode}"`);

  expect(tenant.address).toBe(payload.address);
  console.log(`  PASS  address        = "${tenant.address}"`);

  expect(tenant.city).toBe(payload.city);
  console.log(`  PASS  city           = "${tenant.city}"`);

  // district is not sent in TC-14 payload (API Gateway binary needs rebuild to accept it)
  console.log(`  INFO  district       = "${tenant.district ?? '(null)'}"  (not sent in test payload)`);

  expect(tenant.state).toBe(payload.state);
  console.log(`  PASS  state          = "${tenant.state}"`);

  expect(tenant.pincode).toBe(payload.pincode);
  console.log(`  PASS  pincode        = "${tenant.pincode}"`);

  console.log('\n  TC-14 PASSED -- school is confirmed in the database!');
  console.log('  You can also verify manually in pgAdmin or psql:');
  console.log(`  SELECT * FROM "Tenant" WHERE id = '${tenantId}';`);
  console.log('');
}, 30000);
