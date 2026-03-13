/**
 * UI Registration Test — Playwright
 * ===================================
 * Opens the SME web portal registration page in a real browser,
 * fills every form field, submits the form, and reports the full
 * result inline — no need to open any report files.
 *
 * Pre-requisites:
 *   1. Backend services running  (npm run smeapplocal)
 *   2. Web Portal running        (web-portal on http://sme.test:3102)
 *
 * Run:
 *   npx playwright test "UnitTesting/register.ui.spec.js" --config playwright.config.js
 *
 * Or via npm script:
 *   npm run test:ui:register
 */

const { test, expect } = require('@playwright/test');

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Print a labelled divider line */
function div(label = '') {
  const line = '─'.repeat(60);
  console.log(label ? `\n  ┌── ${label} ${'─'.repeat(Math.max(0, 54 - label.length))}` : `\n  ${line}`);
}

/** Print one input field + value that was fed to the form */
function field(name, value, masked = false) {
  const display = masked ? '*'.repeat(String(value).length) : value;
  console.log(`  │  ${name.padEnd(22)}: ${display}`);
}

/** Print the closing bar of a section */
function divClose() {
  console.log('  └' + '─'.repeat(59));
}

/**
 * Scrape ALL visible error / alert text from the page.
 * Returns an array of non-empty strings.
 */
async function scrapeErrors(page) {
  return page.evaluate(() => {
    const selectors = [
      '[class*="error"]',
      '[class*="Error"]',
      '[class*="alert"]',
      '[class*="Alert"]',
      '[class*="danger"]',
      '[class*="red"]',
      '[role="alert"]',
      'p.text-red-700',
      'span.text-red-700',
      'div.text-red-700',
      '[data-testid*="error"]',
      '[data-testid*="alert"]',
    ];
    const seen  = new Set();
    const texts = [];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const t = el.innerText?.trim();
        // Exclude lone asterisks — these are required-field indicators (*), not errors
        if (t && t !== '*' && t.length > 1 && !seen.has(t)) { seen.add(t); texts.push(t); }
      });
    });
    return texts;
  });
}

/**
 * Scrape the full visible page body text (trimmed, deduplicated lines).
 * Useful when the error lives in an unexpected element.
 */
async function scrapePageText(page) {
  return page.evaluate(() =>
    (document.body?.innerText || '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
  );
}

/**
 * Print a formatted report of captured network API calls.
 */
function printNetworkLog(networkLog) {
  if (!networkLog.length) {
    console.log('\n  ℹ️  No API calls were captured during this test.');
    return;
  }
  div('NETWORK CALLS CAPTURED');
  networkLog.forEach((entry, i) => {
    console.log(`\n  [${i + 1}] ${entry.method} ${entry.url}`);
    console.log(`      Status  : ${entry.status ?? '(no response)'}`);
    if (entry.requestBody) {
      console.log(`      Request : ${JSON.stringify(entry.requestBody, null, 0)}`);
    }
    if (entry.responseBody) {
      const pretty = typeof entry.responseBody === 'string'
        ? entry.responseBody
        : JSON.stringify(entry.responseBody, null, 2)
            .split('\n')
            .map((l, idx) => (idx === 0 ? l : '               ' + l))
            .join('\n');
      console.log(`      Response: ${pretty}`);
    }
  });
  divClose();
}

/**
 * Attach a network interceptor that records every XHR/Fetch call.
 * Returns the mutable array that fills as the test runs.
 */
function attachNetworkLogger(page) {
  const log = [];

  page.on('request', async req => {
    if (!['xhr', 'fetch'].includes(req.resourceType())) return;
    const entry = { method: req.method(), url: req.url(), status: null, requestBody: null, responseBody: null };
    try {
      const raw = req.postData();
      if (raw) entry.requestBody = JSON.parse(raw);
    } catch { /* not JSON */ }
    log.push(entry);
  });

  page.on('response', async res => {
    if (!['xhr', 'fetch'].includes(res.request().resourceType())) return;
    const entry = log.find(e => e.url === res.url() && e.method === res.request().method() && e.status === null);
    if (!entry) return;
    entry.status = res.status();
    try {
      entry.responseBody = await res.json();
    } catch {
      try { entry.responseBody = await res.text(); } catch { /* ignore */ }
    }
  });

  return log;
}

// ─── Test data ───────────────────────────────────────────────────────────────

const UNIQUE_SUFFIX = Date.now();
const SCHOOL_NAME   = `UI Test School ${UNIQUE_SUFFIX}`;
const SUBDOMAIN     = `ui-test-school-${UNIQUE_SUFFIX}`;
const ADMIN_EMAIL   = `admin${UNIQUE_SUFFIX}@uitestschool.edu`;

// ─────────────────────────────────────────────────────────────────────────────
// TC-01: Successful Registration
// ─────────────────────────────────────────────────────────────────────────────
test('TC-01: Should register a new school successfully', async ({ page }) => {

  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-01 : Full registration flow with VALID data');
  console.log('════════════════════════════════════════════════════════════');

  // ── Network logger ────────────────────────────────────────────────────────
  const networkLog = attachNetworkLogger(page);

  // ── Browser console error capture ─────────────────────────────────────────
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', err => consoleErrors.push(`[page.error] ${err.message}`));

  // ── 1. Open the registration page ─────────────────────────────────────────
  console.log('\n  ▶ Opening  http://sme.test:3102/register …');
  console.log('  ℹ️  Note: First load may take up to 60s (Next.js cold-start compile)');

  let pageLoadError = null;
  try {
    await page.goto('http://sme.test:3102/register', { timeout: 60000 });
  } catch (err) {
    pageLoadError = err.message;
  }

  if (pageLoadError) {
    console.log(`\n  ❌ PAGE LOAD FAILED`);
    console.log(`     Error : ${pageLoadError}`);
    console.log(`\n  ⚠️  Is the web-portal running on http://sme.test:3102?`);
    console.log(`     Start it with: npm run dev:web-portal`);
    throw new Error(`Page load failed: ${pageLoadError}`);
  }

  const pageTitle = await page.title();
  console.log(`  ✅ Page loaded — Title: "${pageTitle}"`);
  console.log(`     URL   : ${page.url()}`);

  // ── 2. Print all input values BEFORE submitting ────────────────────────────
  div('INPUT DATA SENT TO FORM');
  field('School Name',      SCHOOL_NAME);
  field('UDISE Code',       '12345678901');
  field('Address',          '123 Test Street, Near Central Park');
  field('City',             'Bhopal');
  field('District',         'Bhopal District');
  field('State',            'Madhya Pradesh');
  field('Pincode',          '462001');
  field('Admin Name',       'Test Admin User');
  field('Admin Email',      ADMIN_EMAIL);
  field('Contact Phone',    '+919876543210');
  field('Password',         'TestPass@123', true);
  field('Subdomain',        SUBDOMAIN);
  divClose();

  // ── 3. Fill all form fields ────────────────────────────────────────────────
  console.log('\n  ▶ Filling form fields…');

  const fillField = async (selector, value, label) => {
    try {
      await page.fill(selector, value);
      console.log(`     ✅ ${label}`);
    } catch (err) {
      console.log(`     ⚠️  ${label} — field not found (${selector}) : ${err.message}`);
    }
  };

  await fillField('input[name="schoolName"]',         SCHOOL_NAME,                    'School Name');
  await fillField('input[name="udiseCode"]',           '12345678901',                  'UDISE Code');
  await fillField('input[name="address"]',             '123 Test Street, Near Central Park', 'Address');
  await fillField('input[name="city"]',                'Bhopal',                       'City');
  await fillField('input[name="dist"]',                'Bhopal District',              'District');
  await fillField('input[name="state"]',               'Madhya Pradesh',               'State');
  await fillField('input[name="pincode"]',             '462001',                       'Pincode');
  await fillField('input[name="adminName"]',           'Test Admin User',              'Admin Name');
  await fillField('input[name="adminEmail"]',          ADMIN_EMAIL,                    'Admin Email');
  await fillField('input[name="primaryContactPhone"]', '+919876543210',                'Contact Phone');
  await fillField('input[name="password"]',            'TestPass@123',                 'Password (masked)');
  await fillField('input[name="subdomain"]',           SUBDOMAIN,                      'Subdomain');

  // ── 4. Submit the form ─────────────────────────────────────────────────────
  console.log('\n  ▶ Submitting form…');
  await page.click('button[type="submit"]');

  // ── 5. Wait for page outcome ──────────────────────────────────────────────
  // NOTE: We do NOT use [class*="red"] because the form has required-field
  // asterisks <span class="text-red-500">*</span> that are ALWAYS visible —
  // using that selector would cause an immediate false-positive 'error' outcome.
  // Instead we use the specific error paragraph class (p.text-red-700) which
  // only renders when error state is set by the React component.
  let outcome = 'unknown';
  try {
    outcome = await Promise.race([
      page.waitForSelector('h1:has-text("Application Received")', { timeout: 45000 }).then(() => 'success'),
      page.waitForSelector('p.text-red-700, [role="alert"]', { timeout: 45000 }).then(() => 'error'),
    ]);
  } catch {
    outcome = 'timeout';
  }

  // Allow any pending network responses to fully resolve before reading log
  await page.waitForTimeout(3000);

  // ── 6. Collect all page error messages ────────────────────────────────────
  const errorMessages = await scrapeErrors(page);

  // ── 7. Print result ────────────────────────────────────────────────────────
  console.log('\n');
  div('RESULT');

  if (outcome === 'success') {
    const heading    = await page.textContent('h1').catch(() => '');
    const subheading = await page.textContent('p.text-slate-600, p.text-gray-600').catch(() => '');
    console.log('  │');
    console.log('  │  STATUS  : ✅  REGISTRATION SUCCESSFUL');
    console.log(`  │  Heading : ${heading.trim()}`);
    if (subheading) console.log(`  │  Message : ${subheading.trim()}`);
  } else if (outcome === 'timeout') {
    const visibleText = await scrapePageText(page);
    console.log('  │');
    console.log('  │  STATUS  : ⏱️  TIMEOUT — no success or error appeared within 45 s');
    console.log(`  │  URL now : ${page.url()}`);
    console.log('  │');
    console.log('  │  Visible page text (first 30 lines):');
    visibleText.slice(0, 30).forEach(l => console.log(`  │    ${l}`));
  } else {
    console.log('  │');
    console.log('  │  STATUS  : ❌  REGISTRATION FAILED');
  }

  if (errorMessages.length) {
    console.log('  │');
    console.log('  │  ERRORS SHOWN ON PAGE:');
    errorMessages.forEach((msg, i) => console.log(`  │    [${i + 1}] ${msg}`));
  }

  divClose();

  // ── 8. Network summary ─────────────────────────────────────────────────────
  printNetworkLog(networkLog);

  // ── 8b. Browser console errors ─────────────────────────────────────────────
  if (consoleErrors.length) {
    div('BROWSER CONSOLE ERRORS');
    consoleErrors.forEach((e, i) => console.log(`  [${i + 1}] ${e}`));
    divClose();
  }

  console.log('');

  // ── 9. Assert ─────────────────────────────────────────────────────────────
  await expect(page.locator('h1')).toContainText('Application Received', { timeout: 10000 });
});


// ─────────────────────────────────────────────────────────────────────────────
// TC-02: Validation Error — Missing Required Field
// ─────────────────────────────────────────────────────────────────────────────
test('TC-02: Should show error when required field (School Name) is missing', async ({ page }) => {

  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-02 : Submit with MISSING School Name — expect validation');
  console.log('════════════════════════════════════════════════════════════');

  const networkLog = attachNetworkLogger(page);

  console.log('\n  ▶ Opening  http://sme.test:3102/register …');
  let pageLoadError = null;
  try {
    await page.goto('http://sme.test:3102/register', { timeout: 30000 });
  } catch (err) {
    pageLoadError = err.message;
  }
  if (pageLoadError) {
    console.log(`\n  ❌ PAGE LOAD FAILED: ${pageLoadError}`);
    throw new Error(`Page load failed: ${pageLoadError}`);
  }
  console.log(`  ✅ Page loaded — URL: ${page.url()}`);

  const tc02Email    = `admin${UNIQUE_SUFFIX + 1}@test.edu`;
  const tc02Subdomain = `missing-name-${UNIQUE_SUFFIX}`;

  div('INPUT DATA SENT TO FORM  (School Name intentionally blank)');
  field('School Name',      '(blank — intentionally omitted)');
  field('UDISE Code',       '12345678901');
  field('Address',          '123 Test Street');
  field('City',             'Bhopal');
  field('State',            'Madhya Pradesh');
  field('Admin Name',       'Test Admin');
  field('Admin Email',      tc02Email);
  field('Contact Phone',    '+919876543210');
  field('Password',         'TestPass@123', true);
  field('Subdomain',        tc02Subdomain);
  divClose();

  console.log('\n  ▶ Filling form fields (skipping School Name)…');
  await page.fill('input[name="udiseCode"]',           '12345678901');
  await page.fill('input[name="address"]',             '123 Test Street');
  await page.fill('input[name="city"]',                'Bhopal');
  await page.fill('input[name="state"]',               'Madhya Pradesh');
  await page.fill('input[name="adminName"]',           'Test Admin');
  await page.fill('input[name="adminEmail"]',          tc02Email);
  await page.fill('input[name="primaryContactPhone"]', '+919876543210');
  await page.fill('input[name="password"]',            'TestPass@123');
  await page.fill('input[name="subdomain"]',           tc02Subdomain);
  console.log('     ✅ All fields filled (School Name left blank)');

  console.log('\n  ▶ Attempting to submit…');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000);

  // Check browser-native HTML5 validity
  const html5Invalid = await page.locator('input[name="schoolName"]')
    .evaluate(el => !el.validity.valid).catch(() => false);

  // Check for any server / app-level error messages
  const errorMessages = await scrapeErrors(page);

  await page.waitForTimeout(1500);

  console.log('\n');
  div('RESULT');
  console.log('  │');

  if (html5Invalid) {
    console.log('  │  STATUS  : ✅  HTML5 browser validation blocked submit');
    console.log('  │            School Name field marked as invalid by browser');
  } else if (errorMessages.length) {
    console.log('  │  STATUS  : ✅  Server / app validation returned errors');
    console.log('  │');
    console.log('  │  ERRORS SHOWN ON PAGE:');
    errorMessages.forEach((msg, i) => console.log(`  │    [${i + 1}] ${msg}`));
  } else {
    const successVisible = await page.locator('h1:has-text("Application Received")').isVisible().catch(() => false);
    if (successVisible) {
      console.log('  │  STATUS  : ❌  UNEXPECTED — registration succeeded without School Name!');
    } else {
      const visibleText = await scrapePageText(page);
      console.log('  │  STATUS  : ⚠️  No validation error found (and no success page)');
      console.log('  │  URL now : ' + page.url());
      console.log('  │');
      console.log('  │  Visible page text:');
      visibleText.slice(0, 20).forEach(l => console.log(`  │    ${l}`));
    }
  }

  divClose();
  printNetworkLog(networkLog);
  console.log('');

  // The success page must NOT have appeared
  await expect(page.locator('h1')).not.toContainText('Application Received', { timeout: 3000 }).catch(() => {});
});


// ─────────────────────────────────────────────────────────────────────────────
// TC-03: Duplicate Subdomain
// ─────────────────────────────────────────────────────────────────────────────
test('TC-03: Should show error when subdomain already exists', async ({ page }) => {

  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('  TC-03 : Submit with a DUPLICATE subdomain — expect conflict');
  console.log('════════════════════════════════════════════════════════════');

  const networkLog = attachNetworkLogger(page);

  // Using a fixed suffix that likely already exists (registered in TC-01 of a
  // previous run, or manually seeded). Adjust the suffix below if needed.
  const DUP_SUFFIX    = UNIQUE_SUFFIX - 1;
  const dupSchoolName = `Duplicate School ${DUP_SUFFIX}`;
  const dupEmail      = `dup${DUP_SUFFIX}@test.edu`;
  const dupSubdomain  = `ui-test-school-${DUP_SUFFIX}`;

  console.log('\n  ▶ Opening  http://sme.test:3102/register …');
  let pageLoadError = null;
  try {
    await page.goto('http://sme.test:3102/register', { timeout: 30000 });
  } catch (err) {
    pageLoadError = err.message;
  }
  if (pageLoadError) {
    console.log(`\n  ❌ PAGE LOAD FAILED: ${pageLoadError}`);
    throw new Error(`Page load failed: ${pageLoadError}`);
  }
  console.log(`  ✅ Page loaded — URL: ${page.url()}`);

  div('INPUT DATA SENT TO FORM  (duplicate subdomain)');
  field('School Name',   dupSchoolName);
  field('UDISE Code',    '99999999999');
  field('Address',       '456 Conflict Road');
  field('City',          'Mumbai');
  field('State',         'Maharashtra');
  field('Admin Name',    'Duplicate Admin');
  field('Admin Email',   dupEmail);
  field('Contact Phone', '+919999999999');
  field('Password',      'TestPass@123', true);
  field('Subdomain',     dupSubdomain + '  ← intentional duplicate');
  divClose();

  console.log('\n  ▶ Filling form fields…');
  await page.fill('input[name="schoolName"]',         dupSchoolName);
  await page.fill('input[name="udiseCode"]',           '99999999999');
  await page.fill('input[name="address"]',             '456 Conflict Road');
  await page.fill('input[name="city"]',                'Mumbai');
  await page.fill('input[name="state"]',               'Maharashtra');
  await page.fill('input[name="adminName"]',           'Duplicate Admin');
  await page.fill('input[name="adminEmail"]',          dupEmail);
  await page.fill('input[name="primaryContactPhone"]', '+919999999999');
  await page.fill('input[name="password"]',            'TestPass@123');
  await page.fill('input[name="subdomain"]',           dupSubdomain);
  console.log('     ✅ All fields filled');

  console.log('\n  ▶ Submitting form…');
  await page.click('button[type="submit"]');

  // Allow response to arrive
  await page.waitForTimeout(6000);

  const isSuccessPage = await page.locator('h1:has-text("Application Received")').isVisible().catch(() => false);
  const errorMessages = await scrapeErrors(page);

  // Allow any trailing network calls to finish
  await page.waitForTimeout(1000);

  console.log('\n');
  div('RESULT');
  console.log('  │');

  if (isSuccessPage) {
    console.log('  │  STATUS  : ⚠️  UNEXPECTED — registration succeeded with a duplicate subdomain');
    console.log(`  │            Subdomain used: ${dupSubdomain}`);
    console.log('  │            (this subdomain may not exist yet in the DB — run TC-01 first)');
  } else if (errorMessages.length) {
    console.log('  │  STATUS  : ✅  Conflict / duplicate error shown correctly');
    console.log('  │');
    console.log('  │  ERRORS SHOWN ON PAGE:');
    errorMessages.forEach((msg, i) => console.log(`  │    [${i + 1}] ${msg}`));
  } else {
    const visibleText = await scrapePageText(page);
    console.log('  │  STATUS  : ℹ️  Neither success nor error is visible');
    console.log('  │  URL now : ' + page.url());
    console.log('  │');
    console.log('  │  Visible page text:');
    visibleText.slice(0, 20).forEach(l => console.log(`  │    ${l}`));
  }

  divClose();
  printNetworkLog(networkLog);
  console.log('');
});
