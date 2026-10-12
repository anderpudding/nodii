import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { 'react-native': 'react-native-web' } },
  test: {
    include: ['{lib,src}/**/*.test.{ts,tsx}'],
    exclude: ['**/*.native.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['./lib/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['{lib,src}/**/*.{ts,tsx}'],
      exclude: ['{lib,src}/**/*.test.{ts,tsx}'],
    },
  },
});
