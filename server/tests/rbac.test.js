import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';
import { setupTestDb } from './dbSetup.js';

setupTestDb();

describe('RBAC: GET /api/auth/admin/stats', () => {
  it('returns 401 with no access token at all', async () => {
    const res = await request(app).get('/api/auth/admin/stats');
    expect(res.status).toBe(401);
  });

  it('returns 403 for an authenticated non-admin user', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Regular User', email: 'user@example.com', password: 'password123' });

    const res = await request(app)
      .get('/api/auth/admin/stats')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with a user count for an admin', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Admin User', email: 'admin@example.com', password: 'password123' });

    // Promote directly in the DB (mirrors scripts/createAdmin.js's bootstrap
    // approach) — the access token issued at register time still carries
    // role: 'user', so a fresh login is needed to get one with role: 'admin'.
    await User.updateOne({ email: 'admin@example.com' }, { role: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'password123' });

    const res = await request(app)
      .get('/api/auth/admin/stats')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalUsers).toBe('number');
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(1);
  });
});
