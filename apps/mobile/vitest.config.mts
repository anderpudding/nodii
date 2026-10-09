import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{lib,src}/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['{lib,src}/**/*.ts'],
      exclude: ['{lib,src}/**/*.test.ts'],
    },
  },
});
