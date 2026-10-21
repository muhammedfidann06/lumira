import {fault} from './feature-core.mjs';
import {catalogPrices} from './paddle-api.mjs';
export async function atomic(ref,change){const listener=()=>{};ref.on('value',listener);try{await ref.get();let failure;const result=await ref.transaction(value=>{failure=null;try{return change(value);}catch(error){failure=error;return;}},undefined,false);if(!result.committed)throw failure||fault('billing_busy',409);return result.snapshot.val();}finally{ref.off('value',listener);}}
const epoch=value=>{const n=Date.parse(value);return Number.isFinite(n)?n:null;};
const priceIds=data=>(data.items||[]).map(item=>item.price?.id||item.price_id).filter(Boolean);
function subscriptionValue(data,catalog){
 const selected=catalog.filter(row=>priceIds(data).includes(row.priceId)).sort((a,b)=>b.amount-a.amount)[0];
 if(!selected)return null;
 return {id:data.id,provider:'paddle',amount:selected.amount,status:data.status,lifetime:false,priceId:selected.priceId,productId:selected.productId||null,billingCycle:selected.billingCycle||data.billing_cycle||null,startsAt:epoch(data.started_at||data.created_at),endsAt:epoch(data.current_billing_period?.ends_at),renewsAt:epoch(data.next_billed_at),cancelAt:data.scheduled_change?.action==='cancel'?epoch(data.scheduled_change.effective_at):null,scheduledChange:data.scheduled_change||null,customerId:data.customer_id};
}
const rank=status=>status==='canceled'?3:status==='paused'?2:1;
async function mirror(db,value){
 if(!value?.uid)return;
 await atomic(db.ref('serverPaddleAccounts/'+value.uid+'/'+(value.id.startsWith('sub_')?'subscriptions':'purchases')+'/'+value.id),old=>{
  if(old&&(old.eventAt>value.eventAt||old.eventAt===value.eventAt&&rank(old.status)>rank(value.status)))return old;
  return value;
 });
}
export async function applyPaddleEvent(db,event,catalog){
 catalog=catalogPrices(catalog);
 const data=event.data,at=epoch(event.occurred_at);if(!data||!Number.isFinite(at)||typeof event.event_id!=='string')throw fault('invalid_webhook',400);
 if(['customer.created','customer.updated'].includes(event.event_type)){
  if(!/^ctm_[a-z\d]{26}$/.test(data.id||'')||typeof data.email!=='string'||data.email.length>320)throw fault('invalid_webhook',400);
  await atomic(db.ref('serverPaddleCustomerRecords/'+data.id),old=>old?.eventAt>=at?old:{id:data.id,email:data.email,status:data.status||'active',createdAt:epoch(data.created_at)||at,updatedAt:epoch(data.updated_at)||at,eventAt:at,eventId:event.event_id});return;
 }
 if(event.event_type.startsWith('subscription.')){
  if(!/^sub_[a-z\d]{26}$/.test(data.id||''))throw fault('invalid_webhook',400);
  const next=subscriptionValue(data,catalog);if(!next)return;
  const saved=await atomic(db.ref('serverPaddleResources/'+data.id),old=>{
   if(old&&(old.eventAt>at||old.eventAt===at&&rank(old.status)>rank(next.status)))return old;
   return {...next,eventAt:at,eventId:event.event_id,...(old?.uid?{uid:old.uid}:{}),...(old?.badgePolicy?{badgePolicy:old.badgePolicy}:{})};
  });
  await mirror(db,saved);return;
 }
 if(event.event_type==='transaction.completed'){
  if(data.status!=='completed'||!/^txn_[a-z\d]{26}$/.test(data.id||''))throw fault('invalid_webhook',400);
  const linked=(await db.ref('serverPaddleTransactions/'+data.id).get()).val();
  if(!linked){
   // A renewal has no new browser checkout. Its subscription was bound by
   // the original server-created transaction, never by client custom_data.
   if(data.subscription_id){const old=(await db.ref('serverPaddleResources/'+data.subscription_id).get()).val();if(old?.uid)await mirror(db,old);}return;
  }
  if(!priceIds(data).includes(linked.priceId))throw fault('billing_event_mismatch',409);
  const item=catalog.find(row=>row.priceId===linked.priceId&&row.amount===linked.amount);if(!item)throw fault('billing_event_mismatch',409);
  if(data.subscription_id){
   if(item.lifetime||!/^sub_[a-z\d]{26}$/.test(data.subscription_id))throw fault('billing_event_mismatch',409);
   const saved=await atomic(db.ref('serverPaddleResources/'+data.subscription_id),old=>{
    if(old?.uid&&old.uid!==linked.uid)throw fault('billing_owner_mismatch',409);
    const base=old||{id:data.subscription_id,provider:'paddle',amount:item.amount,status:'active',lifetime:false,priceId:item.priceId,productId:item.productId||null,billingCycle:item.billingCycle||null,startsAt:epoch(data.created_at)||at,endsAt:epoch(data.billing_period?.ends_at),customerId:data.customer_id,eventAt:at,eventId:event.event_id};
    return {...base,uid:linked.uid,...(!base.badgePolicy&&linked.badgePolicy?{badgePolicy:linked.badgePolicy}:{})};
   });await mirror(db,saved);
  }else{
   if(!item.lifetime||item.amount!==100)throw fault('billing_event_mismatch',409);
   const saved=await atomic(db.ref('serverPaddleResources/'+data.id),old=>old?.eventAt>=at?old:{id:data.id,uid:linked.uid,provider:'paddle',amount:item.amount,status:'active',lifetime:true,startsAt:at,endsAt:null,customerId:data.customer_id,eventAt:at,eventId:event.event_id,...(linked.badgePolicy?{badgePolicy:linked.badgePolicy}:{})});await mirror(db,saved);
  }
  await db.ref('serverPaddleCustomers/'+linked.uid).set(data.customer_id);
  return;
 }
 if(event.event_type==='adjustment.updated'&&data.status==='approved'&&data.action==='refund'&&data.type==='full'&&/^txn_[a-z\d]{26}$/.test(data.transaction_id||'')){
  const ref=db.ref('serverPaddleResources/'+data.transaction_id),old=(await ref.get()).val();
  if(old?.lifetime){const saved=await atomic(ref,value=>value?.eventAt>=at?value:{...value,status:'canceled',eventAt:at,eventId:event.event_id});await mirror(db,saved);}
 }
}
