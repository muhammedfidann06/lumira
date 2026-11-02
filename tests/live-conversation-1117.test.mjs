import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {translateText,connectProvider,LANGUAGES,CONVERSATION_LANGUAGES} from '../netlify/functions/_shared/live-providers.mjs';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('face-to-face offers 24 languages while the live lesson keeps its seven',async()=>{
 assert.deepEqual(LANGUAGES,['tr','de','en','ar','fr','es','ru']);
 assert.equal(CONVERSATION_LANGUAGES.length,24);
 const source=await read('live-conversation.js');
 for(const code of CONVERSATION_LANGUAGES){assert(new RegExp("\\b"+code+":'[a-z]{2}-[A-Z]{2}'").test(source),code+' locale');assert(source.includes(code+":'"),code+' flag');}
 assert(source.includes("config.addTargetLanguage(azureTarget(to))")&&source.includes("r.translations.get(azureTarget(to))"),'Azure target codes are mapped both ways');
 assert(source.includes("if(CORE.includes(from)&&CORE.includes(to)&&root.LUMIRA_TEXT)return root.LUMIRA_TEXT.translate("),'core pairs keep the existing translation path');
 const live=await read('live-text.js');assert(live.includes("const languages=['tr','de','en','ar','fr','es','ru']"),'shared live helpers are untouched');
});

test('server: extra languages are accepted for Azure tokens and text, not for other live providers',async()=>{
 const env={AZURE_SPEECH_KEY:'k',AZURE_SPEECH_REGION:'westeurope',GEMINI_API_KEY:'g',GROQ_API_KEY:'q'};
 const azure=await connectProvider('azure','uk',{env,source:'de',azureToken:async()=>({token:'t',region:'westeurope'})});
 assert.equal(azure.speech.token,'t');
 await assert.rejects(connectProvider('gemini','uk',{env}),e=>e.code==='invalid_input');
 let body;
 const result=await translateText('Guten Tag','de','uk',{env:{GROQ_API_KEY:'q'},fetcher:async(url,init)=>{body=JSON.parse(init.body);return new Response(JSON.stringify({choices:[{message:{content:'Добрий день'}}]}));}});
 assert.equal(result.translated,'Добрий день');
 assert.match(body.messages[0].content,/from de into uk \(Ukrainian\)/);
 let core;
 await translateText('Hallo','de','tr',{env:{GROQ_API_KEY:'q'},fetcher:async(url,init)=>{core=JSON.parse(init.body).messages[0].content;return new Response(JSON.stringify({choices:[{message:{content:'Merhaba'}}]}));}});
 assert.match(core,/^Translate the quoted user text faithfully from de into tr\. /,'the live lesson prompt is unchanged');
 await assert.rejects(translateText('x','de','xx',{env:{GROQ_API_KEY:'q'}}),e=>e.code==='invalid_input');
});

test('transcripts are exportable and history stays on the device',async()=>{
 const source=await read('live-conversation.js');
 assert(source.includes("'lumira_convo_history_v1_'+(id||'guest')"),'history is per account, in local storage');
 assert(!/firebase[^\n]*\.ref\(/.test(source),'conversation text is never written to the database');
 for(const fn of['copyTranscript','downloadTranscript','printTranscript','openHistory','removeHistory'])assert(source.includes('function '+fn+'('),fn);
 assert(source.includes('navigator.share('),'native share sheet when available');
 assert(source.includes("if(root.LUMIRA_CLEARING_DATA)return;"),'account data clearing is respected');
});
