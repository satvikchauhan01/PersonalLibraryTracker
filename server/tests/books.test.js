import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { setupTestDb } from './dbSetup.js';

setupTestDb();

const registerAndGetToken = async (email = 'books-user@example.com') => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Books Tester', email, password: 'password123' });
  return res.body.accessToken;
};

// Phase 18 regression: models/Book.js's { user, isbn } unique index used to
// be `sparse: true`, which only skips documents where isbn is *missing* —
// addBook/importBooks/updateBook all explicitly store `isbn: null` (not
// "missing") when no ISBN is given, so a sparse index still enforced
// uniqueness on it. Net effect: a user's SECOND book with no ISBN always
// 409'd as a false-positive duplicate. Found live while seeding multiple
// no-ISBN books for Phase 18's own AI-feature testing — see models/Book.js's
// index comment and scripts/fixIsbnIndex.js for the full story and the
// migration path for databases built under the old (broken) index.
describe('Book ISBN uniqueness (Phase 18 regression)', () => {
  it('allows a user to add multiple books with no ISBN', async () => {
    const token = await registerAndGetToken();

    const b1 = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Book One', author: 'Author A' });
    expect(b1.status).toBe(201);
    expect(b1.body.isbn).toBeNull();

    const b2 = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Book Two', author: 'Author B' });
    expect(b2.status).toBe(201);
    expect(b2.body.isbn).toBeNull();

    const b3 = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Book Three', author: 'Author C' });
    expect(b3.status).toBe(201);
  });

  it('still rejects a real duplicate ISBN for the same user', async () => {
    const token = await registerAndGetToken('isbn-dupe@example.com');

    const b1 = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Original', author: 'Author A', isbn: '9780441172719' });
    expect(b1.status).toBe(201);

    const b2 = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'A Different Title', author: 'A Different Author', isbn: '9780441172719' });
    expect(b2.status).toBe(409);
  });

  it('allows two different users to each use the same ISBN', async () => {
    const tokenA = await registerAndGetToken('isbn-user-a@example.com');
    const tokenB = await registerAndGetToken('isbn-user-b@example.com');

    const bookA = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Shared ISBN Book', author: 'Some Author', isbn: '9780441172719' });
    expect(bookA.status).toBe(201);

    const bookB = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Shared ISBN Book', author: 'Some Author', isbn: '9780441172719' });
    expect(bookB.status).toBe(201);
  });
});
