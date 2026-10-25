import {fault} from './feature-core.mjs';
import {normalize,tokens} from './story-core.mjs';
import {buildComprehension} from './story-quiz.mjs';
const string={type:'string'};
const array=(items,minItems,maxItems)=>({type:'array',items,minItems,maxItems});
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const narrativeSchema=object({
 title:string,
 sentences:array(object({text:string,translation:string}),12,100),
 focus:array(object({word:string,forms:array(string,1,6),meaning:string}),8,220),
 glossary:array(object({word:string,meaning:string}),0,300)
});
const clean=(value,max=700)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[<>\u0000-\u001f\u202a-\u202e\u2066-\u2069]/u.test(value);
const script=lang=>lang==='ar'?/\p{Script=Arabic}/u:lang==='ru'?/\p{Script=Cyrillic}/u:/\p{Script=Latin}/u;
const contains=(text,form,lang)=>(' '+tokens(text,lang).join(' ')+' ').includes(' '+tokens(form,lang).join(' ')+' ');
function parse(raw){try{if(typeof raw!=='string')return raw;if(raw.length>220000)throw Error();return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw fault('story_invalid',502);}}
export function validateNarrative(raw,pool,options,{reviewed=false}={}){
 const data=parse(raw),language=options.language,native=options.native;
 if(!clean(data?.title,150)||!script(language).test(data.title)||!Array.isArray(data.sentences)||data.sentences.length<(reviewed?6:12)||data.sentences.length>100)throw fault('story_invalid',502);
 let count=0;const sentences=data.sentences.map(row=>{
  if(!clean(row?.text)||!clean(row?.translation)||!script(language).test(row.text)||!script(native).test(row.translation))throw fault('story_invalid',502);
  const words=tokens(row.text,language);if(words.length<(reviewed?1:3)||normalize(row.text,language)===normalize(row.translation,native))throw fault('story_invalid',502);
  count+=words.length;return{text:row.text.trim(),translation:row.translation.trim()};
 });
 // Reject padded greetings, repeated filler and nominal word lists. Structural
 // checks cannot certify a model's grammar; the reviewed fallback is separate.
 const unique=new Set(),duplicates=[];for(const row of sentences){const key=normalize(row.text,language);if(unique.has(key))duplicates.push(row.text);unique.add(key);}
 const naturalShortRepetition=reviewed&&duplicates.length<=2&&duplicates.every(text=>tokens(text,language).length<=8);
 if(count<(reviewed?30:[120,150,180,220][options.level||0])||count>3000||duplicates.length&&!naturalShortRepetition)throw fault('story_invalid',502);
 const full=sentences.map(row=>row.text).join(' '),known=new Map(pool.map(row=>[normalize(row.w,language),row]));
 if(!Array.isArray(data.focus)||data.focus.length>220)throw fault('story_invalid',502);
 const focus=[],seen=new Set(),usedForms=new Set();
 for(const item of data.focus){
  const entry=typeof item?.word==='string'?known.get(normalize(item.word,language)):null;
  if(!entry||seen.has(normalize(entry.w,language))||!Array.isArray(item.forms)||item.forms.length<1||item.forms.length>6)throw fault('story_invalid',502);
  const forms=[...new Set(item.forms)];if(forms.some(form=>!clean(form,180)||!tokens(form,language).length||!contains(full,form,language)||usedForms.has(normalize(form,language))))throw fault('story_invalid',502);
  const meaning=entry.meaning||item.meaning;
  if(!clean(meaning,250)||!script(native).test(meaning))throw fault('story_invalid',502);
  for(const form of forms)usedForms.add(normalize(form,language));seen.add(normalize(entry.w,language));focus.push({word:entry.w,forms,meaning});
 }
 if(focus.length<(reviewed?1:Math.min(12,pool.length)))throw fault('story_vocabulary',502);
 if(!Array.isArray(data.glossary)||data.glossary.length>300)throw fault('story_invalid',502);
 const glossary=[],glossed=new Set();for(const item of data.glossary){
  if(!clean(item?.word,180)||!clean(item?.meaning,250)||!script(native).test(item.meaning)||!contains(full,item.word,language))throw fault('story_invalid',502);
  const key=normalize(item.word,language);if(!glossed.has(key)){glossed.add(key);glossary.push({word:item.word,meaning:item.meaning});}
 }
 const questions=buildComprehension({sentences,focus},options,{reviewed});if(questions.length!==3)throw fault('story_invalid',502);
 return{format:'narrative',title:data.title.trim(),sentences,focus,glossary,questions,wordCount:count,usedWords:focus.length};
}
