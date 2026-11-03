// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/web/__tests__/**/*.test.ts', 'packages/shared/src/__tests__/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
  },
});
