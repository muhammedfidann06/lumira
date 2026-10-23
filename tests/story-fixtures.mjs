import fs from 'node:fs';
import {createWordPool} from '../netlify/functions/_shared/story-core.mjs';
import {knownStory} from '../netlify/functions/_shared/story-library.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../netlify/functions/_shared/story-sources.json',import.meta.url)));
const first=['de','en','ar','fr','es','ru'].flatMap(language=>catalog.filter(row=>row[0]===language).slice(0,50));
// Count legacy collisions against the real complete catalog, as production does.
export const bank=createWordPool(catalog);
export function firstFifty(language){const words={};for(const row of first.filter(row=>row[0]===(language==='tr'?'de':language)))words['u_'+encodeURIComponent(row[0]+'_'+row[1]+'_'+row[2].normalize('NFC')).replace(/\./g,'%2E')]={known:true};return{words};}
export const options=(language='en',native=language==='tr'?'en':'tr',level=0,genre='daily')=>({language,native,level,genre,style:'minimal',voice:'natural'});
const pools=new Map();export function poolFor(language='en',native=language==='tr'?'en':'tr'){const key=language+native;if(!pools.has(key))pools.set(key,bank(firstFifty(language),language,native));return pools.get(key);}
export function dataFor(language='en',native=language==='tr'?'en':'tr',level=0,genre='daily'){const story=knownStory(poolFor(language,native),options(language,native,level,genre));if(!story)throw Error('Missing reviewed fixture: '+language+'/'+native+'/'+genre+'/'+level);return story;}
export const envFor=provider=>provider==='gemini'?{GEMINI_API_KEY:'fixture'}:provider==='groq'?{GROQ_API_KEY:'fixture'}:{CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'fixture'};
export const responseFor=(provider,data)=>Response.json(provider==='gemini'?{candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}]}:provider==='groq'?{choices:[{message:{content:JSON.stringify(data)}}]}:{success:true,result:{response:data}});
