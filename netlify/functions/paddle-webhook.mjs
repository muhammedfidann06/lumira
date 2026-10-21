import {createHmac,timingSafeEqual} from 'node:crypto';
import {NodeRuntime,Webhooks} from '@paddle/paddle-node-sdk';
import {admin} from './_shared/feature-services.mjs';
import {fault} from './_shared/feature-core.mjs';
import {paddleEnvironment} from './_shared/paddle-api.mjs';
import {applyPaddleEvent} from './_shared/paddle-events.mjs';
NodeRuntime.initialize();
const paddle={webhooks:new Webhooks()};
export function verifySignature(raw,signature,secret,now=Date.now()){
 if(!secret||typeof signature!=='string'||signature.length>1000)throw fault('invalid_signature',401);
 const fields=signature.split(';').map(v=>v.trim().split('=')),ts=fields.find(([k])=>k==='ts')?.[1];
 if(!/^\d{10}$/.test(ts||'')||Math.abs(now/1000-Number(ts))>5)throw fault('invalid_signature',401);
 const expected=createHmac('sha256',secret).update(ts+':'+raw).digest();
 const valid=fields.find(([key,value])=>key==='h1'&&/^[a-f\d]{64}$/i.test(value||'')&&timingSafeEqual(expected,Buffer.from(value,'hex')));
 if(!valid)throw fault('invalid_signature',401);
 return 'ts='+ts+';h1='+valid[1];
}
export function createPaddleWebhook({getAdmin=admin,env=process.env,apply=applyPaddleEvent,clock=Date.now}={}){
 return async request=>{
  const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
  try{
   if(Number(request.headers.get('content-length'))>300000)throw fault('invalid_input',413);
   const raw=await request.text();if(!raw||raw.length>300000||!request.headers.get('paddle-signature'))throw fault('invalid_input',400);
   const mode=paddleEnvironment(env),secret=env.PADDLE_NOTIFICATION_WEBHOOK_SECRET||env.PADDLE_WEBHOOK_SECRET;
   if(!secret)throw fault('billing_not_configured',503);
   const signature=verifySignature(raw,request.headers.get('paddle-signature'),secret,clock());
   let verified;try{verified=await paddle.webhooks.unmarshal(raw,secret,signature);}catch{throw fault('invalid_signature',401);}
   const handled=new Set(['customer.created','customer.updated','subscription.created','subscription.updated','subscription.activated','subscription.canceled','subscription.paused','subscription.resumed','subscription.past_due','transaction.completed','adjustment.updated']);
   if(!handled.has(verified.eventType))return reply({received:true});
   const {db}=await getAdmin(),config=(await db.ref('serverPaddleConfig/'+mode).get()).val()||{};
   let event;try{event=JSON.parse(raw);}catch{throw fault('invalid_webhook',400);}
   if(typeof event.event_type!=='string'||!Array.isArray(config.catalog))throw fault('billing_not_configured',503);
   await apply(db,event,config.catalog);return reply({received:true});
  }catch(error){return reply({error:error.code||'billing_unavailable'},error.status||503);}
 };
}
export default createPaddleWebhook();
