import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWordPool,storyLexicon,storySchema,decodeStory,validateStory,tokens,LANGUAGES} from '../netlify/functions/_shared/story-core.mjs';
import {generateStory} from '../netlify/functions/_shared/story-providers.mjs';
import {createStoriesHandler} from '../netlify/functions/stories.mjs';
import {memoryDb} from './memory-db.mjs';

const catalog=JSON.parse(await readFile(new URL('../netlify/functions/_shared/story-sources.json',import.meta.url),'utf8'));
const bank=createWordPool(catalog);
const key=row=>'u_'+encodeURIComponent(row[0]+'_'+row[1]+'_'+row[2].normalize('NFC')).replace(/\./g,'%2E');
const firstFifty=language=>{
 const rows=catalog.filter(row=>row[0]===(language==='tr'?'de':language)).slice(0,50);
 return{words:Object.fromEntries(rows.map(row=>[key(row),{known:true}])),notebook:{}};
};
const options=(language,level=0)=>({language,native:language==='tr'?'en':'tr',level,genre:'daily',voice:'natural',style:'minimal'});
// The vocabulary is taken from real learned cards, never derived from the
// desired story. These brief scenes need no invented conjugations.
const scenes={
 tr:[['Merhaba!','Hello!'],['Aile: anne, baba, çocuk.','Family: mother, father, child.'],['Ekmek, su, elma.','Bread, water, an apple.'],['Teşekkürler!','Thank you!']],
 de:[['Guten Morgen!','Günaydın!'],['Hallo!','Merhaba!'],['Die Familie: die Mutter, der Vater, das Kind.','Aile: anne, baba, çocuk.'],['Das Brot, das Wasser, der Apfel.','Ekmek, su, elma.'],['Danke!','Teşekkürler!']],
 en:[['Hello!','Merhaba!'],['My family: my mother, my father, my sister.','Ailem: annem, babam, kız kardeşim.'],['Bread, please! Water, please!','Ekmek, lütfen! Su, lütfen!'],['Thank you!','Teşekkür ederim!']],
 ar:[['مرحبا!','Merhaba!'],['عائلة: أب، أنا، أنت.','Aile: baba, ben, sen.'],['خبز، ماء.','Ekmek, su.'],['شكرا!','Teşekkürler!']],
 fr:[['Bonjour!','Merhaba!'],['Comment vas-tu?','Nasılsın?'],['Je vais bien, merci.','İyiyim, teşekkür ederim.'],['Bon après-midi!','İyi öğleden sonralar!'],['À bientôt!','Yakında görüşürüz!']],
 es:[['Hola!','Merhaba!'],['¿Cómo estás?','Nasılsın?'],['Estoy bien, gracias.','İyiyim, teşekkür ederim.'],['Buenas tardes!','İyi günler!'],['Hasta luego!','Görüşürüz!']],
 ru:[['Здравствуйте!','Merhaba!'],['Как дела?','Nasılsın?'],['Хорошо, спасибо.','İyiyim, teşekkür ederim.'],['Добрый день!','İyi günler!'],['До свидания!','Hoşça kal!']]
};
const segments=text=>text.match(/[\p{L}\p{M}]+(?:['’ʼ-][\p{L}\p{M}]+)*|\p{N}+|[.,!?:;—،؟«»“”()¿¡…]/gu)||[];
const dataFor=language=>({title:null,sentences:scenes[language].map(([text,translation])=>({segments:segments(text),translation}))});
const poolFor=language=>bank(firstFifty(language),language,options(language).native);
const envFor=provider=>provider==='gemini'?{GEMINI_API_KEY:'fixture'}:provider==='groq'?{GROQ_API_KEY:'fixture'}:{CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'fixture'};
const responseFor=(provider,data)=>Response.json(provider==='gemini'?{candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}]}:provider==='groq'?{choices:[{message:{content:JSON.stringify(data)}}]}:{success:true,result:{response:data}});

for(const language of LANGUAGES){
 for(const provider of ['gemini','groq','cloudflare'])test(`first 50 actual cards: ${language}, ${provider}`,async()=>{
  const pool=poolFor(language),lexicon=storyLexicon(pool,language);let calls=0;
  const result=await generateStory(pool,options(language),{env:envFor(provider),fetcher:async(_url,request)=>{
   calls++;const body=JSON.parse(request.body),content=JSON.parse(provider==='gemini'?body.contents[0].parts[0].text:body.messages[1].content);
   assert.deepEqual(content.allowedTokens,lexicon.allowed);assert.deepEqual(content.wordBank,lexicon.wordBank);
   if(provider==='groq'){assert.equal(body.response_format.type,'json_schema');assert.equal(body.response_format.json_schema.strict,true);assert.deepEqual(body.response_format.json_schema.schema,storySchema(lexicon.wordBank));}
   if(provider==='gemini')assert.deepEqual(body.generationConfig.responseFormat.text.schema,storySchema(lexicon.wordBank));
   return responseFor(provider,dataFor(language));
  }});
  assert.equal(calls,1);assert.equal(result.provider,provider);assert.equal(result.sentences.length,scenes[language].length);
  assert.deepEqual(result.sentences.map(row=>row.text),scenes[language].map(row=>row[0]));
  assert.deepEqual(result.sentences.map(row=>row.translation),scenes[language].map(row=>row[1]));
  assert(result.usedWords>=6);for(const row of result.sentences)for(const word of tokens(row.text,language))assert(lexicon.allowed.includes(word));
 });
 for(const level of [0,1,2,3])test(`valid short dialogue is retained at requested level ${level} in ${language}`,()=>{
  const result=validateStory(dataFor(language),poolFor(language),options(language,level));assert(result.wordCount>=8);assert.equal(result.sentences[0].text,scenes[language][0][0]);
 });
 for(const unknown of ['Xylophonium','987654','<img>'])test(`constrained output cannot bypass known words or HTML checks: ${language}, ${unknown}`,()=>{
  const data=dataFor(language);data.sentences[1].segments.push(unknown);assert.throws(()=>validateStory(data,poolFor(language),options(language)));
 });
 test(`validated provider story saves once without spending writing quota in ${language}`,async()=>{
  const f=memoryDb({progress:{alice:firstFifty(language)},serverFeatureUsage:{alice:{writing:{count:7}}}});let calls=0;
  const handler=createStoriesHandler({identity:async()=>({uid:'alice',db:f.db}),wordPool:bank,generateStory:(pool,o)=>generateStory(pool,o,{env:envFor('groq'),fetcher:async()=>{calls++;return responseFor('groq',dataFor(language));}})});
  const body={action:'generate',id:'story-regression-1105-'+language,...options(language)},request=()=>new Request('https://lumira-tr.com/.netlify/functions/stories',{method:'POST',body:JSON.stringify(body)});
  const response=await handler(request());assert.equal(response.status,200,await response.clone().text());assert.equal(response.headers.get('X-Lumira-Features-Version'),'1.11.1');
  const saved=(await response.json()).story;assert(f.get('serverStories/alice/'+body.id));assert.equal(saved.options.language,language);assert.equal(f.get('serverFeatureUsage/alice/writing/count'),7);
  assert.equal((await handler(request())).status,200);assert.equal(calls,1);
 });
}
test('one bounded repair includes the exact unsupported words',async()=>{
 let calls=0;const bad=dataFor('de');bad.sentences[1].segments.push('Xylophonium');
 const result=await generateStory(poolFor('de'),options('de'),{env:envFor('groq'),fetcher:async(_url,request)=>{
  calls++;if(calls===1)return responseFor('groq',bad);
  const content=JSON.parse(request.body).messages[1].content;assert(content.includes('Repair the draft'));assert(content.includes('"unknownWords":["xylophonium"]'));return responseFor('groq',dataFor('de'));
 }});assert.equal(calls,2);assert(!result.sentences.some(row=>row.text.includes('Xylophonium')));
});
test('older schema support falls back once and keeps the same vocabulary safeguards',async()=>{
 for(const provider of ['groq','gemini']){
  let calls=0;const result=await generateStory(poolFor('en'),options('en'),{env:envFor(provider),fetcher:async(_url,request)=>{
   calls++;const body=JSON.parse(request.body);
   if(calls===1)return Response.json({error:{message:'response schema is unsupported'}},{status:400});
   assert.equal(calls,2);if(provider==='groq')assert.equal(body.response_format.type,'json_object');else assert.equal(body.generationConfig.responseFormat,undefined);
   return responseFor(provider,dataFor('en'));
  }});assert.equal(calls,2);assert.equal(result.provider,provider);
 }
});
for(const status of [401,403,429,500])test('provider HTTP '+status+' fails over without a schema retry',async()=>{
 let calls=0;const result=await generateStory(poolFor('en'),options('en'),{env:{...envFor('gemini'),...envFor('groq')},fetcher:async()=>++calls===1?Response.json({error:{message:'provider unavailable'}},{status}):responseFor('groq',dataFor('en'))});assert.equal(calls,2);assert.equal(result.provider,'groq');
});
test('a schema fallback never returns unknown source words; a reviewed dialogue stays available',async()=>{
 let calls=0;const bad=dataFor('en');bad.sentences[0].segments.push('Xylophonium');
 const result=await generateStory(poolFor('en'),options('en'),{env:envFor('groq'),fetcher:async()=>++calls===1?Response.json({error:{message:'unsupported response_format schema'}},{status:400}):responseFor('groq',bad)});
 assert.equal(result.provider,'guided');assert.equal(calls,3);for(const sentence of result.sentences)for(const token of tokens(sentence.text,'en'))assert(storyLexicon(poolFor('en'),'en').allowed.includes(token));
});
test('a failed repair is bounded and replaces the unsafe draft with a reviewed dialogue',async()=>{
 let calls=0;const bad=dataFor('en');bad.sentences[2].segments.push('Xylophonium');
 const result=await generateStory(poolFor('en'),options('en'),{env:envFor('groq'),fetcher:async()=>{calls++;return responseFor('groq',bad);}});assert.equal(calls,2);assert.equal(result.provider,'guided');assert(!JSON.stringify(result).includes('Xylophonium'));
});
test('the total provider deadline also bounds repair work and leaves the reviewed fallback available',async()=>{
 let now=0,calls=0;const bad=dataFor('en');bad.sentences[0].segments.push('Xylophonium');
 const result=await generateStory(poolFor('en'),options('en'),{env:{...envFor('gemini'),...envFor('groq')},clock:()=>now,fetcher:async()=>{calls++;now=30001;return responseFor('gemini',bad);}});assert.equal(calls,1);assert.equal(result.provider,'guided');
});
test('unlearned conjugations remain excluded',()=>{
 const pool=poolFor('de');assert(!storyLexicon(pool,'de').allowed.includes('bin'));const bad=dataFor('de');bad.sentences[1].segments=['Ich','bin','hier','.'];assert.throws(()=>validateStory(bad,pool,options('de')),e=>e.code==='story_unknown_word');
});
test('parenthetical dictionary labels do not become target-language story words',()=>{
 const pool=bank({notebook:{a:{lang:'es',w:'buenas tardes (akşam)',tr:'iyi akşamlar'},b:{lang:'es',w:'buenas tardes',tr:'iyi günler'}}},'es','tr');assert.equal(pool.length,1);assert.equal(pool[0].w,'buenas tardes');assert(!storyLexicon(pool,'es').allowed.includes('akşam'));
});
test('constrained segments take precedence over an injected free-text field',()=>{
 const raw=dataFor('en');raw.sentences[0].text='<img src=x onerror=alert(1)>';const result=validateStory(raw,poolFor('en'),options('en'));assert.equal(result.sentences[0].text,'Hello!');
});
test('schema word bank stays bounded for large custom vocabularies',()=>{
 const pool=Array.from({length:600},(_,i)=>({w:'word'+i+' '+('letter'.repeat(20)),meaning:''})),lexicon=storyLexicon(pool,'en');assert(lexicon.wordBank.length<=918);assert(lexicon.wordBank.join('').length<12100);assert(storySchema(lexicon.wordBank).properties.sentences.items.additionalProperties===false);
});
test('empty and punctuation-only segments, wrong translations, and too-short scenes stay invalid',()=>{
 for(const invalid of [[],['!'],[42],['<img>']]){const raw=dataFor('en');raw.sentences[0].segments=invalid;assert.throws(()=>validateStory(raw,poolFor('en'),options('en')));}
 const tooShort={sentences:Array.from({length:4},()=>({text:'Hello!',translation:'Merhaba!'}))};assert.throws(()=>validateStory(tooShort,poolFor('en'),options('en')));
 const raw=dataFor('en');raw.sentences[1].translation='Hello!';assert.throws(()=>validateStory(raw,poolFor('en'),{...options('en'),native:'ar'}));
});
test('decoding fenced JSON retains Spanish opening question marks and Arabic punctuation',()=>{
 assert.equal(decodeStory('```json\n'+JSON.stringify(dataFor('es'))+'\n```').sentences[1].text,'¿Cómo estás?');assert.equal(decodeStory(dataFor('ar')).sentences[2].text,'خبز، ماء.');
});
