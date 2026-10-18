import {identity} from './_shared/feature-services.mjs';
import {TIERS,fault} from './_shared/feature-core.mjs';
import {withCors} from './_shared/cors.mjs';
const AMOUNTS=TIERS.filter(t=>t.amount>0).map(t=>t.amount);
const AWARDS=['sampiyon','elmas','efsane','nisanci','ates','oncu','bilge','kitapkurdu','birinci','madalya','onur','kelebek'];
const safeKey=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/u.test(value);
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Lumira-Features-Version':'1.9.8'}});
export function createAdminBadgesHandler(services={identity},clock=Date.now){
 return withCors(async request=>{
  if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
  try{
   const raw=await request.text();if(raw.length>40000)throw fault('invalid_input',413);
   let body;try{body=JSON.parse(raw);}catch{throw fault('invalid_input');}
   if(!body||typeof body!=='object'||Array.isArray(body))throw fault('invalid_input');
   const ctx=await services.identity(request);
   if((await ctx.db.ref('admins/'+ctx.uid).get()).val()!==true)throw fault('admin_required',403);
   if(body.action==='list'){
    if(body.pageToken!==undefined&&(typeof body.pageToken!=='string'||body.pageToken.length>10000))throw fault('invalid_input');
    const page=await ctx.auth.listUsers(1000,body.pageToken||undefined);
    return reply({users:page.users.map(u=>({uid:u.uid,name:u.displayName||u.uid})),nextPageToken:page.pageToken||null});
   }
   if(!['revoke','allow'].includes(body.action))throw fault('invalid_action');
   if(!Array.isArray(body.uids)||!body.uids.length||body.uids.length>100||body.uids.some(u=>!safeKey(u)))throw fault('invalid_input');
   if(typeof body.id!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(body.id))throw fault('invalid_operation');
   const uids=[...new Set(body.uids)],updates={},now=clock();
   if(body.action==='allow'){
    if(!AMOUNTS.includes(body.amount))throw fault('invalid_input');
    const policies=await Promise.all(uids.map(uid=>ctx.db.ref('serverFeatureEntitlements/'+uid+'/'+body.amount).get()));
    uids.forEach((uid,i)=>{if(policies[i].val()===false)updates['serverFeatureEntitlements/'+uid+'/'+body.amount]=null;});
   }else{
    if(!['support','award','all'].includes(body.kind))throw fault('invalid_input');
    if(body.kind!=='award'&&body.amount!=='all'&&!AMOUNTS.includes(body.amount))throw fault('invalid_input');
    if(body.kind!=='support'&&body.badge!=='all'&&!AWARDS.includes(body.badge)&&!/^streak[1-9][0-9]{0,4}$/.test(body.badge||''))throw fault('invalid_input');
    const awards=body.kind!=='support'&&body.badge==='all'?await Promise.all(uids.map(uid=>ctx.db.ref('progress/'+uid+'/meta/awards').get())):[];
    uids.forEach((uid,i)=>{
     if(body.kind!=='award')for(const amount of body.amount==='all'?AMOUNTS:[body.amount]){
      updates['serverFeatureEntitlements/'+uid+'/'+amount]=false;
      updates['progress/'+uid+'/meta/supportGrants/'+amount]=false;
     }
     if(body.kind!=='support')for(const badge of body.badge==='all'?[...new Set([...AWARDS,...Object.keys(awards[i].val()||{})])]:[body.badge]){
      if(safeKey(badge))updates['progress/'+uid+'/meta/awards/'+badge]={removed:true,ts:now};
     }
    });
   }
   updates['serverAdminBadgeOperations/'+ctx.uid+'/'+body.id]={action:body.action,kind:body.kind||'support',amount:body.amount||null,badge:body.badge||null,uids,at:now};
   await ctx.db.ref().update(updates);
   return reply({processed:uids.length});
  }catch(error){return reply({error:error.code||'admin_unavailable'},error.status||503);}
 });
}
export default createAdminBadgesHandler();
