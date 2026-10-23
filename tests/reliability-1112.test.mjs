import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {LocalSession} from '../live-local.mjs';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const devices=[
 ['iPhone',{userAgent:'Mozilla iPhone OS 18',deviceMemory:8},false],
 ['iPad desktop agent',{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5,deviceMemory:8},false],
 ['Android unknown RAM',{userAgent:'Android Chrome Mobile'},false],
 ['Android 4GB',{userAgent:'Android Chrome Mobile',deviceMemory:4},false],
 ['Android 8GB',{userAgent:'Android Chrome Mobile',deviceMemory:8},true],
 ['desktop 2GB',{userAgent:'Windows Chrome',deviceMemory:2},false],
 ['desktop 8GB',{userAgent:'Windows Chrome',deviceMemory:8},true]
];
for(const[name,device,expected]of devices)test('WASM fallback resource policy: '+name,()=>assert.equal(LocalSession.fallbackAllowed(device),expected));
test('iPhone preparation fails before creating or downloading a model worker',async()=>{
 const oldWindow=globalThis.window,oldWorker=globalThis.Worker,descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');let workers=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'iPhone'}});globalThis.window={AudioContext:class{}};globalThis.Worker=class{constructor(){workers++;}};
 const session=new LocalSession({target:'tr',audioContext:{resume:async()=>{}}});session.worker=undefined;
 try{await assert.rejects(session.prepare(),e=>e.featureCode==='local_device_limited');assert.equal(session.worker,null);assert.equal(workers,0);}finally{globalThis.window=oldWindow;globalThis.Worker=oldWorker;if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
function cloudFixture(audio){const window={LUMIRA_FEATURES:{audio}},context=vm.createContext({window,performance,AbortController,ArrayBuffer,Uint8Array,DataView,Float32Array,setTimeout,clearTimeout,queueMicrotask,btoa});vm.runInContext(read('live-cloud.js'),context);return window.LUMIRA_CLOUD;}
const frame=(amplitude=.04)=>new Float32Array(1600).fill(amplitude);
test('a short utterance is sent after a natural pause instead of waiting six seconds',async()=>{
 let calls=0,payload;const{CloudSession}=cloudFixture(async value=>{calls++;payload=value;return{original:'Guten Tag.',translated:'İyi günler.'};});const session=new CloudSession({provider:'groq',target:'tr',id:'lease',source:'de'});await session.start();
 for(let i=0;i<16;i++)session.receive(frame(),(i+1)/10);assert.equal(calls,0);
 for(let i=0;i<5;i++)session.receive(frame(0),1.6+(i+1)/10);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.equal(payload.source,'de');assert.equal(payload.provider,'groq');assert.equal(session.length,0);session.stop();
});
test('continuous speech flushes at six seconds and keeps overlapping boundaries',async()=>{
 const sent=[];const{CloudSession}=cloudFixture(async value=>{sent.push(value);return{empty:true};});const session=new CloudSession({provider:'cloudflare',target:'en',id:'lease'});await session.start();
 for(let i=0;i<60;i++)session.receive(frame(),(i+1)/10);await new Promise(resolve=>setImmediate(resolve));assert.equal(sent.length,1);assert.equal(session.tail.length,9600);session.stop();
});
test('a slow chunk request never creates concurrent uploads and queued speech is retained',async()=>{
 let release,calls=0;const pending=new Promise(resolve=>release=resolve),{CloudSession}=cloudFixture(async()=>{calls++;if(calls===1)await pending;return{empty:true};});const session=new CloudSession({provider:'groq',target:'tr',id:'lease'});await session.start();
 for(let i=0;i<120;i++)session.receive(frame(),(i+1)/10);assert.equal(calls,1);assert.equal(session.length,96000);release();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);assert.equal(session.length,0);session.stop();
});
function glossFixture(){const c=vm.createContext({URL,AbortController,setTimeout,clearTimeout,location:{href:'https://lumira-tr.com/'}});c.window=c;for(const file of['vocab-core.js','vocab-de.js','vocab-en.js','vocab-ar.js','vocab-fr.js','vocab-es.js','vocab-ru.js','practice-gloss.js'])vm.runInContext(read(file),c);return c.LUMIRA_GLOSS;}
const gloss=glossFixture();
for(const native of['tr','en','ar','fr','es','ru'])test('German sentence is split into useful meanings in '+native,()=>{const result=gloss.breakdown('Ich finde den Kurs gut.','de',native);assert.deepEqual(Array.from(result,row=>row.word),['Ich','finde','den','Kurs','gut']);assert(result.every(row=>row.available&&row.meaning));if(native==='tr')assert.deepEqual(Array.from(result,row=>row.meaning),['ben','buluyorum','belirli artikel (belirtme hâli; çoğulda yönelme hâli)','kurs','iyi']);});
test('ambiguous or missing glosses are explained rather than copied from a whole sentence',()=>{const result=gloss.breakdown('Xylophonium finde 25','de','ar');assert.equal(result[0].available,false);assert(/\p{Script=Arabic}/u.test(result[0].meaning));assert.equal(result.at(-1).meaning,'25');});
test('German singular du is not mistranslated into a plural Arabic pronoun',()=>{const result=gloss.breakdown('Du bist hier.','de','ar');assert.equal(result[0].meaning,'أنت');});

test('local translation preparation loads the target direction without prefetching six source models',async()=>{
 const {LocalTextTranslator}=await import('../live-local-text.mjs');const original={fetch:globalThis.fetch,Worker:globalThis.Worker,caches:globalThis.caches},loaded=[];
 globalThis.fetch=async()=>Response.json({models:{}});globalThis.caches={open:async()=>({})};globalThis.Worker=class{postMessage(value){queueMicrotask(()=>this.onmessage({data:{id:value.id,result:true}}));}terminate(){}};
 const translator=new LocalTextTranslator();translator.load=async pair=>loaded.push(pair);
 try{await translator.prepare('tr');assert.deepEqual(loaded,['en-tr']);assert.equal(translator.memoryCache.size,0);}finally{translator.stop();Object.assign(globalThis,original);}
});
