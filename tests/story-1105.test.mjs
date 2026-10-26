import test from 'node:test';import assert from 'node:assert/strict';
import {generateStory} from '../netlify/functions/_shared/story-providers.mjs';
import {narrativeSchema,validateNarrative} from '../netlify/functions/_shared/story-narrative.mjs';
import {LANGUAGES,validateOptions} from '../netlify/functions/_shared/story-core.mjs';
import {createStoriesHandler} from '../netlify/functions/stories.mjs';
import {memoryDb} from './memory-db.mjs';
import {firstKnown as firstFifty,bank,narrativePoolFor as poolFor,options,narrativeDataFor as dataFor,envFor,responseFor} from './story-fixtures.mjs';
for(const language of LANGUAGES){
 for(const provider of ['gemini','groq','cloudflare'])test(`natural narrative and comprehension response: ${language}, ${provider}`,async()=>{
  const pool=poolFor(language);let calls=0;
  const result=await generateStory(pool,options(language),{env:envFor(provider),fetcher:async(_url,request)=>{
   calls++;const body=JSON.parse(request.body),content=JSON.parse(provider==='gemini'?body.contents[0].parts[0].text:body.messages[1].content);
   assert.equal(content.learnedVocabulary.length,Math.min(600,pool.length));assert.equal(content.cefr,'A1');assert(!content.wordBank);
   if(provider==='groq'){assert.equal(body.response_format.type,'json_schema');assert.equal(body.response_format.json_schema.strict,true);assert.deepEqual(body.response_format.json_schema.schema,narrativeSchema);}
   if(provider==='gemini')assert.deepEqual(body.generationConfig.responseFormat.text.schema,narrativeSchema);
   return responseFor(provider,dataFor(language));
  }});
  assert.equal(calls,1);assert.equal(result.provider,provider);assert.equal(result.format,'narrative');assert.equal(result.questions.length,3);assert(result.wordCount>=30);assert(result.focus.length>=3);
 });
 test(`natural narrative saves once, retains questions and does not spend writing allowance: ${language}`,async()=>{
  const f=memoryDb({progress:{alice:firstFifty(language)},serverFeatureUsage:{alice:{writing:{count:7}}}});let calls=0;
  const handler=createStoriesHandler({identity:async()=>({uid:'alice',db:f.db}),wordPool:bank,generateStory:(pool,o)=>generateStory(pool,o,{env:envFor('groq'),fetcher:async()=>{calls++;return responseFor('groq',dataFor(language));}})});
  const body={action:'generate',id:'story-regression-1112-'+language,...options(language)},request=()=>new Request('https://lumira-tr.com/.netlify/functions/stories',{method:'POST',body:JSON.stringify(body)});
  const response=await handler(request());assert.equal(response.status,200,await response.clone().text());assert.equal(response.headers.get('X-Lumira-Features-Version'),'1.11.10');
  const saved=(await response.json()).story;assert.equal(saved.questions.length,3);assert(saved.pool.every(row=>row.meaning));assert.equal(saved.method,'ai');assert.equal(f.get('serverFeatureUsage/alice/writing/count'),7);assert.equal((await handler(request())).status,200);assert.equal(calls,1);
 });
}
test('one bounded repair replaces a list of words with a complete narrative',async()=>{
 let calls=0;const bad=dataFor('de');bad.sentences=bad.sentences.map(row=>({...row,text:'Hallo Brot Wasser.'}));
 const result=await generateStory(poolFor('de'),options('de'),{env:envFor('groq'),fetcher:async(_url,request)=>{
  calls++;if(calls===1)return responseFor('groq',bad);assert(JSON.parse(request.body).messages[1].content.includes('Repair the draft'));return responseFor('groq',dataFor('de'));
 }});assert.equal(calls,2);assert.equal(result.provider,'groq');assert(result.sentences.some(row=>row.text.includes('schneidet')));
});
test('schema compatibility retry retains the same narrative safeguards',async()=>{
 for(const provider of ['groq','gemini']){let calls=0;const result=await generateStory(poolFor('en'),options('en'),{env:envFor(provider),fetcher:async(_url,request)=>{
  calls++;const body=JSON.parse(request.body);if(calls===1)return Response.json({error:{message:'response schema is unsupported'}},{status:400});
  assert.equal(calls,2);if(provider==='groq')assert.equal(body.response_format.type,'json_object');else assert.equal(body.generationConfig.responseFormat,undefined);return responseFor(provider,dataFor('en'));
 }});assert.equal(calls,2);assert.equal(result.provider,provider);}
});
for(const status of[401,403,429,500])test('HTTP '+status+' fails over without an unnecessary schema retry',async()=>{
 let calls=0;const result=await generateStory(poolFor('en'),options('en'),{env:{...envFor('gemini'),...envFor('groq')},fetcher:async()=>++calls===1?Response.json({error:{message:'provider unavailable'}},{status}):responseFor('groq',dataFor('en'))});assert.equal(calls,2);assert.equal(result.provider,'groq');
});
test('failed repair uses the labelled free reading without returning the rejected filler',async()=>{
 let calls=0;const result=await generateStory(poolFor('en'),options('en'),{env:envFor('groq'),fetcher:async()=>{calls++;return responseFor('groq',{sentences:Array.from({length:6},()=>({text:'Hello!',translation:'Merhaba!'}))});}});assert.equal(calls,2);assert.equal(result.provider,'library');assert.equal(result.method,'reviewed');assert.equal(result.questions.length,3);
});
test('total deadline also bounds repair work',async()=>{
 let now=0,calls=0;const result=await generateStory(poolFor('en'),options('en'),{env:{...envFor('gemini'),...envFor('groq')},clock:()=>now,fetcher:async()=>{calls++;now=44001;return responseFor('gemini',{});}});assert.equal(calls,1);assert.equal(result.provider,'library');
});
for(const mutation of[
 data=>data.focus[0].word='unlearned-forged-word',data=>data.focus[0].forms=['word not in this story'],data=>data.sentences[0].translation='<script>alert(1)</script>',data=>data.title='<img>',data=>data.sentences[0].translation='مرحبا',data=>data.sentences[0].translation=data.sentences[0].text,data=>data.glossary=[{word:'absentword',meaning:'deneme'}]
])test('invalid or forged story metadata cannot bypass narrative validation: '+mutation.toString(),()=>{const data=dataFor('en');mutation(data);assert.throws(()=>validateNarrative(data,poolFor('en'),options('en')));});
test('natural grammar and inflections are allowed while the learned lemma stays bound to the pool',()=>{
 const data=dataFor('en');data.sentences[0].text+=' She has visited before.';data.focus.push({word:'you',forms:['She'],meaning:'sen'});
 // The model may map inflections; focus identities themselves must still be learned.
 data.focus.pop();assert.doesNotThrow(()=>validateNarrative(data,poolFor('en'),options('en')));
});
test('only the two explicit story engines are accepted',()=>{assert.equal(validateOptions({...options(),engine:'reviewed'}).engine,'reviewed');assert.throws(()=>validateOptions({...options(),engine:'external-paid'}));});

test('wrong model answer indices are discarded and rebuilt from the saved text',()=>{const data=dataFor('en');data.questions=[{answer:99,choices:['wrong']}];const result=validateNarrative(data,poolFor('en'),options('en'));assert.equal(result.questions.length,3);for(const q of result.questions){assert(q.answer>=0&&q.answer<3);if(q.kind==='passage')assert.equal(q.choices[q.answer],result.sentences[q.evidence].translation);else assert(result.focus.some(row=>row.meaning===q.choices[q.answer]));}});
