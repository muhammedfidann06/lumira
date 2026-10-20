import {identity,admin} from './_shared/feature-services.mjs';
import {fault} from './_shared/feature-core.mjs';
import {withCors} from './_shared/cors.mjs';
import {createPaddleApi,setupPaddle,paddleEnvironment} from './_shared/paddle-api.mjs';
import {atomic,applyPaddleEvent} from './_shared/paddle-events.mjs';
import {playBilling} from './_shared/play-billing.mjs';
const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Lumira-Features-Version':'1.10.0'}});
const operation=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(id);
export function createBillingHandler({identify=identity,getAdmin=admin,makeApi=createPaddleApi,env=process.env,clock=Date.now,play=playBilling}={}){
 return withCors(async request=>{
  try{
   const mode=paddleEnvironment(env);
   if(request.method==='GET'){
    if(!['?config','?catalog'].includes(new URL(request.url).search))return reply({error:'invalid_action'},400);
    const {db}=await getAdmin(),config=(await db.ref('serverPaddleConfig/'+mode).get()).val();
    if(!config?.ready)throw fault('billing_not_configured',503);
    if(new URL(request.url).search==='?catalog')return reply({catalog:config.catalog,environment:mode});
    return reply({environment:mode,clientToken:config.clientToken});
   }
   if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
   const raw=await request.text();if(raw.length>5000)throw fault('invalid_input',413);
   let body;try{body=JSON.parse(raw);}catch{throw fault('invalid_input');}
   const ctx=await identify(request),db=ctx.db;
   if(body.action==='playCancel'){await play.cancel(ctx,body.subscriptionId);return reply({done:true});}
   if(body.action==='playPortal')return reply({url:await play.portal(ctx,body.subscriptionId)});
   if(body.action==='status')return reply({memberships:ctx.tier.memberships||[],serverNow:clock()});
   if(body.action==='restore'){
    if(![1,5,10,25,50,100].includes(body.amount))throw fault('invalid_input');
    if(ctx.tier.revokedSupport?.includes(body.amount)&&(await db.ref('serverFeatureEntitlements/'+ctx.uid+'/'+body.amount).get()).val()===false)throw fault('billing_not_owned',403);
    await db.ref('serverBadgeOptOut/'+ctx.uid+'/'+body.amount).remove();return reply({done:true});
   }
   const api=makeApi({env});
   if(body.action==='setup'){
    if((await db.ref('admins/'+ctx.uid).get()).val()!==true)throw fault('admin_required',403);
    return reply(await setupPaddle(db,api,{env}));
   }
   const config=(await db.ref('serverPaddleConfig/'+mode).get()).val()||{};
   if(body.action==='confirm'){
    if(!/^txn_[a-z\d]{26}$/.test(body.transactionId||''))throw fault('invalid_input');
    const linked=(await db.ref('serverPaddleTransactions/'+body.transactionId).get()).val();if(linked?.uid!==ctx.uid)throw fault('billing_not_owned',403);
    const transaction=(await api.call('/transactions/'+body.transactionId)).data;
    if(transaction.status!=='completed')return reply({confirmed:false,pending:true},202);
    await applyPaddleEvent(db,{event_type:'transaction.completed',event_id:'confirmed-'+transaction.id,occurred_at:transaction.updated_at||new Date(clock()).toISOString(),data:transaction},config.catalog||[]);
    if(transaction.subscription_id){const subscription=(await api.call('/subscriptions/'+transaction.subscription_id)).data;if(subscription.customer_id!==transaction.customer_id)throw fault('billing_not_owned',403);await applyPaddleEvent(db,{event_type:'subscription.updated',event_id:'confirmed-'+subscription.id,occurred_at:subscription.updated_at||new Date(clock()).toISOString(),data:subscription},config.catalog||[]);}
    return reply({confirmed:true});
   }
   if(body.action==='catalog'){if(!config.ready)throw fault('billing_not_configured',503);return reply({catalog:config.catalog,environment:mode});}
   if(body.action==='checkout'){
    if(!config.ready)throw fault('billing_not_configured',503);
    const selected=config.catalog.find(row=>row.amount===body.amount);if(!selected||!operation(body.id))throw fault('invalid_input');
    if(ctx.tier.supportAmounts?.includes(body.amount))throw fault('billing_already_active',409);
    const existing=(await db.ref('serverPaddleAccounts/'+ctx.uid+'/subscriptions').get()).val()||{};
    if(Object.values(existing).some(s=>['active','trialing','past_due'].includes(s.status)&&!s.cancelAt))throw fault('billing_subscription_exists',409);
    const ref=db.ref('serverPaddleCheckoutRequests/'+ctx.uid+'/'+body.id),owner=body.id+'-'+clock();
    const previous=(await ref.get()).val();
    if(previous?.transactionId){if(previous.amount!==body.amount)throw fault('invalid_operation',409);return reply({url:previous.url,transactionId:previous.transactionId});}
    await atomic(ref,value=>{if(value?.until>clock()||value?.transactionId)throw fault('billing_busy',409);return{owner,amount:body.amount,until:clock()+30000};});
    try{
     const source=request.headers.get('origin')==='https://muhammedfidann06.github.io'?'github':'netlify',language=['tr','en','de','ar','fr','es','ru'].includes(body.language)?body.language:'tr';
     const transaction=(await api.call('/transactions',{method:'POST',body:{items:[{price_id:selected.priceId,quantity:1}],collection_mode:'automatic',custom_data:{lumira_user_id:ctx.uid},checkout:{url:'https://lumira-tr.com/checkout/?return='+source+'&lang='+language}}})).data;
     if(!/^txn_[a-z\d]{26}$/.test(transaction?.id||''))throw fault('billing_unavailable',503);
     const url=new URL(transaction.checkout?.url);if(url.origin!=='https://lumira-tr.com'||url.pathname!=='/checkout/')throw fault('billing_unavailable',503);
     await db.ref('serverPaddleTransactions/'+transaction.id).set({uid:ctx.uid,amount:selected.amount,priceId:selected.priceId,createdAt:clock()});
     await ref.set({amount:body.amount,transactionId:transaction.id,url:url.href});return reply({url:url.href,transactionId:transaction.id});
    }catch(error){await atomic(ref,value=>value?.owner===owner?{amount:body.amount,failed:true}:value);throw error;}
   }
   if(['cancel','remove','portal'].includes(body.action)){
    const account=(await db.ref('serverPaddleAccounts/'+ctx.uid).get()).val()||{};
    const entries=Object.values(account.subscriptions||{});
    let subscriptions;
    if(body.action==='remove'){
     if(![1,5,10,25,50,100].includes(body.amount))throw fault('invalid_input');
     subscriptions=entries.filter(s=>s.amount===body.amount);
    }else{
     if(!/^sub_[a-z\d]{26}$/.test(body.subscriptionId||''))throw fault('invalid_input');
     const own=entries.find(s=>s.id===body.subscriptionId);if(!own)throw fault('billing_not_owned',403);subscriptions=[own];
    }
    if(body.action==='portal'){
     const own=subscriptions[0];const session=(await api.call('/customers/'+own.customerId+'/portal-sessions',{method:'POST',body:{subscription_ids:[own.id]}})).data;
     const url=session?.urls?.general?.overview;if(!/^https:\/\/(sandbox-)?customer-portal\.paddle\.com\//.test(url||''))throw fault('billing_unavailable',503);return reply({url});
    }
    for(const owned of subscriptions){
     const current=(await api.call('/subscriptions/'+owned.id)).data;
     if(current.customer_id!==owned.customerId)throw fault('billing_not_owned',403);
     const result=['canceled'].includes(current.status)||current.scheduled_change?.action==='cancel'?current:(await api.call('/subscriptions/'+owned.id+'/cancel',{method:'POST',body:{effective_from:current.status==='paused'?'immediately':'next_billing_period'}})).data;
     await applyPaddleEvent(db,{event_id:'local-cancel-'+owned.id,event_type:'subscription.updated',occurred_at:result.updated_at||new Date(clock()).toISOString(),data:result},config.catalog||[]);
    }
    if(body.action==='remove')await play.cancelTier(ctx,body.amount);
    if(body.action==='remove')await db.ref('serverBadgeOptOut/'+ctx.uid+'/'+body.amount).set(true);
    const fresh=await identify(request);return reply({memberships:fresh.tier.memberships||[],done:true});
   }
   throw fault('invalid_action');
  }catch(error){return reply({error:error.code||'billing_unavailable'},error.status||503);}
 },{methods:['GET','POST']});
}
export default createBillingHandler();
