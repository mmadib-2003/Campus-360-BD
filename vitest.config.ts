// vitest.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirrors apps/web/tsconfig.json paths ("@/*" -> "apps/web/*").
    alias: { '@': fileURLToPath(new URL('./apps/web', import.meta.url)) },
  },
  test: {
    include: ['apps/web/__tests__/**/*.test.ts', 'packages/shared/src/__tests__/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
  },
});
