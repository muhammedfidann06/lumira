import {createPaddleApi,paddleEnvironment} from './paddle-api.mjs';
import {atomic,applyPaddleEvent} from './paddle-events.mjs';
export async function reconcileAccount(db,uid,billing,{env=process.env,clock=Date.now,makeApi=createPaddleApi}={}){
 if(!env.PADDLE_API_KEY)return billing;
 const now=clock(),candidates=Object.values(billing.subscriptions||{}).filter(s=>['active','trialing','past_due'].includes(s.status)&&(!s.endsAt||s.endsAt<=now||s.cancelAt&&s.cancelAt<=now));
 if(!candidates.length)return billing;
 try{
  await atomic(db.ref('serverPaddleRefresh/'+uid),value=>{if(value?.until>now)throw Error('busy');return{until:now+60000};});
  const config=(await db.ref('serverPaddleConfig/'+paddleEnvironment(env)).get()).val();if(!Array.isArray(config?.catalog))return billing;
  const api=makeApi({env});
  await Promise.allSettled(candidates.slice(0,3).map(async owned=>{
   const sub=(await api.call('/subscriptions/'+owned.id)).data;
   if(sub.customer_id!==owned.customerId||!Number.isFinite(Date.parse(sub.updated_at)))throw Error('invalid subscription');
   await applyPaddleEvent(db,{event_type:'subscription.updated',event_id:'reconciled-'+sub.id,occurred_at:sub.updated_at,data:sub},config.catalog);
  }));
  return (await db.ref('serverPaddleAccounts/'+uid).get()).val()||billing;
 }catch{return billing;}
}
