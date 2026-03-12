/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Ensure this covers your source files so Vitest has something to calculate!
    include: ['src/**/*.spec.ts'], 
    // Remove or update this if backend doesn't have a test-setup.ts
    // setupFiles: ['./src/test-setup.ts'], 
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'json-summary'],
      // This 'include' tells Vitest EXACTLY what to measure for the %
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'node_modules/**'],
      clean: true,
    },
    testTimeout: 5000,
  },
});

