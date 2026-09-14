import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './global-setup.js';

// Phase 14: playwright.config.js lives in client/e2e/ rather than the repo
// root — this project has no root package.json, and Playwright itself has
// no opinion about where its config sits as long as it's pointed at
// correctly (see client/package.json's "test:e2e" script).
export default defineConfig({
  testDir: './',
  globalSetup: './global-setup.js',
  globalTeardown: './global-teardown.js',
  timeout: 30000,
  fullyParallel: false, // both specs share the one isolated backend/frontend pair booted in global-setup
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
