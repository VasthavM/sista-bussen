import { defineConfig, devices } from '@playwright/test';

// PW_PORT lets concurrent worktrees run e2e without sharing (and killing) each other's preview server.
const PORT = process.env.PW_PORT ?? '4173';
const ORIGIN = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: ORIGIN,
    colorScheme: 'dark',
    // The cold open covers the whole first launch. Every spec starts as a returning player;
    // coldopen.spec.ts clears this to test the real first launch.
    storageState: {
      cookies: [],
      origins: [{ origin: ORIGIN, localStorage: [{ name: 'sista-bussen.coldopen.v1', value: '1' }] }],
    },
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    // The iOS engine: the update flow must hold under WebKit too (#10). Only the update spec runs here.
    { name: 'webkit', testMatch: 'update.spec.ts', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});