import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const c=vm.createContext({});c.window=c;
for(const f of ['vocab-core.js','vocab-parallel.js','vocab-pairs.js','vocab-identity.js',...['de','en','ar','fr','es','ru'].map(l=>'vocab-'+l+'.js')])vm.runInContext(read(f),c,{filename:f});
const all=vm.runInContext('VOCAB',c), P=c.LUMIRA_VOCAB_PAIRS, ID=c.LUMIRA_VOCAB_ID, languages=['tr','de','en','ar','fr','es','ru'];
const sentenceProof=new Set(all.map(v=>JSON.stringify([v.lang,P.normalize(v.exTr),v.ex])));
const source=read('index.html');
const config=source.slice(source.indexOf('const LANGS = {'),source.indexOf('/* ======================= ANA DİL'));
const helpers=source.slice(source.indexOf('function isReversed()'),source.indexOf('/* Notlarım çalışma/quiz'));
vm.runInContext(config+'\nvar NATIVE_LANG="tr",TARGET_LANG="de",activeLang="de",REVERSED_MODE=false,IS_CROSS=false;\n'+helpers,c);
function state(native,target){vm.runInContext(`NATIVE_LANG=${JSON.stringify(native)};TARGET_LANG=${JSON.stringify(target)};REVERSED_MODE=NATIVE_LANG!=="tr"&&TARGET_LANG==="tr";IS_CROSS=NATIVE_LANG!=="tr"&&TARGET_LANG!=="tr";activeLang=REVERSED_MODE?NATIVE_LANG:TARGET_LANG;`,c);}
for(const lang of languages.filter(l=>l!=='tr'))test('complete dictionary fields and valid levels: '+lang,()=>{
 const a=all.filter(v=>v.lang===lang);assert(a.length>5800);
 for(const v of a){for(const field of ['w','tr','ex','exTr','cat','pos'])assert.equal(typeof v[field],'string',lang+':'+v.w+':'+field);assert(['A1','A2','B1','B2'].includes(v.level));for(const field of ['w','tr','ex','exTr']){assert(v[field].trim());assert(!/[\uFFFD\u0000-\u0008]/u.test(v[field]),v.w);}}
});
for(const native of languages)for(const target of languages){if(native===target)continue;
 test('translation provenance and direction '+target+' → '+native,()=>{
  state(native,target);
  const cards=native==='tr'?all.filter(v=>v.lang===target):target==='tr'?all.filter(v=>v.lang===native):P.build(all,native,target);
  assert(cards.length>1000);
  for(const v of cards){
   assert(c.FRONT_W(v));assert(c.BACK_W(v));assert.equal(c.FRONT_DIR(v),target==='ar'?'rtl':'ltr');assert.equal(c.BACK_DIR(v),native==='ar'?'rtl':'ltr');
   assert(c.FRONT_VOICE(v).startsWith(target+'-'));assert(c.BACK_VOICE(v).startsWith(native+'-'));
   if(!v._exampleTranslation)continue;
   if(v._exampleTranslation==='unavailable'){assert.equal(v.exTr,'');continue;}
   const anchor=P.normalize(v._sourceExTr);
   if(v._exampleTranslation==='reviewed'){
    const row=c.LUMIRA_PARALLEL_EXAMPLES.rows.find(row=>P.normalize(row[0])===anchor);assert(row);assert.equal(v.exTr,row[c.LUMIRA_PARALLEL_EXAMPLES.languages.indexOf(native)]);assert.equal(P.normalize(v.ex),P.normalize(row[c.LUMIRA_PARALLEL_EXAMPLES.languages.indexOf(target)]));
   }else{
    assert(sentenceProof.has(JSON.stringify([native,anchor,v.exTr])),v.w+': unrelated example');
   }
  }
 });
}
test('reported German du / Arabic sentence regression',()=>{
 const v=P.build(all,'ar','de').find(v=>v.w==='du');assert(v);assert.equal(v.tr,'أنت');assert.equal(v.ex,'Du bist sehr nett.');assert.equal(v.exTr,'أنت لطيف جداً.');assert.notEqual(v.exTr,'هل أنت بخير؟');
});
for(const native of languages.filter(l=>!['tr','de'].includes(l)))test('German du exact reviewed sentence for '+native,()=>{
 const v=P.build(all,native,'de').find(v=>v.w==='du');const row=c.LUMIRA_PARALLEL_EXAMPLES.rows.find(row=>row[0]==='Sen çok naziksin.');assert.equal(v.exTr,row[c.LUMIRA_PARALLEL_EXAMPLES.languages.indexOf(native)]);
});
test('unrelated examples never joined solely by the word translation',()=>{
 const cards=P.build([{lang:'de',w:'Baum',tr:'ağaç',pos:'Nomen',ex:'Der Baum ist alt.',exTr:'Ağaç yaşlı.'},{lang:'ar',w:'شجرة',tr:'ağaç',pos:'isim',ex:'الشجرة خضراء.',exTr:'Ağaç yeşil.'}],'ar','de');assert.equal(cards.length,1);assert.equal(cards[0].ex,'Der Baum ist alt.');assert.equal(cards[0].exTr,'');assert.equal(cards[0]._exampleTranslation,'unavailable');
});
test('quantities and negation in the pivot are not discarded',()=>{
 assert.notEqual(P.normalize('bir elma'),P.normalize('elma'));assert.notEqual(P.normalize('biraz su'),P.normalize('su'));assert.notEqual(P.normalize('geliyorum'),P.normalize('gelmiyorum'));
});
test('noun and number homographs cannot be paired',()=>{
 assert.equal(P.build([{lang:'en',w:'hundred',tr:'yüz',pos:'number'},{lang:'fr',w:'visage',tr:'yüz',pos:'isim'}],'fr','en').length,0);
});
test('same word on multiple levels no longer makes an unambiguous meaning disappear',()=>{
 const cards=P.build([{lang:'de',level:'A1',w:'im Notfall',tr:'acil durumda',pos:'Ausdruck'},{lang:'de',level:'B1',w:'im Notfall',tr:'acil durumda',pos:'Ausdruck'},{lang:'en',w:'in case of emergency',tr:'acil durumda',pos:'expression'}],'en','de');assert.equal(cards.length,1);assert.equal(cards[0].level,'A1');
});
test('all reviewed sentence groups contain all seven languages',()=>{
 assert(c.LUMIRA_PARALLEL_EXAMPLES.rows.length>=44);const seen=new Set();for(const row of c.LUMIRA_PARALLEL_EXAMPLES.rows){assert.equal(row.length,7);for(const text of row)assert(text.trim());assert(!seen.has(P.normalize(row[0])));seen.add(P.normalize(row[0]));}
});
test('9 identified missing words added without removing existing words',()=>{
 assert.equal(all.length,36726);for(const [lang,w]of[['en','yours'],['en','hers'],['en','ours'],['en','theirs'],['de','Sie (höflich)'],['ar','أنتِ'],['fr','smartphone'],['es','teléfono inteligente'],['ru','смартфон']])assert(all.some(v=>v.lang===lang&&v.w===w));
});
test('German language name correctly capitalised in its example',()=>assert.equal(all.find(v=>v.lang==='de'&&v.w==='deutsch').ex,'Er lernt schnell Deutsch.'));
test('all progress keys Firebase-safe, bounded, distinct for distinct word identities',()=>{
 const keys=new Map();for(const v of all){const k=ID.key(v),identity=[v.lang,v.level,v.w.normalize('NFC')].join('|');assert(!/[.#$\[\]\/]/.test(k),v.w);assert(Buffer.byteLength(k)<768);if(keys.has(k))assert.equal(keys.get(k),identity,k);keys.set(k,identity);}
});
test('Arabic and Cyrillic progress keys do not collide',()=>{
 for(const lang of ['ar','ru']){const a=all.filter(v=>v.lang===lang && v.level==='A1');assert(new Set(a.map(ID.key)).size>1200);assert(new Set(a.map(ID.legacy)).size<a.length/2);}
});
test('only unambiguous old keys can migrate',()=>{
 const a=all.find(v=>v.lang==='ar'&&v.w==='أنا'),b=all.find(v=>v.lang==='de'&&v.w==='die Straße');assert(!ID.unambiguous(a,all));assert(b);assert(ID.unambiguous(b,all));
});
test('ASCII punctuation and spacing remain distinct in progress keys',()=>{
 assert.notEqual(ID.key({lang:'en',level:'A2',w:'check in'}),ID.key({lang:'en',level:'A2',w:'check-in'}));
 assert.notEqual(ID.key({lang:'de',level:'A1',w:'Sie'}),ID.key({lang:'de',level:'A1',w:'sie'}));
});
test('safe legacy progress migration preserves counts without multiplying a collided record',()=>{
 const start=read('progress.js').indexOf('  function getRecord(v){'),end=read('progress.js').indexOf('\n\n  function checkThresholdTasks',start);
 vm.runInContext('var wordProgress={};function wordKeyFor(v){return LUMIRA_VOCAB_ID.key(v);}\n'+read('progress.js').slice(start,end),c);
 const v=all.find(v=>v.lang==='de'&&v.w==='die Straße');c.wordProgress[ID.legacy(v)]={known:true,correct:4};assert.equal(c.getRecord(v).correct,4);assert.equal(c.getRecord(v)._legacyKey,ID.legacy(v));assert.equal(c.wordProgress[ID.legacy(v)],undefined);
 const a=all.find(v=>v.lang==='ar'&&v.w==='أنا');c.wordProgress[ID.legacy(a)]={known:true,correct:8};assert.equal(c.getRecord(a),null);assert(c.wordProgress[ID.legacy(a)]);
});
const colour=source.slice(source.indexOf('function normalizeWord(w)'),source.indexOf('/* ======================= RENDER: LANG'));
vm.runInContext(colour,c);
test('Arabic and Cyrillic words can be highlighted, and notebook HTML is escaped',()=>{
 assert(c.findStemMatch('أنا أتعلم الألمانية.','أنا'));assert(c.findStemMatch('Я учу немецкий язык.','немецкий'));assert(!c.colorSplit('<img src=x onerror=alert(1)> test','test','#aaa','#bbb').includes('<img'));
});
const san=source.slice(source.indexOf('function nbSanitizeKey(s)'),source.indexOf('function nbInitSync()'));
vm.runInContext('var nbWords={};\n'+san,c);
test('Arabic notebook favourite keys preserve every word',()=>{
 const a=all.filter(v=>v.lang==='ar');const ids=new Map();for(const v of a){const k=c.nbFavKey(v.lang,v.w),identity=v.w.normalize('NFC').trim();if(ids.has(k))assert.equal(ids.get(k),identity);ids.set(k,identity);}assert(ids.size>5800);
});
test('existing favourite is found by its exact content after key migration',()=>{
 c.nbWords={fav_ar_x:{lang:'ar',w:'أنا',tr:'ben',isFavorite:true}};assert.equal(c.nbExistingFavId({lang:'ar',w:'أنا',tr:'ben'}),'fav_ar_x');assert.notEqual(c.nbExistingFavId({lang:'ar',w:'أنت',tr:'sen'}),'fav_ar_x');
});
