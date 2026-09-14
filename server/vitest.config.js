import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/env.js'],
    // Auth/RBAC/webhook tests share one in-memory mongod per file (started
    // in each file's own beforeAll) — running files in parallel would mean
    // multiple mongod instances at once, which is fine but slow to boot
    // repeatedly. Sequential keeps this simple and fast enough at this suite's size.
    fileParallelism: false,
    testTimeout: 20000, // mongodb-memory-server's first download/boot can be slow
    hookTimeout: 30000,
  },
});
