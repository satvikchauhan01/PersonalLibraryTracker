import { beforeAll, afterEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Phase 14: one in-memory MongoDB per test file — call this once at the top
// of a describe block. Registers its own beforeAll/afterEach/afterAll on
// vitest's global hooks, so a test file just needs `setupTestDb()` and
// nothing else. afterEach clears every collection so tests never share state.
export const setupTestDb = () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterEach(async () => {
    const { collections } = mongoose.connection;
    await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
};
