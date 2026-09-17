import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/types.ts', 'src/constants.ts'],
      // NFR-10: 도메인 로직 커버리지 90% 이상
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
