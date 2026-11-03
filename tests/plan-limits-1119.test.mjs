import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {TIERS,changeUsage,summary} from '../netlify/functions/_shared/feature-core.mjs';
import {STORY_DAILY,STORY_SAVED,NOTES_DAILY,PRACTICE_DAILY,FREE_NOTES} from '../netlify/functions/_shared/plan-limits.mjs';
import {createStoriesHandler} from '../netlify/functions/stories.mjs';
import {memoryDb} from './memory-db.mjs';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const tier=amount=>TIERS.find(t=>t.amount===amount);
const now=Date.parse('2026-11-03T09:00:00Z');

test('face-to-face translation has its own pool with the same minutes as live translation',()=>{
 const free=tier(0);
 let s=changeUsage(null,free,'liveStart',{id:'live-session-0001'},now);
 s=changeUsage(s,free,'liveStart',{id:'convo-session-001',pool:'convo'},now);
 assert.equal(s.live.session.id,'live-session-0001');assert.equal(s.convo.session.id,'convo-session-001');
 // Text translation and Azure tokens find the right pool from the session id alone.
 s=changeUsage(s,free,'liveText',{id:'convo-session-001'},now);assert.equal(s.convo.texts.length,1);assert.equal(s.live.texts,undefined);
 s=changeUsage(s,free,'liveConnect',{id:'live-session-0001'},now);assert.equal(s.live.connects.length,1);
 s=changeUsage(s,free,'liveStop',{id:'convo-session-001'},now+5000);assert.equal(s.convo.session,undefined);assert(s.live.session);
 // Use the whole convo pool: live minutes stay untouched.
 let t=now+10000;s=changeUsage(s,free,'liveStop',{id:'live-session-0001'},t);
 s.convo.intervals.used={start:t-free.minutes*60000,end:t};
 assert.throws(()=>changeUsage(s,free,'liveStart',{id:'convo-session-002',pool:'convo'},t),e=>e.code==='convo_limit');
 const q=summary(s,free,t);assert.equal(q.convo.remainingSeconds,0);assert(q.live.remainingSeconds>free.minutes*60-30);
 assert.doesNotThrow(()=>changeUsage(s,free,'liveStart',{id:'live-session-0002'},t));
 for(const row of TIERS){const q2=summary(null,row,now);assert.equal(q2.convo.limitSeconds,q2.live.limitSeconds,'same amount for badge '+row.amount);}
});

test('the app shows the same allowance table as the server',async()=>{
 const window={addEventListener(){},dispatchEvent(){},NATIVE_LANG:'tr'};
 vm.runInNewContext(await read('usage-limits.js'),{window,localStorage:{getItem:()=>null,setItem(){},removeItem(){}},navigator:{onLine:true},Event:class{},Date,Map,Set,Number,JSON,Array,Object,String,Promise});
 const T=window.LUMIRA_LIMITS.TABLE;
 for(const row of TIERS){
  assert.equal(T.minutes[row.amount],row.minutes,'minutes '+row.amount);
  assert.equal(T.practice[row.amount],row.count,'practice equals writing checks '+row.amount);
  assert.equal(T.practice[row.amount],PRACTICE_DAILY[row.amount]);
  assert.equal(T.storySaved[row.amount],STORY_SAVED[row.amount]);
  if(row.amount){assert.equal(T.storyDaily[row.amount],STORY_DAILY[row.amount]);assert.equal(T.notesDaily[row.amount],NOTES_DAILY[row.amount]);}
 }
 const badges=TIERS.filter(t=>t.amount);
 for(const key of['storyDaily','storySaved'])assert.equal(new Set(badges.map(t=>T[key][t.amount])).size,badges.length,key+' differs for every badge');
 for(const row of badges)assert.equal(T.notesDaily[row.amount],null,'any badge: unlimited notes and favourites');
 assert.equal(window.LUMIRA_LIMITS.FREE_NOTES,FREE_NOTES);
});

function limitsFor(amount,stored={}){
 const store=new Map(Object.entries(stored)),window={addEventListener(){},dispatchEvent(){},NATIVE_LANG:'tr',firebase:{auth:()=>({currentUser:{uid:'u1'}})},LUMIRA_FEATURES:{getQuota:()=>({tier:amount})}};
 vm.runInNewContext(source,{window,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},navigator:{onLine:false},Event:class{},Date,Map,Set,Number,JSON,Array,Object,String,Promise});
 return{L:window.LUMIRA_LIMITS,store};
}
let source;

test('Type & Learn and the typed quiz count each answer like a writing check, per mode',async()=>{
 source=await read('usage-limits.js');
 let {L}=limitsFor(0);
 for(let i=0;i<10;i++)assert.equal(L.consume('practice_type'),true);
 assert.equal(L.allowed('practice_type'),false);assert.equal(L.consume('practice_type'),false);
 assert.equal(L.remaining('practice_quiz'),10,'the quiz has its own counter');
 assert.match(L.label('practice_type'),/0 \/ 10/);
 ({L}=limitsFor(1,{'lumira_limits_v1_u1_practice_type':JSON.stringify(Array.from({length:10},(_,i)=>Date.now()-i))}));
 assert.equal(L.remaining('practice_type'),15,'a Thanks badge allows 25');
 ({L}=limitsFor(100));assert.equal(L.remaining('practice_type'),null);assert.equal(L.consume('practice_type'),true);
 ({L}=limitsFor(0,{'lumira_limits_v1_u1_practice_quiz':JSON.stringify([Date.now()-86400001])}));
 assert.equal(L.remaining('practice_quiz'),10,'use older than 24 hours no longer counts');
});

test('My Notes: 50 entries in total without a badge, unlimited with any badge',async()=>{
 source=await read('usage-limits.js');
 let {L}=limitsFor(0);
 assert.equal(L.notesCheck(49,1),null);assert.equal(L.notesCheck(50,1),'notes_free_limit');
 for(const amount of[1,5,100]){
  ({L}=limitsFor(amount));
  for(let i=0;i<400;i++)L.notesUsed(1);
  assert.equal(L.notesCheck(5000,1),null,'badge '+amount+': no total and no daily cap');
 }
 const app=await read('app-main.js');
 assert(app.includes("if(!existing){const limit=window.LUMIRA_LIMITS?.notesCheck(Object.keys(nbWords||{}).length,1);if(limit){window.LUMIRA_LIMITS.upgrade(limit);throw new Error(limit);}}"),'favourites from every screen pass the check');
 assert(app.includes("const limit = window.LUMIRA_LIMITS?.notesCheck(Object.keys(nbWords||{}).length, 1);"),'manually added notes pass the check');
});

function storyFixture(amount,failing=false){
 const samples={en:'I am happy and you are here in a small house today',de:'ich bin heute hier und du bist in einem kleinen Haus glücklich'};
 const meanings=['Ben buradayım.','Sen küçük bir evdesin.','Bugün mutluyum.','Sen mutlusun.','Ben küçük bir evdeyim.','Sen bugün buradasın.'];
 const extra={en:['I am here.','You are in a small house.','I am happy today.','You are happy.','I am in a small house.','You are here today.'],de:['ich bin hier.','du bist in einem kleinen Haus.','ich bin heute glücklich.','du bist glücklich.','ich bin in einem kleinen Haus.','du bist heute hier.']};
 const pool=lang=>samples[lang].split(' ').map(w=>({w,meaning:''}));
 const f=memoryDb({progress:{alice:{words:{known:{known:true}}}}});let time=now,generations=0;
 const handler=createStoriesHandler({identity:async()=>({uid:'alice',db:f.db,tier:{amount}}),wordPool:(progress,lang)=>pool(lang),generateStory:async(p,options)=>{generations++;if(failing)throw Object.assign(new Error('provider'),{code:'story_unavailable',status:503});const lang=options.language,sentences=Array.from({length:6},()=>({text:samples[lang]+'.',translation:'Ben bugün buradayım ve sen küçük bir evde mutlusun.'}));for(const at of[generations%6,Math.floor(generations/6)%6])sentences.push({text:extra[lang][at],translation:meanings[at]});return{title:null,sentences};}},()=>time);
 let n=0;
 const call=async body=>{const r=await handler(new Request('https://lumira-tr.com/.netlify/functions/stories',{method:'POST',headers:{Origin:'https://lumira-tr.com'},body:JSON.stringify(body)}));return{status:r.status,...await r.json()};};
 const make=language=>call({action:'generate',id:'limit-story-operation-'+String(++n).padStart(4,'0'),language,native:'tr',level:0,genre:'daily',style:'cinematic',voice:'natural'});
 return{f,call,make,advance:ms=>time+=ms,get generations(){return generations;}};
}

test('without a badge: one story per language, ever, and one saved story',async()=>{
 const s=storyFixture(0);
 const first=await s.make('en');assert.equal(first.status,200);
 assert.equal((await s.make('en')).error,'story_badge_required');
 s.advance(3*86400000);
 assert.equal((await s.make('en')).error,'story_badge_required','a new day does not bring a new free story');
 assert.equal((await s.make('de')).error,'story_saved_limit','one saved story at a time');
 assert.equal((await s.call({action:'delete',id:first.story.id})).status,200);
 assert.equal((await s.make('de')).status,200,'the free German story is still available');
 await s.call({action:'delete',id:(await s.call({action:'list'})).stories[0].id});
 assert.equal((await s.make('en')).error,'story_badge_required','deleting a story does not return the free story');
 const list=await s.call({action:'list'});
 assert.deepEqual(list.allowance.freeLanguages.sort(),['de','en']);assert.equal(list.allowance.savedLimit,1);
 assert.equal(s.generations,2,'refused requests never reach a provider');
});

test('badges: a rolling 24-hour story allowance and a saved-story limit, both per badge',async()=>{
 const s=storyFixture(1);
 for(let i=0;i<3;i++){s.advance(61000);assert.equal((await s.make('en')).status,200);}
 s.advance(61000);assert.equal((await s.make('en')).error,'story_limit','Thanks badge: 3 per 24 hours');
 s.advance(86400000);
 for(let i=0;i<2;i++){s.advance(61000);assert.equal((await s.make('en')).status,200);}
 s.advance(61000);assert.equal((await s.make('en')).error,'story_saved_limit','Thanks badge: 5 saved stories');
 const list=await s.call({action:'list'});
 assert.equal(list.stories.length,5);assert.equal(list.allowance.savedLimit,5);assert.equal(list.allowance.dailyLimit,3);assert.equal(list.allowance.usedToday,2);
 await s.call({action:'delete',id:list.stories[0].id});
 s.advance(61000);assert.equal((await s.make('en')).status,200,'deleting makes room again');
});

test('a failed generation spends no allowance, not even the free story',async()=>{
 for(const amount of[0,5]){
  const s=storyFixture(amount,true);
  assert.equal((await s.make('en')).error,'story_unavailable');
  const allowance=(await s.call({action:'list'})).allowance;
  assert.equal(allowance.usedToday,0);assert.deepEqual(allowance.freeLanguages,[]);
  assert.deepEqual(s.f.get('serverStoryAllowance/alice/pending')||{},{},'the reservation is released');
 }
});

test('Goethe: one free exam without a badge, every exam with any badge, no official-site link',async()=>{
 const source=await read('goethe-exam.js'),store=new Map(),limits={amount:0};
 const window={addEventListener(){},NATIVE_LANG:'tr',LUMIRA_LIMITS:{tier:()=>limits.amount}};
 vm.runInNewContext(source,{window,document:{currentScript:null,addEventListener(){}},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},URL,Map,Set,Promise,setTimeout,clearTimeout,setInterval,clearInterval,AbortController});
 const G=window.LUMIRA_GOETHE;
 assert.equal(G._freeExam(),null);assert.equal(G._unlocked('B1-03'),true,'nothing used yet');
 G._claimFree('B1-03');
 assert.equal(G._freeExam(),'B1-03');assert.equal(G._unlocked('B1-03'),true);assert.equal(G._unlocked('A2-01'),false);
 limits.amount=1;assert.equal(G._unlocked('A2-01'),true,'any badge unlocks all exams');G._claimFree('C1-01');assert.equal(G._freeExam(),'B1-03');
 // Earlier versions: the first exam with results is the free one.
 const older=new Map([['lumira_goethe_results_v1_guest',JSON.stringify({'A2-04':{lesen:{best:70,at:5}},'A1-02':{hoeren:{best:60,at:2}}})]]),w2={addEventListener(){},NATIVE_LANG:'tr',LUMIRA_LIMITS:{tier:()=>0}};
 vm.runInNewContext(source,{window:w2,document:{currentScript:null,addEventListener(){}},localStorage:{getItem:k=>older.get(k)??null,setItem:(k,v)=>older.set(k,v),removeItem(){}},URL,Map,Set,Promise,setTimeout,clearTimeout,setInterval,clearInterval,AbortController});
 await w2.LUMIRA_GOETHE._loadResults();
 assert.equal(w2.LUMIRA_GOETHE._freeExam(),'A1-02');assert.equal(w2.LUMIRA_GOETHE._unlocked('A2-04'),false);
 assert(!source.includes('goethe.de/de/spr'),'the official-site link is gone');
 assert(source.includes("if(!options.review){if(!unlocked(id)){upgrade();overview(id);return;}claimFree(id);}"),'locked exams cannot be started, only reviewed');
});

test('every screen explains a limit and offers badges in seven languages',async()=>{
 const window={addEventListener(){},dispatchEvent(){},NATIVE_LANG:'tr'};
 vm.runInNewContext(await read('usage-limits.js'),{window,localStorage:{getItem:()=>null,setItem(){},removeItem(){}},navigator:{onLine:true},Event:class{},Date,Map,Set,Number,JSON,Array,Object,String,Promise});
 const copy=window.LUMIRA_LIMITS.copy,keys=Object.keys(copy.tr);
 for(const lang of['en','de','ar','fr','es','ru'])for(const key of keys)assert(copy[lang][key],lang+' '+key);
 for(const code of window.LUMIRA_LIMITS.ERRORS)assert(copy.tr[code],code);
 const access=await read('access-screen.js'),learning=await read('learning.js'),stories=await read('stories.js'),usage=await read('feature-usage.js');
 assert(access.includes("goethe_badge_required:'goethe'")&&access.includes("story_saved_limit:'storySavedSub'"),'the badge screen knows every new reason');
 assert(learning.includes("if(L&&!s.counted.has(key)&&!L.allowed(feature)){limitPage(s);return;}"),'practice stops at the limit');
 assert(stories.includes("root.LUMIRA_LIMITS?.ERRORS.includes(e.featureCode)?root.LUMIRA_FEATURES.text(e.featureCode)"),'story limits use their own messages');
 assert(usage.includes("const LIMIT_ERRORS=['writing_limit','live_limit','pdf_limit','pdf_badge_required',...(window.LUMIRA_LIMITS?.ERRORS||[])];"),'server limit errors open the badge screen');
 const html=await read('index.html'),sw=await read('sw.js');
 assert(/access-i18n\.js\?v=[\d.]+"><\/script>\n<script src="usage-limits\.js\?v=[\d.]+"><\/script>/.test(html),'loaded before feature-usage.js');
 assert(sw.includes("'./usage-limits.js'"));
});
