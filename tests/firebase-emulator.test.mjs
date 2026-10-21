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
import {createWelcomeGift} from '../netlify/functions/_shared/welcome-gift.mjs';
import {applyPaddleEvent} from '../netlify/functions/_shared/paddle-events.mjs';
import {accountMemberships} from '../netlify/functions/_shared/memberships.mjs';
import {createStoriesHandler} from '../netlify/functions/stories.mjs';
import {createPlayBilling} from '../netlify/functions/_shared/play-billing.mjs';

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
    const rules = await readFile(process.env.LUMIRA_FIREBASE_RULES_PATH||new URL('../firebase-security-rules.json',import.meta.url),'utf8');
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
      await assert.rejects(userDb.ref('serverBadgePolicyVersions/member/5/admin').set('forged-version'),/permission[ _]denied/i);
      await assert.rejects(userDb.ref('serverBadgePolicyVersions/member').get(),/permission[ _]denied/i);
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

      const source=await readFile(new URL('../admin.js',import.meta.url),'utf8'),begin=source.indexOf('      function grantToUids('),end=source.indexOf('\n      send.onclick',begin);
      const {runInNewContext}=await import('node:vm');let optionalCalls=0;
      const grant=runInNewContext(source.slice(begin,end)+';grantToUids',{d:adminDb,window:{LUMIRA_ADMIN_BADGES:{allow:async()=>{optionalCalls++;throw Error('optional API down');}}}});
      await adminDb.ref().update({'progress/gift-member/meta/xp':30,'leaderboard/gift-member/xp':80});
      await Promise.all([grant(['gift-member'],[5,'☕','Coffee',50]),grant(['gift-member'],[1,'👍','Thanks',10])]);
      await grant(['gift-member'],[5,'☕','Coffee',50]);
      assert.equal(optionalCalls,0);assert.equal((await db.ref('progress/gift-member/meta/xp').get()).val(),140);assert.equal((await db.ref('leaderboard/gift-member/xp').get()).val(),140);
      console.log('PASS: concurrent real-rule admin gifts preserve all XP, retry safely and need no optional API.');

      const roster=Array.from({length:305},(_,i)=>({uid:'welcome-'+i,email:i+'@fixture.invalid',metadata:{creationTime:new Date(1700000000000+i*1000).toISOString()}})),auth={listUsers:async()=>({users:[...roster].reverse()})},gift=createWelcomeGift();
      await db.ref('serverWelcomeCampaign').remove();
      const coldGift=async uid=>{const app=initializeApp(options,'gift-cold-'+(++sequence));try{return await gift({uid,auth,db:getDatabase(app)});}finally{await deleteApp(app);}};
      const welcome=await Promise.all(['welcome-0','welcome-100','welcome-299','welcome-300','welcome-304'].map(coldGift));assert.deepEqual(welcome.map(r=>r.granted),[true,true,true,false,false]);assert.equal(Object.keys((await db.ref('serverWelcomeCampaign/roster').get()).val()).length,300);
      await db.ref('serverFeatureEntitlements/welcome-0/1').set(false);assert.equal((await coldGift('welcome-0')).granted,false);
      await gift({uid:'welcome-100',auth,db},{ack:true});assert.equal((await coldGift('welcome-100')).show,false);
      await assert.rejects(userDb.ref('serverWelcomeCampaign/roster/member').set(1),/permission[ _]denied/i);
      console.log('PASS: cold SDK welcome enrollment caps at 300, preserves revocations and stores one-time acknowledgements.');

      const subId='sub_'+('1'.repeat(26)),txnId='txn_'+('1'.repeat(26)),priceId='pri_'+('1'.repeat(26)),customerId='ctm_'+('1'.repeat(26)),catalog=[{amount:5,priceId,lifetime:false}];
      await db.ref('serverPaddleTransactions/'+txnId).set({uid:'paid-member',amount:5,priceId});
      const subscription={id:subId,customer_id:customerId,status:'active',created_at:new Date(now-1000).toISOString(),current_billing_period:{ends_at:new Date(now+10000).toISOString()},items:[{price:{id:priceId}}]};
      const events=[{event_type:'subscription.created',event_id:'evt-created',occurred_at:new Date(now-100).toISOString(),data:subscription},{event_type:'subscription.canceled',event_id:'evt-canceled',occurred_at:new Date(now+100).toISOString(),data:{...subscription,status:'canceled'}},{event_type:'transaction.completed',event_id:'evt-paid',occurred_at:new Date(now).toISOString(),data:{id:txnId,status:'completed',subscription_id:subId,customer_id:customerId,billing_period:{ends_at:new Date(now+10000).toISOString()},items:subscription.items,custom_data:{lumira_user_id:'attacker'}}}];
      await Promise.all(events.map(async(event,i)=>{const app=initializeApp(options,'billing-cold-'+i);try{await applyPaddleEvent(getDatabase(app),event,catalog);}finally{await deleteApp(app);}}));
      const paid=(await db.ref('serverPaddleAccounts/paid-member').get()).val();assert.equal(paid.subscriptions[subId].status,'canceled');assert.equal(accountMemberships({}, {},paid,{},now).tier.amount,0);assert.equal((await db.ref('serverPaddleAccounts/attacker').get()).val(),null);
      await assert.rejects(userDb.ref('serverPaddleAccounts/paid-member').get(),/permission[ _]denied/i);await assert.rejects(userDb.ref('serverBadgeOptOut/member/5').set(false),/permission[ _]denied/i);
      console.log('PASS: concurrent cold-SDK Paddle events stay ordered, bind to the server checkout owner and remain private.');

      let googleRenew=true;const googleSku='lumira_support_5_monthly',googleToken='emulator-only-google-purchase-1101';
      const googleApi={packageName:'com.lumira.dilkartlari',call:async(path,{method}={})=>{if(path.endsWith(':cancel')){googleRenew=false;return{};}if(path.startsWith('/subscriptions/'))return{basePlans:[{basePlanId:'monthly',autoRenewingBasePlanType:{billingPeriodDuration:'P1M'}}]};return{subscriptionState:googleRenew?'SUBSCRIPTION_STATE_ACTIVE':'SUBSCRIPTION_STATE_CANCELED',acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',startTime:new Date(now-1000).toISOString(),lineItems:[{productId:googleSku,expiryTime:new Date(now+60000).toISOString(),offerDetails:{basePlanId:'monthly'},autoRenewingPlan:{autoRenewEnabled:googleRenew}}]};}};
      const google=createPlayBilling({api:googleApi,clock:()=>now}),googleCtx={uid:'play-member',db};await google.verify(googleCtx,googleSku,googleToken);
      const playAccount=(await db.ref('serverPlayAccounts/play-member').get()).val(),googleId=Object.keys(playAccount.subscriptions)[0];assert.equal((await db.ref('serverFeatureEntitlements/play-member/5').get()).val(),null);assert.equal(accountMemberships({}, {},{}, {},now,playAccount).tier.amount,5);
      await assert.rejects(google.verify({uid:'play-other',db},googleSku,googleToken),e=>e.code==='purchase_already_linked');
      await assert.rejects(userDb.ref('serverPlayAccounts/play-member').get(),/permission[ _]denied/i);await assert.rejects(userDb.ref('serverPlayAccounts/member/subscriptions/forged').set({amount:100,lifetime:true}),/permission[ _]denied/i);
      await google.cancel(googleCtx,googleId);const stopped=(await db.ref('serverPlayAccounts/play-member').get()).val();assert.equal(accountMemberships({}, {},{}, {},now,stopped).tier.amount,5);assert.equal(accountMemberships({}, {},{}, {},now+60000,stopped).tier.amount,0);
      console.log('PASS: real SDK Play subscriptions stay private, bind one account, cancel renewal and expire without permanent grants.');

      const words='I am happy and you are here in a small house today'.split(' ').map(w=>({w,meaning:''}));let generations=0;
      const story=createStoriesHandler({identity:async()=>({uid:'story-member',db}),wordPool:()=>words,generateStory:async()=>{generations++;return{title:'small house',sentences:Array.from({length:6},()=>({text:'I am happy and you are here in a small house today.',translation:'Ben mutluyum ve sen bugün küçük bir evdesin.'}))};}},()=>now);
      const storyBody={action:'generate',id:'real-sdk-story-1100-test',language:'en',native:'tr',genre:'daily',style:'anime',voice:'calm',level:1},storyRequest=()=>new Request('https://lumira.test/.netlify/functions/stories',{method:'POST',body:JSON.stringify(storyBody)});
      assert.equal((await story(storyRequest())).status,200);assert.equal((await story(storyRequest())).status,200);assert.equal(generations,1);assert.equal((await db.ref('serverFeatureUsage/story-member').get()).val(),null);await assert.rejects(userDb.ref('serverStories/story-member').get(),/permission[ _]denied/i);
      console.log('PASS: real SDK stories are private, saved once and independent of writing quotas.');

    }finally{await Promise.all([owner,member,manager].map(deleteApp));}

  } finally {
    for (const { db } of clients.values()) await deleteApp(db.app);
    emulator.kill();
    await once(emulator, 'exit').catch(() => {});
  }
});
