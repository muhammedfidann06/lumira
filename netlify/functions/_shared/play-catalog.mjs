import {createPlayApi} from './play-api.mjs';
import {fault} from './feature-core.mjs';
const amounts=[1,5,10,25,50,100];
export const canonicalSku=amount=>'lumira_support_'+amount+(amount===100?'':'_monthly');
const normalize=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ı/g,'i');
const names={1:['tesekkur','thanks','thank you','gratitude','danke','merci','gracias','спасибо','شكر'],5:['kahve','coffee','kaffee','cafe','cafe','кофе','قهوة'],10:['destekci','supporter','unterstutzer','soutien','apoyo','поддержка','داعم'],25:['dost','friend','freund','ami','amigo','друг','صديق'],50:['yildiz','star','stern','etoile','estrella','звезда','نجمة'],100:['kral','king','konig','roi','rey','король','ملك']};
export function catalogAmount(row){
 const id=normalize(row.productId||row.sku),exact=amounts.find(amount=>new RegExp('(?:^|[_.-])'+amount+'(?:$|[_.-])').test(id));
 if(exact&&/^lumira[_.-](?:support|badge|rozet)[_.-]/.test(id))return exact;
 const title=normalize([id,...(Array.isArray(row.listings)?row.listings:Object.values(row.listings||{})).map(value=>value.title||'')].join(' '));
 const matches=amounts.filter(amount=>names[amount].some(word=>new RegExp('(?:^|[^\\p{L}\\p{N}])'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^\\p{L}\\p{N}])','u').test(title.replace(/[_-]/g,' '))));
 return matches.length===1?matches[0]:null;
}
export function createPlayCatalog({env=process.env,api=createPlayApi({env}),clock=Date.now}={}){
 let cache,pending,until=0;
 async function load({refresh=false}={}){
  if(!refresh&&cache&&until>clock())return cache;if(pending)return pending;
  pending=(async()=>{
   const products=[],issues=[];let pageToken,activationProject,seen=new Set();
   try{do{const page=await api.call('/subscriptions?pageSize=1000'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):''));for(const row of page.subscriptions||[]){
    const amount=catalogAmount(row);if(!amount||amount===100||row.archived)continue;
    const plans=(row.basePlans||[]).filter(plan=>plan.state==='ACTIVE'&&plan.autoRenewingBasePlanType?.billingPeriodDuration==='P1M'&&!plan.autoRenewingBasePlanType.installmentDetails);
    if(plans.length)products.push({amount,sku:row.productId,canonicalSku:canonicalSku(amount),lifetime:false,basePlans:plans.map(plan=>plan.basePlanId)});
   }pageToken=page.nextPageToken;if(pageToken&&seen.has(pageToken))throw fault('store_catalog_invalid',502);if(pageToken)seen.add(pageToken);}while(pageToken&&seen.size<5);}catch(error){issues.push(error.code||'purchase_verification_unavailable');if(/^\d{1,20}$/.test(error.activationProject||''))activationProject=error.activationProject;}
   const resolved=[];
   for(const amount of amounts){
    const candidates=products.filter(row=>row.amount===amount),exact=candidates.find(row=>row.sku===canonicalSku(amount));
    if(exact)resolved.push(exact);
    else if(candidates.length===1)resolved.push(candidates[0]);
    else if(candidates.length>1){issues.push('store_catalog_ambiguous');resolved.push({amount,canonicalSku:canonicalSku(amount),sku:canonicalSku(amount),lifetime:false,unavailable:true});}
    else resolved.push({amount,sku:canonicalSku(amount),canonicalSku:canonicalSku(amount),lifetime:amount===100});
   }
   const ids=resolved.map(row=>row.sku);if(ids.some(id=>typeof id!=='string'||!/^[a-z0-9][a-z0-9_.]{0,149}$/.test(id)))throw fault('store_catalog_invalid',502);
   cache={products:resolved,issues:[...new Set(issues)],...(activationProject?{activationProject}:{})};until=clock()+(issues.length?30000:300000);return cache;
  })();try{return await pending;}finally{pending=null;}
 }
 async function resolve(sku){const value=(await load()).products.find(row=>row.sku===sku&&!row.unavailable);if(!value)throw fault('invalid_purchase',422);return value;}
 async function report(){const catalog=await load({refresh:true}),raw=env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON||env.FIREBASE_SERVICE_ACCOUNT_JSON;let accountEmail='',projectId='';try{const account=JSON.parse(raw||'{}'),value=account.client_email;if(typeof value==='string'&&value.length<200)accountEmail=value;if(/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(account.project_id||''))projectId=account.project_id;}catch{}
  const activationProject=catalog.activationProject||projectId;
  return{...catalog,packageName:api.packageName||env.GOOGLE_PLAY_PACKAGE_NAME||'com.lumira.dilkartlari',credentialConfigured:!!raw,accountEmail,projectId,...(catalog.issues.includes('play_api_disabled')&&activationProject?{activationUrl:'https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com?project='+encodeURIComponent(activationProject)}:{}),mappedMonthly:catalog.products.filter(row=>!row.lifetime&&!row.unavailable&&row.basePlans?.length).length,catalogReady:!catalog.issues.length&&catalog.products.filter(row=>!row.lifetime&&row.basePlans?.length).length===5};
 }
 return{load,resolve,report};
}
export const playCatalog=createPlayCatalog();
