import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:8080';
const target = new URL(baseURL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !['http:', 'https:'].includes(target.protocol)) {
  throw new Error('E2E_BASE_URL must use a loopback HTTP(S) test environment.');
}
if (target.username || target.password || target.search || target.hash || target.pathname !== '/') {
  throw new Error('E2E_BASE_URL must be an origin without credentials, path, query or fragment.');
}

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  globalTimeout: 120_000,
  expect: { timeout: 10_000 },
  outputDir: '../../target/e2e/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../target/e2e/report', open: 'never' }],
    ['junit', { outputFile: '../../target/e2e/junit.xml' }],
  ],
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
