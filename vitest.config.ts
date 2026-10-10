import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@agentcraft/engine': fileURLToPath(new URL('./packages/engine/src/index.ts', import.meta.url)),
      '@agentcraft/content': fileURLToPath(new URL('./packages/content/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 15000,
  },
});
