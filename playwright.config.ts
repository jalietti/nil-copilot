import { defineConfig, devices } from '@playwright/test'

// End-to-end tests of the core athlete flow against a running local Supabase
// (`npx supabase start`). `npm run test:e2e` resets the local database to the
// seed first — see docs/testing.md.
const port = Number(process.env.E2E_PORT ?? 3400)

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'node tests/e2e/mock-anthropic.mjs',
      port: Number(process.env.MOCK_ANTHROPIC_PORT ?? 4010),
      reuseExistingServer: false,
    },
    {
      command: 'bash scripts/e2e-server.sh',
      url: `http://localhost:${port}/login`,
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
})
