import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/firestoreRules.test.ts'],
    environment: 'node',
    globals: true,
  },
});
