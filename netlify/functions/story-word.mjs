import {authenticatedIdentity} from './_shared/feature-services.mjs';
import {fault} from './_shared/feature-core.mjs';
import {withCors} from './_shared/cors.mjs';
import {assertAvailable} from './_shared/maintenance.mjs';
import {contextualMeaning} from './_shared/story-meaning.mjs';
import {storyWord} from './_shared/story-word.mjs';
// Word lookups for saved stories. Unlike the stories endpoint this bundle does
// not contain the 6.8 MB story catalog, so a cold start answers a tap faster.
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export function createStoryWordHandler(services={identity:authenticatedIdentity,meaning:contextualMeaning},clock=Date.now){return withCors(async request=>{
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
 try{
  const raw=await request.text();if(raw.length>2000)throw fault('invalid_input',413);
  let body;try{body=JSON.parse(raw);}catch{throw fault('invalid_input');}
  if(!body||body.action!=='word')throw fault('invalid_action');
  const ctx=await services.identity(request);
  await(services.assertAvailable||assertAvailable)(ctx,'stories');
  return reply(await storyWord(ctx,body,{meaning:services.meaning||contextualMeaning,clock}));
 }catch(error){return reply({error:error.code||'story_unavailable'},error.status||503);}
});}
export default createStoryWordHandler();
