import {fault} from './feature-core.mjs';
const tiers=[1,5,10,25,50,100];
const aliases={tesekkur:1,thanks:1,thankyou:1,kahve:5,coffee:5,destekci:10,supporter:10,destek:10,dost:25,friend:25,yildiz:50,star:50,kral:100,king:100,crown:100};
export function paddleEnvironment(env=process.env){
 const mode=env.PADDLE_ENV||env.PADDLE_ENVIRONMENT||(/pdl_live_/.test(env.PADDLE_API_KEY||'')?'production':'sandbox');
 if(!['production','sandbox'].includes(mode))throw fault('billing_not_configured',503);
 if(env.PADDLE_API_KEY&&((mode==='sandbox'&&/pdl_live_/.test(env.PADDLE_API_KEY))||(mode==='production'&&/pdl_sdbx_/.test(env.PADDLE_API_KEY))))throw fault('billing_not_configured',503);
 return mode;
}
export function createPaddleApi({env=process.env,fetcher=fetch}={}){
 const mode=paddleEnvironment(env),base=mode==='production'?'https://api.paddle.com':'https://sandbox-api.paddle.com';
 async function call(path,{method='GET',body}={}){
  if(!env.PADDLE_API_KEY)throw fault('billing_not_configured',503);
  if(!path.startsWith('/')||path.includes('://')||path.includes('..'))throw fault('invalid_input');
  let response;try{response=await fetcher(base+path,{method,headers:{Authorization:'Bearer '+env.PADDLE_API_KEY,'Content-Type':'application/json','Paddle-Version':'1'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});}catch{throw fault('billing_unavailable',503);}
  let result;try{result=await response.json();}catch{throw fault('billing_unavailable',503);}
  if(!response.ok)throw fault(response.status===401||response.status===403?'billing_permissions':response.status===409?'billing_busy':'billing_unavailable',response.status===409?409:503);
  return result;
 }
 async function list(path){let next=path,items=[],seen=new Set();do{if(seen.has(next)||seen.size>=50)throw fault('billing_unavailable',503);seen.add(next);const page=await call(next);if(!Array.isArray(page.data))throw fault('billing_unavailable',503);items.push(...page.data);if(page.meta?.pagination?.has_more){const url=new URL(page.meta.pagination.next);if(url.origin!==base)throw fault('billing_unavailable',503);next=url.pathname+url.search;}else next=null;}while(next);return items;}
 return {call,list,environment:mode};
}
const fold=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ı/g,'i').replace(/[^a-z0-9]/g,'');
function productAmount(product){
 const explicit=Number(product.custom_data?.lumira_tier);if(tiers.includes(explicit))return explicit;
 const words=String(product.name||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ı/g,'i').split(/[^a-z0-9]+/).filter(Boolean);
 const matches=[...new Set(words.filter(word=>word!=='destek'&&Object.hasOwn(aliases,word)).map(word=>aliases[word]))];
 if(matches.length===1)return matches[0];if(matches.length>1)return null;
 if(words.includes('destek'))return 10;
 const name=fold(product.name);return Object.entries(aliases).find(([word])=>name===word||name==='lumira'+word||name===word+'rozeti'||name==='lumira'+word+'rozeti'||name===word+'badge'||name==='lumira'+word+'badge')?.[1]||null;
}
export function matchCatalog(products,prices){
 const entries=[];
 for(const amount of tiers){
  const matches=products.filter(product=>{
   if(product.status!=='active')return false;
   return productAmount(product)===amount;
  });
  if(matches.length!==1)throw fault('billing_catalog_incomplete',503);
  const product=matches[0];
  const candidates=prices.filter(price=>price.product_id===product.id&&price.status==='active'&&!price.trial_period&&(amount===100?!price.billing_cycle:price.billing_cycle?.interval==='month'&&price.billing_cycle.frequency===1));
  // Never choose an arbitrary price or silently convert a monthly Crown
  // into lifetime access. The actual catalog determines billing semantics.
  const crownMonthly=amount===100&&!candidates.length?prices.filter(price=>price.product_id===product.id&&price.status==='active'&&!price.trial_period&&price.billing_cycle?.interval==='month'&&price.billing_cycle.frequency===1):[];
  const selected=candidates.length?candidates:crownMonthly;
  if(selected.length!==1)throw fault('billing_catalog_incomplete',503);
  const price=selected[0];if(!/^pri_[a-z\d]{26}$/.test(price.id)||!/^\d+$/.test(price.unit_price?.amount||''))throw fault('billing_catalog_incomplete',503);
  entries.push({amount,productId:product.id,priceId:price.id,name:product.name,lifetime:!price.billing_cycle,billingCycle:price.billing_cycle||null,price:price.unit_price});
 }
 return entries;
}
export async function loadCatalog(api){return matchCatalog(await api.list('/products?per_page=200&status=active'),await api.list('/prices?per_page=200&status=active'));}
export const PADDLE_EVENTS=['transaction.completed','subscription.created','subscription.updated','subscription.activated','subscription.canceled','subscription.paused','subscription.resumed','subscription.past_due','adjustment.updated'];
export async function setupPaddle(db,api,{env=process.env}={}){
 const catalog=await loadCatalog(api),path='serverPaddleConfig/'+api.environment;
 const existing=(await db.ref(path).get()).val()||{};
 const destination='https://lumira-tr.com/.netlify/functions/paddle-webhook';
 const settings=await api.list('/notification-settings?per_page=200');
 let setting=settings.find(s=>s.destination===destination&&s.type==='url');
 if(setting){const needed=new Set(PADDLE_EVENTS),present=new Set((setting.subscribed_events||[]).map(e=>typeof e==='string'?e:e.name));if(!setting.active||[...needed].some(e=>!present.has(e)))setting=(await api.call('/notification-settings/'+setting.id,{method:'PATCH',body:{active:true,subscribed_events:[...new Set([...present,...needed])],traffic_source:api.environment==='sandbox'?'all':'platform'}})).data;else setting=(await api.call('/notification-settings/'+setting.id)).data;}
 else setting=(await api.call('/notification-settings',{method:'POST',body:{description:'Lumira membership access',type:'url',destination,subscribed_events:PADDLE_EVENTS,traffic_source:api.environment==='sandbox'?'all':'platform'}})).data;
 let clientToken=env.PADDLE_CLIENT_TOKEN||env.PADDLE_CLIENT_SIDE_TOKEN||existing.clientToken;
 if(!clientToken){const found=(await api.list('/client-tokens?per_page=200')).find(t=>t.name==='Lumira web checkout'&&!t.revoked_at);clientToken=found?.token;if(!clientToken)clientToken=(await api.call('/client-tokens',{method:'POST',body:{name:'Lumira web checkout',description:'Lumira approved web checkout'}})).data?.token;}
 const secret=env.PADDLE_NOTIFICATION_WEBHOOK_SECRET||env.PADDLE_WEBHOOK_SECRET||setting.endpoint_secret_key;
 if(!secret||!clientToken||!clientToken.startsWith(api.environment==='production'?'live_':'test_'))throw fault('billing_not_configured',503);
 await db.ref(path).set({catalog,clientToken,webhookSecret:secret,destinationId:setting.id,environment:api.environment,ready:true});
 return {ready:true,environment:api.environment,catalog};
}
