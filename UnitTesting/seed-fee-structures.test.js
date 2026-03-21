/**
 * Unit Test: Seed Fee Structures — verifies hierarchical category seeding
 * and FeeStructure creation for MASTER_TEMPLATE.
 *
 * Category hierarchy:
 *   Admission Fee  → Registration Fee, Admission Fee, Security Deposit/Caution Deposit
 *   Annual Fees    → Infrastructure/Development Fee, Examination Fee, Lab/Library Fee, Student Insurance & Diary
 *   Tuition Fee    (standalone — no children)
 *   Utilities Fee  (standalone — no children)
 *
 * FeeStructures link to LEAF categories only (items + standalone parents).
 * Expected: 12 classes × 9 leaf items = 108 structures
 *
 * Run from repo root:
 *   node UnitTesting/seed-fee-structures.test.js
 */

const TENANT_SVC = process.env.TENANT_SERVICE_URL || 'http://localhost:3002';
const JWT_SECRET = process.env.JWT_SECRET || 'sme-dev-jwt-secret';

// ── JWT helper (HS256) ────────────────────────────────────────────────────────
function signJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data   = `${header}.${body}`;
  const { createHmac } = require('crypto');
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const PLATFORM_ADMIN_JWT = signJwt(
  {
    sub: 'unit-test-admin',
    roles: ['PLATFORM_ADMIN'],
    permissions: ['TENANT_CREATE'],
    tenantId: 'MASTER_TEMPLATE',
    sessionId: `test-session-${Date.now()}`,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  JWT_SECRET,
);

const AUTH_HEADERS = {
  'content-type':    'application/json',
  'authorization':   `Bearer ${PLATFORM_ADMIN_JWT}`,
  'x-correlation-id': `test-seed-fs-${Date.now()}`,
};

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function unwrap(body) {
  if (body && typeof body === 'object' && 'data' in body) return body.data;
  return body;
}

async function httpGet(path) {
  const res = await fetch(`${TENANT_SVC}${path}`, { method: 'GET', headers: AUTH_HEADERS });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: unwrap(body) };
}

async function httpPost(path, payload) {
  const res = await fetch(`${TENANT_SVC}${path}`, {
    method: 'POST', headers: AUTH_HEADERS,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: unwrap(body) };
}

async function httpDelete(path) {
  const res = await fetch(`${TENANT_SVC}${path}`, { method: 'DELETE', headers: AUTH_HEADERS });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: unwrap(body) };
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { console.log(`  ✓ ${msg}`); passed++; }
  else           { console.error(`  ✗ ${msg}`); failed++; }
}

// ── Expected hierarchy ────────────────────────────────────────────────────────
const HIERARCHY = [
  {
    name: 'Admission Fee',
    description: 'One-time fees collected during admissions',
    items: [
      { name: 'Registration Fee',                 description: 'Non-refundable one-time registration fee' },
      { name: 'Admission Fee',                     description: 'One-time fee paid upon student admission' },
      { name: 'Security Deposit/Caution Deposit',  description: 'Refundable security deposit collected at admission' },
    ],
  },
  {
    name: 'Annual Fees',
    description: 'Recurring annual charges billed once per academic year',
    items: [
      { name: 'Infrastructure/Development Fee',  description: 'Annual infrastructure and campus development charge' },
      { name: 'Examination Fee',                 description: 'Annual examination and assessment fee' },
      { name: 'Lab/Library Fee',                 description: 'Annual laboratory and library access charge' },
      { name: 'Student Insurance & Diary',       description: 'Annual student insurance premium and school diary' },
    ],
  },
  { name: 'Tuition Fee',  description: 'Monthly or term-based tuition fee (class-tier pricing)' },
  { name: 'Utilities Fee', description: 'Transport and other utility charges (school defines amount)' },
];

(async () => {
  console.log('=== Seed Fee Structures (Hierarchical Categories) — Unit Test ===\n');

  // ════════════════════════════════════════════════════════════════════════════
  // Step -1: CLEANUP — remove all old fee structures and all old categories
  // ════════════════════════════════════════════════════════════════════════════
  console.log('-1. Cleanup: Remove old fee structures & old categories');

  const existingStructures = await httpGet('/web-admin/fee-structures');
  const structList = Array.isArray(existingStructures.body) ? existingStructures.body : [];
  if (structList.length > 0) {
    console.log(`   Deleting ${structList.length} old fee structures...`);
    for (const s of structList) { await httpDelete(`/web-admin/fee-structures/${s.id}`); }
    console.log(`   Deleted ${structList.length} structures.`);
  }

  const existingCats = await httpGet('/web-admin/fee-categories');
  const catList = Array.isArray(existingCats.body) ? existingCats.body : [];
  if (catList.length > 0) {
    const childrenFirst = catList.filter(c => c.parentId);
    const parentsThen = catList.filter(c => !c.parentId);
    console.log(`   Deleting ${childrenFirst.length} children + ${parentsThen.length} parents...`);
    for (const c of [...childrenFirst, ...parentsThen]) { await httpDelete(`/web-admin/fee-categories/${c.id}`); }
    console.log(`   Deleted ${catList.length} categories.`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Step 0: Ensure prerequisites (Academic Years, Classes)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n0. Ensure Prerequisites');

  const yrCheck = await httpGet('/web-admin/academic-years');
  let years = Array.isArray(yrCheck.body) ? yrCheck.body : [];
  if (years.length === 0) {
    await httpPost('/web-admin/academic-years/seed');
    const yrReload = await httpGet('/web-admin/academic-years');
    years = Array.isArray(yrReload.body) ? yrReload.body : [];
  }
  assert(years.length >= 1, `Academic years available (${years.length})`);

  const clsCheck = await httpGet('/web-admin/classes');
  let classes = Array.isArray(clsCheck.body) ? clsCheck.body : [];
  if (classes.length === 0) {
    await httpPost('/web-admin/classes/seed');
    const clsReload = await httpGet('/web-admin/classes');
    classes = Array.isArray(clsReload.body) ? clsReload.body : [];
  }
  assert(classes.length >= 12, `Classes available (${classes.length})`);

  // ════════════════════════════════════════════════════════════════════════════
  // Step 1: Seed hierarchical fee categories (4 parents + 7 items = 11 records)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n1. Seed Hierarchical Fee Categories');

  let totalCatsCreated = 0;
  for (const cat of HIERARCHY) {
    const parentRes = await httpPost('/web-admin/fee-categories', {
      name: cat.name, description: cat.description,
    });
    assert(parentRes.status === 201 || parentRes.status === 200,
      `Parent "${cat.name}" created (${parentRes.status})`);
    const parentId = parentRes.body?.id;
    totalCatsCreated++;

    if (cat.items) {
      for (const item of cat.items) {
        const itemRes = await httpPost('/web-admin/fee-categories', {
          name: item.name, description: item.description, parentId,
        });
        assert(itemRes.status === 201 || itemRes.status === 200,
          `  Item "${item.name}" under "${cat.name}" (${itemRes.status})`);
        totalCatsCreated++;
      }
    }
  }
  assert(totalCatsCreated === 11, `Total records created: ${totalCatsCreated} (expected 11)`);

  // ════════════════════════════════════════════════════════════════════════════
  // Step 2: Verify categories have correct hierarchy
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n2. Verify Category Hierarchy');
  const catRes = await httpGet('/web-admin/fee-categories');
  assert(catRes.status === 200, `GET /web-admin/fee-categories → 200 (got ${catRes.status})`);
  let categories = Array.isArray(catRes.body) ? catRes.body : [];
  assert(categories.length === 11, `Total 11 category records (got ${categories.length})`);

  const parentCats = categories.filter(c => !c.parentId);
  const childCats = categories.filter(c => c.parentId);
  assert(parentCats.length === 4, `4 parent categories (got ${parentCats.length})`);
  assert(childCats.length === 7, `7 child items (got ${childCats.length})`);

  for (const expected of ['Admission Fee', 'Annual Fees', 'Tuition Fee', 'Utilities Fee']) {
    assert(parentCats.some(c => c.name === expected), `Parent "${expected}" exists`);
  }

  const admissionParent = parentCats.find(c => c.name === 'Admission Fee');
  const admissionItems = childCats.filter(c => c.parentId === admissionParent?.id);
  assert(admissionItems.length === 3, `Admission Fee has 3 items (got ${admissionItems.length})`);

  const annualParent = parentCats.find(c => c.name === 'Annual Fees');
  const annualItems = childCats.filter(c => c.parentId === annualParent?.id);
  assert(annualItems.length === 4, `Annual Fees has 4 items (got ${annualItems.length})`);

  // ════════════════════════════════════════════════════════════════════════════
  // Step 3: Seed Fee Structures (12 × 9 leaf items = 108)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n3. Seed Fee Structures');
  const seedRes = await httpPost('/web-admin/fee-structures/seed');
  assert(seedRes.status === 201 || seedRes.status === 200,
    `POST /web-admin/fee-structures/seed → 2xx (got ${seedRes.status})`);
  console.log(`   Response: ${JSON.stringify(seedRes.body)}`);

  const expectedTotal = classes.length * 9;
  if (seedRes.status >= 200 && seedRes.status < 300) {
    const { created, skipped } = seedRes.body;
    assert(typeof created === 'number', `"created" count: ${created}`);
    assert(typeof skipped === 'number', `"skipped" count: ${skipped}`);
    assert((created || 0) + (skipped || 0) === expectedTotal,
      `Total = ${(created||0)+(skipped||0)}, expected ${expectedTotal}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Step 4: Verify structure list
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n4. Verify: List Fee Structures');
  const listRes = await httpGet('/web-admin/fee-structures');
  assert(listRes.status === 200, `GET /web-admin/fee-structures → 200 (got ${listRes.status})`);
  const structures = Array.isArray(listRes.body) ? listRes.body : [];
  assert(structures.length >= expectedTotal, `At least ${expectedTotal} structures (got ${structures.length})`);

  // ════════════════════════════════════════════════════════════════════════════
  // Step 5: Verify amounts
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n5. Verify: Amount Correctness');
  const catIdMap = new Map(categories.map(c => [c.id, c.name]));
  const classCodeMap = new Map(classes.map(c => [c.id, c.code]));

  function expectedAmount(catName, classCode) {
    if (catName === 'Registration Fee')                 return 500;
    if (catName === 'Admission Fee')                    return 5000;
    if (catName === 'Security Deposit/Caution Deposit') return 5000;
    if (catName === 'Infrastructure/Development Fee')   return 2000;
    if (catName === 'Examination Fee')                  return 1000;
    if (catName === 'Lab/Library Fee')                  return 1000;
    if (catName === 'Student Insurance & Diary')        return 500;
    if (catName === 'Utilities Fee')                    return null;
    if (catName === 'Tuition Fee') {
      const num = parseInt(classCode.replace(/\D/g, ''), 10);
      if (num >= 1 && num <= 5)   return 3500;
      if (num >= 6 && num <= 8)   return 4500;
      if (num >= 9 && num <= 10)  return 5500;
      if (num >= 11 && num <= 12) return 6500;
    }
    return null;
  }

  let amtPassed = 0, amtFailed = 0;
  for (const s of structures) {
    const catName   = catIdMap.get(s.feeCategoryId);
    const classCode = classCodeMap.get(s.classId);
    if (!catName || !classCode) continue;
    const expected = expectedAmount(catName, classCode);
    const actual   = s.amount != null ? Number(s.amount) : null;
    if (actual === expected) amtPassed++;
    else { amtFailed++; console.error(`    ✗ ${catName} / ${classCode}: expected ${expected}, got ${actual}`); }
  }
  assert(amtFailed === 0, `All amount checks passed (${amtPassed} passed, ${amtFailed} failed)`);

  // ════════════════════════════════════════════════════════════════════════════
  // Step 6: Idempotency
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n6. Verify: Idempotency');
  const reseed = await httpPost('/web-admin/fee-structures/seed');
  if (reseed.status >= 200 && reseed.status < 300) {
    assert(reseed.body.created === 0, `Re-seed created 0 (got ${reseed.body.created})`);
    assert(reseed.body.skipped > 0,   `Re-seed skipped all (${reseed.body.skipped})`);
  } else {
    assert(false, `Re-seed returned error ${reseed.status}: ${JSON.stringify(reseed.body)}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
})();
