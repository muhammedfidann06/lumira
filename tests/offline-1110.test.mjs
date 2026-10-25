import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import vm from'node:vm';
test('installed worker downloads all phrase locales, serves them offline and preserves dictionaries/models on activation',async()=>{
 const base='https://muhammedfidann06.github.io/lumira/',events={},messages=[],stores=new Map();let online=true;
 const url=value=>new URL(typeof value==='string'?value:value.url,base).href;
 const fetcher=async value=>{if(!online)throw Error('offline');let rel=new URL(url(value)).pathname.replace(/^\/lumira\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';try{return new Response(fs.readFileSync(new URL('../'+rel,import.meta.url)),{status:200});}catch{return new Response('missing',{status:404});}};
 const caches={keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key),open:async name=>{if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);return{match:async(req,options={})=>{const key=url(req);for(const[k,v]of data)if(options.ignoreSearch?k.split('?')[0]===key.split('?')[0]:k===key)return v.clone();},put:async(req,res)=>data.set(url(req),res.clone()),add:async req=>{const res=await fetcher(req);if(!res.ok)throw Error('add');data.set(url(req),res.clone());},keys:async()=>[...data.keys()].map(k=>new Request(k))};}};
 const self={location:new URL(base+'sw.js'),addEventListener:(type,fn)=>events[type]=fn,registration:{navigationPreload:{enable:async()=>{}}},clients:{claim:async()=>{},matchAll:async()=>[{postMessage:m=>messages.push(m)}]}};
 class BrowserRequest extends Request{constructor(value,options){super(url(value),options);}}
 const c=vm.createContext({self,caches,fetch:fetcher,Request:BrowserRequest,Response,URL,AbortSignal,AbortController,Promise,console,Headers,Date,setTimeout,clearTimeout});vm.runInContext(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),c);
 await(await caches.open('lumira-vocab-v1.9.5')).put('vocab-de.js',new Response('obsolete dictionary'));await caches.open('lumira-local-models-v1');await caches.open('lumira-shell-v1.10.4');
 let wait;events.install({waitUntil:p=>wait=p});await wait;
 // A cold lazy load uses a release query; an explicit offline download uses
 // the bare URL. They must not double the user's dictionary storage.
 for(const path of['vocab-fr.js','phrase-translations/fr.json']){
  let response;events.fetch({request:new BrowserRequest(path+'?v=1.11.4'),respondWith:p=>response=p});assert.equal((await response).status,200);
 }
 events.message({data:{type:'CACHE_ALL'},waitUntil:p=>wait=p});await wait;
 for(const name of['lumira-vocab-v1.11.4','lumira-phrases-v1.11.4']){
  const keys=await(await caches.open(name)).keys(),paths=keys.map(key=>new URL(key.url).pathname);
  assert.equal(paths.length,new Set(paths).size,'versioned and bare dictionary URLs share one entry');
  assert(keys.every(key=>!new URL(key.url).search));
 }
 assert.equal(messages.at(-1).type,'CACHE_DONE');assert.equal(messages.find(m=>m.type==='CACHE_PROGRESS').total,11);
 const request=async lang=>{let response;events.fetch({request:new BrowserRequest('phrase-translations/'+lang+'.json?v=1.11.1'),respondWith:p=>response=p});return await response;};
 for(const lang of['en','ar','fr','es','ru'])assert.equal((await(await request(lang)).json()).language,lang);
 events.activate({waitUntil:p=>wait=p});await wait;online=false;
 for(const lang of['en','ar','fr','es','ru']){const response=await request(lang);assert.equal(response.status,200);assert.equal(Object.keys((await response.json()).meanings).length,680);}
 assert(!stores.has('lumira-vocab-v1.9.5'));assert(stores.has('lumira-vocab-v1.11.4'));assert((await(await(await caches.open('lumira-vocab-v1.11.4')).match('vocab-de.js')).text()).includes('parallel vocabulary expansion'));assert(stores.has('lumira-local-models-v1'));assert(stores.has('lumira-phrases-v1.11.4'));assert(!stores.has('lumira-shell-v1.10.4'));
 let intercepted=false;events.fetch({request:new BrowserRequest('https://lumira-tr.com/.netlify/functions/maintenance'),respondWith:()=>intercepted=true});assert(!intercepted);
});
