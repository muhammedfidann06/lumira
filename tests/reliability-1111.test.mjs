import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {connectProvider,resetCircuitsForTests} from '../netlify/functions/_shared/live-providers.mjs';
import {knownStory} from '../netlify/functions/_shared/story-library.mjs';
import {validateStory} from '../netlify/functions/_shared/story-core.mjs';
import {LocalSession} from '../live-local.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const languages=['tr','en','de','ar','fr','es','ru'];

test('Gemini token locks the actual REST setup, with transcription fields at the setup level',async()=>{
 resetCircuitsForTests();let sent;
 await connectProvider('gemini','tr',{env:{GEMINI_API_KEY:'fixture'},fetcher:async(url,init)=>{sent=JSON.parse(init.body);return Response.json({name:'auth_tokens/fixture'});}});
 const setup=sent.bidiGenerateContentSetup;
 assert(setup.inputAudioTranscription);assert(setup.outputAudioTranscription);
 assert(!Object.hasOwn(setup.generationConfig,'inputAudioTranscription'));
 assert.equal(setup.generationConfig.translationConfig.targetLanguageCode,'tr');
 assert.equal(sent.uses,1);assert(!Object.hasOwn(sent,'liveConnectConstraints'));
});
test('Gemini legacy endpoint schema gets one bounded compatibility retry',async()=>{
 resetCircuitsForTests();const calls=[];
 const result=await connectProvider('gemini','ar',{env:{GEMINI_API_KEY:'fixture'},fetcher:async(url,init)=>{calls.push(JSON.parse(init.body));return calls.length===1?Response.json({error:{message:'Unknown name "bidiGenerateContentSetup": Cannot find field.'}},{status:400}):Response.json({name:'auth_tokens/fixture'});}});
 assert.equal(calls.length,2);assert(calls[0].bidiGenerateContentSetup);assert.equal(calls[1].liveConnectConstraints.config.translationConfig.targetLanguageCode,'ar');assert.equal(result.credential.token,'auth_tokens/fixture');
});
for(const status of[400,401,403,429,503])test('Gemini HTTP '+status+' does not retry a quota, auth or unrelated validation failure',async()=>{
 resetCircuitsForTests();let count=0;
 await assert.rejects(connectProvider('gemini','tr',{env:{GEMINI_API_KEY:'fixture'},fetcher:async()=>{count++;return Response.json({error:{message:'Invalid request'}},{status});}}));assert.equal(count,1);
});

test('failed AudioWorklet falls back to capture without reopening or downloading models',async()=>{
 const old=globalThis.window;let calls=0,closed=0,stopped=0,resumed=0;
 const node=()=>({connect(){},disconnect(){},gain:{value:1}});
 const context={state:'running',sampleRate:48000,audioWorklet:{addModule:async()=>{calls++;throw Error('module unavailable');}},createMediaStreamSource:node,createGain:node,createScriptProcessor:()=>({...node()}),destination:{},resume:async()=>resumed++,close:async()=>closed++};
 globalThis.window={AudioContext:class{},AudioWorkletNode:class{}};
 try{
  const session=new LocalSession({target:'tr',audioContext:context});
  await session.arm({clone:()=>({getTracks:()=>[{stop:()=>stopped++}]})});
  assert.equal(calls,1);assert.equal(typeof session.capture.onaudioprocess,'function');assert.equal(session.worker,undefined);
  session.capture.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4800).fill(.1)}});assert.equal(session.samples,1600);
  context.state='suspended';session.resumeCapture();assert(resumed>=3);assert(!session.collecting);
  session.stop();assert.equal(closed,1);assert.equal(stopped,1);
 }finally{globalThis.window=old;}
});

const catalog=JSON.parse(read('netlify/functions/_shared/story-sources.json'));
for(const language of languages)for(const native of languages.filter(v=>v!==language))test('reviewed short story uses only first fifty learned cards: '+language+' → '+native,()=>{
 const pool=catalog.filter(v=>v[0]===(language==='tr'?'de':language)).slice(0,50).map(v=>({w:v[language==='tr'?3:2]}));
 const options={language,native,level:0,genre:'daily',style:'minimal',voice:'natural'};
 const story=knownStory(pool,options);assert(story,'reviewed scene must fit');assert.equal(story.format,'dialogue');assert.equal(story.provider,'guided');assert.doesNotThrow(()=>validateStory(story,pool,options));
});
test('large learned pool can receive a grammatical short story without twenty-word padding',()=>{
 const pool=['Hello','How are you','I am fine thank you','See you soon',...Array.from({length:566},(_,i)=>'word'+i)].map(w=>({w}));
 const options={language:'en',native:'tr',level:0};
 const sentences=[{text:'Hello!',translation:'Merhaba!'},{text:'How are you?',translation:'Nasılsın?'},{text:'I am fine, thank you.',translation:'İyiyim, teşekkür ederim.'},{text:'See you soon!',translation:'Yakında görüşürüz!'}];
 const result=validateStory({sentences},pool,options);assert(result.wordCount<20);assert(result.usedWords>=6);
 const bad=structuredClone(sentences);bad[2].text+=' dragons';assert.throws(()=>validateStory({sentences:bad},pool,options),e=>e.code==='story_unknown_word');
});
test('reviewed fallback refuses unrelated word lists rather than silently introducing new words',()=>{
 assert.equal(knownStory(['book','blue','table','window','quiet','large','green','house'].map(w=>({w})),{language:'en',native:'tr',level:0}),null);
});

function workerFixture({failedAsset='',status=200}={}){
 const base='https://muhammedfidann06.github.io/lumira/',events={},stores=new Map();let networkStatus=status;
 const url=v=>new URL(typeof v==='string'?v:v.url,base).href;
 const fetcher=async req=>{const href=url(req);return new Response(href.includes(failedAsset)&&failedAsset?'missing':'network',{status:failedAsset&&href.includes(failedAsset)?503:networkStatus});};
 const caches={keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n),open:async name=>{
  if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
  return{match:async(req,{ignoreSearch=false}={})=>{for(const[key,value]of store)if(ignoreSearch?key.split('?')[0]===url(req).split('?')[0]:key===url(req))return value.clone();},put:async(req,res)=>store.set(url(req),res.clone()),add:async req=>{const response=await fetcher(req);if(!response.ok)throw Error('required_asset_failed');store.set(url(req),response);}};
 }};
 class BrowserRequest extends Request{constructor(value,options){super(url(value),options);}}
 const self={location:new URL(base+'sw.js'),registration:{scope:base,navigationPreload:{enable:async()=>{}}},clients:{claim:async()=>{},matchAll:async()=>[]},addEventListener:(name,fn)=>events[name]=fn};
 vm.runInNewContext(read('sw.js'),{self,caches,fetch:fetcher,Request:BrowserRequest,Response,URL,AbortSignal,Promise,setTimeout,clearTimeout,console});
 return{events,caches,stores,setStatus:v=>networkStatus=v,request:BrowserRequest,base};
}
test('missing stylesheet rejects worker installation instead of activating a partial design',async()=>{
 const f=workerFixture({failedAsset:'theme.css'});let wait;f.events.install({waitUntil:p=>wait=p});await assert.rejects(wait,/required_asset_failed/);
});
test('optional missing image does not discard a fully installed code/theme shell',async()=>{
 const f=workerFixture({failedAsset:'scene-bg.jpg'});let wait;f.events.install({waitUntil:p=>wait=p});await wait;assert(f.stores.get('lumira-shell-v1.11.1').has(f.base+'theme.css'));
});
test('HTTP 503 for a script preserves the last working code rather than rendering an incomplete page',async()=>{
 const f=workerFixture({status:503}),cache=await f.caches.open('lumira-shell-v1.11.1');await cache.put('theme.js',new Response('cached-theme'));
 let response;f.events.fetch({request:new f.request('theme.js?v=1.11.0'),respondWith:p=>response=p});assert.equal(await(await response).text(),'cached-theme');
});
test('a versioned asset uses the coherent installed release even if the network already has a newer deploy',async()=>{
 const f=workerFixture(),cache=await f.caches.open('lumira-shell-v1.11.1');await cache.put('theme.css',new Response('installed-theme'));
 let response;f.events.fetch({request:new f.request('theme.css?v=1.11.1'),respondWith:p=>response=p});assert.equal(await(await response).text(),'installed-theme');
});
test('failed HTML navigation retains the working app instead of a server error page',async()=>{
 const f=workerFixture({status:503}),cache=await f.caches.open('lumira-shell-v1.11.1');await cache.put('index.html',new Response('working-app'));
 // Worker navigation is selected by request.mode, which is read-only on native Request.
 let result;f.events.fetch({request:{url:f.base,method:'GET',mode:'navigate'},respondWith:p=>result=p});assert.equal(await(await result).text(),'working-app');
});

test('all six phrase decks preserve original word objects, valid identities and aligned meanings',async()=>{
 const ctx=vm.createContext({URL,AbortController,setTimeout,clearTimeout,location:{href:'https://lumira-tr.com/'},fetch:async url=>({ok:true,json:async()=>JSON.parse(read(new URL(url).pathname.slice(1)))})});
 for(const f of['vocab-core.js',...['de','en','ar','fr','es','ru'].map(l=>'vocab-'+l+'.js')])vm.runInContext(read(f),ctx);
 const original=vm.runInContext('VOCAB.slice()',ctx);vm.runInContext(read('phrases-de.js'),ctx);
 for(const language of['de','en','ar','fr','es','ru'])await ctx.LUMIRA_PHRASES.ensureLanguage(language);
 const all=vm.runInContext('VOCAB',ctx);for(const card of original)assert(all.includes(card));
 for(const language of['de','en','ar','fr','es','ru']){
  const phrases=all.filter(v=>v.lang===language&&v.cat==='Kalıp Cümleler');assert(phrases.length>=675);
  for(const level of['A1','A2','B1','B2'])assert.equal(ctx.LUMIRA_PHRASES.rows.filter(v=>v.id.startsWith('extra-')&&v.level===level).length,10);
  for(const phrase of phrases){assert(phrase.w.trim());assert(phrase.tr.trim());assert(encodeURIComponent(phrase.lang+'_'+phrase.level+'_'+phrase.w).length+2<=700);}
 }
 assert.equal(new Set(all.map(v=>[v.lang,v.level,v.w].join('\n'))).size,all.length);
});
