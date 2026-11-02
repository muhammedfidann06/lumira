import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,readdir} from 'node:fs/promises';

const root=new URL('../',import.meta.url),read=name=>readFile(new URL(name,root),'utf8');
// Teil layout per level: [type, item count]. 'pairs' = B1/B2 Hören Teil 1 (richtig/falsch + a/b/c per text).
const SPEC={
 A1:{lesen:[['rf',5],['ab',5],['rf',5]],hoeren:[['abc',6],['rf',4],['abc',5]],schreiben:2,sprechen:3},
 A2:{lesen:[['abc',5],['abc',5],['abc',5],['match',5]],hoeren:[['abc',5],['match',5],['abc',5],['yn',5]],schreiben:2,sprechen:3},
 B1:{lesen:[['rf',6],['abc',6],['match',7],['yn',7],['abc',4]],hoeren:[['pairs',10],['abc',5],['rf',7],['match',8]],schreiben:3,sprechen:3},
 B2:{lesen:[['match',9],['abc',6],['match',6],['match',6],['match',3]],hoeren:[['pairs',10],['abc',6],['match',6],['abc',8]],schreiben:2,sprechen:2},
 C1:{lesen:[['abc',9],['abc',7],['match',6],['match',8]],hoeren:[['pairs',10],['abc',7],['abc',8]],schreiben:2,sprechen:2}
};
const COUNTS={a1:10,a2:10,b1:10,b2:10,c1:5};
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
   if(type==='rf'||type==='yn'){assert.equal(typeof item.a,'boolean',it+' boolean answer');assert(text(item.q),it+' statement');}
   else if(type==='abc'||type==='ab'){
    assert(Array.isArray(item.options)&&item.options.length===(type==='ab'?2:3),it+' option count');
    item.options.forEach(o=>assert(text(o),it+' option text'));
    assert.equal(new Set(item.options).size,item.options.length,it+' distinct options');
    assert(Number.isInteger(item.a)&&item.a>=0&&item.a<item.options.length,it+' answer index');
   }else if(type==='match'){
    assert(keys.length>=3,it+' choices');
    assert(keys.includes(item.a)||(teil.none&&item.a==='0'),it+' answer key '+item.a);
    assert(text(item.q)||text(item.text),it+' prompt');
   }else assert.fail(it+' unknown type '+type);
   if(module==='hoeren'){
    const needsAudio=!teil.audio&&!(kind==='pairs'&&j%2===1);
    if(needsAudio)assert(text(item.audio),it+' audio');
   }
   answers.push(type==='match'||type==='abc'||type==='ab'?String(item.a):item.a?'T':'F');
  });
  if(teil.audio!==undefined)assert(text(teil.audio),at+' teil audio');
  // Matching answers must not simply run a, b, c … in order.
  if(keys.length&&teil.items.length>=5)assert(teil.items.filter((item,j)=>item.a===keys[j]).length<3,at+' match answers are in plain order');
 });
 // A paper whose answers are all the same letter would be a broken exam.
 assert(new Set(answers).size>1,where+' '+module+' answers vary');
}
async function exams(){
 const files=(await readdir(new URL('goethe/',root))).filter(f=>/^(a1|a2|b1|b2|c1)-\d\d\.json$/.test(f)).sort();
 return Promise.all(files.map(async f=>({file:f,data:JSON.parse(await read('goethe/'+f))})));
}

test('all 45 Goethe practice exams exist: 10 per level A1–B2 and 5 for C1',async()=>{
 const files=(await exams()).map(e=>e.file);
 for(const [level,count] of Object.entries(COUNTS))for(let i=1;i<=count;i++)assert(files.includes(level+'-'+String(i).padStart(2,'0')+'.json'),'missing '+level+'-'+String(i).padStart(2,'0'));
 assert.equal(files.length,45);
});
test('every exam follows the official section, Teil and task layout of its level',async()=>{
 for(const {file,data} of await exams()){
  const level=file.slice(0,2).toUpperCase(),spec=SPEC[level],where=file;
  assert.equal(data.id,level+'-'+file.slice(3,5),where+' id');assert.equal(data.level,level,where+' level');
  checkObjective(data,'lesen',spec.lesen,where);checkObjective(data,'hoeren',spec.hoeren,where);
  assert.equal(data.schreiben.length,spec.schreiben,where+' Schreiben Teile');
  data.schreiben.forEach((teil,i)=>{
   const at=where+' Schreiben '+(i+1);assert(text(teil.title)&&text(teil.task),at);
   if(teil.form){assert(teil.form.length>=5,at+' form fields');teil.form.forEach(f=>assert(text(f.label)&&text(f.a),at+' field'));assert(text(teil.situation),at+' situation');}
   else{assert(Number.isInteger(teil.words)&&teil.words>=20,at+' words');assert(Array.isArray(teil.points)&&teil.points.length>=2,at+' points');assert(text(teil.sample),at+' sample');}
  });
  assert.equal(data.sprechen.length,spec.sprechen,where+' Sprechen Teile');
  data.sprechen.forEach((teil,i)=>assert(text(teil.title)&&text(teil.task)&&text(teil.sample),where+' Sprechen '+(i+1)));
 }
});
test('the same answer key never repeats a whole exam (each test is distinct)',async()=>{
 const seen=new Map();
 for(const {file,data} of await exams()){
  const signature=JSON.stringify([data.lesen.map(t=>t.texts?.[0]?.body||t.items[0].q),data.hoeren.map(t=>t.audio||t.items[0].audio)]);
  assert(!seen.has(signature),file+' duplicates '+seen.get(signature));seen.set(signature,file);
 }
});
test('engine helpers: form answers are matched leniently and dialogue speakers are recognised',async()=>{
 const source=await read('goethe-exam.js'),window={addEventListener(){},NATIVE_LANG:'tr'};
 vm.runInNewContext(source,{window,document:{currentScript:null,addEventListener(){}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},URL,Map,Set,Promise,setTimeout,clearTimeout,setInterval,clearInterval,AbortController});
 const G=window.LUMIRA_GOETHE;
 assert(G._formCorrect({a:'Gómez',alt:['Gomez']},'gomez'));assert(G._formCorrect({a:'Abend',alt:['am Abend']},'Am Abend.'));assert(!G._formCorrect({a:'Koch'},'Lehrer'));assert(!G._formCorrect({a:'28'},''));
 const lines=G._parseScript('Frau: Hallo!\nMann: Guten Tag.\nAchtung am Gleis 4.');
 assert.deepEqual(JSON.parse(JSON.stringify(lines)),[{speaker:'Frau',text:'Hallo!'},{speaker:'Mann',text:'Guten Tag.'},{speaker:'',text:'Achtung am Gleis 4.'}]);
 assert.equal(G.validExam({lesen:[],hoeren:[],schreiben:[],sprechen:[]}),false);
 assert.deepEqual(JSON.parse(JSON.stringify(G.LEVELS.map(L=>L.order[0]))),['hoeren','lesen','lesen','lesen','lesen']);
 assert.deepEqual(JSON.parse(JSON.stringify(G.LEVELS.map(L=>G._countOf(L.id)))),[10,10,10,10,5]);
});
test('placement opens the new entry screen and the word test returns to it',async()=>{
 const source=await read('progress.js'),html=await read('index.html'),sw=await read('sw.js');
 assert(source.includes('window.PM_openPlacement=function(){pmInWritingFlow=false;pmInStoryFlow=false;openPersonalMode(openPlacementHub);};'));
 assert(source.includes("window.LUMIRA_GOETHE.hub(root, { word: openLevelTestPicker"));
 assert(/<script src="goethe-exam\.js\?v=[\d.]+"><\/script>/.test(html)&&/goethe-exam\.css\?v=/.test(html));
 assert(sw.includes("'./goethe-exam.js'")&&sw.includes("'./goethe-exam.css'"));
});
