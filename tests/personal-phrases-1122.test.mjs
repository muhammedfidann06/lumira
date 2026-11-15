import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../progress.js',import.meta.url),'utf8');
const slice=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to));
const pools=slice('  function poolForActiveLang(){','  function knownCountIn(');
const stats=slice('  function studyRecords(){','  // ESKİ (dahili) mekanik');
const review=slice('  function yesterdayStr(){','  function injectStyles(){');
const picker=slice('  function pickBatch(){','  /* ============================================ SEVİYE TESPİT SINAVI');
const badges=slice('  function checkBadges(){','  /* Seri (streak)');
const PHRASES='Kalıp Cümleler';
const plain=v=>JSON.parse(JSON.stringify(v));

function fixture({base=true}={}){
 const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
 const day=`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
 const words=[
  {lang:'de',level:'A1',cat:'food',w:'Brot'},{lang:'de',level:'A1',cat:'food',w:'Wasser'},{lang:'de',level:'A2',cat:'travel',w:'Reise'},
  {lang:'de',level:'A1',cat:PHRASES,w:'Wie geht es dir?'},{lang:'de',level:'A2',cat:PHRASES,w:'Ich hätte gern einen Kaffee.'},
  {lang:'en',level:'A1',cat:PHRASES,w:'How are you?'}];
 const records={Wasser:{known:true,learnedDate:day,cat:'food'},'Wie geht es dir?':{known:true,learnedDate:day,cat:PHRASES}};
 const storage=new Map(),toasts=[];
 const window={NATIVE_LANG:'tr',TARGET_LANG:'de',t:null,...(base?{basePool:()=>words.filter(v=>v.lang==='de')}:{})};
 const wordProgress={
  Brot:{seen:3,correct:2,wrong:1,known:false,cat:'food'},Wasser:{seen:4,correct:4,wrong:0,known:true,cat:'food'},
  phraseA:{seen:6,correct:0,wrong:6,known:true,cat:PHRASES},phraseB:{seen:2,correct:2,wrong:0,known:true,cat:PHRASES}};
 const ctx=vm.createContext({window,currentKey:'alice',activeLang:'de',activeLevel:'TÜMÜ',VOCAB:words,meta:{studySessionCount:3,badges:{}},BATCH_SIZE:10,
  safeLocalGet:k=>storage.get(k),getRecord:v=>records[v.w],wordKeyFor:v=>v.lang+v.w,shuffle:arr=>arr,wordProgress,
  BADGE_THRESHOLDS:[2,3],sessionStats:{newBadges:[]},showToast:text=>toasts.push(text),checkStreakAwards(){}});
 vm.runInContext(pools+stats+review+picker+badges,ctx);
 const run=code=>vm.runInContext(code,ctx);
 return{run,storage,ctx};
}

test('set phrases never enter the personal study pool',()=>{
 for(const base of [true,false]){
  const f=fixture({base}),pool=plain(f.run('poolForActiveLang()'));
  assert.deepEqual(pool.map(v=>v.w),['Brot','Wasser','Reise'],base?'with the app pool':'with the plain word list');
 }
});

test('the study batch is made of words only',()=>{
 const f=fixture(),picked=plain(f.run('pickBatch()'));
 assert(picked.length>0);
 assert(picked.every(row=>row.v.cat!==PHRASES),'no set phrase is asked');
});

test('set phrases are not offered as a focus category, and an old choice falls back safely',()=>{
 const f=fixture();
 f.storage.set(f.run('studyCategoryKey()'),PHRASES);
 assert.equal(f.run('studyCategory()'),'','a saved set-phrase focus is ignored');
 assert(plain(f.run('pickBatch()')).every(row=>row.v.cat!==PHRASES));
 const categories=plain(f.run('[...new Set(poolForActiveLang().map(v=>v.cat))]'));
 assert.equal(categories.includes(PHRASES),false);
});

test('daily review and level filters skip set phrases',()=>{
 const f=fixture();
 assert.deepEqual(plain(f.run('dailyReviewWords()')).map(v=>v.w),['Wasser']);
 f.ctx.activeLevel='A2';
 assert.deepEqual(plain(f.run('poolForActiveFilter()')).map(v=>v.w),['Reise']);
});

test('old set-phrase records stay saved but leave personal statistics and word badges out',()=>{
 const f=fixture();
 assert.equal(f.run('totalStudiedCount()'),2);
 assert.equal(f.run('accuracyOverall()'),86,'6 correct of 7 answers, without the set phrases');
 const cats=plain(f.run('categoryAccuracy()'));
 assert.equal(cats.worst.cat,'food','a set-phrase category is not shown as the weakest');
 f.run('checkBadges()');
 assert.deepEqual(plain(f.run('Object.keys(meta.badges)')),[],'only one word is known, below the first badge');
 assert.equal(Object.keys(f.ctx.wordProgress).length,4,'nothing is deleted');
});

test('other sections keep their set phrases',async()=>{
 const learning=await readFile(new URL('../learning.js',import.meta.url),'utf8'),app=await readFile(new URL('../app-main.js',import.meta.url),'utf8');
 assert(learning.includes("if(s.content==='phrases')return root.LUMIRA_PHRASES.rows"),'writing practice still offers set phrases');
 assert(!app.includes("'Kalıp Cümleler')"),'the shared card pool is not filtered');
 assert(source.includes("window.basePool ? window.basePool() :"),'personal mode still starts from the shared pool');
});
