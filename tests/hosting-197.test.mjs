import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {withCors} from '../netlify/functions/_shared/cors.mjs';
import features from '../netlify/functions/features.mjs';
import examples from '../netlify/functions/examples.mjs';
import audio from '../netlify/functions/live-audio.mjs';
import {createTtsHandler} from '../netlify/functions/tts.mjs';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const GH='https://muhammedfidann06.github.io',NL='https://lumira-tr.com';
const names=['features','live-audio','examples','tts'];
const handlers={features,examples,'live-audio':audio,tts:createTtsHandler(async()=>new Response(new Uint8Array([73,68,51,1,2,3]),{headers:{'Content-Type':'audio/mpeg'}}))};
function setup(url,{token,fetcher,deadline}={}){
 const root=new EventTarget(),location=new URL(url),calls=[],storage=new Map(),doc={addEventListener(){},querySelectorAll:()=>[]};let authCallback;
 root.location=location;root.NATIVE_LANG='tr';root.account={uid:'first',getIdToken:token||async function(){return'fixture-id-token';}};
 root.firebase={auth:()=>({currentUser:root.account,onAuthStateChanged:cb=>{authCallback=cb;}})};
 const context=vm.createContext({window:root,document:doc,navigator:{onLine:true,userAgent:'test',platform:'test'},AbortController,Event,CustomEvent,crypto,performance,queueMicrotask,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  setTimeout:(fn,ms)=>setTimeout(fn,deadline && ms===25000?deadline:ms),clearTimeout,
  fetch:async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return fetcher?fetcher(url,options):Response.json({quota:{tier:0,writing:{used:0,limit:10,remaining:10},live:{limitSeconds:1200,remainingSeconds:1200},pdf:{limit:0,remaining:0},offline:false}});}});
 for(const name of ['backend.js','access-i18n.js','feature-usage.js'])vm.runInContext(read(name),context,{filename:name});
 return{root,context,calls,authChange:()=>authCallback()};
}
for(const [url,base]of[
 [GH+'/lumira/',NL],[GH+'/lumira/index.html?src=twa',NL],[GH+'/lumira',NL],
 [NL+'/', ''],['https://preview--lumira.netlify.app/',''],['http://localhost:5000/',''],
 [GH+'/other-repo/',''],['https://someone-else.github.io/lumira/',''],['https://muhammedfidann06.github.io.attacker.invalid/lumira/','']
])for(const name of names)test('backend route '+url+' → '+name,()=>{
 const {root}=setup(url);assert.equal(root.LUMIRA_BACKEND.url(name),base+'/.netlify/functions/'+name);
});
for(const bad of ['../secrets','https://attacker.invalid','features?host=evil','features/../../other'])test('public routing refuses arbitrary endpoint '+bad,()=>assert.throws(()=>setup(GH+'/lumira/').root.LUMIRA_BACKEND.url(bad)));

for(const site of [GH+'/lumira/',NL+'/'])for(const action of ['status','check','liveStart','liveRenew','liveConnect','liveStop','pdfBegin','pdfCommit','pdfCancel','verifyPurchase'])test('authenticated client '+action+' from '+site,async()=>{
 const f=setup(site),body={id:'operation-12345678901234',text:'Hallo.',language:'de'};await f.root.LUMIRA_FEATURES.api(action,body);
 const call=f.calls[0];assert.equal(call.url,(site.startsWith(GH)?NL:'')+'/.netlify/functions/features');assert.equal(call.options.credentials,'omit');assert.equal(call.options.headers.Authorization,'Bearer fixture-id-token');assert.equal(call.body.action,action);assert.equal(call.body.text,'Hallo.');
});
for(const site of [GH+'/lumira/',NL+'/'])test('audio and unload cleanup share correct account endpoint from '+site,async()=>{
 const f=setup(site),F=f.root.LUMIRA_FEATURES;await F.audio({id:'session-12345678901234'});F.releaseOnExit('session-12345678901234');
 assert.equal(f.calls[0].url,(site.startsWith(GH)?NL:'')+'/.netlify/functions/live-audio');assert.equal(f.calls[1].url,(site.startsWith(GH)?NL:'')+'/.netlify/functions/features');assert.equal(f.calls[1].body.action,'liveStop');assert.equal(f.calls[1].options.keepalive,true);assert.equal(f.calls[1].options.credentials,'omit');
});
test('token retrieval is included in the API deadline',async()=>{
 const f=setup(GH+'/lumira/',{token:()=>new Promise(()=>{}),deadline:15});await assert.rejects(f.root.LUMIRA_FEATURES.api('status'),e=>e.featureCode==='request_timeout');assert.equal(f.calls.length,0);
});
test('account switch while obtaining a token sends no previous-account request',async()=>{
 let release;const f=setup(GH+'/lumira/',{token:()=>new Promise(r=>release=r)}),pending=f.root.LUMIRA_FEATURES.api('status');await Promise.resolve();f.root.account={uid:'second',getIdToken:async()=>'second-token'};f.authChange();release('old-token');await assert.rejects(pending,e=>e.featureCode==='login_required');f.root.LUMIRA_FEATURES.releaseOnExit('old-session');assert.equal(f.calls.length,0);
});
test('previous-account response cannot publish its quota to a new account',async()=>{
 let release,started;const ready=new Promise(r=>started=r),f=setup(GH+'/lumira/',{fetcher:()=>{started();return new Promise(r=>release=r);}}),pending=f.root.LUMIRA_FEATURES.api('status');await ready;f.root.account={uid:'second'};f.authChange();release(Response.json({quota:{tier:100}}));await assert.rejects(pending,e=>e.featureCode==='login_required');assert.equal(f.root.LUMIRA_FEATURES.getQuota(),null);
});
test('logout clears the token used by best-effort stop',async()=>{
 const f=setup(GH+'/lumira/');await f.root.LUMIRA_FEATURES.api('status');f.root.account=null;f.authChange();f.root.LUMIRA_FEATURES.releaseOnExit('session-12345678901234');assert.equal(f.calls.length,1);
});
test('a pre-aborted API call never reaches the server',async()=>{
 const f=setup(GH+'/lumira/'),controller=new AbortController();controller.abort();await assert.rejects(f.root.LUMIRA_FEATURES.api('status',{}, {signal:controller.signal}));assert.equal(f.calls.length,0);
});
test('an anonymous call never reaches the server',async()=>{const f=setup(GH+'/lumira/');f.root.account=null;await assert.rejects(f.root.LUMIRA_FEATURES.api('status'),e=>e.featureCode==='login_required');assert.equal(f.calls.length,0);});

function preflight(name,origin=GH,{method,headers='authorization,content-type'}={}){
 return new Request(NL+'/.netlify/functions/'+name,{method:'OPTIONS',headers:{Origin:origin,'Sec-Fetch-Site':'cross-site','Access-Control-Request-Method':method||(name==='tts'?'GET':'POST'),'Access-Control-Request-Headers':name==='tts'?'range':headers}});
}
for(const name of names)for(const origin of [GH,NL])test('CORS preflight '+name+' from '+origin,async()=>{
 const response=await handlers[name](preflight(name,origin));assert.equal(response.status,204);assert.equal(await response.text(),'');assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(response.headers.get('Access-Control-Allow-Credentials'),null);assert.equal(response.headers.get('Access-Control-Max-Age'),'600');assert(response.headers.get('Vary').includes('Origin'));
});
for(const name of names)for(const origin of ['null','https://other.github.io','https://muhammedfidann06.github.io.attacker.invalid','http://muhammedfidann06.github.io','https://lumira-tr.com.attacker.invalid'])test('CORS rejects '+name+' from '+origin,async()=>{
 const response=await handlers[name](preflight(name,origin));assert.equal(response.status,403);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});
for(const name of names)test('CORS rejects unapproved preflight method for '+name,async()=>assert.equal((await handlers[name](preflight(name,GH,{method:'DELETE'}))).status,403));
for(const name of names.filter(n=>n!=='tts'))test('CORS rejects unexpected request headers for '+name,async()=>assert.equal((await handlers[name](preflight(name,GH,{headers:'authorization,x-invented-admin'}))).status,403));
function wave(){const b=Buffer.alloc(3244);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(3200,40);return b.toString('base64');}
for(const [name,body]of[
 ['features',{action:'status'}],['examples',{source:'de',target:'ar',texts:['Du bist sehr nett.']}],['live-audio',{id:'session-12345678901234',provider:'groq',target:'tr',audio:wave()}]
])test('allowing GitHub CORS never removes '+name+' authentication',async()=>{
 const response=await handlers[name](new Request(NL+'/.netlify/functions/'+name,{method:'POST',headers:{Origin:GH,'Sec-Fetch-Site':'cross-site','Content-Type':'application/json'},body:JSON.stringify(body)}));assert.equal(response.status,401);assert.equal((await response.json()).error,'login_required');assert.equal(response.headers.get('Access-Control-Allow-Origin'),GH);
});
test('CORS preserves error status and exposes version headers',async()=>{
 const handler=withCors(async()=>Response.json({error:'live_limit'},{status:429,headers:{'Vary':'Accept-Encoding','X-Lumira-Features-Version':'1.9.8'}})),r=await handler(new Request(NL+'/x',{method:'POST',headers:{Origin:GH,'Sec-Fetch-Site':'cross-site'}}));assert.equal(r.status,429);assert.equal(r.headers.get('Vary'),'Accept-Encoding, Origin');assert.equal(r.headers.get('Access-Control-Allow-Origin'),GH);assert(r.headers.get('Access-Control-Expose-Headers').includes('X-Lumira-Features-Version'));
});
test('cross-site metadata without an origin cannot bypass the allow-list',async()=>assert.equal((await features(new Request(NL+'/.netlify/functions/features',{method:'POST',headers:{'Sec-Fetch-Site':'cross-site'},body:'{}'}))).status,403));
test('TTS byte-range responses remain playable from GitHub',async()=>{
 const r=await handlers.tts(new Request(NL+'/.netlify/functions/tts?lang=de&text=Hallo',{headers:{Origin:GH,'Sec-Fetch-Site':'cross-site',Range:'bytes=0-1'}}));assert.equal(r.status,206);assert.equal(r.headers.get('Access-Control-Allow-Origin'),GH);assert.equal(r.headers.get('Cross-Origin-Resource-Policy'),'cross-origin');assert.equal(r.headers.get('Content-Range'),'bytes 0-1/6');assert.equal((await r.arrayBuffer()).byteLength,2);
});
test('TTS HEAD and invalid ranges preserve response metadata under CORS',async()=>{
 const headers={Origin:GH,'Sec-Fetch-Site':'cross-site'};const head=await handlers.tts(new Request(NL+'/.netlify/functions/tts?lang=de&text=Hallo',{method:'HEAD',headers}));assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(head.headers.get('Content-Length'),'6');const bad=await handlers.tts(new Request(NL+'/.netlify/functions/tts?lang=de&text=Hallo',{headers:{...headers,Range:'bytes=99-100'}}));assert.equal(bad.status,416);assert.equal(bad.headers.get('Access-Control-Allow-Origin'),GH);
});
test('TTS provider failure is readable by the app without exposing upstream details',async()=>{
 const handler=createTtsHandler(async()=>{throw Error('private-upstream-detail');}),r=await handler(new Request(NL+'/.netlify/functions/tts?lang=de&text=Hallo',{headers:{Origin:GH}}));assert.equal(r.status,502);assert.equal(r.headers.get('Access-Control-Allow-Origin'),GH);assert(!(await r.text()).includes('private-upstream-detail'));
});
for(const site of [GH+'/lumira/',NL+'/'])test('iPhone media playback routes synchronously and uses anonymous CORS from '+site,()=>{
 const f=setup(site),played=[];
 class Audio{play(){played.push(this);this.onplaying?.();this.onended?.();return Promise.resolve();}pause(){}}
 f.context.Audio=Audio;f.context.navigator.userAgent='iPhone';vm.runInContext(read('voice.js'),f.context);
 f.root.speakGoogle('Hallo? & مرحبا','de-DE',false);assert.equal(played.length,1);assert.equal(played[0].crossOrigin,'anonymous');const url=new URL(played[0].src,site);assert.equal(url.origin,NL);assert.equal(url.pathname,'/.netlify/functions/tts');assert.equal(url.searchParams.get('text'),'Hallo? & مرحبا');
});

const accessSource=read('access-screen.js');
const accessGuard=accessSource.slice(accessSource.indexOf('async function requireFeature('),accessSource.indexOf('window.LUMIRA_ACCESS='));
function withAccess(f,language='tr'){
 const opened=[],toasts=[];f.root.NATIVE_LANG=language;f.root.PWA={toast:(...args)=>toasts.push(args)};
 f.context.T=key=>f.root.LUMIRA_ACCESS_COPY.text(key);f.context.open=(...args)=>opened.push(args);vm.runInContext(accessGuard,f.context);
 return{opened,toasts,require:feature=>f.context.requireFeature(feature)};
}
for(const site of [GH+'/lumira/',NL+'/'])for(const tier of [0,1,5,10,25,50,100])for(const feature of ['pdf','offline'])test('access '+feature+' tier '+tier+' from '+site,async()=>{
 const f=setup(site,{fetcher:async()=>Response.json({quota:{tier,pdf:{remaining:tier===0?0:tier===1?5:null},writing:{limit:10,used:0,remaining:10},live:{remainingSeconds:1200}}})}),a=withAccess(f);
 assert.equal(await a.require(feature),tier>0);assert.equal(a.toasts.length,0);assert.equal(a.opened.length,tier?0:1);assert.equal(f.calls[0].url,site.startsWith(GH)?NL+'/.netlify/functions/features':'/.netlify/functions/features');
});
for(const language of ['tr','en','de','ar','fr','es','ru'])for(const failure of ['html','server','auth'])test('online '+failure+' failure is not mislabeled as offline in '+language,async()=>{
 const f=setup(GH+'/lumira/',{fetcher:async()=>failure==='html'?new Response('<html>404</html>',{status:404}):Response.json({error:failure==='server'?'server_not_configured':'login_required'},{status:failure==='server'?503:401})}),a=withAccess(f,language);
 assert.equal(await a.require('offline'),false);assert.equal(a.opened.length,0);assert.equal(a.toasts.length,1);assert.notEqual(a.toasts[0][0],f.root.LUMIRA_ACCESS_COPY.text('net'));assert(!a.toasts[0][0].includes('henüz kullanıma'));assert.equal(a.toasts[0][0],f.root.LUMIRA_FEATURES.text(failure==='auth'?'login_required':failure==='html'?'backend_unavailable':'server_not_configured'));
});
for(const language of ['tr','en','de','ar','fr','es','ru'])test('genuine offline without verified entitlement shows internet message in '+language,async()=>{
 const f=setup(GH+'/lumira/'),a=withAccess(f,language);f.context.navigator.onLine=false;assert.equal(await a.require('pdf'),false);assert.equal(a.toasts[0][0],f.root.LUMIRA_ACCESS_COPY.text('net'));assert.equal(f.calls.length,0);assert.equal(a.opened.length,0);
});
test('verified offline badge uses its cached entitlement without a network request',async()=>{
 const f=setup(GH+'/lumira/',{fetcher:async()=>Response.json({quota:{tier:5,pdf:{remaining:null}}})}),a=withAccess(f);await f.root.LUMIRA_FEATURES.api('status');f.context.navigator.onLine=false;assert.equal(await a.require('pdf'),true);assert.equal(await a.require('offline'),true);assert.equal(f.calls.length,1);assert.equal(a.toasts.length,0);
});
test('exhausted five PDF allowance opens the benefits screen and never claims missing internet',async()=>{
 const f=setup(GH+'/lumira/',{fetcher:async()=>Response.json({quota:{tier:1,pdf:{remaining:0}}})}),a=withAccess(f);assert.equal(await a.require('pdf'),false);assert.equal(a.opened[0][0],'pdf_limit');assert.equal(a.toasts.length,0);
});
test('anonymous PDF request asks for login instead of offering a badge before identity is known',async()=>{
 const f=setup(GH+'/lumira/'),a=withAccess(f);f.root.account=null;assert.equal(await a.require('pdf'),false);assert.equal(a.opened.length,0);assert.equal(a.toasts[0][0],f.root.LUMIRA_FEATURES.text('login_required'));assert.equal(f.calls.length,0);
});
for(const body of ['null','[]','1','"wrong"'])test('malformed backend JSON '+body+' is rejected as unavailable',async()=>{
 const f=setup(GH+'/lumira/',{fetcher:async()=>new Response(body)});await assert.rejects(f.root.LUMIRA_FEATURES.api('status'),e=>e.featureCode==='backend_unavailable');
});

test('an expired token refreshes once and retains the same writing operation ID',async()=>{
 const tokens=[];let attempts=0;
 const f=setup(GH+'/lumira/',{token:async force=>{tokens.push(force);return force?'fresh-token':'expired-token';},fetcher:async()=>++attempts===1?Response.json({error:'login_required'},{status:401}):Response.json({matches:[],quota:{tier:0}})});
 await f.root.LUMIRA_FEATURES.api('check',{id:'same-operation-1234567890',text:'Hallo.',language:'de'});
 assert.deepEqual(tokens,[false,true]);assert.equal(f.calls.length,2);
 assert.equal(f.calls[1].options.headers.Authorization,'Bearer fresh-token');
 assert.equal(f.calls[0].options.body,f.calls[1].options.body);
});
test('a second unauthorized response does not create a refresh loop',async()=>{
 const f=setup(GH+'/lumira/',{fetcher:async()=>Response.json({error:'login_required'},{status:401})});
 await assert.rejects(f.root.LUMIRA_FEATURES.api('status'),e=>e.featureCode==='login_required');assert.equal(f.calls.length,2);
});
test('a lost response never blindly replays a writing mutation',async()=>{
 const f=setup(GH+'/lumira/',{fetcher:async()=>{throw new TypeError('network failure');}});
 await assert.rejects(f.root.LUMIRA_FEATURES.api('check',{id:'single-operation-12345678',text:'Hallo.',language:'de'}),e=>e.featureCode==='backend_unavailable');assert.equal(f.calls.length,1);
});
for(const name of ['stories','billing'])for(const site of [GH+'/lumira/',NL+'/'])test('authenticated '+name+' service uses the correct backend from '+site,async()=>{
 const f=setup(site);await f.root.LUMIRA_FEATURES.service(name,'status');
 assert.equal(f.calls[0].url,(site.startsWith(GH)?NL:'')+'/.netlify/functions/'+name);
 assert.equal(f.calls[0].options.headers.Authorization,'Bearer fixture-id-token');assert.equal(f.calls[0].body.action,'status');
});
