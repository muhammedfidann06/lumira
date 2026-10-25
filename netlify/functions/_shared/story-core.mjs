import {fault} from './feature-core.mjs';
export const LANGUAGES=['tr','en','de','ar','fr','es','ru'],GENRES=['adventure','fairy','scifi','mystery','daily','comedy'],STYLES=['cinematic','anime','dream','fantasy','minimal','watercolor'],VOICES=['natural','warm','calm','bright'];
export function normalize(text,lang){let value=String(text).normalize('NFKC').replace(/[’ʼ]/gu,"'").toLocaleLowerCase(lang);if(lang==='ar')value=value.replace(/[\u0640\u064b-\u065f\u0670\u06d6-\u06ed]/gu,'');return value;}
export const tokens=(text,lang)=>normalize(text,lang).match(/[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*|\p{N}+/gu)||[];
const punctuation=['.',',','!','?',':',';','—','،','؟','«','»','“','”','(',')','¿','¡','…'];
export function storyLexicon(pool,language){
 const allowed=[...new Set(pool.flatMap(row=>tokens(row.w,language)))],known=new Set(allowed),bank=new Set();let characters=0;
 const add=value=>{if(!value||bank.has(value)||bank.size>=900||characters+value.length>12000||!known.has(normalize(value,language)))return;bank.add(value);characters+=value.length;};
 for(const row of pool)for(const word of String(row.w).normalize('NFKC').replace(/[’ʼ]/gu,"'").match(/[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*|\p{N}+/gu)||[]){add(word);add(normalize(word,language));add(word[0].toLocaleUpperCase(language)+word.slice(1));}
 return{allowed,wordBank:[...bank,...punctuation]};
}
export function storySchema(wordBank){return{type:'object',properties:{title:{type:['string','null']},sentences:{type:'array',minItems:4,maxItems:18,items:{type:'object',properties:{segments:{type:'array',minItems:1,maxItems:120,items:{type:'string',enum:wordBank}},translation:{type:'string'}},required:['segments','translation'],additionalProperties:false}}},required:['title','sentences'],additionalProperties:false};}
export function decodeStory(raw){
 let data;try{data=typeof raw==='string'?JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')):raw;}catch{throw fault('story_invalid',502);}
 if(!Array.isArray(data?.sentences))return data;
 return{...data,sentences:data.sentences.map(row=>{
  if(!Object.hasOwn(row||{},'segments'))return row;
  if(!Array.isArray(row.segments)||!row.segments.length||row.segments.length>120||row.segments.some(value=>typeof value!=='string'||value.length>180||(!tokens(value,'en').length&&!punctuation.includes(value))))throw fault('story_invalid',502);
  // A free-text field never overrides the constrained segments, including
  // responses from providers that only support basic JSON mode.
  const text=row.segments.join(' ').replace(/\s+([.,!?:;،؟)»”…])/gu,'$1').replace(/([«“(¿¡])\s+/gu,'$1');
  return{text,translation:row.translation};
 })};
}
const canonical=v=>'u_'+encodeURIComponent(v[0]+'_'+v[1]+'_'+v[2].normalize('NFC')).replace(/\./g,'%2E');
const legacy=v=>(v[0]+'_'+v[1]+'_'+v[2]).toLowerCase().replace(/[.#$\[\]\/\s]+/g,'_').replace(/[^a-z0-9_aoubcdefghijklmnopqrstuvwxyz]/gi,'_').slice(0,120);
export function createWordPool(catalog){
 const meanings=new Map();for(const row of catalog){const key=row[0]+'|'+normalize(row[3],'tr');if(!meanings.has(key))meanings.set(key,new Set());meanings.get(key).add(row[2]);}const nativeMeaning=(row,native)=>{if(native==='tr')return row[3];if(typeof row[5]?.[native]==='string')return row[5][native];const matches=meanings.get(native+'|'+normalize(row[3],'tr'));return matches?.size===1?[...matches][0]:'';};
 const counts=new Map();for(const row of catalog){const old=legacy(row);if(!counts.has(old))counts.set(old,new Set());counts.get(old).add(canonical(row));}
 return function(progress,language,native){const pool=new Map(),words=progress?.words||{};
  const add=(w,meaning,category,forms)=>{if(typeof w!=='string'||!w.trim()||w.length>180||/[<>\u0000-\u001f]/u.test(w))return;w=w.normalize('NFKC').replace(/\([^)]*\)/gu,' ').replace(/\s+/gu,' ').trim();if(!w)return;const key=normalize(w,language);if(!pool.has(key)||!pool.get(key).meaning&&meaning)pool.set(key,{w,meaning:String(meaning||'').slice(0,250),...(typeof category==='string'?{category:category.slice(0,128)}:{})});if(Array.isArray(forms)){const safe=forms.filter(value=>typeof value==='string'&&value.trim()&&value.length<=180&&!/[<>\u0000-\u001f]/u.test(value)).slice(0,16);if(safe.length)pool.get(key).forms=[...new Set([...(pool.get(key).forms||[]),...safe])].slice(0,16);}};
  for(const row of catalog){if(language!=='tr'&&row[0]!==language)continue;const known=words[canonical(row)]||(counts.get(legacy(row))?.size===1?words[legacy(row)]:null);if(known?.known===true)add(language==='tr'?row[3]:row[2],language==='tr'&&native===row[0]?row[2]:nativeMeaning(row,native),row[4],row[6]?.[language]);}
  for(const value of Object.values(progress?.notebook||{}))if(value?.lang===language)add(value.w,value.meaningLang===native||!value.meaningLang&&native==='tr'?value.tr:'');
  return [...pool.values()];
 };
}
export function validateOptions(body){if(!LANGUAGES.includes(body.language)||!LANGUAGES.includes(body.native)||body.language===body.native||!GENRES.includes(body.genre)||!STYLES.includes(body.style)||!VOICES.includes(body.voice)||![0,1,2,3].includes(body.level))throw fault('invalid_input',422);if(body.engine!==undefined&&!['auto','reviewed'].includes(body.engine))throw fault('invalid_input',422);if(body.wordsGoal!==undefined&&![20,50,100,200].includes(body.wordsGoal))throw fault('invalid_input',422);return{...(body.wordsGoal?{wordsGoal:body.wordsGoal}:{}),...Object.fromEntries(['language','native','genre','style','voice','level'].map(k=>[k,body[k]])),...(body.engine?{engine:body.engine}:{})};}
export function validateStory(raw,pool,options){
 const data=decodeStory(raw);
 if(!Array.isArray(data?.sentences)||data.sentences.length<4||data.sentences.length>18)throw fault('story_invalid',502);
 const allowed=new Set(pool.flatMap(row=>tokens(row.w,options.language))),used=new Set();let count=0;
 const clean=s=>typeof s==='string'&&s.trim()&&s.length<=700&&!/[<>\u0000-\u001f\u202a-\u202e\u2066-\u2069]/u.test(s);
  const sentences=data.sentences.map(row=>{if(!clean(row?.text)||!clean(row?.translation))throw fault('story_invalid',502);const words=tokens(row.text,options.language);if(!words.length)throw fault('story_invalid',502);const unknown=[...new Set(words.filter(word=>!allowed.has(word)))];if(unknown.length)throw Object.assign(fault('story_unknown_word',502),{unknownWords:unknown.slice(0,30)});for(const word of words)used.add(word);if(tokens(row.translation,options.language).join(' ')===words.join(' '))throw fault('story_invalid',502);const script=options.native==='ar'?/\p{Script=Arabic}/u:options.native==='ru'?/\p{Script=Cyrillic}/u:/\p{Script=Latin}/u;if(!script.test(row.translation))throw fault('story_invalid',502);count+=words.length;return{text:row.text.trim(),translation:row.translation.trim()};});
 if(count<8||count>350||used.size<6)throw fault('story_invalid',502);
 const title=clean(data.title)&&tokens(data.title,options.language).length&&tokens(data.title,options.language).every(w=>allowed.has(w))?data.title.trim():null;
 return{title,sentences,wordCount:count,usedWords:used.size};
}
