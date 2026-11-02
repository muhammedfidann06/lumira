import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const langs=['tr','en','de','ar','fr','es','ru'];

// The PDF helpers are sliced out of support-badges.js and run in isolation.
async function pdf({native='tr',vocab=[],cross=null}={}){
 const source=await read('support-badges.js'),a=source.indexOf('  var LANG_INFO = {'),b=source.indexOf('  async function openPdfExport()');
 assert(a>0&&b>a);
 const window={NATIVE_LANG:native,catName:c=>c==='Aile'?'Family':c,buildCrossDeck:cross,LUMIRA_ACCESS_COPY:{text:k=>({all:'All',wordList:'Word list',level:'Level',pdfSave:'Save',pdfPrint:'Print'})[k]||k}};
 return vm.runInNewContext(source.slice(a,b)+';({PDF_COPY,pdfText,deckFor,collectWords,sortKey,letterOf,groupWords,wordHtml,buildPdfHtml})',{window,VOCAB:vocab,Intl,Object,Array,String,Date,Promise});
}
const de=[
 {lang:'de',level:'A1',cat:'Aile',w:'der Vater',tr:'baba',ex:'Mein Vater arbeitet.',exTr:'Babam çalışıyor.'},
 {lang:'de',level:'A1',cat:'Aile',w:'die Mutter',tr:'anne'},
 {lang:'de',level:'A2',cat:'Aile',w:'das Baby',tr:'bebek'},
 {lang:'de',level:'A1',cat:'Zaman',w:'der Abend',tr:'akşam'},
 {lang:'de',level:'A1',cat:'Zaman',w:'bald',tr:'yakında'},
 {lang:'de',level:'A1',cat:'Zaman',w:'Äpfel',tr:'elmalar'},
 {lang:'en',level:'A1',cat:'Aile',w:'father',tr:'baba'}
];

test('every interface language has the same PDF texts',async()=>{
 const {PDF_COPY}=await pdf(),keys=Object.keys(PDF_COPY.tr).sort();
 for(const lang of langs)assert.deepEqual(Object.keys(PDF_COPY[lang]).sort(),keys,lang);
});
test('one category can be printed alone; all categories are grouped and sorted alphabetically',async()=>{
 const p=await pdf({vocab:de});
 assert.deepEqual(JSON.parse(JSON.stringify(p.collectWords('de','TÜMÜ','Aile').map(w=>w.w))),['der Vater','die Mutter','das Baby']);
 assert.equal(p.collectWords('de','A1','').length,5);
 const groups=JSON.parse(JSON.stringify(p.groupWords(p.collectWords('de','TÜMÜ',''),'de','tr')));
 assert.deepEqual(groups.map(g=>g.name),['Family','Zaman']);
 assert.deepEqual(groups[0].words.map(w=>w.w),['das Baby','die Mutter','der Vater']);
 assert.deepEqual(groups[1].words.map(w=>w.w),['der Abend','Äpfel','bald']);
});
test('dictionary order ignores articles and diacritics in letter headings, per language',async()=>{
 const p=await pdf();
 assert.equal(p.sortKey('der Abend','de'),'Abend');assert.equal(p.sortKey("l'école",'fr'),'école');assert.equal(p.sortKey('las casas','es'),'casas');assert.equal(p.sortKey('to go','en'),'go');assert.equal(p.sortKey('الكتاب','ar'),'كتاب');
 assert.equal(p.letterOf('Äpfel','de'),'A');assert.equal(p.letterOf('éclair','fr'),'E');assert.equal(p.letterOf('ñandú','es'),'Ñ');assert.equal(p.letterOf('şeker','tr'),'Ş');assert.equal(p.letterOf('إبرة','ar'),'ا');assert.equal(p.letterOf('42','de'),'#');
 assert.equal(p.wordHtml('der Abend','de'),'<span class="art art-der">der</span>&nbsp;Abend');assert.equal(p.wordHtml('der Abend','en'),'der Abend');
});
test('meanings follow the learner’s own language, as on the learning screens',async()=>{
 const crossCalls=[],p=await pdf({native:'en',vocab:de,cross:(native,target)=>{crossCalls.push([native,target]);return[{lang:'de',level:'A1',cat:'Aile',w:'der Vater',tr:'father'}];}});
 assert.deepEqual(JSON.parse(JSON.stringify(p.collectWords('de','TÜMÜ','').map(w=>w.tr))),['father']);assert.deepEqual(crossCalls,[['en','de']]);
 const learner=await pdf({native:'en',vocab:de});
 assert.deepEqual(JSON.parse(JSON.stringify(learner.collectWords('tr','TÜMÜ','').map(w=>[w.w,w.tr]))),[['baba','father']]);
});
test('the printed page: cover, contents only for several categories, sections, examples and the new handle',async()=>{
 const p=await pdf({vocab:de});
 const all=p.buildPdfHtml('de','TÜMÜ',p.collectWords('de','TÜMÜ',''),{examples:true});
 assert.match(all,/class="toc"/);assert.equal((all.match(/<section class="cat"/g)||[]).length,2);assert.match(all,/Mein Vater arbeitet\./);assert.match(all,/@lumira\.learn/);assert.match(all,/art-der/);assert.match(all,/<title>Lumira · /);
 const one=p.buildPdfHtml('de','A1',p.collectWords('de','A1','Aile'),{category:'Aile'});
 assert.doesNotMatch(one,/class="toc"/);assert.match(one,/<title>[^<]*Family · A1<\/title>/);assert.doesNotMatch(one,/class="ex"/);assert.doesNotMatch(one,/class="lvl"/);
});
test('the old Instagram account is gone everywhere and the new one is linked',async()=>{
 for(const file of['index.html','app-i18n.js','web-pages.js','privacy/index.html','admin.js','lumira-landing.html']){
  const text=await read(file);assert.doesNotMatch(text,/muhammedf\.fdn/i,file);assert.match(text,/lumira\.learn/,file);
 }
 assert.match(await read('index.html'),/href="https:\/\/www\.instagram\.com\/lumira\.learn"/);
});
