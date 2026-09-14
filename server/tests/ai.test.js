import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { setupTestDb } from './dbSetup.js';

setupTestDb();

// Phase 18: NODE_ENV=test never sets GEMINI_API_KEY (see tests/env.js's own
// comment on why) — so every route below hits its real, live
// "AI not configured" branch instead of a mock. That's a deliberate choice:
// it proves the graceful-degradation contract (clean 503, never a hang on a
// network call that was never going to succeed) for real, the same way
// health.test.js proves /health's 200/503 split for real rather than
// stubbing mongoose.connection.readyState.

const registerAndGetToken = async (email = 'ai-user@example.com') => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'AI Tester', email, password: 'password123' });
  return res.body.accessToken;
};

const addBook = async (token, overrides = {}) => {
  const res = await request(app)
    .post('/api/books')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi', ...overrides });
  return res.body;
};

describe('AI routes — auth gating', () => {
  it('GET /books/:id/similar requires auth', async () => {
    const res = await request(app).get('/api/books/000000000000000000000000/similar');
    expect(res.status).toBe(401);
  });

  it('POST /diary/ask requires auth', async () => {
    const res = await request(app).post('/api/diary/ask').send({ question: 'How was my week?' });
    expect(res.status).toBe(401);
  });

  it('POST /ai/summary/:bookId requires auth', async () => {
    const res = await request(app).post('/api/ai/summary/000000000000000000000000');
    expect(res.status).toBe(401);
  });

  it('GET /ai/habits requires auth', async () => {
    const res = await request(app).get('/api/ai/habits');
    expect(res.status).toBe(401);
  });

  it('POST /ai/review-assist requires auth', async () => {
    const res = await request(app)
      .post('/api/ai/review-assist')
      .send({ bookId: '000000000000000000000000', bulletPoints: ['good pacing'] });
    expect(res.status).toBe(401);
  });

  it('POST /ai/search requires auth', async () => {
    const res = await request(app).post('/api/ai/search').send({ query: 'short fantasy books' });
    expect(res.status).toBe(401);
  });
});

describe('AI routes — request validation (400s happen before any Gemini call)', () => {
  it('POST /diary/ask rejects a too-short question', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .post('/api/diary/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'hi' }); // < 3 chars
    expect(res.status).toBe(400);
  });

  it('POST /ai/search rejects a missing query', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .post('/api/ai/search')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /ai/review-assist rejects an empty bulletPoints array', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .post('/api/ai/review-assist')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: '000000000000000000000000', bulletPoints: [] });
    expect(res.status).toBe(400);
  });
});

describe('AI routes — graceful 503 when Gemini is not configured', () => {
  it('GET /books/:id/similar', async () => {
    const token = await registerAndGetToken();
    const book = await addBook(token);
    const res = await request(app)
      .get(`/api/books/${book._id}/similar`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
  });

  it('POST /diary/ask', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .post('/api/diary/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What did I write about last week?' });
    expect(res.status).toBe(503);
  });

  it('POST /ai/summary/:bookId (cache miss)', async () => {
    const token = await registerAndGetToken();
    const book = await addBook(token);
    const res = await request(app)
      .post(`/api/ai/summary/${book._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
  });

  it('GET /ai/habits', async () => {
    const token = await registerAndGetToken();
    const res = await request(app).get('/api/ai/habits').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
  });

  it('POST /ai/review-assist', async () => {
    const token = await registerAndGetToken();
    const book = await addBook(token);
    const res = await request(app)
      .post('/api/ai/review-assist')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: book._id, bulletPoints: ['loved the pacing', 'slow start'] });
    expect(res.status).toBe(503);
  });

  it('POST /ai/search', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .post('/api/ai/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'short fantasy books I rated highly' });
    expect(res.status).toBe(503);
  });
});

describe('AI routes — ownership / not-found checks still run before the AI call', () => {
  it("GET /books/:id/similar 404s on another user's book id shape (valid id, not found)", async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .get('/api/books/507f1f77bcf86cd799439011/similar')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('POST /ai/summary/:bookId 404s for a book that does not exist', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .post('/api/ai/summary/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('POST /ai/review-assist 401s on a book that belongs to a different user', async () => {
    const ownerToken = await registerAndGetToken('owner@example.com');
    const book = await addBook(ownerToken);

    const otherToken = await registerAndGetToken('other@example.com');
    const res = await request(app)
      .post('/api/ai/review-assist')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ bookId: book._id, bulletPoints: ['not my book'] });
    expect(res.status).toBe(401);
  });
});

describe('AI routes — diary lock still gates POST /diary/ask', () => {
  it('423s when the diary lock is enabled and no x-diary-token is sent', async () => {
    const token = await registerAndGetToken();
    await request(app)
      .post('/api/diary/lock/setup-pin')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '1234' });

    const res = await request(app)
      .post('/api/diary/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What did I write about last week?' });
    expect(res.status).toBe(423);
  });
});
