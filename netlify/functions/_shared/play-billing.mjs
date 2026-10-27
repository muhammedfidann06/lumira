import {createHash} from 'node:crypto';
import {fault} from './feature-core.mjs';
import {atomic} from './paddle-events.mjs';
import {createPlayApi} from './play-api.mjs';
import {createPlayCatalog} from './play-catalog.mjs';
const amounts=[1,5,10,25,50,100],hash=value=>createHash('sha256').update(value).digest('hex');
export const PLAY_PRODUCTS=Object.freeze(Object.fromEntries(amounts.flatMap(amount=>[
 ['lumira_support_'+amount,{amount,lifetime:true}],
 ...(amount===100?[]:[['lumira_support_'+amount+'_monthly',{amount,lifetime:false}]])
])));
const date=value=>{const n=Date.parse(value);return Number.isFinite(n)?n:null;};
const idOK=id=>/^play_[a-f\d]{64}$/.test(id||'');
export function playMembership(data,sku,token,now=Date.now(),product=PLAY_PRODUCTS[sku]){
 if(!product||product.lifetime)throw fault('invalid_purchase',422);
 const lines=(data.lineItems||[]).filter(row=>row.productId===sku&&!row.deferredItemReplacement);
 if(lines.length!==1)throw fault('invalid_purchase',422);
 const item=lines[0],endsAt=date(item.expiryTime),basePlanId=item.offerDetails?.basePlanId;
 if(!endsAt||typeof basePlanId!=='string'||!basePlanId||basePlanId.length>100||!item.autoRenewingPlan||item.autoRenewingPlan.installmentDetails)throw fault('invalid_purchase',422);
 const enabled=item.autoRenewingPlan.autoRenewEnabled===true;
 const permitted=['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED'].includes(data.subscriptionState);
 const active=permitted&&endsAt>now;
 return{id:'play_'+hash(token),provider:'google_play',sku,basePlanId,amount:product.amount,lifetime:false,status:active?'active':'expired',storeState:data.subscriptionState,startsAt:date(data.startTime),endsAt,renewsAt:active&&enabled?endsAt:null,cancelAt:enabled?null:endsAt,purchaseToken:token,checkedAt:now};
}
export function createPlayBilling({api=createPlayApi(),clock=Date.now}={}){
 const resolver=createPlayCatalog({api,clock}),productFor=async sku=>PLAY_PRODUCTS[sku]||resolver.resolve(sku);
 const catalog=new Map();
 async function monthlyPlan(sku,basePlanId){
  const key=sku+'/'+basePlanId;if((catalog.get(key)||0)>clock())return;
  const product=await api.call('/subscriptions/'+encodeURIComponent(sku));
  const plan=product.basePlans?.find(row=>row.basePlanId===basePlanId);
  if(!plan||plan.autoRenewingBasePlanType?.billingPeriodDuration!=='P1M'||plan.autoRenewingBasePlanType?.installmentDetails)throw fault('invalid_purchase',422);
  catalog.set(key,clock()+900000);
 }
 async function bind(ctx,token,sku){
  await atomic(ctx.db.ref('serverFeaturePurchases/'+hash(token)),old=>{
   if(old&&old.uid!==ctx.uid)throw fault('purchase_already_linked',409);
   if(old?.sku&&old.sku!==sku)throw fault('invalid_purchase',422);
   return old||{uid:ctx.uid,sku,at:clock()};
  });
 }
 async function save(ctx,value){
  const saved=await atomic(ctx.db.ref('serverPlayAccounts/'+ctx.uid+'/subscriptions/'+value.id),old=>{
   if(old?.checkedAt>value.checkedAt)return old;
   if(old?.checkedAt===value.checkedAt&&old.cancelAt&&!value.cancelAt)return old;
   return value;
  });return saved;
 }
 async function verify(ctx,sku,token){
  if(typeof sku!=='string'||!/^[a-z0-9][a-z0-9_.]{0,149}$/.test(sku)||typeof token!=='string'||token.length<10||token.length>4096)throw fault('invalid_purchase',422);
  const product=await productFor(sku),entitlement=ctx.db.ref('serverFeatureEntitlements/'+ctx.uid+'/'+product.amount);
  // A token never seen before is a new purchase. Background re-verification
  // of known tokens must not undo a badge the buyer chose to hide, nor one an
  // administrator removed; a new purchase always opens the badge again.
  const fresh=!(await ctx.db.ref('serverFeaturePurchases/'+hash(token)).get()).val();
  if(!fresh&&(await entitlement.get()).val()===false)throw fault('purchase_revoked',403);
  const observed=clock(),encoded=encodeURIComponent(token);
  if(product.lifetime){
   const path='/purchases/products/'+encodeURIComponent(sku)+'/tokens/'+encoded,data=await api.call(path);
   if(data.purchaseState!==0)throw fault('purchase_not_completed',422);
   await bind(ctx,token,sku);
   if(data.acknowledgementState===0)await api.call(path+':acknowledge',{method:'POST',body:{}});
   await atomic(entitlement,old=>{if(old===false&&!fresh)throw fault('purchase_revoked',403);return true;});
  }else{
   const data=await api.call('/purchases/subscriptionsv2/tokens/'+encoded),value=playMembership(data,sku,token,observed,product);
   if(value.status!=='active')throw fault('purchase_not_completed',422);
   await monthlyPlan(sku,value.basePlanId);
   if(data.linkedPurchaseToken){
    const linked=(await ctx.db.ref('serverFeaturePurchases/'+hash(data.linkedPurchaseToken)).get()).val();
    if(linked&&linked.uid!==ctx.uid)throw fault('purchase_already_linked',409);
   }
   await bind(ctx,token,sku);
   if(data.acknowledgementState==='ACKNOWLEDGEMENT_STATE_PENDING')await api.call('/purchases/subscriptions/'+encodeURIComponent(sku)+'/tokens/'+encoded+':acknowledge',{method:'POST',body:{}});
   else if(data.acknowledgementState!=='ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED')throw fault('purchase_not_completed',422);
   await save(ctx,value);
   if(data.linkedPurchaseToken){const previous='play_'+hash(data.linkedPurchaseToken),ref=ctx.db.ref('serverPlayAccounts/'+ctx.uid+'/subscriptions/'+previous);await atomic(ref,old=>old?{...old,status:'expired',endsAt:Math.min(old.endsAt||clock(),clock()),renewsAt:null,cancelAt:clock(),checkedAt:clock()}:null);}
  }
  // Buying a badge the buyer had hidden in My Profile shows it again; without
  // this the paid badge stayed invisible behind the earlier opt-out.
  if(fresh){const optOut=ctx.db.ref('serverBadgeOptOut/'+ctx.uid+'/'+product.amount);if((await optOut.get()).val()===true)await optOut.set(null);if(!product.lifetime&&(await entitlement.get()).val()===false)await entitlement.set(null);}
  return product.amount;
 }
 async function owned(ctx,id){if(!idOK(id))throw fault('invalid_input');const value=(await ctx.db.ref('serverPlayAccounts/'+ctx.uid+'/subscriptions/'+id).get()).val();if(!value?.purchaseToken)throw fault('billing_not_owned',403);if((await productFor(value.sku)).lifetime)throw fault('billing_not_owned',403);return value;}
 async function cancel(ctx,id){
  const value=await owned(ctx,id),product=await productFor(value.sku),path='/purchases/subscriptionsv2/tokens/'+encodeURIComponent(value.purchaseToken),before=await api.call(path),current=playMembership(before,value.sku,value.purchaseToken,clock(),product);
  if(!current.cancelAt&&current.status==='active')await api.call(path+':cancel',{method:'POST',body:{cancellationContext:{cancellationType:'USER_REQUESTED_STOP_RENEWALS'}}});
  const after=await api.call(path),result=playMembership(after,value.sku,value.purchaseToken,clock(),product);
  if(result.status==='active'&&!result.cancelAt)throw fault('billing_unavailable',503);
  return save(ctx,result);
 }
 async function cancelTier(ctx,amount){const account=(await ctx.db.ref('serverPlayAccounts/'+ctx.uid+'/subscriptions').get()).val()||{};for(const value of Object.values(account))if(value.amount===amount&&value.status==='active'&&!value.cancelAt)await cancel(ctx,value.id);}
 async function portal(ctx,id){const value=await owned(ctx,id);return'https://play.google.com/store/account/subscriptions?sku='+encodeURIComponent(value.sku)+'&package='+encodeURIComponent(api.packageName);}
 async function reconcile(ctx,account){
  const now=clock(),candidates=Object.values(account.subscriptions||{}).filter(value=>value.purchaseToken&&value.endsAt>now-60*86400000&&(value.checkedAt||0)+300000<=now||value.purchaseToken&&value.status==='active'&&value.endsAt<=now);
  if(!candidates.length)return account;
  try{await atomic(ctx.db.ref('serverPlayRefresh/'+ctx.uid),old=>{if(old?.until>now)throw fault('billing_busy',409);return{until:now+60000};});}catch{return account;}
  await Promise.allSettled(candidates.slice(0,5).map(async value=>{
   try{const data=await api.call('/purchases/subscriptionsv2/tokens/'+encodeURIComponent(value.purchaseToken));await save(ctx,playMembership(data,value.sku,value.purchaseToken,now,await productFor(value.sku)));}
   catch(error){if(error.code==='invalid_purchase')await save(ctx,{...value,status:'expired',endsAt:Math.min(now,value.endsAt),renewsAt:null,cancelAt:Math.min(now,value.endsAt),checkedAt:now});}
  }));
  return(await ctx.db.ref('serverPlayAccounts/'+ctx.uid).get()).val()||account;
 }
 return{verify,cancel,cancelTier,portal,reconcile};
}
export const playBilling=createPlayBilling();
