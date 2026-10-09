import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { 'react-native': 'react-native-web' } },
  test: {
    include: ['{lib,src}/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['{lib,src}/**/*.{ts,tsx}'],
      exclude: ['{lib,src}/**/*.test.{ts,tsx}'],
    },
  },
});
