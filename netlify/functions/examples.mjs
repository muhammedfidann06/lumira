import {createHash,randomUUID} from 'node:crypto';
import sources from './_shared/example-sources.json' with {type:'json'};
import {identity} from './_shared/feature-services.mjs';
import {fault} from './_shared/feature-core.mjs';
import {EXAMPLE_LANGUAGES,translateExamples,validExample,changeExampleBudget} from './_shared/example-translation.mjs';

const allowed=new Map(Object.entries(sources).map(([lang,texts])=>[lang,new Set(texts)]));
const HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Lumira-Examples-Version':'1.9.6'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const hash=text=>createHash('sha256').update(text).digest('hex');
async function transaction(ref,update){
  const listener=()=>{};ref.on('value',listener);
  try{await ref.get();let reason;const result=await ref.transaction(value=>{reason=null;try{return update(value);}catch(e){reason=e;return;}},undefined,false);if(!result.committed)throw reason||fault('examples_busy',429);return result.snapshot.val();}
  finally{ref.off('value',listener);}
}
export function createExamplesHandler(services={identity,translateExamples},clock=Date.now){
  return async request=>{
    if(request.method!=='POST')return response({error:'method_not_allowed'},405);
    const origin=request.headers.get('origin');if((origin && origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')return response({error:'cross_origin_request'},403);
    let locks=[],ctx,owner=randomUUID(),resolved=[],sourceLanguage,targetLanguage;
    try{
      if(Number(request.headers.get('content-length'))>30000)throw fault('invalid_input',413);
      const raw=await request.text();if(raw.length>20000)throw fault('invalid_input',413);
      let body;try{body=JSON.parse(raw);}catch{throw fault('invalid_input',422);}
      if(!body || !EXAMPLE_LANGUAGES.includes(body.source) || !EXAMPLE_LANGUAGES.includes(body.target) || body.source===body.target || !Array.isArray(body.texts) || !body.texts.length || body.texts.length>6)throw fault('invalid_input',422);
      const texts=[...new Set(body.texts)];
      if(texts.some(text=>typeof text!=='string'||text.length>2000||!allowed.get(body.source)?.has(text)))throw fault('unknown_example',422);
      sourceLanguage=body.source;targetLanguage=body.target;
      ctx=await services.identity(request);
      const base='serverExampleTranslations/v1/'+body.source+'/'+body.target+'/';
      const rows=await Promise.all(texts.map(async sourceText=>{
        const key=hash(sourceText),ref=ctx.db.ref(base+key),value=(await ref.get()).val();
        if(value?.sourceText===sourceText && validExample(sourceText,value.text,body.target,body.source))return{sourceText,translation:value.text,kind:'automatic'};
        return{sourceText,key,ref};
      }));
      const missing=rows.filter(row=>!row.translation);
      resolved=rows;
      if(!missing.length)return response({source:body.source,target:body.target,examples:rows});
      // Cache hits never spend inference budget or touch purchased writing/audio allowances.
      await transaction(ctx.db.ref('serverExampleBudget/users/'+ctx.uid),value=>changeExampleBudget(value,'user',1,clock()));
      const work=[];
      for(const row of missing){
        const ref=ctx.db.ref('serverExampleLocks/v1/'+body.source+'/'+body.target+'/'+row.key);
        try{await transaction(ref,value=>{if(value?.until>clock())throw fault('examples_busy',429);return{owner,until:clock()+30000};});locks.push(ref);work.push(row);}catch(e){if(e.code!=='examples_busy')throw e;}
      }
      if(work.length){
        await transaction(ctx.db.ref('serverExampleBudget/project'),value=>changeExampleBudget(value,'project',work.length,clock()));
        // Another request may have filled an entry immediately before this lock.
        const pending=[];
        for(const row of work){const cached=(await row.ref.get()).val();if(cached?.sourceText===row.sourceText && validExample(row.sourceText,cached.text,body.target,body.source))row.translation=cached.text;else pending.push(row);}
        if(pending.length){
          const translated=await services.translateExamples(pending.map(row=>row.sourceText),body.source,body.target);
          for(const [id,value]of translated){
            const row=pending[id];if(!row || !validExample(row.sourceText,value.text,body.target,body.source))continue;
            await row.ref.set({sourceText:row.sourceText,text:value.text,provider:value.provider,createdAt:clock()});row.translation=value.text;
          }
        }
      }
      const examples=rows.filter(row=>row.translation).map(row=>({sourceText:row.sourceText,translation:row.translation,kind:'automatic'}));
      return response({source:body.source,target:body.target,examples,pending:examples.length<texts.length},examples.length?200:202);
    }catch(e){
      const examples=resolved.filter(row=>row.translation).map(row=>({sourceText:row.sourceText,translation:row.translation,kind:'automatic'}));
      if(examples.length)return response({source:sourceLanguage,target:targetLanguage,examples,pending:false});
      return response({error:['login_required','invalid_input','unknown_example','examples_busy','cross_origin_request'].includes(e.code)?e.code:'examples_unavailable'},e.status||503);
    }
    finally{for(const ref of locks)try{await transaction(ref,value=>value?.owner===owner?null:value);}catch{ /* Lock also expires after 30 seconds. */ }}
  };
}
export default createExamplesHandler();
