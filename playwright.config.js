// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for SME UI tests.
 * Tests run against the already running web-portal on http://sme.test:3102
 * The webServer block is intentionally omitted to avoid starting Next.js again.
 */
module.exports = defineConfig({
  testDir: './UnitTesting',
  testMatch: '**/*.ui.spec.js',

  /* Maximum time one test can run — 90s to allow for Next.js cold-start */
  timeout: 90_000,

  /* Run tests in parallel — set to false to see results sequentially */
  fullyParallel: false,

  /* Fail fast on CI if a test fails */
  retries: 0,

  /* Reporter format */
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    /* Base URL for all navigation calls */
    baseURL: 'http://sme.test:3102',

    /* Take a screenshot on failure for debugging */
    screenshot: 'only-on-failure',

    /* Record a video on failure */
    video: 'retain-on-failure',

    /* Increase navigation timeout */
    navigationTimeout: 15_000,

    /* Action timeout */
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
