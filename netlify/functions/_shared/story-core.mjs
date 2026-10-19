import {fault} from './feature-core.mjs';
export const LANGUAGES=['tr','en','de','ar','fr','es','ru'],GENRES=['adventure','fairy','scifi','mystery','daily','comedy'],STYLES=['cinematic','anime','dream','fantasy','minimal','watercolor'],VOICES=['natural','warm','calm','bright'];
export function normalize(text,lang){let value=String(text).normalize('NFKC').replace(/[’ʼ]/gu,"'").toLocaleLowerCase(lang);if(lang==='ar')value=value.replace(/[\u0640\u064b-\u065f\u0670\u06d6-\u06ed]/gu,'');return value;}
export const tokens=(text,lang)=>normalize(text,lang).match(/[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*|\p{N}+/gu)||[];
const canonical=v=>'u_'+encodeURIComponent(v[0]+'_'+v[1]+'_'+v[2].normalize('NFC')).replace(/\./g,'%2E');
const legacy=v=>(v[0]+'_'+v[1]+'_'+v[2]).toLowerCase().replace(/[.#$\[\]\/\s]+/g,'_').replace(/[^a-z0-9_aoubcdefghijklmnopqrstuvwxyz]/gi,'_').slice(0,120);
export function createWordPool(catalog){
 const counts=new Map();for(const row of catalog){const old=legacy(row);if(!counts.has(old))counts.set(old,new Set());counts.get(old).add(canonical(row));}
 return function(progress,language,native){const pool=new Map(),words=progress?.words||{};
  const add=(w,meaning)=>{if(typeof w!=='string'||!w.trim()||w.length>180||/[<>\u0000-\u001f]/u.test(w))return;const key=normalize(w,language);if(!pool.has(key))pool.set(key,{w:w.trim(),meaning:String(meaning||'').slice(0,250)});};
  for(const row of catalog){if(language!=='tr'&&row[0]!==language)continue;const known=words[canonical(row)]||(counts.get(legacy(row))?.size===1?words[legacy(row)]:null);if(known?.known===true)add(language==='tr'?row[3]:row[2],native==='tr'?row[3]:language==='tr'&&native===row[0]?row[2]:'');}
  for(const value of Object.values(progress?.notebook||{}))if(value?.lang===language)add(value.w,value.meaningLang===native||!value.meaningLang&&native==='tr'?value.tr:'');
  return [...pool.values()];
 };
}
export function validateOptions(body){if(!LANGUAGES.includes(body.language)||!LANGUAGES.includes(body.native)||body.language===body.native||!GENRES.includes(body.genre)||!STYLES.includes(body.style)||!VOICES.includes(body.voice)||![0,1,2,3].includes(body.level))throw fault('invalid_input',422);return Object.fromEntries(['language','native','genre','style','voice','level'].map(k=>[k,body[k]]));}
export function validateStory(raw,pool,options){
 let data;try{data=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw fault('story_invalid',502);}
 if(!Array.isArray(data?.sentences)||data.sentences.length<4||data.sentences.length>18)throw fault('story_invalid',502);
 const allowed=new Set(pool.flatMap(row=>tokens(row.w,options.language))),used=new Set();let count=0;
 const clean=s=>typeof s==='string'&&s.trim()&&s.length<=700&&!/[<>\u0000-\u001f\u202a-\u202e\u2066-\u2069]/u.test(s);
  const sentences=data.sentences.map(row=>{if(!clean(row?.text)||!clean(row?.translation))throw fault('story_invalid',502);const words=tokens(row.text,options.language);if(words.length<2)throw fault('story_invalid',502);for(const word of words){if(!allowed.has(word))throw fault('story_unknown_word',502);used.add(word);}if(tokens(row.translation,options.language).join(' ')===words.join(' '))throw fault('story_invalid',502);const script=options.native==='ar'?/\p{Script=Arabic}/u:options.native==='ru'?/\p{Script=Cyrillic}/u:/\p{Script=Latin}/u;if(!script.test(row.translation))throw fault('story_invalid',502);count+=words.length;return{text:row.text.trim(),translation:row.translation.trim()};});
 if(count<20||count>350||used.size<6)throw fault('story_invalid',502);
 const title=clean(data.title)&&tokens(data.title,options.language).length&&tokens(data.title,options.language).every(w=>allowed.has(w))?data.title.trim():null;
 return{title,sentences,wordCount:count,usedWords:used.size};
}
