import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../netlify/functions/features.mjs';
import { TIERS, WINDOW_MS, nextMidnight, tierFor } from '../netlify/functions/_shared/feature-core.mjs';
import { checkWriting, speechToken, sha256, verifyPlayPurchase } from '../netlify/functions/_shared/feature-services.mjs';
import { generateKeyPairSync } from 'node:crypto';

function fixture(amount = 0) {
  const values = new Map(), locks = new Map();
  const db = { ref(path) { return {
    on() {}, off() {},
    async get() { await locks.get(path); return { val: () => structuredClone(values.get(path) || null) }; },
    transaction(fn) {
      const p = (locks.get(path) || Promise.resolve()).then(() => {
        const next = fn(structuredClone(values.get(path) || null));
        if (next === undefined) return { committed:false };
        values.set(path, structuredClone(next));
        return { committed:true, snapshot:{val:()=>structuredClone(next)} };
      });
      locks.set(path,p.catch(()=>{}));return p;
    }
  }; } };
  const f = { now:Date.parse('2026-10-17T10:00:00Z'), tier:TIERS.find(t=>t.amount===amount), calls:0, speechCalls:0, values, failWriting:false, failSpeech:false };
  const services = {
    async identity(request) {
      const uid=request.headers.get('authorization')?.replace('Bearer ','');
      if(!uid) throw Object.assign(new Error(),{code:'login_required',status:401});
      return {uid,db,tier:f.tier};
    },
    async checkWriting() { f.calls++;if(f.gate)await f.gate;if(f.failWriting)throw Object.assign(new Error(),{code:'writing_unavailable',status:502});return []; },
    async speechToken() { f.speechCalls++;if(f.failSpeech)throw Object.assign(new Error(),{code:'speech_not_configured',status:503});return {token:'fake',region:'westeurope',expiresAt:f.now+540000}; },
    async verifyPlayPurchase() {}, sha256
  };
  f.handler=createHandler(services,()=>f.now);
  f.request=async(body,uid='user1',origin='https://lumira.test')=>{
    const response=await f.handler(new Request('https://lumira.test/.netlify/functions/features',{method:'POST',headers:{Authorization:uid?'Bearer '+uid:'',Origin:origin},body:JSON.stringify(body)}));
    return {status:response.status,...await response.json()};
  };
  f.check=(n,uid)=>f.request({action:'check',id:'operation-'+String(n).padStart(16,'0'),text:'Ich bin hier.',language:'de'},uid);
  f.status=uid=>f.request({action:'status'},uid);
  return f;
}

test('all seven badge tiers enforce the requested boundary; only crown has no limit',async()=>{
  for(const tier of TIERS){
    const f=fixture(tier.amount),events={};
    const count=tier.count===null?700:tier.count-1;
    for(let i=0;i<count;i++)events['seed'+i]={at:f.now-1000,hash:'seed'};
    f.values.set('serverFeatureUsage/user1',{writing:{events}});
    const last=await f.check(1);assert.equal(last.status,200);
    assert.equal(last.quota.writing.limit,tier.count);
    const next=await f.check(2);
    assert.equal(next.status,tier.count===null?200:429);
    if(tier.count!==null){assert.equal(next.error,'writing_limit');assert.equal(f.calls,1);}
    assert.equal(last.quota.live.limitSeconds,tier.minutes===null?null:tier.minutes*60);
  }
});
test('24-hour rolling expiry, upgrade and account isolation preserve actual use',async()=>{
  const f=fixture();for(let i=0;i<10;i++)assert.equal((await f.check(i)).status,200);
  assert.equal((await f.check(19)).status,429);
  assert.equal((await f.status('user2')).quota.writing.remaining,10);
  f.tier=TIERS[1];assert.equal((await f.status()).quota.writing.remaining,15);
  f.tier=TIERS[0];f.now+=WINDOW_MS;
  assert.equal((await f.status()).quota.writing.remaining,10);
  assert.equal((await f.check(10)).status,200);
});
test('simultaneous checks cannot overspend the last allowance',async()=>{
  const f=fixture();for(let i=0;i<9;i++)await f.check(i);
  let release;f.gate=new Promise(resolve=>{release=resolve;});
  const first=f.check(40);
  while(f.calls<10)await new Promise(resolve=>setImmediate(resolve));
  const second=await f.check(41);assert.equal(second.status,429);
  release();assert.equal((await first).status,200);
  assert.equal((await f.status()).quota.writing.used,10);
});
test('failed checks are refunded and retries with the same operation never double-charge',async()=>{
  const f=fixture();f.failWriting=true;
  assert.equal((await f.check(1)).status,502);
  assert.equal((await f.status()).quota.writing.used,0);
  assert.equal((await f.status()).quota.writing.remaining,10);
  f.failWriting=false;await f.check(1);await f.check(1);
  assert.equal((await f.status()).quota.writing.used,1);
  const conflict=await f.request({action:'check',id:'operation-0000000000000001',text:'Changed text',language:'de'});
  assert.equal(conflict.status,409);
});
test('empty/unsupported input, missing auth and cross-site calls never consume a check',async()=>{
  const f=fixture();
  for(const body of [{action:'check',id:'operation-1234567890123456',text:'',language:'de'},{action:'check',id:'operation-1234567890123456',text:'Unsupported',language:'ja'}])assert.equal((await f.request(body)).status,422);
  assert.equal((await f.request({action:'status'},'')).status,401);
  assert.equal((await f.request({action:'status'},'user1','https://other.test')).status,403);
  assert.equal(f.calls,0);assert.equal((await f.status()).quota.writing.used,0);
});
test('live sessions are exclusive across devices and stopping refunds unused reserved seconds',async()=>{
  const f=fixture();const id='session-1234567890123456';
  const start=await f.request({action:'liveStart',id});assert.equal(start.status,200);
  assert.equal(start.quota.live.remainingSeconds,1200);
  const second=await f.request({action:'liveStart',id:'session-abcdefghijklmnop'});assert.equal(second.error,'live_already_active');
  f.now+=5000;const stop=await f.request({action:'liveStop',id});
  assert.equal(stop.quota.live.usedSeconds,5);assert.equal(stop.quota.live.remainingSeconds,1195);
  const duplicate=await f.request({action:'liveStop',id});assert.equal(duplicate.quota.live.usedSeconds,5);
});
test('last live second, daily reset and unavailable provider are handled without extra minutes',async()=>{
  const f=fixture(),id='session-1234567890123456';f.failSpeech=true;
  assert.equal((await f.request({action:'liveStart',id})).status,503);
  assert.equal((await f.status()).quota.live.usedSeconds,0);
  f.failSpeech=false;
  const status=await f.status();const {dayKey}=await import('../netlify/functions/_shared/feature-core.mjs');
  f.values.set('serverFeatureUsage/user1',{live:{day:dayKey(f.now),used:1199}});
  const last=await f.request({action:'liveStart',id});assert.equal(last.session.until-f.now,1000);
  f.now+=1000;assert.equal((await f.request({action:'liveStart',id})).error,'live_limit');
  f.now+=WINDOW_MS+15000;assert.equal((await f.status()).quota.live.remainingSeconds,1200);
});
test('Vienna calendar-day reset handles both daylight-saving changes',()=>{
  const spring=Date.parse('2026-03-28T23:00:00Z'),autumn=Date.parse('2026-10-24T22:00:00Z');
  assert.equal(nextMidnight(spring)-spring,23*3600000);
  assert.equal(nextMidnight(autumn)-autumn,25*3600000);
});
test('local fallback works without Azure credentials and retains server-enforced account exclusivity',async()=>{
  const f=fixture(),id='local-session-1234567890123456';f.failSpeech=true;
  const status=await f.status();assert.equal(status.localFallback,true);
  const started=await f.request({action:'liveStart',id,provider:'local'});
  assert.equal(started.status,200);assert.equal(started.provider,'local');assert.equal(started.speech,undefined);assert.equal(f.speechCalls,0);
  assert.equal((await f.request({action:'liveStart',id:'another-session-1234567890123456',provider:'local'})).error,'live_already_active');
  f.now+=5000;
  const renewed=await f.request({action:'liveRenew',id,provider:'local',refreshToken:true});
  assert.equal(renewed.status,200);assert.equal(f.speechCalls,0);
  assert.equal((await f.request({action:'liveStop',id})).quota.live.usedSeconds,5);
});
test('switching provider preserves elapsed use; choosing local cannot bypass the daily allowance',async()=>{
  const f=fixture(),azure='azure-session-1234567890123456',local='local-session-1234567890123456';
  await f.request({action:'liveStart',id:azure});f.now+=6000;
  assert.equal((await f.request({action:'liveStop',id:azure})).quota.live.usedSeconds,6);
  f.failSpeech=true;
  const next=await f.request({action:'liveStart',id:local,provider:'local'});
  assert.equal(next.status,200);assert.equal(next.quota.live.usedSeconds,6);
  assert.equal(f.speechCalls,1);
  for(let seconds=0;seconds<1194;seconds+=5){f.now+=Math.min(5,1194-seconds)*1000;await f.request({action:'liveRenew',id:local,provider:'local'});}
  const end=await f.request({action:'liveStart',id:'after-limit-1234567890123456',provider:'local'});
  assert.equal(end.error,'live_limit');assert.equal((await f.status()).quota.live.usedSeconds,1200);
});
test('invalid provider never reserves a session',async()=>{
  const f=fixture();
  const result=await f.request({action:'liveStart',id:'invalid-provider-1234567890123456',provider:'unlimited'});
  assert.equal(result.error,'invalid_input');assert.equal(f.speechCalls,0);assert.equal((await f.status()).quota.live.usedSeconds,0);
});
test('Azure network errors are classified as provider failures so the client can use local fallback',async()=>{
  const previousFetch=globalThis.fetch,previousKey=process.env.AZURE_SPEECH_KEY,previousRegion=process.env.AZURE_SPEECH_REGION;
  try{
    process.env.AZURE_SPEECH_KEY='qa-placeholder';process.env.AZURE_SPEECH_REGION='northeurope';
    globalThis.fetch=async()=>{throw new TypeError('Network is unavailable');};
    await assert.rejects(()=>speechToken(),error=>error.code==='speech_unavailable' && error.status===502);
  }finally{
    globalThis.fetch=previousFetch;
    if(previousKey===undefined)delete process.env.AZURE_SPEECH_KEY;else process.env.AZURE_SPEECH_KEY=previousKey;
    if(previousRegion===undefined)delete process.env.AZURE_SPEECH_REGION;else process.env.AZURE_SPEECH_REGION=previousRegion;
  }
});
test('upstream response validation rejects malformed writing results',async()=>{
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response(JSON.stringify({notMatches:[]}),{status:200});
    await assert.rejects(()=>checkWriting('Ich bin hier.','de'),e=>e.code==='writing_invalid_result');
    globalThis.fetch=async()=>new Response('busy',{status:429});
    await assert.rejects(()=>checkWriting('Ich bin hier.','de'),e=>e.code==='writing_service_busy');
  }finally{globalThis.fetch=original;}
});
test('highest verified/server-granted badge wins; arbitrary client values grant nothing',()=>{
  assert.equal(tierFor({1:true,25:true},{50:true}).amount,50);
  assert.equal(tierFor({100:'true',50:1},{25:false}).amount,0);
});
test('Play receipts are verified, acknowledged and bound to one account; canceled and pending purchases grant nothing',async()=>{
  const previousFetch=globalThis.fetch,previousAccount=process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=JSON.stringify({client_email:'qa@example.invalid',private_key:privateKey.export({type:'pkcs8',format:'pem'})});
  const records=new Map();let state=0,acknowledged=0;
  const db={ref(path){return {
    async transaction(fn){const value=fn(records.get(path)||null);if(value===undefined)return {committed:false};records.set(path,value);return {committed:true};},
    async set(value){records.set(path,value);}
  };}};
  try {
    globalThis.fetch=async(url)=>{
      if(String(url).includes('oauth2.googleapis.com'))return new Response(JSON.stringify({access_token:'fake-oauth'}));
      if(String(url).endsWith(':acknowledge')){acknowledged++;return new Response(null,{status:204});}
      return new Response(JSON.stringify({purchaseState:state,acknowledgementState:0}));
    };
    assert.equal(await verifyPlayPurchase({db,uid:'first'},'lumira_support_5','valid-receipt-123456'),5);
    assert.equal(records.get('serverFeatureEntitlements/first/5'),true);assert.equal(acknowledged,1);
    await assert.rejects(()=>verifyPlayPurchase({db,uid:'second'},'lumira_support_5','valid-receipt-123456'),e=>e.code==='purchase_already_linked');
    for(state of [1,2])await assert.rejects(()=>verifyPlayPurchase({db,uid:'first'},'lumira_support_100','pending-or-canceled-'+state),e=>e.code==='purchase_not_completed');
    assert.equal(records.has('serverFeatureEntitlements/first/100'),false);
  }finally{
    globalThis.fetch=previousFetch;
    if(previousAccount===undefined)delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;else process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=previousAccount;
  }
});
