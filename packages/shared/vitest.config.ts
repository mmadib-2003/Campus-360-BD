// packages/shared/vitest.config.ts
//
// `pnpm turbo run test` executes this workspace's `vitest run` with cwd set to
// packages/shared. Without a config here, vitest walks up and picks up the repo-root
// vitest.config.ts, whose `test.include` globs ("apps/web/__tests__/**",
// "packages/shared/src/__tests__/**") are relative to the REPOSITORY ROOT. Resolved
// against packages/shared they match nothing, and vitest exits 1 with
// "No test files found" -- which failed the CI `verify` job even though every test
// in the repo passed. Globs for a workspace must be workspace-relative.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    environment: 'node',
    // Keep the "no tests" case loud inside this workspace too: if the include stops
    // matching, CI should fail rather than quietly report success.
    passWithNoTests: false,
  },
});
