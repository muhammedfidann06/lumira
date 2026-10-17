import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { once } from 'node:events';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { createHandler } from '../netlify/functions/features.mjs';
import { TIERS } from '../netlify/functions/_shared/feature-core.mjs';
import { sha256 } from '../netlify/functions/_shared/feature-services.mjs';

// Optional real-SDK integration test. Only a local emulator is used. Supply the
// official database-emulator JAR through LUMIRA_EMULATOR_JAR to run it.
test('real Firebase: writing commits, cold renewals last an hour, quotas stay atomic', {
  skip: !process.env.LUMIRA_EMULATOR_JAR, timeout: 180000
}, async () => {
  for (const key of Object.keys(process.env)) {
    if (/^(https?|all|ws|wss)_proxy$/i.test(key)) delete process.env[key];
  }
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
  const emulator = spawn('java', ['-jar', process.env.LUMIRA_EMULATOR_JAR, '--host', '127.0.0.1', '--port', '9000'], { stdio: 'ignore' });
  const options = { projectId: 'demo-lumira', databaseURL: 'https://demo-lumira-default-rtdb.firebaseio.com' };
  const clients = new Map();
  let sequence = 0, writingCalls = 0, failWriting = false;
  let now = Date.parse('2026-10-17T10:00:00Z');
  const services = {
    async identity(request) { return clients.get(request.headers.get('x-test-client')); },
    async checkWriting() {
      writingCalls++;
      if (failWriting) throw Object.assign(new Error('upstream failed'), { code: 'writing_unavailable', status: 502 });
      return [{ offset: 2, length: 2, message: 'Use am with I.', replacements: [{ value: 'am' }] }];
    },
    async speechToken() { return { token: 'emulator-only-token', region: 'northeurope', expiresAt: now + 540000 }; },
    async verifyPlayPurchase() {}, sha256
  };
  const handler = createHandler(services, () => now);
  // Every request uses a NEW SDK app/connection, like separate Lambda workers.
  async function call(body, uid = 'unlimited', tier = TIERS[5]) {
    const key = 'test-' + (++sequence);
    const app = initializeApp(options, key);
    clients.set(key, { uid, db: getDatabase(app), tier });
    try {
      const response = await handler(new Request('https://lumira.test/.netlify/functions/features', {
        method: 'POST', headers: { 'x-test-client': key }, body: JSON.stringify(body)
      }));
      return { status: response.status, ...await response.json() };
    } finally { clients.delete(key); await deleteApp(app); }
  }
  try {
    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 15000;
      const check = () => {
        if (Date.now() > deadline) return reject(new Error('Database emulator did not start'));
        const request = http.get('http://127.0.0.1:9000/.json?ns=demo-lumira-default-rtdb', response => { response.resume(); resolve(); });
        request.on('error', () => setTimeout(check, 100));
      };
      check();
    });
    const body = { action: 'check', id: 'writing-emulator-123456', text: 'I is happy.', language: 'en' };
    const first = await call(body, 'writer', TIERS[0]);
    assert.equal(first.status, 200, first.error);
    assert.equal(first.matches[0].replacements[0].value, 'am');
    assert.equal(first.quota.writing.used, 1);
    const retry = await call(body, 'writer', TIERS[0]);
    assert.equal(retry.status, 200);
    assert.equal(retry.quota.writing.used, 1);
    failWriting = true;
    assert.equal((await call({ ...body, id: 'failed-emulator-123456' }, 'writer', TIERS[0])).status, 502);
    failWriting = false;
    assert.equal((await call({ action: 'status' }, 'writer', TIERS[0])).quota.writing.used, 1);

    const concurrent = await Promise.all(Array.from({ length: 8 }, (_, i) => call({ ...body, id: 'concurrent-writing-' + i }, 'limited', TIERS[0])));
    assert.equal(concurrent.filter(r => r.status === 200).length, 5);
    assert.equal(concurrent.filter(r => r.error === 'writing_limit').length, 3);
    assert.equal((await call({ action: 'status' }, 'limited', TIERS[0])).quota.writing.used, 5);

    const id = 'live-emulator-session-123456';
    const started = await call({ action: 'liveStart', id });
    assert.equal(started.status, 200);
    const competitor = await call({ action: 'liveStart', id: 'competing-live-session-123456' });
    assert.equal(competitor.error, 'live_already_active');
    for (let second = 5; second <= 3600; second += 5) {
      now += 5000;
      const renewed = await call({ action: 'liveRenew', id, refreshToken: second % 480 === 0 });
      assert.equal(renewed.status, 200, 'at ' + second + ' seconds: ' + renewed.error);
      assert.equal(renewed.session.id, id);
      assert.ok(renewed.session.until > now);
      if (second % 600 === 0) console.log('Real Firebase cold-client session:', second / 60, 'simulated minutes');
    }
    const stopped = await call({ action: 'liveStop', id });
    assert.equal(stopped.status, 200);
    assert.equal(stopped.session, null);
    assert.equal(stopped.quota.live.usedSeconds, 3600);
    console.log('Writing/refund/concurrent quotas and 720 cold-client renewals passed. Provider checks:', writingCalls);
  } finally {
    for (const { db } of clients.values()) await deleteApp(db.app);
    emulator.kill();
    await once(emulator, 'exit').catch(() => {});
  }
});
