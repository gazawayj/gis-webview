/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],        // include all spec files
    exclude: ['src/app/app.spec.ts'],     // exclude app.spec.ts from CI
    setupFiles: ['./src/test-setup.ts'], // initialize Angular test environment
  },
});
