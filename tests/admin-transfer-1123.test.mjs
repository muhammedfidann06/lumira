import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const admin=read('admin.js'),progress=read('progress.js');
const between=(text,from,to)=>{const a=text.indexOf(from),b=text.indexOf(to,a);assert(a>-1&&b>a,from);return text.slice(a,b);};
const c=vm.createContext({});c.window=c;
for(const f of ['vocab-core.js','vocab-parallel.js','vocab-pairs.js','vocab-identity.js',...['de','en','ar','fr','es','ru'].map(l=>'vocab-'+l+'.js')])vm.runInContext(read(f),c,{filename:f});
vm.runInContext(between(admin,'  var TRANSFER = {','  function openTransferLevel(')+'\nthis.TRANSFER=TRANSFER;',c);
vm.runInContext('var wordProgress={};function wordKeyFor(v){return LUMIRA_VOCAB_ID.key(v);}\n'+between(progress,'  function getRecord(v){','\n\n  function checkThresholdTasks')+'\n'+between(progress,'  function mergeWordProgress(','\n\n  function mergeRemoteBadges'),c);
const all=vm.runInContext('VOCAB',c),T=c.TRANSFER,ID=c.LUMIRA_VOCAB_ID,plain=v=>JSON.parse(JSON.stringify(v));
const NUMBERS='Sayılar';

test('a level lists its categories in dictionary order with word counts',()=>{
 const cats=plain(T.categories(all,'de','A1'));
 const numbers=cats.find(row=>row.cat===NUMBERS);
 assert(numbers,'A1 has a numbers category');
 assert.equal(numbers.count,all.filter(v=>v.lang==='de'&&v.level==='A1'&&v.cat===NUMBERS).length);
 assert.equal(cats.reduce((n,row)=>n+row.count,0),all.filter(v=>v.lang==='de'&&v.level==='A1').length,'the categories cover the whole level');
 assert.deepEqual(cats.slice(0,4).map(row=>row.cat),['Selamlaşma','Zamirler','Zaman',NUMBERS]);
 assert.deepEqual(plain(T.categories(all,'de','C1')),[]);
});

test('only the chosen categories are transferred, and no choice still means the whole level',()=>{
 const numbers=T.pool(all,'de','A1',[NUMBERS]);
 assert(numbers.length>0);
 assert(numbers.every(v=>v.lang==='de'&&v.level==='A1'&&v.cat===NUMBERS));
 assert.equal(numbers.some(v=>v.level==='A2'),false,'another level is never included');
 const two=T.pool(all,'de','A1',[NUMBERS,'Renkler']);
 assert.equal(two.length,numbers.length+all.filter(v=>v.lang==='de'&&v.level==='A1'&&v.cat==='Renkler').length);
 assert.equal(T.pool(all,'de','A1',[]).length,all.filter(v=>v.lang==='de'&&v.level==='A1').length);
 assert.equal(T.label('A1',[]),'A1');
 assert.equal(T.label('A1',[NUMBERS]),'A1 · Sayılar');
 assert.equal(T.label('A1',[NUMBERS,'Renkler']),'A1 · 2 kategori');
});

test('every language writes the same keys the personal mode reads',()=>{
 for(const lang of ['de','en','ar','fr','es','ru']){
  const pool=T.pool(all,lang,'A1',[]);
  const plan=T.updates('bob',pool,{},all,'2026-11-15',1);
  assert.equal(plan.added,pool.length,lang+': one record per word');
  assert.equal(Object.keys(plan.updates).length,pool.length,lang+': no two words share a key');
  for(const v of pool.slice(0,25))assert(plan.updates['progress/bob/words/'+ID.key(v)],lang);
 }
});

test('a transferred word shows as known on the person\'s device',()=>{
 const v=all.find(row=>row.lang==='ar'&&row.level==='A1'&&row.cat===NUMBERS)||all.find(row=>row.lang==='ar'&&row.level==='A1');
 const plan=T.updates('bob',[v],{},all,'2026-11-15',5);
 c.wordProgress={[ID.key(v)]:plan.updates['progress/bob/words/'+ID.key(v)]};
 assert.equal(c.getRecord(v).known,true);
 assert.equal(c.getRecord(v).cat,v.cat);
});

test('existing progress is kept and already known words are left alone',()=>{
 const [a,b,d]=T.pool(all,'de','A1',[NUMBERS]);
 const words={[ID.key(a)]:{seen:7,correct:3,wrong:4,known:false,retryAfterSession:9,lastSeen:10,lang:'de',level:'A1',cat:NUMBERS},
  [ID.key(b)]:{seen:2,correct:2,wrong:0,known:true,learnedDate:'2026-01-01',lastSeen:20}};
 const plan=T.updates('bob',[a,b,d],words,all,'2026-11-15',99);
 assert.equal(plan.added,2);assert.equal(plan.already,1);
 const recA=plan.updates['progress/bob/words/'+ID.key(a)];
 assert.deepEqual({seen:recA.seen,correct:recA.correct,wrong:recA.wrong,known:recA.known,retry:recA.retryAfterSession,date:recA.learnedDate,last:recA.lastSeen},{seen:7,correct:3,wrong:4,known:true,retry:null,date:'2026-11-15',last:99});
 assert.equal(plan.updates['progress/bob/words/'+ID.key(b)],undefined,'a known word keeps its own learned date');
 const recD=plan.updates['progress/bob/words/'+ID.key(d)];
 assert.deepEqual({seen:recD.seen,correct:recD.correct,known:recD.known,cat:recD.cat},{seen:1,correct:1,known:true,cat:NUMBERS});
});

test('an old unambiguous key that is already known counts as known, a collided one does not',()=>{
 const v=all.find(row=>row.lang==='de'&&row.w==='die Straße');
 assert(ID.unambiguous(v,all));
 assert.equal(T.updates('bob',[v],{[ID.legacy(v)]:{known:true}},all,'2026-11-15',1).already,1);
 const a=all.find(row=>row.lang==='ar'&&row.w==='أنا');
 assert(!ID.unambiguous(a,all));
 assert.equal(T.updates('bob',[a],{[ID.legacy(a)]:{known:true}},all,'2026-11-15',1).added,1,'a collided Arabic key never stands for this word');
});

test('an older copy on the person\'s device does not undo the transfer',()=>{
 const v=T.pool(all,'de','A1',[NUMBERS])[0],key=ID.key(v);
 const local={[key]:{seen:3,correct:1,wrong:2,known:false,lastSeen:Date.now()-60000}};
 const plan=T.updates('bob',[v],local,all,'2026-11-15',Date.now());
 const merged=c.mergeWordProgress(local,{[key]:plan.updates['progress/bob/words/'+key]});
 assert.equal(merged[key].known,true);
 assert.equal(merged[key].wrong,2);
});

test('the panel offers category choice and no longer keeps its own key copy',()=>{
 assert.match(admin,/data-transfer-cats/);
 assert.match(admin,/Tüm kategoriler/);
 assert.match(admin,/key: function \(v\) \{ return window\.LUMIRA_VOCAB_ID\.key\(v\); \}/);
 assert.doesNotMatch(between(admin,'  var TRANSFER = {','  /* ============================================ 2.5)'),/replace\(\/\[\^a-z0-9_/,'the colliding legacy key is gone from the transfer');
 assert.match(admin,/d\.ref\('progress\/' \+ u\.uid \+ '\/words'\)\.once\('value'\)/,'existing progress is read before writing');
});
