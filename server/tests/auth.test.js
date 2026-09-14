import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { setupTestDb } from './dbSetup.js';

setupTestDb();

const registerUser = (overrides = {}) =>
  request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: 'test@example.com', password: 'password123', ...overrides });

describe('Auth: register', () => {
  it('registers a new user, returning an access token and a refresh cookie', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.password).toBeUndefined(); // never leaked in the response
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeTruthy();
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    await registerUser();
    const res = await registerUser();
    expect(res.status).toBe(400);
  });
});

describe('Auth: login', () => {
  it('logs in with correct credentials', async () => {
    await registerUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects an incorrect password', async () => {
    await registerUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });
});

describe('Auth: refresh rotation + reuse-detection', () => {
  it('rotates the refresh token on /refresh — issues a new one, invalidates the old', async () => {
    const reg = await registerUser();
    const originalCookie = reg.headers['set-cookie'];

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    const rotatedCookie = refreshed.headers['set-cookie'];
    expect(rotatedCookie).toBeTruthy();
    expect(rotatedCookie[0]).not.toBe(originalCookie[0]);
  });

  it('detects reuse of an already-rotated refresh token and revokes every session', async () => {
    const reg = await registerUser();
    const originalCookie = reg.headers['set-cookie'];

    // Rotate once — `originalCookie` is now a revoked, spent token.
    const firstRefresh = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
    expect(firstRefresh.status).toBe(200);
    const rotatedCookie = firstRefresh.headers['set-cookie'];

    // Replaying the spent token is exactly what a stolen-cookie attacker
    // would do — must be rejected...
    const reuseAttempt = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
    expect(reuseAttempt.status).toBe(401);

    // ...and must burn the *legitimate* rotated token too, not just the
    // replayed one — reuse of any token in the chain means the whole chain
    // is compromised, so every session dies, not just the flagged one.
    const legitimateAfterCompromise = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', rotatedCookie);
    expect(legitimateAfterCompromise.status).toBe(401);
  });

  it('rejects /refresh with no cookie at all', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});
