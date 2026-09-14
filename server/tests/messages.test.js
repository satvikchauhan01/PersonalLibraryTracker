import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';
import { setupTestDb } from './dbSetup.js';

setupTestDb();

const registerAndGetToken = async (email) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: email.split('@')[0], email, password: 'password123' });
  return { token: res.body.accessToken, id: res.body._id };
};

// Directly friends two users in the DB — mirrors acceptFriendRequest's own
// $addToSet writes, without needing to exercise the whole request/accept
// flow (already covered by friendController's own tests, not duplicated here).
const makeFriends = async (idA, idB) => {
  await User.updateOne({ _id: idA }, { $addToSet: { friends: idB } });
  await User.updateOne({ _id: idB }, { $addToSet: { friends: idA } });
};

describe('Messages — auth & friendship gating', () => {
  it('requires auth on every route', async () => {
    const conv = await request(app).get('/api/messages/conversations');
    expect(conv.status).toBe(401);

    const hist = await request(app).get('/api/messages/000000000000000000000000');
    expect(hist.status).toBe(401);

    const send = await request(app)
      .post('/api/messages/000000000000000000000000')
      .send({ text: 'hi' });
    expect(send.status).toBe(401);
  });

  it('403s sending a message to a non-friend', async () => {
    const alice = await registerAndGetToken('alice@example.com');
    const bob = await registerAndGetToken('bob@example.com');

    const res = await request(app)
      .post(`/api/messages/${bob.id}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ text: 'hey we are not friends' });
    expect(res.status).toBe(403);
  });

  it('403s reading history with a non-friend', async () => {
    const alice = await registerAndGetToken('alice2@example.com');
    const bob = await registerAndGetToken('bob2@example.com');

    const res = await request(app)
      .get(`/api/messages/${bob.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(403);
  });

  it('400s on a malformed friendId', async () => {
    const alice = await registerAndGetToken('alice3@example.com');
    const res = await request(app)
      .get('/api/messages/not-a-real-id')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(400);
  });

  it('rejects an empty message body', async () => {
    const alice = await registerAndGetToken('alice4@example.com');
    const bob = await registerAndGetToken('bob4@example.com');
    await makeFriends(alice.id, bob.id);

    const res = await request(app)
      .post(`/api/messages/${bob.id}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ text: '   ' });
    expect(res.status).toBe(400);
  });
});

describe('Messages — sending, history, read receipts, conversation list', () => {
  it('sends messages both ways, returns them in chronological order, and marks incoming ones read on fetch', async () => {
    const alice = await registerAndGetToken('alice5@example.com');
    const bob = await registerAndGetToken('bob5@example.com');
    await makeFriends(alice.id, bob.id);

    const m1 = await request(app)
      .post(`/api/messages/${bob.id}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ text: 'hey bob!' });
    expect(m1.status).toBe(201);
    expect(m1.body.read).toBe(false);

    const m2 = await request(app)
      .post(`/api/messages/${alice.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ text: 'hey alice!' });
    expect(m2.status).toBe(201);

    // Bob reads the thread — his fetch should mark Alice's message to him as read
    const history = await request(app)
      .get(`/api/messages/${alice.id}`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(history.status).toBe(200);
    expect(history.body.messages.map((m) => m.text)).toEqual(['hey bob!', 'hey alice!']);

    // Alice's own fetch should now see her message marked read
    const aliceHistory = await request(app)
      .get(`/api/messages/${bob.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    const herFirstMessage = aliceHistory.body.messages.find((m) => m.text === 'hey bob!');
    expect(herFirstMessage.read).toBe(true);
  });

  it('lists conversations with the last message, unread count, and includes never-messaged friends', async () => {
    const alice = await registerAndGetToken('alice6@example.com');
    const bob = await registerAndGetToken('bob6@example.com');
    const carol = await registerAndGetToken('carol6@example.com');
    await makeFriends(alice.id, bob.id);
    await makeFriends(alice.id, carol.id); // never messaged

    await request(app)
      .post(`/api/messages/${alice.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ text: 'first' });
    await request(app)
      .post(`/api/messages/${alice.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ text: 'second' });

    const conv = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(conv.status).toBe(200);
    expect(conv.body).toHaveLength(2);

    const bobRow = conv.body.find((c) => c.friend._id === bob.id);
    expect(bobRow.lastMessage.text).toBe('second');
    expect(bobRow.lastMessage.fromMe).toBe(false);
    expect(bobRow.unreadCount).toBe(2);

    const carolRow = conv.body.find((c) => c.friend._id === carol.id);
    expect(carolRow.lastMessage).toBeNull();
    expect(carolRow.unreadCount).toBe(0);

    // Active conversation (Bob) sorts before the never-messaged friend (Carol)
    expect(conv.body[0].friend._id).toBe(bob.id);
  });
});

// Regression: a message delivered live via socket while its thread is
// already open never went through GET /messages/:friendId (the route that
// marks incoming messages read), so it sat in the DB as unread — the badge
// would resurrect an "unread" count once the client navigated away and
// refetched, even though the message had already been seen. POST .../read
// is what the client now calls in that case instead.
describe('Messages — POST /:friendId/read', () => {
  it('marks unread messages read without needing to fetch them', async () => {
    const alice = await registerAndGetToken('alice7@example.com');
    const bob = await registerAndGetToken('bob7@example.com');
    await makeFriends(alice.id, bob.id);

    await request(app)
      .post(`/api/messages/${alice.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ text: 'ping' });

    const before = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(before.body.find((c) => c.friend._id === bob.id).unreadCount).toBe(1);

    const markRead = await request(app)
      .post(`/api/messages/${bob.id}/read`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(markRead.status).toBe(200);

    const after = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(after.body.find((c) => c.friend._id === bob.id).unreadCount).toBe(0);
  });

  it('403s for a non-friend and 400s on a malformed id', async () => {
    const alice = await registerAndGetToken('alice8@example.com');
    const bob = await registerAndGetToken('bob8@example.com');

    const notFriends = await request(app)
      .post(`/api/messages/${bob.id}/read`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(notFriends.status).toBe(403);

    const badId = await request(app)
      .post('/api/messages/not-a-real-id/read')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(badId.status).toBe(400);
  });
});
