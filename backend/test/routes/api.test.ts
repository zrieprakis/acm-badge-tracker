import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';

const testDbDir = mkdtempSync(join(tmpdir(), 'acm-tracker-test-'));
process.env.DB_PATH = join(testDbDir, 'test.db');

const { runMigrations } = await import('../../src/db/migrate.js');
const { createApp } = await import('../../src/app.js');
const { teamMemberRepository } = await import('../../src/repositories/teamMemberRepository.js');
const { accessEventRepository } = await import('../../src/repositories/accessEventRepository.js');
const { adminUserRepository } = await import('../../src/repositories/adminUserRepository.js');
const { passwordService } = await import('../../src/auth/passwordService.js');

const TEST_USERNAME = 'testadmin';
const TEST_PASSWORD = 'test-password-123';

beforeAll(async () => {
  await runMigrations();
  const passwordHash = await passwordService.hash(TEST_PASSWORD);
  await adminUserRepository.create(TEST_USERNAME, passwordHash);
});

const app = createApp();

/** A supertest agent that persists the session cookie across requests, logged in as the seeded test admin. */
async function loggedInAgent() {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: TEST_USERNAME, password: TEST_PASSWORD });
  return agent;
}

describe('auth', () => {
  it('rejects protected routes without a session', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects a nonexistent username with the same 401 as a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody-such-user', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  it('locks out after 3 failed attempts, even with the correct password on the 4th try', async () => {
    // A username unique to this test so its failure count doesn't interact
    // with other tests' login attempts against TEST_USERNAME.
    const username = 'rate-limit-test-user';

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username, password: 'wrong-password' });
      expect(res.status).toBe(401);
    }

    const lockedRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: TEST_PASSWORD });
    expect(lockedRes.status).toBe(429);
  });

  it('logs in, accesses a protected route, then logs out and loses access', async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toEqual({ username: TEST_USERNAME });

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);

    const protectedRes = await agent.get('/api/dashboard');
    expect(protectedRes.status).toBe(200);

    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(204);

    const afterLogoutRes = await agent.get('/api/dashboard');
    expect(afterLogoutRes.status).toBe(401);
  });
});

describe('GET /api/health', () => {
  it('returns a well-formed health status even before any poll has run', async () => {
    const agent = await loggedInAgent();
    const res = await agent.get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      lastPollSuccess: null,
      consecutiveFailureCount: 0,
    });
    expect(typeof res.body.pollIntervalSeconds).toBe('number');
  });
});

describe('GET /api/dashboard', () => {
  it('returns active team members with null event fields when no events are cached yet', async () => {
    const agent = await loggedInAgent();
    const member = await teamMemberRepository.create({
      displayName: 'Dashboard Test Person',
      acmCardholderId: 'CARD-DASH-1',
    });

    const res = await agent.get('/api/dashboard');

    expect(res.status).toBe(200);
    const entry = res.body.find((e: { teamMemberId: number }) => e.teamMemberId === member.id);
    expect(entry).toMatchObject({ displayName: 'Dashboard Test Person', doorName: null });
  });

  it('reflects a recorded access event', async () => {
    const agent = await loggedInAgent();
    const member = await teamMemberRepository.create({
      displayName: 'Badged In Person',
      acmCardholderId: 'CARD-DASH-2',
    });
    await accessEventRepository.recordEventIfNewer({
      teamMemberId: member.id,
      doorName: 'Main Entrance',
      doorId: 'main-entrance',
      eventType: 'granted',
      eventTimestamp: new Date().toISOString(),
      rawEventId: 'evt-1',
    });

    const res = await agent.get('/api/dashboard');

    const entry = res.body.find((e: { teamMemberId: number }) => e.teamMemberId === member.id);
    expect(entry.doorName).toBe('Main Entrance');
  });

  it('includes the previous event once a second one is recorded, and none before that', async () => {
    const agent = await loggedInAgent();
    const member = await teamMemberRepository.create({
      displayName: 'Two Swipes Person',
      acmCardholderId: 'CARD-DASH-3',
    });

    await accessEventRepository.recordEventIfNewer({
      teamMemberId: member.id,
      doorName: 'First Door',
      doorId: 'first-door',
      eventType: 'granted',
      eventTimestamp: new Date(Date.now() - 60_000).toISOString(),
      rawEventId: 'evt-first',
    });

    const afterFirst = await agent.get('/api/dashboard');
    const entryAfterFirst = afterFirst.body.find(
      (e: { teamMemberId: number }) => e.teamMemberId === member.id,
    );
    expect(entryAfterFirst.doorName).toBe('First Door');
    expect(entryAfterFirst.previousDoorName).toBeNull();

    await accessEventRepository.recordEventIfNewer({
      teamMemberId: member.id,
      doorName: 'Second Door',
      doorId: 'second-door',
      eventType: 'granted',
      eventTimestamp: new Date().toISOString(),
      rawEventId: 'evt-second',
    });

    const afterSecond = await agent.get('/api/dashboard');
    const entryAfterSecond = afterSecond.body.find(
      (e: { teamMemberId: number }) => e.teamMemberId === member.id,
    );
    expect(entryAfterSecond.doorName).toBe('Second Door');
    expect(entryAfterSecond.previousDoorName).toBe('First Door');
  });
});

describe('/api/team CRUD', () => {
  it('creates, updates, and soft-deletes a team member', async () => {
    const agent = await loggedInAgent();

    const createRes = await agent
      .post('/api/team')
      .send({ displayName: 'CRUD Person', acmCardholderId: 'CARD-CRUD-1' });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    const updateRes = await agent
      .put(`/api/team/${id}`)
      .send({ displayName: 'CRUD Person Updated' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.displayName).toBe('CRUD Person Updated');

    const deleteRes = await agent.delete(`/api/team/${id}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.isActive).toBe(false);
  });

  it('rejects a duplicate acmCardholderId with 409', async () => {
    const agent = await loggedInAgent();

    await agent.post('/api/team').send({ displayName: 'First', acmCardholderId: 'CARD-DUP-1' });

    const res = await agent
      .post('/api/team')
      .send({ displayName: 'Second', acmCardholderId: 'CARD-DUP-1' });

    expect(res.status).toBe(409);
  });

  it('rejects an empty displayName with 400', async () => {
    const agent = await loggedInAgent();
    const res = await agent.post('/api/team').send({ displayName: '', acmCardholderId: 'X' });
    expect(res.status).toBe(400);
  });

  it('permanently removes a team member with ?hard=true', async () => {
    const agent = await loggedInAgent();

    const createRes = await agent
      .post('/api/team')
      .send({ displayName: 'Hard Delete Me', acmCardholderId: 'CARD-HARD-1' });
    const id = createRes.body.id;

    const deleteRes = await agent.delete(`/api/team/${id}?hard=true`);
    expect(deleteRes.status).toBe(204);

    const listRes = await agent.get('/api/team');
    expect(listRes.body.find((m: { id: number }) => m.id === id)).toBeUndefined();
  });

  it('returns 404 hard-deleting a nonexistent team member', async () => {
    const agent = await loggedInAgent();
    const res = await agent.delete('/api/team/999999?hard=true');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/auth/password', () => {
  it('rejects without a session', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .send({ currentPassword: 'x', newPassword: 'y'.repeat(12) });
    expect(res.status).toBe(401);
  });

  it('rejects an incorrect current password', async () => {
    const agent = await loggedInAgent();
    const res = await agent
      .put('/api/auth/password')
      .send({ currentPassword: 'wrong-password', newPassword: 'a-new-long-password' });
    expect(res.status).toBe(401);
  });

  it('rejects a new password shorter than 12 characters', async () => {
    const agent = await loggedInAgent();
    const res = await agent
      .put('/api/auth/password')
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('changes the password and allows login with the new one', async () => {
    const agent = await loggedInAgent();
    const newPassword = 'a-brand-new-longer-password';

    const changeRes = await agent
      .put('/api/auth/password')
      .send({ currentPassword: TEST_PASSWORD, newPassword });
    expect(changeRes.status).toBe(204);

    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    expect(oldLoginRes.status).toBe(401);

    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: newPassword });
    expect(newLoginRes.status).toBe(200);
  });
});
