import { defineConfig, devices } from '@playwright/test';

const gameURL = process.env.AGENTCRAFT_TEST_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  // Desktop is the supported target; previous mobile acceptance remains archived.
  testIgnore: '**/offline.spec.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: gameURL ?? 'http://localhost:5173',
    viewport: { width: 1366, height: 768 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-1366x768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
  ],
  webServer: gameURL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
