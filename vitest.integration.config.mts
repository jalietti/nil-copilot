import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// API-level tests against a running local Supabase (`npm run test:rls`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
