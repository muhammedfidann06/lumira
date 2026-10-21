import {fault,TIERS} from './feature-core.mjs';
import {createHash} from 'node:crypto';
const tiers=[1,5,10,25,50,100];
const aliases={tesekkur:1,thanks:1,thankyou:1,kahve:5,coffee:5,destekci:10,supporter:10,destek:10,dost:25,friend:25,yildiz:50,star:50,kral:100,king:100,crown:100};
export function paddleEnvironment(env=process.env){
 const mode=env.PADDLE_ENV||env.PADDLE_ENVIRONMENT;
 if(!['production','sandbox'].includes(mode))throw fault('billing_not_configured',503);
 if(env.PADDLE_API_KEY&&((mode==='sandbox'&&/pdl_live_/.test(env.PADDLE_API_KEY))||(mode==='production'&&/pdl_sdbx_/.test(env.PADDLE_API_KEY))))throw fault('billing_environment_mismatch',503);
 return mode;
}
export function createPaddleApi({env=process.env,fetcher=fetch}={}){
 const mode=paddleEnvironment(env),base=mode==='production'?'https://api.paddle.com':'https://sandbox-api.paddle.com',apiKey=typeof env.PADDLE_API_KEY==='string'?env.PADDLE_API_KEY.trim():'';
 async function call(path,{method='GET',body}={}){
  if(!apiKey)throw fault('billing_not_configured',503);
  if(/^(?:apikey_|live_|test_)/.test(apiKey)||/[\s*]/.test(apiKey))throw fault('billing_authentication',503);
  if(!path.startsWith('/')||path.includes('://')||path.includes('..'))throw fault('invalid_input');
  let response;try{response=await fetcher(base+path,{method,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Paddle-Version':'1'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});}catch{throw fault('billing_unavailable',503);}
  let result;try{result=await response.json();}catch{throw fault('billing_unavailable',503);}
  if(!response.ok){
   const providerCode=/^[a-z_]{1,80}$/.test(result?.error?.code||'')?result.error.code:undefined;
   const authentication=response.status===401||['invalid_token','authentication_missing','authentication_malformed','invalid_client_token'].includes(providerCode);
   const error=fault(authentication?'billing_authentication':response.status===403?'billing_permissions':response.status===409?'billing_busy':'billing_unavailable',response.status===409?409:503);
   throw Object.assign(error,{httpStatus:response.status,...(providerCode?{providerCode}:{}),...(/^[a-zA-Z0-9_-]{1,100}$/.test(result?.meta?.request_id||'')?{requestId:result.meta.request_id}:{})});
  }
  return result;
 }
 async function list(path){let next=path,items=[],seen=new Set();do{if(seen.has(next)||seen.size>=50)throw fault('billing_unavailable',503);seen.add(next);const page=await call(next);if(!Array.isArray(page.data))throw fault('billing_unavailable',503);items.push(...page.data);if(page.meta?.pagination?.has_more){const url=new URL(page.meta.pagination.next);if(url.origin!==base)throw fault('billing_unavailable',503);next=url.pathname+url.search;}else next=null;}while(next);return items;}
 async function portal(customerId,subscriptions=[]){
  if(!apiKey)throw fault('billing_not_configured',503);
  const {Paddle}=await import('@paddle/paddle-node-sdk');
  try{const session=await new Paddle(apiKey,{environment:mode}).customerPortalSessions.create(customerId,subscriptions);return session.urls.general.overview;}catch{throw fault('billing_unavailable',503);}
 }
 return {call,list,portal,environment:mode};
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
 const entries=[],active=products.filter(product=>product.status==='active');
 const candidatesFor=amount=>prices.filter(price=>{
  const product=active.find(item=>item.id===price.product_id);
  if(!product||price.status!=='active'||price.trial_period)return false;
  const shared=['lumirarozetaylik','lumirabadgemonthly','lumiramonthlybadges'].includes(fold(product.name));
  const productTier=productAmount(product),priceTier=productTier||shared?productAmount({...price,name:price.name||price.description}):null;
  if(productTier&&priceTier&&productTier!==priceTier)return false;
  let tier=productTier||priceTier;
  // Also support the user's shared "Lumira Rozet Aylık" product. Only its
  // exact EUR base prices identify tiers; unrelated products never match.
  if(!tier&&shared&&price.unit_price?.currency_code==='EUR'){
   const cents=String(price.unit_price.amount||'');
   if(price.billing_cycle?.interval==='month'&&price.billing_cycle.frequency===1&&/^\d+$/.test(cents)&&tiers.slice(0,-1).includes(Number(cents)/100))tier=Number(cents)/100;
  }
  return tier===amount;
 });
 for(const amount of tiers){
  const matches=candidatesFor(amount);
  const candidates=matches.filter(price=>amount===100?!price.billing_cycle:price.billing_cycle?.interval==='month'&&price.billing_cycle.frequency===1);
  // Never choose an arbitrary price or silently convert a monthly Crown
  // into lifetime access. The actual catalog determines billing semantics.
  const crownMonthly=amount===100&&!candidates.length?matches.filter(price=>price.billing_cycle?.interval==='month'&&price.billing_cycle.frequency===1):[];
  const selected=candidates.length?candidates:crownMonthly;
  if(selected.length!==1)throw fault('billing_catalog_incomplete',503);
  const price=selected[0],product=active.find(item=>item.id===price.product_id);if(!/^pri_[a-z\d]{26}$/.test(price.id)||!/^\d+$/.test(price.unit_price?.amount||''))throw fault('billing_catalog_incomplete',503);
  const entry={amount,productId:product.id,priceId:price.id,name:price.name||price.description||product.name,lifetime:!price.billing_cycle,billingCycle:price.billing_cycle||null,price:price.unit_price};
  const annual=matches.filter(row=>row.billing_cycle?.interval==='year'&&row.billing_cycle.frequency===1);
  if(annual.length>1)throw fault('billing_catalog_incomplete',503);
  if(annual.length){const row=annual[0];if(!/^pri_[a-z\d]{26}$/.test(row.id)||!/^\d+$/.test(row.unit_price?.amount||''))throw fault('billing_catalog_incomplete',503);entry.annual={...entry,priceId:row.id,lifetime:false,billingCycle:row.billing_cycle,price:row.unit_price};}
  entries.push(entry);
 }
 return entries;
}
export async function loadCatalog(api){return matchCatalog(await api.list('/products?per_page=200&status=active'),await api.list('/prices?per_page=200&status=active'));}
export const catalogPrices=catalog=>(catalog||[]).flatMap(row=>[row,...(row.annual?[row.annual]:[])]);
export const webhookFingerprint=secret=>createHash('sha256').update(secret).digest('hex');
export function paddleWebhookReady(config,env=process.env){const secret=env.PADDLE_NOTIFICATION_WEBHOOK_SECRET||env.PADDLE_WEBHOOK_SECRET;return !!secret&&config.webhookSecretHash===webhookFingerprint(secret);}
export const PADDLE_EVENTS=['transaction.completed','customer.created','customer.updated','subscription.created','subscription.updated','subscription.activated','subscription.canceled','subscription.paused','subscription.resumed','subscription.past_due','adjustment.updated'];
export const PRICING_TIERS=[{id:'starter',name:'Starter',amount:1},{id:'pro',name:'Pro',amount:10,featured:true},{id:'advanced',name:'Advanced',amount:50}];
export function pricingTiers(catalog){return PRICING_TIERS.map(tier=>{const item=catalog.find(row=>row.amount===tier.amount),benefits=TIERS.find(row=>row.amount===tier.amount);return{...tier,minutes:benefits.minutes,count:benefits.count,priceId:{month:item&&!item.lifetime?item.priceId:null,year:item?.annual?.priceId||null}};});}
const countries=new Set('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '));
export function visitorCountry(request,context){const code=String(context?.geo?.country?.code||request.headers.get('x-vercel-ip-country')||'').toUpperCase();return countries.has(code)?code:undefined;}
export async function auditPaddle(api){
 const result={environment:api.environment};
 await Promise.all([['paymentMethods','/settings/checkout-payment-methods'],['tax','/settings/tax'],['balanceCurrency','/settings/balance-currency'],['checkoutUrl','/settings/checkout-url'],['domains','/checkout-domains?per_page=200',true],['verification','/verifications?verification_type=onboarding&per_page=200',true]].map(async ([key,path,list])=>{
  try{result[key]={ok:true,data:list?await api.list(path):(await api.call(path)).data};}catch(error){result[key]={ok:false,error:error.code||'billing_unavailable',...(error.providerCode?{providerCode:error.providerCode}:{}),...(error.httpStatus?{httpStatus:error.httpStatus}:{}),...(error.requestId?{requestId:error.requestId}:{})};}
 }));
 return result;
}
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
 if(!setting.endpoint_secret_key||(env.PADDLE_NOTIFICATION_WEBHOOK_SECRET||env.PADDLE_WEBHOOK_SECRET)&&secret!==setting.endpoint_secret_key)throw fault('billing_webhook_mismatch',503);
 // Secrets belong in the function environment. Preserve historical private
 // state when updating configuration; never delete the permanent destination.
 await db.ref(path).update({catalog,clientToken,webhookSecretHash:webhookFingerprint(setting.endpoint_secret_key),destinationId:setting.id,environment:api.environment,ready:true});
 let defaultPaymentLink;
 try{defaultPaymentLink=(await api.call('/settings/checkout-url',{method:'PATCH',body:{default_url:'https://lumira-tr.com/checkout/'}})).data;}catch(error){defaultPaymentLink={error:error.code||'billing_unavailable',dashboard:'Checkout > Checkout configuration'};}
 return {ready:true,environment:api.environment,catalog,clientToken,needsClientToken:!env.PADDLE_CLIENT_TOKEN&&!env.PADDLE_CLIENT_SIDE_TOKEN,needsWebhookSecret:!env.PADDLE_NOTIFICATION_WEBHOOK_SECRET&&!env.PADDLE_WEBHOOK_SECRET,defaultPaymentLink};
}
