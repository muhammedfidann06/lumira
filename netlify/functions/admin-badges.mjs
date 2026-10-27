import {identity} from './_shared/feature-services.mjs';
import {TIERS,fault} from './_shared/feature-core.mjs';
import {withCors} from './_shared/cors.mjs';
import {accountMemberships} from './_shared/memberships.mjs';
const AMOUNTS=TIERS.filter(t=>t.amount>0).map(t=>t.amount);
const AWARDS=['sampiyon','elmas','efsane','nisanci','ates','oncu','bilge','kitapkurdu','birinci','madalya','onur','kelebek'];
const safeKey=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/u.test(value);
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Lumira-Features-Version':'1.11.14'}});
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
    const [page,profiles]=await Promise.all([ctx.auth.listUsers(1000,body.pageToken||undefined),ctx.db.ref('leaderboard').get()]);
    const names=profiles.val()||{};return reply({users:page.users.map(u=>({uid:u.uid,name:String(names[u.uid]?.name||u.displayName||u.uid).slice(0,128)})),nextPageToken:page.pageToken||null});
   }
   if(!['revoke','allow'].includes(body.action))throw fault('invalid_action');
   if(!Array.isArray(body.uids)||!body.uids.length||body.uids.length>100||body.uids.some(u=>!safeKey(u)))throw fault('invalid_input');
   if(typeof body.id!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(body.id))throw fault('invalid_operation');
   const uids=[...new Set(body.uids)],updates={},now=clock(),changed=[];
   if(body.action==='allow'){
    if(!AMOUNTS.includes(body.amount))throw fault('invalid_input');
    const policies=await Promise.all(uids.map(uid=>ctx.db.ref('serverFeatureEntitlements/'+uid+'/'+body.amount).get()));
    uids.forEach((uid,i)=>{if(policies[i].val()===false)updates['serverFeatureEntitlements/'+uid+'/'+body.amount]=null;updates['serverBadgeOptOut/'+uid+'/'+body.amount]=null;updates['serverBadgePolicyVersions/'+uid+'/'+body.amount+'/admin']='allow:'+ctx.uid+':'+body.id;});
   }else{
    if(!['support','award','all'].includes(body.kind))throw fault('invalid_input');
    if(body.kind!=='award'&&body.amount!=='all'&&!AMOUNTS.includes(body.amount))throw fault('invalid_input');
    if(body.kind!=='support'&&body.badge!=='all'&&!AWARDS.includes(body.badge)&&!/^streak[1-9][0-9]{0,4}$/.test(body.badge||''))throw fault('invalid_input');
    // Only badges a person actually holds are removed. Someone without the
    // badge is left untouched: no marker, no "removed" label, nothing to unlock.
    const read=path=>ctx.db.ref(path).get().then(snapshot=>snapshot.val());
    const states=await Promise.all(uids.map(uid=>Promise.all([
     body.kind==='award'?null:Promise.all(['progress/'+uid+'/meta/supportGrants','serverFeatureEntitlements/'+uid,'serverPaddleAccounts/'+uid,'serverPlayAccounts/'+uid,'serverBadgePolicyVersions/'+uid].map(read)),
     body.kind==='support'?null:read('progress/'+uid+'/meta/awards')
    ])));
    uids.forEach((uid,i)=>{
     const[support,awards]=states[i];let touched=false;
     if(support){
      const[grants,verified,billing,play,policies]=support.map(value=>value||{});
      // A badge the person hid themselves still counts as held.
      const held=new Set(accountMemberships(grants,verified,billing,{},now,play,policies).memberships.filter(row=>row.active).map(row=>row.amount));
      for(const amount of body.amount==='all'?AMOUNTS:[body.amount])if(held.has(amount)){
       updates['serverFeatureEntitlements/'+uid+'/'+amount]=false;
       if(grants[amount]===true)updates['progress/'+uid+'/meta/supportGrants/'+amount]=false;
       updates['serverBadgePolicyVersions/'+uid+'/'+amount+'/admin']='revoke:'+ctx.uid+':'+body.id;touched=true;
      }
     }
     if(awards!==null){
      const owned=awards||{};
      for(const badge of body.badge==='all'?Object.keys(owned):[body.badge])if(safeKey(badge)&&owned[badge]&&owned[badge].removed!==true){updates['progress/'+uid+'/meta/awards/'+badge]={removed:true,ts:now};touched=true;}
     }
     if(touched)changed.push(uid);
    });
   }
   updates['serverAdminBadgeOperations/'+ctx.uid+'/'+body.id]={action:body.action,kind:body.kind||'support',amount:body.amount||null,badge:body.badge||null,uids,at:now};
   await ctx.db.ref().update(updates);
   return reply({processed:uids.length,changed:body.action==='revoke'?changed.length:uids.length});
  }catch(error){return reply({error:error.code||'admin_unavailable'},error.status||503);}
 });
}
export default createAdminBadgesHandler();
