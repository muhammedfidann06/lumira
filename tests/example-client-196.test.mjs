import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../example-translations.js',import.meta.url),'utf8');
const KEY='lumira_example_translations_v1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function client({saved=[],fetcher,storageDenied=false,token,deadline=22000}={}){
 const root=new EventTarget(),storage=new Map([[KEY,typeof saved==='string'?saved:JSON.stringify(saved)]]),calls=[],timers=[];
 root.NATIVE_LANG='tr';root.firebase={auth:()=>({currentUser:root.account})};
 root.account={uid:'first',getIdToken:token||async function(){return 'token-'+root.account.uid;}};
 const nav={onLine:true};
 const context=vm.createContext({window:root,localStorage:{getItem:k=>{if(storageDenied)throw Error('denied');return storage.get(k)||null;},setItem:(k,v)=>{if(storageDenied)throw Error('denied');storage.set(k,v);}},navigator:nav,AbortController,Event,
  setTimeout:(fn,ms)=>{timers.push(ms);return setTimeout(fn,ms===22000?deadline:ms);},clearTimeout,
  fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push({body,token:options.headers.Authorization,signal:options.signal});return fetcher?fetcher(body,options):new Response(JSON.stringify({source:body.source,target:body.target,examples:body.texts.map(sourceText=>({sourceText,translation:'Translated: '+sourceText}))}),{headers:{'Content-Type':'application/json'}});}});
 vm.runInContext(code,context);
 return {root,E:root.LUMIRA_EXAMPLES,storage,calls,nav,timers};
}
const row=(sourceText,translation='A translated sentence.')=>({source:'de',target:'en',sourceText,translation});

for(const language of ['tr','en','de','ar','fr','es','ru'])test('example client has complete status and retry copy: '+language,()=>{
 const {root,E}=client();root.NATIVE_LANG=language;
 for(const label of ['loading','automatic','missing','offline','login','retry'])assert(E.label(label).trim());
 assert.equal(E.label('retry'),E.copy[language].retry);
});
test('cache restoration binds the exact source, target and complete source text',()=>{
 const {E}=client({saved:[row('Du bist sehr nett.','You are very kind.')]});
 assert.equal(E.get('de','en','Du bist sehr nett.'),'You are very kind.');
 assert.equal(E.get('de','ar','Du bist sehr nett.'),'');assert.equal(E.get('en','de','Du bist sehr nett.'),'');assert.equal(E.get('de','en','Du bist nicht nett.'),'');
});
test('corrupt local storage does not prevent client initialisation',()=>{
 const {E}=client({saved:'{broken JSON'});assert.equal(E.get('de','en','x'),'');
});
test('invalid restored records never become example translations',()=>{
 const {E}=client({saved:[null,row('one',''),{...row('two'),target:'xx'},{...row('three'),source:'en'},row('four','Correct.')]});
 for(const text of ['one','two','three'])assert.equal(E.get('de','en',text),'');assert.equal(E.get('de','en','four'),'Correct.');
});
test('storage permission failure still allows an authenticated in-memory result',async()=>{
 const {E}=client({storageDenied:true});assert.equal(await E.request('de','en','Public dictionary example.'),'Translated: Public dictionary example.');assert.equal(E.state('de','en','Public dictionary example.'),'automatic');
});
test('cache count is bounded to the newest 1,200 entries',()=>{
 const {E}=client({saved:Array.from({length:1300},(_,i)=>row('Example '+i))});assert.equal(E.get('de','en','Example 99'),'');assert.equal(E.get('de','en','Example 100'),'A translated sentence.');assert(E.get('de','en','Example 1299'));
});
test('cache byte cap bounds large restored and subsequently persisted records',async()=>{
 const saved=Array.from({length:500},(_,i)=>row('Example '+i+' '+('x'.repeat(1700)),'y'.repeat(2800))),{E,storage}=client({saved});
 assert.equal(E.get('de','en',saved[0].sourceText),'');assert(E.get('de','en',saved[499].sourceText));await E.request('de','en','One more.');
 const persisted=storage.get(KEY);assert(persisted.length*2<1000500);assert(JSON.parse(persisted).length<1200);
});
test('offline cache works without an account and never makes a request',async()=>{
 const {root,E,calls,nav}=client({saved:[row('Already saved.','Ready offline.')]});root.account=null;nav.onLine=false;
 assert.equal(await E.request('de','en','Already saved.'),'Ready offline.');assert.equal(await E.request('de','en','Unseen.'),'');assert.equal(E.state('de','en','Unseen.'),'offline');assert.equal(calls.length,0);
});
test('anonymous requests stay local and show the translated login state',async()=>{
 const {root,E,calls}=client();root.account=null;assert.equal(await E.request('de','en','Not cached.'),'');assert.equal(E.state('de','en','Not cached.'),'login');assert.equal(calls.length,0);
});
test('invalid language, identical language and oversized input never reach the server',async()=>{
 const {E,calls}=client();for(const args of [['xx','en','x'],['de','xx','x'],['de','de','x'],['de','en',''],['de','en','x'.repeat(2001)]])assert.equal(await E.request(...args),'');assert.equal(calls.length,0);
});
test('duplicate exact examples share one in-flight request and result',async()=>{
 const {E,calls}=client();const a=E.request('de','en','One.'),b=E.request('de','en','One.');assert.equal(a,b);assert.equal(await a,'Translated: One.');assert.equal(calls.length,1);
});
test('nearby examples are batched at no more than six per request',async()=>{
 const {E,calls}=client();const outputs=await Promise.all(Array.from({length:13},(_,i)=>E.request('de','en','Example '+i)));assert(outputs.every(Boolean));assert.equal(calls.length,3);assert(calls.every(c=>c.body.texts.length<=6));assert.equal(new Set(calls.flatMap(c=>c.body.texts)).size,13);
});
test('source and target language batches remain separate',async()=>{
 const {E,calls}=client();await Promise.all([E.request('de','en','One.'),E.request('de','ar','One.'),E.request('fr','en','Deux.')]);assert.equal(calls.length,3);assert.equal(new Set(calls.map(c=>c.body.source+'/'+c.body.target)).size,3);
});
test('wrong response language cannot enter the example cache',async()=>{
 const {E}=client({fetcher:async()=>new Response(JSON.stringify({source:'de',target:'ar',examples:[{sourceText:'One.',translation:'Wrong target.'}]}))});assert.equal(await E.request('de','en','One.'),'');assert.equal(E.get('de','en','One.'),'');
});
test('response rows outside the requested source batch are ignored',async()=>{
 const {E}=client({fetcher:async()=>new Response(JSON.stringify({source:'de',target:'en',examples:[{sourceText:'Other.',translation:'Unrequested.'},{sourceText:'One.',translation:'The right sentence.'}]}))});assert.equal(await E.request('de','en','One.'),'The right sentence.');assert.equal(E.get('de','en','Other.'),'');
});
test('failed requests do not loop automatically, and an explicit retry recovers',async()=>{
 let fail=true;const {E,calls}=client({fetcher:async b=>fail?new Response('{}',{status:503}):new Response(JSON.stringify({source:b.source,target:b.target,examples:[{sourceText:'One.',translation:'Recovered.'}]}))});
 assert.equal(await E.request('de','en','One.'),'');assert.equal(await E.request('de','en','One.'),'');assert.equal(calls.length,1);fail=false;assert.equal(await E.request('de','en','One.',{retry:true}),'Recovered.');assert.equal(calls.length,2);
});
test('pending server generation gets exactly one delayed automatic retry',async()=>{
 const {E,calls}=client({fetcher:async b=>new Response(JSON.stringify({source:b.source,target:b.target,examples:[],pending:true}),{status:202})});assert.equal(await E.request('de','en','Busy.'),'');assert.equal(calls.length,2);assert.equal(E.state('de','en','Busy.'),'missing');
});
test('an account change aborts the active fetch and resolves its caller safely',async()=>{
 let started;const ready=new Promise(r=>started=r);const {root,E,calls}=client({fetcher:(body,options)=>new Promise((resolve,reject)=>{started();options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});})});
 const old=E.request('de','en','One.');await ready;root.account=null;root.dispatchEvent(new Event('lumira:featureauthchange'));assert.equal(await old,'');await sleep(5);assert(calls[0].signal.aborted);assert.equal(E.state('de','en','One.'),'login');
});
test('a late old-account response cannot resolve or overwrite a new-account job',async()=>{
 let release,started;const ready=new Promise(r=>started=r);let index=0;
 const {root,E}=client({fetcher:async b=>{if(index++===0){started();await new Promise(r=>release=r);return new Response(JSON.stringify({source:b.source,target:b.target,examples:[{sourceText:'One.',translation:'Old response.'}]}));}return new Response(JSON.stringify({source:b.source,target:b.target,examples:[{sourceText:'One.',translation:'New response.'}]}));}});
 const old=E.request('de','en','One.');await ready;root.account={uid:'second',getIdToken:async()=>'second-token'};root.dispatchEvent(new Event('lumira:featureauthchange'));const next=E.request('de','en','One.');assert.equal(await old,'');assert.equal(await next,'New response.');release();await sleep(10);assert.equal(E.get('de','en','One.'),'New response.');
});
test('token retrieval is also covered by the 22-second abort deadline',async()=>{
 const {E,calls,timers}=client({token:()=>new Promise(()=>{}),deadline:20});assert.equal(await E.request('de','en','One.'),'');assert(timers.includes(22000));assert.equal(calls.length,0);assert.equal(E.state('de','en','One.'),'missing');
});
test('returning online clears the offline failure and allows the pending card to retry',async()=>{
 const {root,E,nav}=client();nav.onLine=false;assert.equal(await E.request('de','en','One.'),'');nav.onLine=true;root.dispatchEvent(new Event('online'));assert.equal(await E.request('de','en','One.'),'Translated: One.');
});
