import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,readdir} from 'node:fs/promises';
import {scoreGoethe,EXAMS} from '../netlify/functions/_shared/goethe-ai.mjs';

const root=new URL('../',import.meta.url),read=name=>readFile(new URL(name,root),'utf8');
// Layout per family and level: objective modules as [type, item count]; productive modules as task counts.
// 'pairs' = one true/false and one a/b/c question per listening text.
const SPEC={
 en:{A2:{lesen:[['abc',6],['match',7],['abc',5],['abc',6]],hoeren:[['abc',5],['abc',5],['match',5]],schreiben:2,sprechen:2},
     B1:{lesen:[['abc',5],['match',5],['abc',5],['match',5],['abc',6]],hoeren:[['abc',7],['abc',6],['abc',6]],schreiben:2,sprechen:2},
     B2:{lesen:[['abc',8],['abc',6],['match',6],['match',10]],hoeren:[['abc',8],['match',5],['abc',7]],schreiben:2,sprechen:2},
     C1:{lesen:[['abc',8],['abc',6],['match',6],['match',10]],hoeren:[['abc',6],['abc',6],['match',5]],schreiben:2,sprechen:2}},
 fr:{A1:{hoeren:[['abc',6],['abc',4]],lesen:[['abc',5],['abc',5]],schreiben:2,sprechen:3},
     A2:{hoeren:[['abc',6],['abc',5]],lesen:[['abc',5],['abc',5],['rf',5]],schreiben:2,sprechen:3},
     B1:{hoeren:[['abc',6],['abc',6]],lesen:[['match',5],['abc',8]],schreiben:1,sprechen:3},
     B2:{hoeren:[['abc',6],['abc',8]],lesen:[['abc',8],['abc',8]],schreiben:1,sprechen:2},
     C1:{hoeren:[['abc',8],['abc',6]],lesen:[['abc',10]],schreiben:2,sprechen:2}},
 es:{A1:{lesen:[['abc',5],['match',6],['abc',5]],hoeren:[['abc',5],['match',5]],schreiben:2,sprechen:3},
     A2:{lesen:[['abc',6],['match',6],['abc',6]],hoeren:[['abc',6],['match',6],['abc',6]],schreiben:2,sprechen:3},
     B1:{lesen:[['match',6],['abc',6],['match',6],['abc',6]],hoeren:[['abc',6],['abc',6],['match',6]],schreiben:2,sprechen:3},
     B2:{lesen:[['abc',6],['match',6],['match',6],['abc',8]],hoeren:[['abc',6],['match',6],['abc',6]],schreiben:2,sprechen:2},
     C1:{lesen:[['abc',6],['match',6],['abc',8]],hoeren:[['abc',6],['match',6],['abc',6]],schreiben:2,sprechen:2}},
 ru:{A1:{grammatik:[['abc',20]],lesen:[['abc',10]],hoeren:[['abc',8]],schreiben:2,sprechen:2},
     A2:{grammatik:[['abc',20]],lesen:[['abc',10]],hoeren:[['abc',10]],schreiben:2,sprechen:3},
     B1:{grammatik:[['abc',25]],lesen:[['abc',10],['abc',8]],hoeren:[['abc',6],['abc',6]],schreiben:2,sprechen:3},
     B2:{grammatik:[['abc',25]],lesen:[['abc',8],['abc',8]],hoeren:[['abc',6],['abc',6]],schreiben:2,sprechen:2},
     C1:{grammatik:[['abc',25]],lesen:[['abc',8],['abc',8]],hoeren:[['abc',6],['abc',6]],schreiben:2,sprechen:2}}
};
const CEFR={A1:{lesen:[['rf',5],['abc',5]],hoeren:[['abc',5],['rf',5]],schreiben:2,sprechen:2},
 A2:{lesen:[['abc',5],['match',5],['rf',5]],hoeren:[['abc',5],['rf',5]],schreiben:2,sprechen:2},
 B1:{lesen:[['rf',6],['abc',6],['match',6]],hoeren:[['abc',6],['abc',6]],schreiben:2,sprechen:2},
 B2:{lesen:[['abc',6],['match',6],['match',6]],hoeren:[['abc',6],['abc',6]],schreiben:2,sprechen:2},
 C1:{lesen:[['abc',7],['match',6],['abc',8]],hoeren:[['abc',7],['abc',7]],schreiben:2,sprechen:2}};
SPEC.ar=CEFR;SPEC.tr=CEFR;

const text=v=>typeof v==='string'&&v.trim().length>0;
function checkObjective(exam,module,layout,where){
 assert.equal(exam[module].length,layout.length,where+' '+module+' Teil count');
 const answers=[];
 exam[module].forEach((teil,i)=>{
  const [kind,count]=layout[i],at=where+' '+module+' '+(teil.title||i);
  assert(text(teil.title)&&text(teil.task),at+' title/task');
  assert.equal(teil.items.length,count,at+' item count');
  if(module==='hoeren')assert(Number.isInteger(teil.plays)&&teil.plays>=1&&teil.plays<=2,at+' plays');
  const keys=Array.isArray(teil.choices)?teil.choices.map(c=>c.key):[];
  if(Array.isArray(teil.choices)){assert.equal(new Set(keys).size,keys.length,at+' unique choice keys');teil.choices.forEach(c=>assert(/^[a-z]$/.test(c.key)&&text(c.text),at+' choice'));}
  (teil.texts||[]).forEach(t=>assert(text(t.body),at+' text body'));
  teil.items.forEach((item,j)=>{
   const type=item.type||teil.type,it=at+' item '+(j+1);
   if(kind==='pairs')assert.equal(type,j%2===0?'rf':'abc',it+' pair type');else assert.equal(type,kind,it+' type');
   if(type==='rf'){assert.equal(typeof item.a,'boolean',it+' boolean answer');assert(text(item.q),it+' statement');}
   else if(type==='abc'){
    assert(Array.isArray(item.options)&&item.options.length===3,it+' option count');
    item.options.forEach(o=>assert(text(o),it+' option text'));
    assert.equal(new Set(item.options).size,3,it+' distinct options');
    assert(Number.isInteger(item.a)&&item.a>=0&&item.a<3,it+' answer index');
    assert(text(item.q)||text(item.text)||text(item.audio)||(teil.texts||[]).length>0,it+' prompt');
   }else if(type==='match'){
    assert(keys.length>=3,it+' choices');assert(keys.includes(item.a),it+' answer key '+item.a);assert(text(item.q)||text(item.text),it+' prompt');
   }else assert.fail(it+' unknown type '+type);
   if(module==='hoeren'&&!teil.audio&&!(kind==='pairs'&&j%2===1))assert(text(item.audio),it+' audio');
   answers.push(String(item.a));
  });
  if(keys.length&&teil.items.length>=5)assert(teil.items.filter((item,j)=>item.a===keys[j]).length<3,at+' match answers are in plain order');
 });
 assert(new Set(answers).size>1,where+' '+module+' answers vary');
}
async function familyFiles(lang){
 try{return(await readdir(new URL('exams/'+lang+'/',root))).filter(f=>/^(a1|a2|b1|b2|c1)-\d\d\.json$/.test(f)).sort();}catch{return[];}
}

test('every certificate family has one practice exam per level',async()=>{
 for(const [lang,levels] of Object.entries(SPEC))assert.deepEqual(await familyFiles(lang),Object.keys(levels).map(l=>l.toLowerCase()+'-01.json'),lang+' files');
});

test('each practice exam follows the layout of its certificate and level',async()=>{
 for(const [lang,levels] of Object.entries(SPEC)){
  const files=await familyFiles(lang);
  for(const file of files){
   const data=JSON.parse(await read('exams/'+lang+'/'+file)),level=file.slice(0,2).toUpperCase(),spec=levels[level],where=lang+'/'+file;
   assert.equal(data.id,lang+'-'+level+'-01',where+' id');assert.equal(data.level,level,where+' level');assert.equal(data.lang,lang,where+' lang');
   for(const module of['grammatik','lesen','hoeren'])if(spec[module])checkObjective(data,module,spec[module],where);else assert.equal(data[module],undefined,where+' no '+module);
   assert.equal(data.schreiben.length,spec.schreiben,where+' writing tasks');
   data.schreiben.forEach((teil,i)=>{const at=where+' writing '+(i+1);assert(text(teil.title)&&text(teil.task),at);
    if(teil.form){assert(teil.form.length>=5,at+' form fields');teil.form.forEach(f=>assert(text(f.label)&&text(f.a),at+' field'));assert(text(teil.situation),at+' situation');}
    else{assert(Number.isInteger(teil.words)&&teil.words>=20,at+' words');assert(Array.isArray(teil.points)&&teil.points.length>=2,at+' points');assert(text(teil.sample),at+' sample');}});
   assert.equal(data.sprechen.length,spec.sprechen,where+' speaking tasks');
   data.sprechen.forEach((teil,i)=>assert(text(teil.title)&&text(teil.task)&&text(teil.sample),where+' speaking '+(i+1)));
  }
 }
});

test('the engine knows seven certificate families and finds each exam file',async()=>{
 const source=await read('goethe-exam.js'),window={addEventListener(){},NATIVE_LANG:'tr'};
 vm.runInNewContext(source,{window,document:{currentScript:null,addEventListener(){}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},URL,Map,Set,Promise,Proxy,setTimeout,clearTimeout,setInterval,clearInterval,AbortController,Intl});
 const G=window.LUMIRA_GOETHE;
 assert.deepEqual(JSON.parse(JSON.stringify(G.FAMILIES.map(f=>f.id))),['goethe','cambridge','delf','dele','torfl','arabic','tys']);
 assert.equal(G._fileOf('B1-03'),'goethe/b1-03.json','German exams keep their ids and files');
 assert.equal(G._fileOf('en-B2-01'),'exams/en/b2-01.json');assert.equal(G._famOf('ru-A1-01').id,'torfl');
 for(const f of G.FAMILIES){assert.equal(EXAMS[f.id]?.name?.length>0,true,f.id+' is known to AI scoring');assert.equal(typeof f.short,'string',f.id+' short name is text (titles and share text use it)');for(const L of f.levels){const id=(f.prefix||'')+L.id+'-01';assert(Object.keys(L.minutes).every(m=>L.order.includes(m)),f.id+' '+L.id+' order');assert(G._fileOf(id).endsWith(L.id.toLowerCase()+'-01.json'));}}
 // Pass rules: DELF needs 50 overall and 5/25 per part; DELE needs both groups; TORFL 66% per subtest.
 const mods=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,{pct:v}]));
 assert.equal(G._examPassed('fr-B1-01',mods({hoeren:70,lesen:70,schreiben:70,sprechen:15}),56,0),false);
 assert.equal(G._examPassed('fr-B1-01',mods({hoeren:40,lesen:45,schreiben:60,sprechen:60}),51,0),true);
 assert.equal(G._examPassed('es-B1-01',mods({lesen:80,schreiben:50,hoeren:60,sprechen:60}),62,0),true);
 assert.equal(G._examPassed('es-B1-01',mods({lesen:80,schreiben:80,hoeren:50,sprechen:60}),67,0),false);
 assert.equal(G._examPassed('ru-B1-01',mods({}),80,4),false,'all five TORFL subtests are required');
 assert.equal(G._examPassed('ru-B1-01',mods({}),80,5),true);
 assert.equal(G._examPassed('en-B2-01',mods({}),60,0),true);
 // Speaker labels in every script are split off, so the voice does not read them out.
 for(const [line,speaker] of [['Мужчина: Извините, где метро?','Мужчина'],['امرأة: بكم هذا القميص؟','امرأة'],['İnci: Merhaba!','İnci'],['Élodie: Bonjour !','Élodie'],['Fatih Bey: En büyük hata…','Fatih Bey']]){
  const [part]=G._parseScript(line);assert.equal(part.speaker,speaker,line);assert(!part.text.includes(speaker+':'),line);
 }
});

test('AI scoring takes the role and answer language of the chosen certificate',async()=>{
 let prompt='';
 const fetcher=async(url,init)=>{prompt=JSON.parse(init.body).messages[0].content;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({criteria:{task:{score:4,comment:'ok'},coherence:{score:3,comment:'ok'},vocabulary:{score:3,comment:'ok'},grammar:{score:3,comment:'ok'}}})}}]}));};
 await scoreGoethe({level:'B1',module:'schreiben',task:'Écrivez un message.',text:'Bonjour, je vous écris parce que je voudrais réserver une chambre.',uiLanguage:'tr',exam:'delf'},{env:{GROQ_API_KEY:'q'},fetcher});
 assert.match(prompt,/DELF\/DALF B1 examiner/);assert.match(prompt,/French written answer/);assert.match(prompt,/keep French examples in French/);
 await assert.rejects(scoreGoethe({level:'B1',module:'schreiben',task:'x',text:'y',exam:'toefl'},{env:{GROQ_API_KEY:'q'},fetcher}),e=>e.code==='invalid_input');
});
