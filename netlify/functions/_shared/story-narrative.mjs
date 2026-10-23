import {fault} from './feature-core.mjs';
import {normalize,tokens} from './story-core.mjs';
const string={type:'string'};
const array=(items,minItems,maxItems)=>({type:'array',items,minItems,maxItems});
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const narrativeSchema=object({
 title:string,
 sentences:array(object({text:string,translation:string}),6,12),
 focus:array(object({word:string,forms:array(string,1,6),meaning:string}),3,12),
 glossary:array(object({word:string,meaning:string}),0,90),
 questions:array(object({question:string,choices:array(string,3,3),answer:{type:'integer',minimum:0,maximum:2},evidence:{type:'integer',minimum:0,maximum:11}}),3,3)
});
const clean=(value,max=700)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[<>\u0000-\u001f\u202a-\u202e\u2066-\u2069]/u.test(value);
const script=lang=>lang==='ar'?/\p{Script=Arabic}/u:lang==='ru'?/\p{Script=Cyrillic}/u:/\p{Script=Latin}/u;
const contains=(text,form,lang)=>(' '+tokens(text,lang).join(' ')+' ').includes(' '+tokens(form,lang).join(' ')+' ');
function parse(raw){try{if(typeof raw!=='string')return raw;if(raw.length>60000)throw Error();return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw fault('story_invalid',502);}}
export function validateNarrative(raw,pool,options,{reviewed=false}={}){
 const data=parse(raw),language=options.language,native=options.native;
 if(!clean(data?.title,150)||!script(language).test(data.title)||!Array.isArray(data.sentences)||data.sentences.length<6||data.sentences.length>12)throw fault('story_invalid',502);
 let count=0;const sentences=data.sentences.map(row=>{
  if(!clean(row?.text)||!clean(row?.translation)||!script(language).test(row.text)||!script(native).test(row.translation))throw fault('story_invalid',502);
  const words=tokens(row.text,language);if(words.length<3||normalize(row.text,language)===normalize(row.translation,native))throw fault('story_invalid',502);
  count+=words.length;return{text:row.text.trim(),translation:row.translation.trim()};
 });
 // Reject padded greetings, repeated filler and nominal word lists. Structural
 // checks cannot certify a model's grammar; the reviewed fallback is separate.
 if(count<30||count>300||new Set(sentences.map(row=>normalize(row.text,language))).size!==sentences.length)throw fault('story_invalid',502);
 const full=sentences.map(row=>row.text).join(' '),known=new Map(pool.map(row=>[normalize(row.w,language),row]));
 if(!Array.isArray(data.focus)||data.focus.length>12)throw fault('story_invalid',502);
 const focus=[],seen=new Set();
 for(const item of data.focus){
  const entry=typeof item?.word==='string'?known.get(normalize(item.word,language)):null;
  if(!entry||seen.has(normalize(entry.w,language))||!Array.isArray(item.forms)||item.forms.length<1||item.forms.length>6)throw fault('story_invalid',502);
  const forms=[...new Set(item.forms)];if(forms.some(form=>!clean(form,180)||!tokens(form,language).length||!contains(full,form,language)))throw fault('story_invalid',502);
  const meaning=entry.meaning||item.meaning;
  if(!clean(meaning,250)||!script(native).test(meaning))throw fault('story_invalid',502);
  seen.add(normalize(entry.w,language));focus.push({word:entry.w,forms,meaning});
 }
 if(focus.length<(reviewed?1:3))throw fault('story_vocabulary',502);
 if(!Array.isArray(data.glossary)||data.glossary.length>90)throw fault('story_invalid',502);
 const glossary=[],glossed=new Set();for(const item of data.glossary){
  if(!clean(item?.word,180)||!clean(item?.meaning,250)||!script(native).test(item.meaning)||!contains(full,item.word,language))throw fault('story_invalid',502);
  const key=normalize(item.word,language);if(!glossed.has(key)){glossed.add(key);glossary.push({word:item.word,meaning:item.meaning});}
 }
 if(!Array.isArray(data.questions)||data.questions.length!==3)throw fault('story_invalid',502);
 const questions=data.questions.map(row=>{
  if(!clean(row?.question,300)||!script(native).test(row.question)||!Array.isArray(row.choices)||row.choices.length!==3||row.choices.some(value=>!clean(value,700)||!script(native).test(value))||new Set(row.choices.map(value=>normalize(value,native))).size!==3||!Number.isInteger(row.answer)||row.answer<0||row.answer>2||!Number.isInteger(row.evidence)||row.evidence<0||row.evidence>=sentences.length)throw fault('story_invalid',502);
  return{question:row.question.trim(),choices:row.choices.map(value=>value.trim()),answer:row.answer,evidence:row.evidence,quote:sentences[row.evidence].text};
 });
 if(new Set(questions.map(row=>row.evidence)).size!==3)throw fault('story_invalid',502);
 return{format:'narrative',title:data.title.trim(),sentences,focus,glossary,questions,wordCount:count,usedWords:focus.length};
}
