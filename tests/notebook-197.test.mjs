import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),pwa=fs.readFileSync(new URL('../pwa.js',import.meta.url),'utf8');
const notebook=html.slice(html.indexOf('let nbWords = {}'),html.indexOf('/* ======================= INIT =======================',html.indexOf('let nbWords = {}')));
const pwaFavorites=pwa.slice(pwa.indexOf("var FAV_KEY = 'lumira_favs_v1'"),pwa.indexOf('function activeLangCode()'));
const languages=['tr','en','de','ar','fr','es','ru'];
const words={tr:'öğrenmek',en:'learn',de:'lernen',ar:'أتعلم',fr:'apprendre',es:'aprender',ru:'учиться'};
function fixture({seed={},legacy=[],local=null,fail=false}={}){
 const data=structuredClone(seed),storage=new Map([['lumira_favs_v1',JSON.stringify(legacy)],...(local?[['lumira_notebook_v1',JSON.stringify(local)]]:[])]),listeners=[],writes=[],toasts=[],root=new EventTarget();let uid='first',failure=fail,hold=null;
 const read=path=>path.split('/').filter(Boolean).reduce((v,k)=>v?.[k],data)??null;
 const assign=(path,value)=>{const keys=path.split('/').filter(Boolean);let node=data;for(const key of keys.slice(0,-1))node=node[key]??={};if(value===null)delete node[keys.at(-1)];else node[keys.at(-1)]=structuredClone(value);};
 const snapshot=path=>{const value=structuredClone(read(path));return{val:()=>value};};
 const emit=()=>{for(const l of listeners.filter(l=>l.active)){const snap=snapshot(l.path);queueMicrotask(()=>l.cb(snap));}};
 const mutate=async(path,value,merge)=>{writes.push({path,value:structuredClone(value),merge});if(failure)throw Error('permission_denied');if(merge)for(const[k,v]of Object.entries(value))assign((path?path+'/':'')+k,v);else assign(path,value);emit();if(hold)await hold;};
 const ref=path=>({key:path.split('/').at(-1),on(event,cb,error){const l={path,cb,error,active:true};listeners.push(l);const snap=snapshot(path);queueMicrotask(()=>cb(snap));},off(event,cb){listeners.filter(l=>l.path===path&&l.cb===cb).forEach(l=>l.active=false);},once:async()=>snapshot(path),update:value=>mutate(path,value,true),set:value=>mutate(path,value,false),remove:()=>mutate(path,null,false),push:()=>ref(path+'/push'+writes.length)});
 const db={ref:path=>ref(path||'')};root.t=k=>k;root.LB_getDb=()=>db;root.LB_getUid=()=>uid;root.LUM_toast=(...a)=>toasts.push(a);
 const context=vm.createContext({window:root,document:{getElementById:()=>null,addEventListener(){}},Event,console,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},queueMicrotask,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},LANGS:Object.fromEntries(languages.map(l=>[l,{}])),NATIVE_LANG:'tr',activeCat:'Tümü',deck:[{lang:'de',w:'lernen',tr:'öğrenmek',ex:'Ich lerne.',exTr:'Öğreniyorum.'}],idx:0,t:k=>k,isCross:()=>false,isReversed:()=>false,cardFrontWord:v=>v.w,cardBackWord:v=>v.tr,cardFrontExample:v=>v.ex,cardBackExample:v=>v.exTr});
 vm.runInContext(notebook,context);context.store=(k,v)=>v===undefined?JSON.parse(storage.get(k)||'null'):storage.set(k,JSON.stringify(v));context.toast=(...a)=>toasts.push(a);vm.runInContext(pwaFavorites,context);
 const settle=()=>new Promise(r=>setTimeout(r,15));
 return{root,context,data,storage,listeners,writes,toasts,settle,read,assign,emit,async ready(){vm.runInContext('nbInitSync()',context);await settle();},fail:v=>failure=v,hold:p=>hold=p,async switch(value){uid=value;vm.runInContext('nbInitSync()',context);await settle();}};
}
for(const lang of languages)test('favorite '+lang+': PWA save appears in account notebook and both favorite lists',async()=>{
 const f=fixture();await f.ready();const v={lang,w:words[lang],tr:'meaning',ex:'Example.',exTr:'Meaning.',meaningLang:lang==='tr'?'en':'tr'};assert.equal(await f.context.addFavorite(v),true);await f.settle();const list=vm.runInContext('nbCombinedList()',f.context);assert.equal(list.length,1);assert.equal(list[0].w,v.w);assert.equal(list[0].ex,v.ex);assert.equal(list[0].meaningLang,v.meaningLang);assert.equal(f.context.favs().length,1);assert.equal(f.root.NB_getFavorites().length,1);assert.equal(Object.values(f.read('progress/first/notebook'))[0].w,v.w);
});
test('PWA remove and core star share a record; unfavorite retains the notebook word',async()=>{
 const f=fixture();await f.ready();assert.equal(await f.context.nbToggleFavorite(true),true);assert.equal(f.context.favs().length,1);const v=f.root.NB_currentFavorite();assert.equal(await f.context.removeFavorite(v),true);await f.settle();assert.equal(f.context.favs().length,0);assert.equal(vm.runInContext('nbCombinedList().length',f.context),1);assert.equal(await f.context.addFavorite(v),true);assert.equal(vm.runInContext('nbCombinedList().length',f.context),1);
});
test('favorite toggles preserve an existing manual note, its example and difficulty',async()=>{
 const note={w:'lernen',tr:'öğrenmek',lang:'de',ex:'My example',difficulty:'zor',ts:1};const f=fixture({seed:{progress:{first:{notebook:{manual:note}}}}});await f.ready();await f.context.addFavorite(f.root.NB_currentFavorite());await f.settle();assert.equal(f.read('progress/first/notebook/manual').isFavorite,true);assert.equal(f.read('progress/first/notebook/manual').difficulty,'zor');assert.equal(f.read('progress/first/notebook/manual').ex,'My example');assert.equal(Object.keys(f.read('progress/first/notebook')).length,1);
});
test('same word with different meaning or language never overwrites an earlier note',async()=>{
 const f=fixture();await f.ready();for(const v of[{lang:'de',w:'Bank',tr:'banka'},{lang:'de',w:'Bank',tr:'bank'},{lang:'en',w:'Bank',tr:'bank'}])assert.equal(await f.context.addFavorite(v),true);await f.settle();assert.equal(Object.keys(f.read('progress/first/notebook')).length,3);assert.equal(f.context.favs().length,3);
});
test('repeated add is idempotent and rapid double toggle cannot race a pending write',async()=>{
 const f=fixture();await f.ready();let release;f.hold(new Promise(r=>release=r));const pending=f.context.nbToggleFavorite(true);await f.settle();assert.equal(await f.context.nbToggleFavorite(true),false);assert.equal(f.context.favs().length,1);release();await pending;f.hold(null);assert.equal(await f.context.addFavorite(f.root.NB_currentFavorite()),true);assert.equal(f.read('progress/first/notebook')&&Object.keys(f.read('progress/first/notebook')).length,1);
});
test('permission failure rolls back both stars and lists and reports failure',async()=>{
 const f=fixture();await f.ready();f.fail(true);assert.equal(await f.context.addFavorite(f.root.NB_currentFavorite()),false);assert.equal(f.context.favs().length,0);assert.equal(vm.runInContext('nbCombinedList().length',f.context),0);assert(f.toasts.some(t=>t[0]==='nb_fav_add_failed'));
});
test('failed removal keeps the saved note and favorite',async()=>{
 const f=fixture();await f.ready();await f.context.addFavorite(f.root.NB_currentFavorite());await f.settle();f.fail(true);assert.equal(await f.context.removeFavorite(f.root.NB_currentFavorite()),false);assert.equal(f.context.favs().length,1);
});
test('existing local PWA favorites migrate once with examples, all languages and no duplicates',async()=>{
 const legacy=languages.map(lang=>({w:words[lang],lang,tr:'meaning',ex:'Example.',exTr:'Meaning.',at:10}));const f=fixture({legacy});await f.ready();assert.equal(f.root.NB_getFavorites().length,7);assert.equal(f.storage.get('lumira_pwa_favs_migrated_first'),'1');assert.equal(JSON.parse(f.storage.get('lumira_favs_v1')).length,7);await f.context.removeFavorite(legacy[0]);await f.switch(null);await f.switch('first');assert.equal(f.root.NB_getFavorites().length,6);assert.equal(vm.runInContext('nbCombinedList().length',f.context),7);
});
test('local migration failure retains the original list and does not mark it as completed',async()=>{
 const f=fixture({legacy:[{lang:'de',w:'lernen',tr:'öğrenmek'}],fail:true});await f.ready();assert.equal(f.storage.get('lumira_pwa_favs_migrated_first'),undefined);assert(JSON.parse(f.storage.get('lumira_favs_v1')).length===1);
});
test('legacy Firebase migration deletes the old node only after a successful copy',async()=>{
 const old={one:{lang:'de',w:'Bank',tr:'banka'},two:{lang:'de',w:'Bank',tr:'bank'}};const f=fixture({seed:{progress:{first:{favorites:old}}}});await f.ready();assert.equal(f.read('progress/first/favorites'),null);assert.equal(Object.keys(f.read('progress/first/notebook')).length,2);assert(f.writes.findIndex(w=>w.path==='progress/first/favorites')>f.writes.findIndex(w=>w.path===''));
});
test('legacy Firebase migration failure never removes the only copy',async()=>{
 const f=fixture({seed:{progress:{first:{favorites:{old:{lang:'de',w:'lernen',tr:'öğrenmek'}}}}},fail:true});await f.ready();assert(f.read('progress/first/favorites/old'));assert(!f.writes.some(w=>w.path==='progress/first/favorites'&&w.value===null));
});
test('deduplicating an old manual/favorite pair keeps its star and nonempty examples',async()=>{
 const f=fixture({seed:{progress:{first:{notebook:{a:{lang:'de',w:'lernen',tr:'öğrenmek',ts:1},b:{lang:'de',w:'lernen',tr:'öğrenmek',ex:'Keep this example.',isFavorite:true,ts:2}}}}}});await f.ready();assert.equal(Object.keys(f.read('progress/first/notebook')).length,1);assert.equal(f.read('progress/first/notebook/a').isFavorite,true);assert.equal(f.read('progress/first/notebook/a').ex,'Keep this example.');assert.equal(f.context.favs().length,1);
});
test('switching accounts detaches the old listener and isolates notes and local favorites',async()=>{
 const f=fixture({legacy:[{lang:'de',w:'lernen',tr:'öğrenmek'}]});await f.ready();const old=f.listeners[0];await f.switch('second');assert.equal(old.active,false);assert.equal(f.context.favs().length,0);old.cb({val:()=>({private:{lang:'de',w:'Private',isFavorite:true}})});assert.equal(f.context.favs().length,0);await f.context.addFavorite({lang:'ar',w:'مرحبا',tr:'merhaba'});await f.settle();assert.equal(f.root.NB_getFavorites().length,1);await f.switch('first');assert.equal(f.root.NB_getFavorites()[0].w,'lernen');old.cb({val:()=>({private:{lang:'de',w:'Stale',isFavorite:true}})});assert.equal(f.root.NB_getFavorites()[0].w,'lernen');await f.switch(null);assert.equal(f.context.favs().length,0);assert.equal(await f.context.addFavorite({lang:'de',w:'private'}),false);
});
test('saving a selected word cannot change to another card while initial sync is pending',async()=>{
 const f=fixture();const v=f.root.NB_currentFavorite(),pending=f.context.addFavorite(v);vm.runInContext("deck=[{lang:'en',w:'other',tr:'başka'}]",f.context);assert.equal(await pending,true);assert.equal(f.root.NB_getFavorites()[0].w,'lernen');
});

test('local manual note and legacy favorite migrate in order without overwriting personal details',async()=>{
 const v={lang:'de',w:'lernen',tr:'öğrenmek'},f=fixture({local:[{...v,ex:'My personal example.',cat:'My category'}],legacy:[v]});await f.ready();assert.equal(f.root.NB_getFavorites().length,1);const saved=Object.values(f.read('progress/first/notebook'));assert.equal(saved.length,1);assert.equal(saved[0].ex,'My personal example.');assert.equal(saved[0].cat,'My category');assert.equal(f.storage.get('lumira_notebook_v1'),undefined);
});
test('failed local notebook migration keeps its source and completion flag unset',async()=>{
 const f=fixture({local:[{lang:'de',w:'lernen',tr:'öğrenmek'}],fail:true});await f.ready();assert.equal(JSON.parse(f.storage.get('lumira_notebook_v1')).length,1);assert.equal(f.storage.get('lumira_notebook_migrated_first'),undefined);
});
test('migration preserves an intentionally unfavorited notebook word',async()=>{
 const v={lang:'de',w:'lernen',tr:'öğrenmek',isFavorite:false},f=fixture({seed:{progress:{first:{notebook:{saved:v}}}},legacy:[v]});await f.ready();assert.equal(f.context.favs().length,0);assert.equal(f.read('progress/first/notebook/saved').isFavorite,false);
});
test('identical words in different meaning languages keep independent favorites and survive deduplication',async()=>{
 const base={lang:'de',w:'Taxi',tr:'taxi',isFavorite:true},f=fixture({seed:{progress:{first:{notebook:{english:{...base,meaningLang:'en'},french:{...base,meaningLang:'fr'}}}}}});await f.ready();assert.equal(f.context.favs().length,2);assert.equal(await f.context.addFavorite({...base,meaningLang:'es'}),true);await f.settle();assert.equal(f.context.favs().length,3);assert.equal(await f.context.removeFavorite({...base,meaningLang:'en'}),true);assert.equal(f.context.favs().length,2);assert.equal(f.read('progress/first/notebook/french').isFavorite,true);assert.equal(vm.runInContext('nbCombinedList().length',f.context),3);
});
