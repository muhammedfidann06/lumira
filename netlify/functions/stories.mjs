import {validateNarrative} from './_shared/story-narrative.mjs';
import {storyPlan} from './_shared/story-plans.mjs';
import {contextualMeaning,validateWordMeaning} from './_shared/story-meaning.mjs';
import {createHash,randomUUID} from 'node:crypto';import catalog from './_shared/story-sources.json' with {type:'json'};
import{assertAvailable}from'./_shared/maintenance.mjs';
import {identity} from './_shared/feature-services.mjs';import {fault} from './_shared/feature-core.mjs';import {withCors} from './_shared/cors.mjs';import {atomic} from './_shared/paddle-events.mjs';import {createWordPool,LANGUAGES,validateOptions,validateStory,tokens} from './_shared/story-core.mjs';import {generateStory} from './_shared/story-providers.mjs';
const poolFor=createWordPool(catalog),idOK=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(id);
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Lumira-Features-Version':'1.11.7'}});
export function createStoriesHandler(services={identity,generateStory,wordPool:poolFor},clock=Date.now){return withCors(async request=>{
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405);let lock,owner=randomUUID();
 try{const raw=await request.text();if(raw.length>5000)throw fault('invalid_input',413);let body;try{body=JSON.parse(raw);}catch{throw fault('invalid_input');}if(!body||!['pool','generate','list','get','delete','word'].includes(body.action))throw fault('invalid_action');
  const ctx=await services.identity(request),base='serverStories/'+ctx.uid+'/';
  if(body.action!=='delete')await(services.assertAvailable||assertAvailable)(ctx,'stories');
  if(body.action==='word'){
   if(!idOK(body.id)||!Number.isInteger(body.sentence)||body.sentence<0||body.sentence>99||!Number.isInteger(body.position)||body.position<0||body.position>3000)throw fault('invalid_input',422);
   const story=(await ctx.db.ref(base+body.id).get()).val(),sentence=story?.sentences?.[body.sentence];if(!story||!sentence)throw fault('story_not_found',404);
   const word=sentence.text.match(/[\p{L}\p{M}]+(?:['’ʼ-][\p{L}\p{M}]+)*|\p{N}+/gu)?.[body.position];if(!word)throw fault('invalid_input',422);
   const input={word,position:body.position,language:story.options.language,native:story.options.native,sentence:sentence.text,translation:sentence.translation},ref=ctx.db.ref('serverStoryWordMeanings/'+ctx.uid+'/'+body.id+'/'+body.sentence+'_'+body.position),cached=(await ref.get()).val();
   if(cached&&validateWordMeaning(cached,input))return reply({...cached,contextual:true});
   await atomic(ctx.db.ref('serverStoryWordBudget/'+ctx.uid),value=>{const starts=(Array.isArray(value?.starts)?value.starts:[]).filter(time=>Number.isFinite(time)&&time>clock()-60000);if(starts.length>=60)throw fault('story_busy',429);return{starts:[...starts,clock()]};});
   const result=validateWordMeaning(await(services.meaning||contextualMeaning)(input),input);if(result){await ref.set(result);return reply({...result,contextual:true});}return reply({word,meaning:'',contextual:false});
  }
  if(body.action==='list'){const all=(await ctx.db.ref('serverStoryIndex/'+ctx.uid).get()).val()||{};return reply({stories:Object.entries(all).map(([id,s])=>({id,...s})).sort((a,b)=>b.createdAt-a.createdAt).slice(0,20)});}
  if(['get','delete'].includes(body.action)){if(!idOK(body.id))throw fault('invalid_input');const ref=ctx.db.ref(base+body.id),story=(await ref.get()).val();if(!story)throw fault('story_not_found',404);if(body.action==='delete'){await ctx.db.ref().update({[base+body.id]:null,['serverStoryIndex/'+ctx.uid+'/'+body.id]:null,['serverStoryWordMeanings/'+ctx.uid+'/'+body.id]:null});return reply({deleted:true});}return reply({story});}
  if(!LANGUAGES.includes(body.language)||!LANGUAGES.includes(body.native)||body.language===body.native)throw fault('invalid_input',422);
  const [words,notebook]=await Promise.all([ctx.db.ref('progress/'+ctx.uid+'/words').get(),ctx.db.ref('progress/'+ctx.uid+'/notebook').get()]);const pool=(services.wordPool||poolFor)({words:words.val(),notebook:notebook.val()},body.language,body.native);
  if(body.action==='pool')return reply({pool:pool.slice(0,4000),total:pool.length});const options=validateOptions(body);if(!idOK(body.id))throw fault('invalid_operation');
  if(new Set(pool.flatMap(r=>tokens(r.w,body.language))).size<12)throw fault('story_more_words',422);
  const hash=createHash('sha256').update(JSON.stringify(options)).digest('hex');lock=ctx.db.ref('serverStoryRequests/'+ctx.uid+'/'+body.id);const old=(await lock.get()).val();if(old?.hash&&old.hash!==hash)throw fault('invalid_operation',409);if(old?.complete){const story=(await ctx.db.ref(base+body.id).get()).val();if(story)return reply({story});throw fault('story_not_found',404);}
  await atomic(lock,value=>{if(value?.hash&&value.hash!==hash)throw fault('invalid_operation',409);if(value?.complete||value?.until>clock())throw fault('story_busy',409);return{hash,owner,until:clock()+60000};});
  await atomic(ctx.db.ref('serverStoryBudget/'+ctx.uid),value=>{const starts=(Array.isArray(value?.starts)?value.starts:[]).filter(t=>Number.isFinite(t)&&t>clock()-60000);if(starts.length>=3)throw fault('story_busy',429);return{starts:[...starts,clock()]};});
  let planIndex=old?.planIndex;
  const rotation=ctx.db.ref('serverStoryRotation/'+ctx.uid+'/'+options.language+'/'+options.genre);
  if(!Number.isSafeInteger(planIndex)){
   const sequence=await atomic(rotation,value=>({...value,next:(Number.isSafeInteger(value?.next)?value.next:0)+1}));planIndex=sequence.next-1;await lock.update({planIndex});
  }
  const offset=parseInt(createHash('sha256').update(ctx.uid+'|'+options.language+'|'+options.genre).digest('hex').slice(0,6),16)%100,plan=storyPlan(options.genre,planIndex,offset);
  const prior=(await ctx.db.ref('serverStoryIndex/'+ctx.uid).get()).val()||{},recent=Object.values(prior).filter(row=>row.options?.language===options.language).sort((a,b)=>b.createdAt-a.createdAt).slice(0,20);
  const generationOptions={...options,plan,recentTitles:recent.map(row=>row.title),recentFingerprints:recent.map(row=>row.fingerprint).filter(Boolean),sequence:planIndex};
  const result=await services.generateStory(pool,generationOptions),checked=result.format==='narrative'?validateNarrative(result,pool,options,{reviewed:result.method==='reviewed'}):validateStory(result,pool,options);
  const lines=checked.sentences.map(row=>' '+tokens(row.text,options.language).join(' ')+' '),usedPool=pool.filter(row=>lines.some(line=>line.includes(' '+tokens(row.w,options.language).join(' ')+' ')));
  const fingerprint=createHash('sha256').update(checked.sentences.map(row=>row.text).join('\n')).digest('hex');
  if(recent.some(row=>row.fingerprint===fingerprint))throw fault('story_repeated',502);
  const story={...checked,method:result.method==='reviewed'?'reviewed':'ai',id:body.id,options,themeId:plan.id,planIndex,coverId:plan.id,createdAt:clock(),pool:result.format==='narrative'?checked.focus.map(row=>({w:row.word,meaning:row.meaning})):usedPool},index={title:checked.title,options,themeId:plan.id,fingerprint,createdAt:story.createdAt,wordCount:story.wordCount};
  await ctx.db.ref().update({[base+body.id]:story,['serverStoryIndex/'+ctx.uid+'/'+body.id]:index,['serverStoryRequests/'+ctx.uid+'/'+body.id]:{hash,owner,complete:true}});
  const all=(await ctx.db.ref('serverStoryIndex/'+ctx.uid).get()).val()||{},expired=Object.entries(all).sort((a,b)=>b[1].createdAt-a[1].createdAt).slice(20);if(expired.length){const remove={};for(const[id]of expired){remove[base+id]=null;remove['serverStoryIndex/'+ctx.uid+'/'+id]=null;remove['serverStoryWordMeanings/'+ctx.uid+'/'+id]=null;}await ctx.db.ref().update(remove);}
  return reply({story});
 }catch(error){return reply({error:error.code||'story_unavailable'},error.status||503);}finally{if(lock)try{await atomic(lock,value=>value?.owner===owner&&!value.complete?{...value,until:0,failed:true}:value);}catch{}}
 });}
export default createStoriesHandler();
