import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import {Resampler} from '../live-local-core.mjs';
import {LocalSession} from '../live-local.mjs';
import {storyPlan} from '../netlify/functions/_shared/story-plans.mjs';
import {preparedStory} from '../netlify/functions/_shared/story-prepared.mjs';
import {knownStory} from '../netlify/functions/_shared/story-library.mjs';
import {generateStory} from '../netlify/functions/_shared/story-providers.mjs';
import {createStoriesHandler} from '../netlify/functions/stories.mjs';
import {bank,firstFifty,narrativePoolFor,options,dataFor,envFor,responseFor} from './story-fixtures.mjs';
import {memoryDb} from './memory-db.mjs';
const languages=['tr','en','de','ar','fr','es','ru'],genres=['daily','adventure','fairy','scifi','mystery','comedy'];
for(const language of languages){const pool=narrativePoolFor(language);for(const genre of genres)test('100 prepared stories are distinct, aligned and have text-derived answers: '+language+'/'+genre,()=>{
 const text=new Set(),titles=new Set();
 for(let index=0;index<100;index++){
  const story=preparedStory(pool,{...options(language),genre,plan:storyPlan(genre,index)});assert(story,index);text.add(story.sentences.map(row=>row.text).join('\n'));titles.add(story.title);assert.equal(story.questions.length,3);
  for(const question of story.questions){assert(question.choices[question.answer]);assert(question.evidence>=0&&question.evidence<story.sentences.length);if(question.kind==='passage')assert.equal(question.choices[question.answer],story.sentences[question.evidence].translation);}
 }
 assert.equal(text.size,100);assert.equal(titles.size,100);
});}
test('all seven native languages can read prepared stories with only fifty learned cards',()=>{
 for(const language of languages)for(const native of languages.filter(value=>value!==language)){const pool=bank(firstFifty(language),language,native);for(const genre of genres)for(const level of[0,1,2,3])assert(knownStory(pool,{...options(language,native,level,genre),plan:storyPlan(genre,0)}),[language,native,genre,level].join('/'));}
});
test('production requests persist a full 100-story cycle while preserving idempotency and writing quota',async()=>{
 let now=1800000000000;const database=memoryDb({progress:{alice:firstFifty('en')},serverFeatureUsage:{alice:{writing:{count:7}}}}),handler=createStoriesHandler({identity:async()=>({uid:'alice',db:database.db}),wordPool:bank,generateStory:(pool,config)=>generateStory(pool,config,{env:{}})},()=>now),texts=new Set();
 for(let index=0;index<100;index++){
  const body={action:'generate',id:'prepared-production-1114-'+index,...options('en'),engine:'reviewed'},request=()=>new Request('https://lumira-tr.com/.netlify/functions/stories',{method:'POST',body:JSON.stringify(body)}),response=await handler(request());assert.equal(response.status,200,await response.clone().text());const result=(await response.json()).story;texts.add(result.sentences.map(row=>row.text).join('\n'));assert.match(result.coverId,/^daily-\d{3}$/);assert.equal((await(await handler(request())).json()).story.id,result.id);now+=61000;
 }
 assert.equal(texts.size,100);assert.equal(Object.keys(database.get('serverStoryIndex/alice')).length,20);assert.equal(database.get('serverFeatureUsage/alice/writing/count'),7);
});
test('a repeated AI draft is repaired or replaced with the new planned reading',async()=>{
 const draft=dataFor('en'),fingerprint=createHash('sha256').update(draft.sentences.map(row=>row.text).join('\n')).digest('hex');let calls=0;
 const result=await generateStory(narrativePoolFor('en'),{...options('en'),plan:storyPlan('daily',1),recentFingerprints:[fingerprint]},{env:envFor('groq'),fetcher:async()=>{calls++;return responseFor('groq',draft);}});
 assert.equal(calls,2);assert.equal(result.method,'reviewed');assert.notEqual(result.title,draft.title);
});
test('the microphone worklet retains right-channel speech and does not cancel opposite-phase audio',()=>{
 let Capture;const output=[],context={Resampler,sampleRate:48000,AudioWorkletProcessor:class{constructor(){this.port={postMessage:audio=>output.push(audio)};}},registerProcessor:(name,type)=>Capture=type};
 vm.runInNewContext(fs.readFileSync(new URL('../live-local-audio.mjs',import.meta.url),'utf8').replace(/^import[^\n]+\n/,''),context);
 const capture=new Capture();for(let n=0;n<375;n++)capture.process([[new Float32Array(128),new Float32Array(128).fill(.25)]]);assert.equal(output.reduce((sum,row)=>sum+row.length,0),16000);assert(output.every(row=>row.every(value=>Math.abs(value-.25)<1e-5)));
 output.length=0;const opposite=new Capture();for(let n=0;n<375;n++)opposite.process([[new Float32Array(128).fill(-.3),new Float32Array(128).fill(.3)]]);assert(output.every(row=>row.every(value=>Math.abs(value)>.29)));
});
test('the ScriptProcessor compatibility path also captures the active stereo channel',async()=>{
 const original=globalThis.window,output=[];let channels;const node=()=>({connect(){},disconnect(){},gain:{value:1}}),audioContext={state:'running',sampleRate:48000,audioWorklet:{addModule:async()=>{throw Error('fixture worklet unavailable');}},createMediaStreamSource:node,createGain:node,createScriptProcessor:(_size,count)=>{channels=count;return node();},destination:{},resume:async()=>{},close:async()=>{}};
 globalThis.window={AudioContext:class{},AudioWorkletNode:class{}};
 try{const session=new LocalSession({target:'tr',audioContext,onAudio:audio=>output.push(audio)});await session.arm({getAudioTracks:()=>[{getSettings:()=>({channelCount:2})}],clone:()=>({getTracks:()=>[{stop(){}}],getAudioTracks:()=>[{getSettings:()=>({channelCount:2})}]})});assert.equal(channels,2);session.capture.onaudioprocess({inputBuffer:{numberOfChannels:2,getChannelData:index=>new Float32Array(4800).fill(index?.25:0)}});assert.equal(session.samples,1600);assert(output.every(row=>row.every(value=>Math.abs(value-.25)<1e-5)));session.stop();}finally{globalThis.window=original;}
});
