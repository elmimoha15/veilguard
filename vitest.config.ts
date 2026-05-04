import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    timeout: 10000,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
