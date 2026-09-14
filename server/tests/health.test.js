import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../app.js';

// Phase 17: manages its own connection (rather than the shared
// tests/dbSetup.js helper) because this file deliberately disconnects
// mid-test to exercise the 503 path — sharing a connection with other test
// files here would risk leaving them without a working DB mid-suite.
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  await mongod.stop();
});

describe('GET /health', () => {
  it('returns 200 and "connected" when Mongo is up', async () => {
    await mongoose.connect(mongod.getUri());
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', mongo: 'connected' });
  });

  it('returns 503 and "disconnected" when Mongo is down', async () => {
    await mongoose.disconnect();
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', mongo: 'disconnected' });
  });
});
