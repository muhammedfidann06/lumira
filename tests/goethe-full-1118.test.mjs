import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHandler} from '../netlify/functions/features.mjs';
import {TIERS} from '../netlify/functions/_shared/feature-core.mjs';
import {sha256} from '../netlify/functions/_shared/feature-services.mjs';
import {LEVELS} from '../netlify/functions/_shared/goethe-ai.mjs';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
async function engine(){
 const source=await read('goethe-exam.js'),window={addEventListener(){},NATIVE_LANG:'tr'};
 vm.runInNewContext(source,{window,document:{currentScript:null,addEventListener(){}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},URL,Map,Set,Promise,setTimeout,clearTimeout,setInterval,clearInterval,AbortController});
 return window.LUMIRA_GOETHE;
}
const plain=v=>JSON.parse(JSON.stringify(v));

test('Goethe grades follow the official bands',async()=>{
 const G=await engine();
 assert.deepEqual([100,90,89,80,79,70,69,60,59,0].map(G._grade),['sehr gut','sehr gut','gut','gut','befriedigend','befriedigend','ausreichend','ausreichend','nicht bestanden','nicht bestanden']);
});

test('the full-exam result sheet: modular levels need every module, A1/A2 the total',async()=>{
 const G=await engine(),b1=JSON.parse(await read('goethe/b1-01.json')),a1=JSON.parse(await read('goethe/a1-01.json'));
 const texts={},scores={};
 b1.sprechen.forEach((t,i)=>{texts[i]='Ich finde die Idee gut, weil wir dann mehr Zeit zusammen haben und alle mithelfen können '+i;scores[i]={score:70,hash:G._hashText(texts[i])};});
 const writing={texts:{},scores:{}};
 b1.schreiben.forEach((t,i)=>{writing.texts[i]='Liebe Freunde, vielen Dank für die Einladung. Ich komme sehr gern und bringe einen Salat mit. Leider kann ich erst um acht Uhr da sein, weil ich lange arbeiten muss. Bis Samstag! '+i;writing.scores[i]={score:50,hash:G._hashText(writing.texts[i])};});
 let d=G._certificateData('B1-01',b1,{mods:{lesen:{pct:80},hoeren:{pct:72},schreiben:{data:writing},sprechen:{data:{texts,scores}}}});
 assert.equal(d.complete,true);assert.equal(d.pct,Math.round((80+72+50+70)/4));
 assert.equal(d.passedCount,3);assert.equal(d.passed,false,'one module below 60 fails a modular exam even with a passing average');
 // A1 is a total exam: the same average passes.
 const form={0:Object.fromEntries(a1.schreiben[0].form.map((f,k)=>[k,f.a]))},letter='Liebe Frau Weber, ich kann am Montag leider nicht kommen. Ich bin krank. Können wir einen neuen Termin machen? Viele Grüße';
 const a1speak={texts:{},scores:{}};a1.sprechen.forEach((t,i)=>{a1speak.texts[i]='Ich heiße Anna und ich komme aus Polen. Ich wohne in Köln '+i;a1speak.scores[i]={score:55,hash:G._hashText(a1speak.texts[i])};});
 d=G._certificateData('A1-01',a1,{mods:{hoeren:{pct:70},lesen:{pct:65},schreiben:{data:{form,texts:{1:letter},scores:{1:{score:40,hash:G._hashText(letter)}}}},sprechen:{data:a1speak}}});
 assert.equal(d.complete,true);assert.equal(d.passed,d.pct>=60);assert(d.mods.schreiben.pct>40,'the form part counts in A1 Schreiben');
});

test('in the full exam an empty task counts as 0 and an unscored answer is pending',async()=>{
 const G=await engine(),b2=JSON.parse(await read('goethe/b2-01.json'));
 // B2 Teil 1 verlangt 150 Wörter; unter 45 Wörtern (30 %) zählt die Antwort als leer.
 const essay='In der Sendung wurde intensiv diskutiert, ob ein soziales Jahr für alle sinnvoll ist. Ich halte die Idee grundsätzlich für richtig, weil junge Menschen dabei Verantwortung lernen und andere Lebenswelten kennenlernen. Allerdings müsste man die Freiwilligen angemessen bezahlen und ihnen genug Zeit für die Berufswahl lassen. In meinem Heimatland gibt es bereits ähnliche Programme, die bei vielen Jugendlichen sehr beliebt sind und das Miteinander stärken.';
 const data={texts:{0:essay,1:'Hallo'},scores:{}};
 let d=G._certificateData('B2-01',b2,{mods:{lesen:{pct:70},hoeren:{pct:70},schreiben:{data},sprechen:{data:{texts:{},scores:{}}}}});
 assert.equal(d.complete,false);assert.deepEqual(plain(d.pending.map(p=>[p.m,p.row.i])),[['schreiben',0]],'only the real answer waits for AI scoring');
 assert.equal(d.mods.sprechen.pct,0,'a speaking part with no answers scores 0, like an unanswered task in the exam');
 data.scores[0]={score:80,hash:G._hashText(essay)};
 d=G._certificateData('B2-01',b2,{mods:{lesen:{pct:70},hoeren:{pct:70},schreiben:{data},sprechen:{data:{texts:{},scores:{}}}}});
 assert.equal(d.complete,true);assert(d.mods.schreiben.pct<80,'the empty second task lowers the module score');
 assert.equal(G._productiveOutcome(b2,'schreiben',data).pct,null,'outside the full exam an empty task is still simply unscored');
 d=G._certificateData('B2-01',b2,{mods:{lesen:{pct:70}}});
 assert.equal(d.complete,false);assert.equal(d.mods.hoeren.pct,null,'missing modules keep the sheet incomplete');
});

test('the full exam runs the four modules in order and saves one result',async()=>{
 const source=await read('goethe-exam.js');
 assert(source.includes("if(r.full){fullRecord(r.id,r.m,{pct,correct,total});saveResult(r.id,r.m,entry);fullBreak(r.id,r.m,timeUp);return;}"),'objective modules continue to the break screen');
 assert(source.includes("if(r.full){fullRecord(r.id,r.m,{data});saveProductive(r.id,r.m,r.exam,data);fullBreak(r.id,r.m,timeUp);return;}"),'productive modules continue to the break screen');
 assert(source.includes("if(full)saved.timed=m!=='sprechen';"),'the real time limits always apply');
 assert(source.includes("key=progressKey(id,m)+(full?'_full':'')"),'a full exam never overwrites a separate section attempt');
 assert(source.includes("saveResult(id,'full',{pct:d.pct,passed:d.passed,mods},FULL_XP)"),'the finished exam is stored once with its own XP');
 assert(source.includes('Dies ist kein offizielles Zertifikat des Goethe-Instituts.'),'the printable sheet says it is not an official certificate');
});

test('C1 is a level of its own: five exams and AI scoring on the server',async()=>{
 const G=await engine();
 const c1=G.LEVELS.find(L=>L.id==='C1');
 assert.deepEqual(plain(c1.minutes),{lesen:65,hoeren:40,schreiben:80,sprechen:15});
 assert.equal(G._countOf('C1'),5);assert.equal(G._countOf('B2'),10);
 assert(LEVELS.includes('C1'));
 const values=new Map(),db={ref(path){return{on(){},off(){},async get(){return{val:()=>structuredClone(values.get(path)||null)};},async transaction(fn){const next=fn(structuredClone(values.get(path)||null));if(next===undefined)return{committed:false};values.set(path,structuredClone(next));return{committed:true,snapshot:{val:()=>structuredClone(next)}};}};}};
 let input;
 const handler=createHandler({async identity(){return{uid:'u1',db,tier:TIERS.find(t=>t.amount===0)};},sha256,async assertAvailable(){},async scoreGoethe(x){input=x;return{score:66,criteria:{}};}},()=>Date.parse('2026-11-02T10:00:00Z'));
 const r=await handler(new Request('https://lumira.test/.netlify/functions/features',{method:'POST',headers:{Authorization:'Bearer u1',Origin:'https://lumira.test'},body:JSON.stringify({action:'goetheScore',id:'goethe-c1-operation-01',level:'C1',module:'schreiben',task:'Schreiben Sie einen Forumsbeitrag.',text:'Meiner Ansicht nach überwiegen die Vorteile deutlich.'})}));
 assert.equal(r.status,200);assert.equal(input.level,'C1');
});
