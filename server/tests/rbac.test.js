import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';
import { setupTestDb } from './dbSetup.js';

setupTestDb();

// Registers a user, promotes it to admin directly in the DB, then logs in
// for a fresh admin-role access token — mirrors what the first RBAC test
// below does inline.
const registerAdmin = async (email = 'admin@example.com') => {
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'Admin User', email, password: 'password123' });
  await User.updateOne({ email }, { role: 'admin' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return login.body.accessToken;
};

const registerUser = async (email, name = 'Regular User') => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123' });
  return { accessToken: res.body.accessToken, id: res.body._id };
};

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

describe('RBAC: GET /api/auth/admin/users', () => {
  it('rejects a non-admin with 403', async () => {
    const { accessToken } = await registerUser('user@example.com');
    const res = await request(app)
      .get('/api/auth/admin/users')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  it('lists and searches users for an admin', async () => {
    const adminToken = await registerAdmin();
    await registerUser('alice@example.com', 'Alice');
    await registerUser('bob@example.com', 'Bob');

    const all = await request(app)
      .get('/api/auth/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3); // admin + alice + bob
    expect(all.body.users[0].password).toBeUndefined();

    const searched = await request(app)
      .get('/api/auth/admin/users?search=alice')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(searched.status).toBe(200);
    expect(searched.body.total).toBe(1);
    expect(searched.body.users[0].email).toBe('alice@example.com');
  });
});

describe('RBAC: PATCH /api/auth/admin/users/:id/role', () => {
  it('promotes a regular user to admin', async () => {
    const adminToken = await registerAdmin();
    const { id } = await registerUser('user@example.com');

    const res = await request(app)
      .patch(`/api/auth/admin/users/${id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('refuses to let an admin change their own role', async () => {
    const adminToken = await registerAdmin();
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .patch(`/api/auth/admin/users/${me.body._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'user' });
    expect(res.status).toBe(400);
  });

  it('demoted user loses admin-only access on their next request', async () => {
    const adminToken = await registerAdmin('admin1@example.com');
    const adminToken2 = await registerAdmin('admin2@example.com');
    const me2 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken2}`);

    const demote = await request(app)
      .patch(`/api/auth/admin/users/${me2.body._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'user' });
    expect(demote.status).toBe(200);

    // req.user is re-fetched from the DB on every request, so the same
    // still-valid access token now carries a stale (admin) claim that the
    // DB no longer backs — the authorize() check must use fresh data.
    const res = await request(app)
      .get('/api/auth/admin/stats')
      .set('Authorization', `Bearer ${adminToken2}`);
    expect(res.status).toBe(403);
  });
});

describe('RBAC: PATCH /api/auth/admin/users/:id/ban', () => {
  it('suspends a user and immediately blocks their existing session', async () => {
    const adminToken = await registerAdmin();
    const { accessToken, id } = await registerUser('user@example.com');

    const ban = await request(app)
      .patch(`/api/auth/admin/users/${id}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isBanned: true, reason: 'Spam' });
    expect(ban.status).toBe(200);
    expect(ban.body.isBanned).toBe(true);

    // Same still-valid (not yet expired) access token, now rejected.
    const blocked = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(blocked.status).toBe(403);
  });

  it('blocks a banned user from logging back in', async () => {
    const adminToken = await registerAdmin();
    const { id } = await registerUser('user@example.com');
    await request(app)
      .patch(`/api/auth/admin/users/${id}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isBanned: true });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' });
    expect(login.status).toBe(403);
  });

  it('refuses to let an admin suspend their own account', async () => {
    const adminToken = await registerAdmin();
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .patch(`/api/auth/admin/users/${me.body._id}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isBanned: true });
    expect(res.status).toBe(400);
  });

  it('refuses to suspend another admin directly', async () => {
    const adminToken = await registerAdmin('admin1@example.com');
    const adminToken2 = await registerAdmin('admin2@example.com');
    const me2 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken2}`);

    const res = await request(app)
      .patch(`/api/auth/admin/users/${me2.body._id}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isBanned: true });
    expect(res.status).toBe(400);
  });

  it('reinstates a suspended user', async () => {
    const adminToken = await registerAdmin();
    const { id } = await registerUser('user@example.com');
    await request(app)
      .patch(`/api/auth/admin/users/${id}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isBanned: true });

    const unban = await request(app)
      .patch(`/api/auth/admin/users/${id}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isBanned: false });
    expect(unban.status).toBe(200);
    expect(unban.body.isBanned).toBe(false);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' });
    expect(login.status).toBe(200);
  });
});
