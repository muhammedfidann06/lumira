import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import fs from'node:fs';
const source=fs.readFileSync(new URL('../analytics.js',import.meta.url),'utf8');
function fixture({increment=true}={}){
 const events={},store=new Map(),writes=[];let user={uid:'alice'},deny=true,authChange,opened=0;
 const db=()=>({ref:path=>({set(value){writes.push({path,value});return deny?Promise.reject(Object.assign(Error('permission_denied'),{code:'PERMISSION_DENIED'})):Promise.resolve();},transaction(fn){writes.push({path,value:fn(0)});return deny?Promise.reject(Error('permission_denied')):Promise.resolve();}})});db.ServerValue=increment?{increment:amount=>({'.sv':{increment:amount}})}:{};
 const firebase={apps:[{}],database:db,auth:()=>({get currentUser(){return user;},onAuthStateChanged(fn){authChange=fn;}})},storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const root={openSupport:()=>{opened++;return'opened';},openProfile(){},print(){},addEventListener(){}},document={readyState:'loading',addEventListener:(name,fn)=>events[name]=fn};
 vm.runInNewContext(source,{window:root,firebase,document,localStorage:storage,sessionStorage:storage,setTimeout,Date,String,Promise});events.DOMContentLoaded();
 return{root,writes,store,opened:()=>opened,allow:()=>deny=false,auth(uid){user=uid?{uid}:null;authChange();}};
}
for(const increment of[true,false])test('denied '+(increment?'increment':'transaction')+' metrics never reject the purchase handler or claim a successful DAU write',async()=>{const f=fixture({increment});assert.equal(f.root.openSupport(),'opened');f.root.LUMIRA_TRACK('extra');assert.equal(f.opened(),1);await new Promise(r=>setImmediate(r));assert(![...f.store.keys()].some(k=>k.startsWith('lumira_dau_')));assert(f.writes.some(r=>r.path.includes('support_clicked')));});
test('a successful DAU guard belongs to the signed-in account and sign-out does not write',async()=>{const f=fixture();await new Promise(r=>setImmediate(r));f.allow();f.auth(null);const before=f.writes.length;f.root.LUMIRA_TRACK('queued');assert.equal(f.writes.length,before);f.auth('bob');await new Promise(r=>setImmediate(r));assert([...f.store.keys()].some(k=>k.endsWith('_bob')));assert(![...f.store.keys()].some(k=>k.endsWith('_alice')));assert(f.writes.some(r=>r.path.endsWith('/bob')));});
test('the current microphone controller URL is pinned to the installed release',()=>{const version=JSON.parse(fs.readFileSync(new URL('../app-version.json',import.meta.url),'utf8')).version,loader=fs.readFileSync(new URL('../live-local-loader.js',import.meta.url),'utf8');assert(loader.includes('live-local.mjs?v='+version));});
for(const [level,expected]of[[.1,true],[0,false],[.02,false]])test(level===.1?'sustained voiced PCM without any Azure transcript switches away':level?'background room noise never abandons a healthy Azure session':'valid quiet PCM does not trigger the transcript watchdog',async()=>{
 let clock=1000,onAudio,browsers=0;
 class Local{constructor(options){onAudio=options.onAudio;}arm(){return Promise.resolve();}stop(){}}
 const root={location:{search:''},AudioContext:class{},LUMIRA_LOCAL:Local,LUMIRA_FEATURES:{subscribe(){},text:k=>k},LUMIRA_BROWSER:{BrowserSession:class{static supported(){return true;}start(){browsers++;}stop(){}}},PWA:{logError(){}},addEventListener(){}};
 const code=fs.readFileSync(new URL('../live-translate.js',import.meta.url),'utf8').replace('  window.LUMIRA_LIVE={mount,','  window.__captureTest={s,initLocal};window.LUMIRA_LIVE={mount,');
 vm.runInNewContext(code,{window:root,document:{hidden:false,addEventListener(){}},navigator:{},URLSearchParams,performance:{now:()=>clock},Promise,Date,Set,WeakMap,Float32Array,DataView,ArrayBuffer,setTimeout,clearTimeout,clearInterval,setInterval:()=>1,queueMicrotask,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
 const {s,initLocal}=root.__captureTest;Object.assign(s,{generation:1,phase:'listening',provider:'azure',providers:['azure'],sessionId:'session-fixture-1118',lastResult:clock,stream:{getTracks:()=>[]}});await initLocal(1);const pcm=new Float32Array(1600).fill(level);for(let i=0;i<140;i++){clock+=160;onAudio(pcm,i/10);}await new Promise(r=>setImmediate(r));assert.equal(browsers,expected?1:0);assert.equal(s.provider,expected?'browser':'azure');
});
test('a microphone that delivers only digital silence is reported once and clears when sound arrives',async()=>{
 let clock=1000,onAudio,browsers=0;const logs=[];
 class Local{constructor(options){onAudio=options.onAudio;this.captureMode='worklet';this.context={sampleRate:48000};}arm(){return Promise.resolve();}stop(){}}
 const root={location:{search:''},AudioContext:class{},LUMIRA_LOCAL:Local,LUMIRA_FEATURES:{subscribe(){},text:k=>k},LUMIRA_BROWSER:{BrowserSession:class{static supported(){return true;}start(){browsers++;}stop(){}}},PWA:{logError:entry=>logs.push(entry.message)},addEventListener(){}};
 const code=fs.readFileSync(new URL('../live-translate.js',import.meta.url),'utf8').replace('  window.LUMIRA_LIVE={mount,','  window.__captureTest={s,initLocal};window.LUMIRA_LIVE={mount,');
 vm.runInNewContext(code,{window:root,document:{hidden:false,addEventListener(){}},navigator:{},URLSearchParams,performance:{now:()=>clock},Promise,Date,Set,WeakMap,Float32Array,DataView,ArrayBuffer,setTimeout,clearTimeout,clearInterval,setInterval:()=>1,queueMicrotask,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
 const {s,initLocal}=root.__captureTest;Object.assign(s,{generation:1,phase:'listening',provider:'azure',providers:['azure'],sessionId:'session-fixture-1119',lastResult:clock,stream:{getTracks:()=>[],getAudioTracks:()=>[{muted:true}]}});await initLocal(1);
 const silence=new Float32Array(1600);for(let i=0;i<80;i++){clock+=100;onAudio(silence,i/10);}
 assert.equal(s.silentInput,true);assert.equal(logs.filter(message=>message.includes('silent_input')).length,1);assert(logs.find(message=>message.includes('silent_input')).includes('muted'));assert.equal(browsers,0);assert.equal(s.provider,'azure');
 onAudio(new Float32Array(1600).fill(.05),9);assert.equal(s.silentInput,false);
 const debug=root.LUMIRA_LIVE.debug();assert.equal(debug.silentInput,false);assert(debug.inputPeak>=.05);
});