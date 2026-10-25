import {identity} from './_shared/feature-services.mjs';
import {fault} from './_shared/feature-core.mjs';
import {atomic} from './_shared/paddle-events.mjs';
import {withCors} from './_shared/cors.mjs';
const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(value);
const safeUid=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[.#$/\[\]\u0000-\u001f]/u.test(value);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value);
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export function createAnnouncementsHandler(services={identity},clock=Date.now){return withCors(async request=>{
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
 try{
  const raw=await request.text();if(raw.length>8000)throw fault('invalid_input',413);
  let body;try{body=JSON.parse(raw);}catch{throw fault('invalid_input');}
  if(!body||!['create','inbox','claim','ack','history'].includes(body.action))throw fault('invalid_action');
  const ctx=await services.identity(request),now=clock();
  const publicRef=ctx.db.ref('serverAnnouncements/broadcast'),personalRef=ctx.db.ref('serverAnnouncements/users/'+ctx.uid),readsRef=ctx.db.ref('serverAnnouncementReads/'+ctx.uid);
  const recent=async ref=>{const query=ref.orderByChild?ref.orderByChild('createdAt').limitToLast(100):ref;return(await query.get()).val()||{};};
  if(['create','history'].includes(body.action)){
   if((await ctx.db.ref('admins/'+ctx.uid).get()).val()!==true)throw fault('admin_required',403);
   if(body.action==='history')return reply({messages:Object.entries(await recent(ctx.db.ref('serverAnnouncementAudit'))).map(([id,row])=>({id,...row})).sort((a,b)=>b.createdAt-a.createdAt).slice(0,50)});
   if(!safeId(body.id)||!text(body.title,100)||!text(body.message,1600)||!['all','one'].includes(body.scope))throw fault('invalid_input');
   if(body.scope==='one'){
    if(!safeUid(body.uid))throw fault('invalid_input');
    try{await ctx.auth.getUser(body.uid);}catch{throw fault('user_not_found',404);}
   }
   const ref=ctx.db.ref('serverAnnouncementAudit/'+body.id),notice={title:body.title.trim(),message:body.message.trim(),scope:body.scope,...(body.scope==='one'?{uid:body.uid}:{}),createdAt:now,expiresAt:now+90*86400000,createdBy:ctx.uid};
   await atomic(ref,old=>{
    if(old){if(old.createdBy!==ctx.uid||old.title!==notice.title||old.message!==notice.message||old.scope!==notice.scope||old.uid!==notice.uid)throw fault('invalid_operation',409);return old;}
    return notice;
   });
   const saved=(await ref.get()).val();
   await ctx.db.ref((saved.scope==='all'?'serverAnnouncements/broadcast/':'serverAnnouncements/users/'+saved.uid+'/')+body.id).set(saved);
   return reply({id:body.id,sent:true});
  }
  if(body.action==='inbox'){
   const[all,personal,reads]=await Promise.all([recent(publicRef),recent(personalRef),readsRef.get().then(s=>s.val()||{})]);
   return reply({messages:Object.entries({...all,...personal}).filter(([id,row])=>safeId(id)&&row.expiresAt>now&&!reads[id]?.seenAt&&!(reads[id]?.until>now)).sort((a,b)=>a[1].createdAt-b[1].createdAt).slice(0,10).map(([id,row])=>({id,title:row.title,message:row.message,createdAt:row.createdAt}))});
  }
  if(!safeId(body.id))throw fault('invalid_input');
  const[all,personal]=await Promise.all([publicRef.child?publicRef.child(body.id).get():ctx.db.ref('serverAnnouncements/broadcast/'+body.id).get(),ctx.db.ref('serverAnnouncements/users/'+ctx.uid+'/'+body.id).get()]);
  const notice=personal.val()||all.val();if(!notice||notice.expiresAt<=now)throw fault('announcement_not_found',404);
  const read=ctx.db.ref('serverAnnouncementReads/'+ctx.uid+'/'+body.id);
  if(body.action==='claim'){
   if(!safeId(body.claim))throw fault('invalid_input');
   await atomic(read,old=>{
    if(old?.seenAt||old?.until>now&&old.claim!==body.claim)throw fault('announcement_seen',409);
    return{claim:body.claim,until:now+120000};
   });
   return reply({claimed:true});
  }
  if(!safeId(body.claim))throw fault('invalid_input');
  await atomic(read,old=>{
   if(old?.seenAt)return old;
   if(old?.claim!==body.claim)throw fault('announcement_claim_required',409);
   return{seenAt:now};
  });
  return reply({seen:true});
 }catch(error){return reply({error:error.code||'announcements_unavailable'},error.status||503);}
});}
export default createAnnouncementsHandler();
