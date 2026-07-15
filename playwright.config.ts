import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3101';
const startServer = process.env.PLAYWRIGHT_START_SERVER === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  expect: {
    toHaveScreenshot: {
      // Soft thresholds — WebGL/fonts can vary slightly across environments
      threshold: 0.35,
      maxDiffPixelRatio: 0.08,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Keep visual/e2e deterministic on one worker (CI + local)
  // Production smoke is excluded via package.json --grep-invert @production
  webServer: startServer
    ? {
        command: 'npm run preview -- --host 127.0.0.1 --port 3101',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
