import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import { once } from 'node:events';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { createExamplesHandler } from '../netlify/functions/examples.mjs';
import { createHandler } from '../netlify/functions/features.mjs';
import { createAdminBadgesHandler } from '../netlify/functions/admin-badges.mjs';
import { TIERS } from '../netlify/functions/_shared/feature-core.mjs';
import { grantVerifiedEntitlement, sha256 } from '../netlify/functions/_shared/feature-services.mjs';

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

    const concurrent = await Promise.all(Array.from({ length: 12 }, (_, i) => call({ ...body, id: 'concurrent-writing-' + i }, 'limited', TIERS[0])));
    assert.equal(concurrent.filter(r => r.status === 200).length, 10);
    assert.equal(concurrent.filter(r => r.error === 'writing_limit').length, 2);
    assert.equal((await call({ action: 'status' }, 'limited', TIERS[0])).quota.writing.used, 10);

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
    const rules = await readFile(new URL('../firebase-security-rules.json',import.meta.url),'utf8');
    const applied = await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-lumira-default-rtdb', {method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:rules});
    assert.equal(applied.status,200,await applied.text());
    const owner=initializeApp(options,'rules-owner'),member=initializeApp({...options,databaseAuthVariableOverride:{uid:'member'}},'rules-member'),manager=initializeApp({...options,databaseAuthVariableOverride:{uid:'manager'}},'rules-manager');
    try{
      const db=getDatabase(owner),userDb=getDatabase(member),adminDb=getDatabase(manager);
      await db.ref().update({'admins/manager':true,'progress/member/meta/xp':7,'progress/member/meta/supportGrants/5':true,'serverFeatureUsage/member/hidden':42,'serverFeatureEntitlements/member/5':true});
      await userDb.ref('progress/member/words/test').set({seen:1,correct:1});
      for(const [lang,word]of Object.entries({tr:'öğrenmek',en:'learn',de:'lernen',ar:'أتعلم',fr:'apprendre',es:'aprender',ru:'учиться'})){
        const key='fav_'+lang+'_u_'+encodeURIComponent(word).replace(/\./g,'%2E');
        const note=userDb.ref('progress/member/notebook/'+key);
        await note.set({lang,w:word,tr:'meaning',isFavorite:true,ex:'Example.',exTr:'Meaning.'});
        assert.equal((await note.get()).val().w,word);
        await note.update({isFavorite:false});
        assert.equal((await note.get()).val().w,word);
        assert.equal((await note.get()).val().isFavorite,false);
      }
      await assert.rejects(userDb.ref('progress/other/notebook/favorite').set({w:'private'}),/permission[ _]denied/i);
      console.log('PASS: real Firebase notebook writes/reads in 7 languages, unfavorite retains notes, other-account writes denied.');
      await userDb.ref('progress/member/meta/xp').set(8);
      await assert.rejects(userDb.ref('progress/member/meta/xp').set(7),/permission[ _]denied/i);
      await assert.rejects(userDb.ref('progress/member/meta/supportGrants/100').set(true),/permission[ _]denied/i);
      await assert.rejects(userDb.ref('progress/member/meta').set({xp:8,supportGrants:{100:true}}),/permission[ _]denied/i);
      await assert.rejects(userDb.ref('progress/member/meta/supportGrants').set({'100':{nested:true}}),/permission[ _]denied/i);
      await userDb.ref('progress/member/meta').set({xp:9,supportGrants:{5:true},studySessionCount:2});
      await userDb.ref('progress/member/meta/supportGrants/5').set(true);
      await adminDb.ref('progress/member/meta/supportGrants/50').set(true);
      assert.equal((await userDb.ref('progress/member/meta/supportGrants/50').get()).val(),true);
      await assert.rejects(userDb.ref('progress/other/words/test').set({seen:1}),/permission[ _]denied/i);
      await assert.rejects(userDb.ref('serverFeatureUsage/member/hidden').get(),/permission[ _]denied/i);
      await assert.rejects(userDb.ref('serverFeatureUsage/member').set({}),/permission[ _]denied/i);
      await assert.rejects(userDb.ref('serverFeatureEntitlements/member/100').set(true),/permission[ _]denied/i);
      assert.equal((await adminDb.ref('progress/member/meta/xp').get()).val(),9);
      // Anonymous public leaderboard remains available; private progress does not.
      const anonymous=initializeApp({...options,databaseAuthVariableOverride:null},'rules-anonymous');
      try{await getDatabase(anonymous).ref('leaderboard').get();await assert.rejects(getDatabase(anonymous).ref('progress/member').get(),/permission[ _]denied/i);}finally{await deleteApp(anonymous);}
      console.log('PASS: 16 real Firebase rules scenarios: account progress, XP, gifts, forgery and private server records.');
      let exampleCalls=0;
      const exampleRequest=async()=>{const app=initializeApp(options,'example-cold-'+(++sequence));try{const handler=createExamplesHandler({identity:async()=>({uid:'example-learner',db:getDatabase(app)}),translateExamples:async()=>{exampleCalls++;await new Promise(r=>setTimeout(r,60));return new Map([[0,{text:'أنت لطيف جداً.',provider:'fixture'}]]);}},()=>now);const response=await handler(new Request('https://lumira.test/.netlify/functions/examples',{method:'POST',body:JSON.stringify({source:'de',target:'ar',texts:['Du bist sehr nett.']})}));return{status:response.status,...await response.json()};}finally{await deleteApp(app);}};
      const generated=await Promise.all(Array.from({length:6},()=>exampleRequest()));
      assert(generated.some(r=>r.status===200));assert.equal(exampleCalls,1);
      const cached=await exampleRequest();assert.equal(cached.examples[0].translation,'أنت لطيف جداً.');assert.equal(exampleCalls,1);
      assert.equal((await db.ref('serverFeatureUsage/example-learner').get()).val(),null);
      await assert.rejects(userDb.ref('serverExampleTranslations').get(),/permission[ _]denied/i);
      await assert.rejects(userDb.ref('serverExampleBudget/project').set({count:0}),/permission[ _]denied/i);
      console.log('PASS: real Firebase example caching across 6 cold SDK clients; one generation, independent quotas and private counters.');

      // Real SDK, new/cold connections: revocation, purchase restore and rules.
      await db.ref().update({'progress/revoke-member/meta/xp':98,'progress/revoke-member/meta/supportGrants/100':true,'progress/revoke-member/meta/supportGrants/5':true,'progress/revoke-member/meta/awards/streak7':{e:'🔥'},'progress/revoke-member/words/keep':{seen:4},'serverFeatureEntitlements/revoke-member/100':true});
      const adminHandler=createAdminBadgesHandler({identity:async()=>({uid:'manager',db})},()=>now);
      const removed=await adminHandler(new Request('https://lumira.test/.netlify/functions/admin-badges',{method:'POST',body:JSON.stringify({action:'revoke',kind:'all',amount:'all',badge:'all',uids:['revoke-member'],id:'emulator-remove-198-12345'})}));
      assert.equal(removed.status,200,await removed.text());
      assert.equal((await db.ref('serverFeatureEntitlements/revoke-member/100').get()).val(),false);
      assert.equal((await db.ref('progress/revoke-member/meta/awards/streak7').get()).val().removed,true);
      assert.equal((await db.ref('progress/revoke-member/meta/xp').get()).val(),98);
      assert.equal((await db.ref('progress/revoke-member/words/keep').get()).val().seen,4);
      for(let i=0;i<5;i++){
        const cold=initializeApp(options,'cold-revoked-'+i);
        try{await assert.rejects(grantVerifiedEntitlement({uid:'revoke-member',db:getDatabase(cold)},100),e=>e.code==='purchase_revoked');}finally{await deleteApp(cold);}
      }
      assert.equal((await db.ref('serverFeatureEntitlements/revoke-member/100').get()).val(),false);
      const removedMember=initializeApp({...options,databaseAuthVariableOverride:{uid:'revoke-member'}},'rules-revoked-member');
      try{await assert.rejects(getDatabase(removedMember).ref('progress/revoke-member/meta/supportGrants/100').set(true),/permission[ _]denied/i);}finally{await deleteApp(removedMember);}
      const restored=await adminHandler(new Request('https://lumira.test/.netlify/functions/admin-badges',{method:'POST',body:JSON.stringify({action:'allow',amount:100,uids:['revoke-member'],id:'emulator-allow-198-12345'})}));
      assert.equal(restored.status,200);await grantVerifiedEntitlement({uid:'revoke-member',db},100);
      assert.equal((await db.ref('serverFeatureEntitlements/revoke-member/100').get()).val(),true);
      console.log('PASS: admin revocation, 5 cold purchase restores denied, user gift forgery denied, deliberate admin regrant works; XP and words preserved.');

    }finally{await Promise.all([owner,member,manager].map(deleteApp));}

  } finally {
    for (const { db } of clients.values()) await deleteApp(db.app);
    emulator.kill();
    await once(emulator, 'exit').catch(() => {});
  }
});
