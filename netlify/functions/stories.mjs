import {createHash,randomUUID} from 'node:crypto';import catalog from './_shared/story-sources.json' with {type:'json'};
import {identity} from './_shared/feature-services.mjs';import {fault} from './_shared/feature-core.mjs';import {withCors} from './_shared/cors.mjs';import {atomic} from './_shared/paddle-events.mjs';import {createWordPool,LANGUAGES,validateOptions,validateStory,tokens} from './_shared/story-core.mjs';import {generateStory} from './_shared/story-providers.mjs';
const poolFor=createWordPool(catalog),idOK=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(id);
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Lumira-Features-Version':'1.10.0'}});
export function createStoriesHandler(services={identity,generateStory,wordPool:poolFor},clock=Date.now){return withCors(async request=>{
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405);let lock,owner=randomUUID();
 try{const raw=await request.text();if(raw.length>5000)throw fault('invalid_input',413);let body;try{body=JSON.parse(raw);}catch{throw fault('invalid_input');}if(!body||!['pool','generate','list','get','delete'].includes(body.action))throw fault('invalid_action');
  const ctx=await services.identity(request),base='serverStories/'+ctx.uid+'/';
  if(body.action==='list'){const all=(await ctx.db.ref('serverStoryIndex/'+ctx.uid).get()).val()||{};return reply({stories:Object.entries(all).map(([id,s])=>({id,...s})).sort((a,b)=>b.createdAt-a.createdAt).slice(0,20)});}
  if(['get','delete'].includes(body.action)){if(!idOK(body.id))throw fault('invalid_input');const ref=ctx.db.ref(base+body.id),story=(await ref.get()).val();if(!story)throw fault('story_not_found',404);if(body.action==='delete'){await ctx.db.ref().update({[base+body.id]:null,['serverStoryIndex/'+ctx.uid+'/'+body.id]:null});return reply({deleted:true});}return reply({story});}
  if(!LANGUAGES.includes(body.language)||!LANGUAGES.includes(body.native)||body.language===body.native)throw fault('invalid_input',422);
  const [words,notebook]=await Promise.all([ctx.db.ref('progress/'+ctx.uid+'/words').get(),ctx.db.ref('progress/'+ctx.uid+'/notebook').get()]);const pool=(services.wordPool||poolFor)({words:words.val(),notebook:notebook.val()},body.language,body.native).slice(0,600);
  if(body.action==='pool')return reply({pool});const options=validateOptions(body);if(!idOK(body.id))throw fault('invalid_operation');
  if(new Set(pool.flatMap(r=>tokens(r.w,body.language))).size<12)throw fault('story_more_words',422);
  const hash=createHash('sha256').update(JSON.stringify(options)).digest('hex');lock=ctx.db.ref('serverStoryRequests/'+ctx.uid+'/'+body.id);const old=(await lock.get()).val();if(old?.hash&&old.hash!==hash)throw fault('invalid_operation',409);if(old?.complete){const story=(await ctx.db.ref(base+body.id).get()).val();if(story)return reply({story});throw fault('story_not_found',404);}
  await atomic(lock,value=>{if(value?.hash&&value.hash!==hash)throw fault('invalid_operation',409);if(value?.complete||value?.until>clock())throw fault('story_busy',409);return{hash,owner,until:clock()+60000};});
  await atomic(ctx.db.ref('serverStoryBudget/'+ctx.uid),value=>{const starts=(Array.isArray(value?.starts)?value.starts:[]).filter(t=>Number.isFinite(t)&&t>clock()-60000);if(starts.length>=3)throw fault('story_busy',429);return{starts:[...starts,clock()]};});
  const result=await services.generateStory(pool,options),checked=validateStory(result,pool,options);
  const lines=checked.sentences.map(row=>' '+tokens(row.text,options.language).join(' ')+' '),usedPool=pool.filter(row=>lines.some(line=>line.includes(' '+tokens(row.w,options.language).join(' ')+' ')));
  const story={...checked,id:body.id,options,createdAt:clock(),pool:usedPool},index={title:checked.title,options,createdAt:story.createdAt,wordCount:story.wordCount};
  await ctx.db.ref().update({[base+body.id]:story,['serverStoryIndex/'+ctx.uid+'/'+body.id]:index,['serverStoryRequests/'+ctx.uid+'/'+body.id]:{hash,owner,complete:true}});
  const all=(await ctx.db.ref('serverStoryIndex/'+ctx.uid).get()).val()||{},expired=Object.entries(all).sort((a,b)=>b[1].createdAt-a[1].createdAt).slice(20);if(expired.length){const remove={};for(const[id]of expired){remove[base+id]=null;remove['serverStoryIndex/'+ctx.uid+'/'+id]=null;}await ctx.db.ref().update(remove);}
  return reply({story});
 }catch(error){return reply({error:error.code||'story_unavailable'},error.status||503);}finally{if(lock)try{await atomic(lock,value=>value?.owner===owner&&!value.complete?{hash:value.hash,failed:true}:value);}catch{}}
 });}
export default createStoriesHandler();
