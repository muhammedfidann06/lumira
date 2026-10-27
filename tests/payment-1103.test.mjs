import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {createBillingHandler} from '../netlify/functions/billing.mjs';
import {createAdminBadgesHandler} from '../netlify/functions/admin-badges.mjs';
import {createPaddleWebhook} from '../netlify/functions/paddle-webhook.mjs';
import {applyPaddleEvent} from '../netlify/functions/_shared/paddle-events.mjs';
import {accountMemberships,badgePolicySnapshot} from '../netlify/functions/_shared/memberships.mjs';
import {createPaddleApi,webhookFingerprint,auditPaddle} from '../netlify/functions/_shared/paddle-api.mjs';
import {memoryDb} from './memory-db.mjs';

const amounts=[1,5,10,25,50,100],langs=['tr','en','de','ar','fr','es','ru'];
const id=(kind,n)=>kind+'_'+String(n).padStart(26,'0');
const catalog=amounts.map((amount,i)=>({amount,priceId:id('pri',i+1),productId:id('pro',i+1),lifetime:amount===100,billingCycle:amount===100?null:{interval:'month',frequency:1},price:{amount:String(amount*100),currency_code:'EUR'}}));
const env={PADDLE_ENV:'production',PADDLE_API_KEY:'pdl_live_fixture',PADDLE_CLIENT_TOKEN:'live_fixture_public',PADDLE_NOTIFICATION_WEBHOOK_SECRET:'fixture-signing-secret'};
const newEvent=(type,data,at=Date.now())=>({event_id:id('evt',at),notification_id:id('ntf',at),event_type:type,occurred_at:new Date(at).toISOString(),data});

function fixture(amount,mask='admin',versioned=false){
 const f=memoryDb({admins:{manager:true},progress:{alice:{meta:{xp:123,supportGrants:{}}}},serverPaddleConfig:{production:{ready:true,clientToken:env.PADDLE_CLIENT_TOKEN,webhookSecretHash:webhookFingerprint(env.PADDLE_NOTIFICATION_WEBHOOK_SECRET),catalog}}});
 if(mask==='admin'||mask==='both')f.set('serverFeatureEntitlements/alice/'+amount,false);
 if(mask==='user'||mask==='both')f.set('serverBadgeOptOut/alice/'+amount,true);
 if(versioned)f.set('serverBadgePolicyVersions/alice/'+amount,{admin:'revoke-before-checkout',user:'remove-before-checkout'});
 let serial=0,at=Date.now();const calls=[],transactions=new Map();
 const tier=()=>accountMemberships(f.get('progress/alice/meta/supportGrants')||{},f.get('serverFeatureEntitlements/alice')||{},f.get('serverPaddleAccounts/alice')||{},f.get('serverBadgeOptOut/alice')||{},at,f.get('serverPlayAccounts/alice')||{},f.get('serverBadgePolicyVersions/alice')||{}).tier;
 const identify=async request=>{const uid=request.headers.get('authorization')?.slice(7);if(!uid)throw Object.assign(Error(),{code:'login_required',status:401});return{uid,db:f.db,tier:uid==='alice'?tier():{memberships:[]}};};
 const api={environment:'production',async call(path,{body}={}){
  calls.push({path,body});
  if(path==='/transactions'){
   const transactionId=id('txn',++serial),priceId=body.items[0].price_id;
   const selected=catalog.find(row=>row.priceId===priceId);
   transactions.set(transactionId,{id:transactionId,status:'ready',customer_id:id('ctm',1),created_at:new Date(at).toISOString(),currency_code:'EUR',collection_mode:'automatic',origin:'web',payments:[],items:[{quantity:1,price:{id:priceId,product_id:selected.productId,unit_price:selected.price,billing_cycle:selected.billingCycle,quantity:{minimum:1,maximum:1},status:'active'}}],custom_data:{lumira_user_id:'untrusted-user'}});
   return{data:{id:transactionId,checkout:{url:'https://lumira-tr.com/checkout/?_ptxn='+transactionId}}};
  }
  if(path.startsWith('/transactions/'))return{data:transactions.get(path.split('/').at(-1))};
  if(path.endsWith('/cancel'))return{data:{...subscription(path.split('/')[2]),scheduled_change:{action:'cancel',effective_at:new Date(at+86400000).toISOString()}}};
  return{data:subscription(path.split('/').at(-1))};
 }};
 const handler=createBillingHandler({env,identify,getAdmin:async()=>({db:f.db}),makeApi:()=>api,clock:()=>at,play:{cancelTier:async()=>{}}});
 const admin=createAdminBadgesHandler({identity:identify},()=>at);
 const call=async(body,uid='alice',which=handler)=>{const response=await which(new Request('https://lumira-tr.com/.netlify/functions/billing',{method:'POST',headers:uid?{Authorization:'Bearer '+uid}:{},body:JSON.stringify(body)}));return{http:response.status,...await response.json()};};
 const subscription=(subscriptionId,status='active')=>({id:subscriptionId,status,customer_id:id('ctm',1),created_at:new Date(at).toISOString(),current_billing_period:{ends_at:new Date(at+86400000).toISOString()},next_billed_at:new Date(at+86400000).toISOString(),items:[{price:{id:catalog.find(row=>row.amount===amount).priceId}}]});
 const checkout=()=>call({action:'checkout',amount,id:'checkout-operation-'+(++serial)});
 const complete=async result=>{
  const transaction={...transactions.get(result.transactionId),status:'completed',...(amount!==100?{subscription_id:id('sub',serial)}:{})};transactions.set(result.transactionId,transaction);
  await applyPaddleEvent(f.db,newEvent('transaction.completed',transaction,++at),catalog);return transaction;
 };
 const revoke=()=>call({action:'revoke',kind:'support',amount,badge:'all',uids:['alice'],id:'admin-operation-'+(++serial)},'manager',admin);
 return{...f,calls,transactions,tier,call,checkout,complete,revoke,subscription,advance:()=>++at};
}

for(const amount of amounts)for(const mask of ['admin','user','both'])for(const versioned of [false,true]){
 test(`new paid ${amount} recovers ${mask} removal, versioned=${versioned}`,async()=>{
  const f=fixture(amount,mask,versioned),before=f.get('serverFeatureEntitlements/alice/'+amount);
  assert.equal(f.tier().amount,0);
  const checkout=await f.checkout();assert.equal(checkout.http,200);assert.equal(f.tier().amount,0);
  assert.equal(f.get('serverFeatureEntitlements/alice/'+amount),before);
  assert.equal(f.get('serverPaddleAccounts/alice'),null);
  const proof=f.get('serverPaddleTransactions/'+checkout.transactionId);
  assert.equal(proof.uid,'alice');assert.deepEqual(proof.badgePolicy,badgePolicySnapshot(f.get('serverBadgePolicyVersions/alice/'+amount)));
  const paid=await f.complete(checkout);assert.equal(f.tier().amount,amount);assert.deepEqual(f.tier().revokedSupport,[]);
  assert.equal(f.get('serverPaddleAccounts/untrusted-user'),null);assert.equal(f.get('progress/alice/meta/xp'),123);
  if(paid.subscription_id){await applyPaddleEvent(f.db,newEvent('subscription.updated',f.subscription(paid.subscription_id),f.advance()),catalog);assert.equal(f.tier().amount,amount);}
  await applyPaddleEvent(f.db,newEvent('transaction.completed',paid,f.advance()),catalog);assert.equal(f.tier().amount,amount);
 });
}
for(const amount of amounts){
 test(`admin revocation after paid ${amount} survives renewals and payment replay`,async()=>{
  const f=fixture(amount,'admin',true),first=await f.checkout(),paid=await f.complete(first);
  assert.equal(f.tier().amount,amount);assert.equal((await f.revoke()).http,200);assert.equal(f.tier().amount,0);
  await applyPaddleEvent(f.db,newEvent('transaction.completed',paid,f.advance()),catalog);
  if(paid.subscription_id)await applyPaddleEvent(f.db,newEvent('subscription.updated',f.subscription(paid.subscription_id),f.advance()),catalog);
  assert.equal(f.tier().amount,0);assert.equal((await f.call({action:'restore',amount})).http,403);
 });
 test(`a removal sent before payment changes nothing for a buyer who did not hold ${amount} yet`,async()=>{
  const f=fixture(amount,'admin',true),checkout=await f.checkout(),before=structuredClone(f.get('serverBadgePolicyVersions/alice'));
  assert.equal((await f.revoke()).changed,0);assert.deepEqual(f.get('serverBadgePolicyVersions/alice'),before);
  await f.complete(checkout);assert.equal(f.tier().amount,amount);
 });
 test(`own removal and restore of newly paid ${amount} preserve administrative decisions`,async()=>{
  const f=fixture(amount,'both',true),checkout=await f.checkout(),paid=await f.complete(checkout);assert.equal(f.tier().amount,amount);
  assert.equal((await f.call({action:'remove',amount})).http,200);assert.equal(f.tier().amount,0);
  await applyPaddleEvent(f.db,newEvent('transaction.completed',paid,f.advance()),catalog);assert.equal(f.tier().amount,0);
  assert.equal((await f.call({action:'restore',amount})).http,200);assert.equal(f.tier().amount,amount);
  await f.revoke();assert.equal((await f.call({action:'restore',amount})).http,403);assert.equal(f.tier().amount,0);
 });
 test(`old paid records without the new private checkout proof stay revoked for ${amount}`,async()=>{
  const f=fixture(amount),checkout=await f.checkout();f.set('serverPaddleTransactions/'+checkout.transactionId+'/badgePolicy',null);await f.complete(checkout);assert.equal(f.tier().amount,0);
 });
 test(`unsigned owner metadata and unbound completed events cannot recover ${amount}`,async()=>{
  const f=fixture(amount),data={id:id('txn',999),status:'completed',customer_id:id('ctm',1),custom_data:{lumira_user_id:'alice',badgePolicy:{admin:'legacy',user:'legacy'}},items:[{price:{id:catalog.find(row=>row.amount===amount).priceId}}]};
  await applyPaddleEvent(f.db,newEvent('transaction.completed',data),catalog);assert.equal(f.tier().amount,0);assert.equal(f.get('serverPaddleAccounts/alice'),null);
 });
 test(`caller cannot choose or overwrite the policy snapshot for ${amount}`,async()=>{
  const f=fixture(amount,'both',true),result=await f.call({action:'checkout',amount,id:'forged-policy-checkout',badgePolicy:{admin:'attacker',user:'attacker'}});
  assert.equal(result.http,200);assert.deepEqual(f.get('serverPaddleTransactions/'+result.transactionId+'/badgePolicy'),{admin:'revoke-before-checkout',user:'remove-before-checkout'});
 });
 test(`a real raw-body SDK signature is required before paid ${amount} is provisioned`,async()=>{
  const f=fixture(amount,'both',true),checkout=await f.checkout(),data={...f.transactions.get(checkout.transactionId),status:'completed',...(amount!==100?{subscription_id:id('sub',42)}:{})};
  const raw=JSON.stringify(newEvent('transaction.completed',data)),stamp=String(Math.floor(Date.now()/1000));
  const webhook=createPaddleWebhook({getAdmin:async()=>({db:f.db}),env});
  const delivery=signature=>webhook(new Request('https://lumira-tr.com/.netlify/functions/paddle-webhook',{method:'POST',headers:{'paddle-signature':signature},body:raw}));
  assert.equal((await delivery('ts='+stamp+';h1='+'0'.repeat(64))).status,401);assert.equal(f.tier().amount,0);
  const signature='ts='+stamp+';h1='+createHmac('sha256',env.PADDLE_NOTIFICATION_WEBHOOK_SECRET).update(stamp+':'+raw).digest('hex');
  const response=await delivery(signature);assert.equal(response.status,200,await response.text());assert.equal(f.tier().amount,amount);
 });
}
for(const status of ['active','trialing','past_due'])test(`an existing renewing ${status} subscription still prevents a second charge`,async()=>{
 const f=fixture(10);f.set('serverPaddleAccounts/alice/subscriptions/'+id('sub',8),{id:id('sub',8),provider:'paddle',amount:5,status,lifetime:false,cancelAt:null});
 assert.equal((await f.checkout()).error,'billing_subscription_exists');assert.equal(f.calls.length,0);
});
test('anonymous checkout never creates a provider transaction or private binding',async()=>{const f=fixture(5);assert.equal((await f.call({action:'checkout',amount:5,id:'anonymous-checkout'},'')).http,401);assert.equal(f.calls.length,0);});

for(const code of ['invalid_token','authentication_missing','authentication_malformed'])test('Paddle '+code+' is authentication rather than missing permissions',async()=>{
 const api=createPaddleApi({env,fetcher:async()=>Response.json({error:{code},meta:{request_id:'fixture-request-id'}},{status:403})});
 await assert.rejects(api.call('/products'),error=>error.code==='billing_authentication'&&error.providerCode===code&&error.httpStatus===403&&error.requestId==='fixture-request-id');
});
test('a real forbidden response retains its exact permission diagnosis',async()=>{
 const api=createPaddleApi({env,fetcher:async()=>Response.json({error:{code:'forbidden'}},{status:403})});await assert.rejects(api.call('/products'),error=>error.code==='billing_permissions'&&error.providerCode==='forbidden');
});
for(const value of ['apikey_fixture_id','live_browser_token','test_browser_token','pdl_live_masked****','pdl_live_key internal-space'])test('malformed API credentials never leave the server: '+value,async()=>{
 let called=false;const api=createPaddleApi({env:{...env,PADDLE_API_KEY:value},fetcher:async()=>{called=true;return Response.json({});}});await assert.rejects(api.call('/products'),error=>error.code==='billing_authentication');assert.equal(called,false);
});
test('outer whitespace on a copied secret is normalized before the provider request',async()=>{
 let authorization;const api=createPaddleApi({env:{...env,PADDLE_API_KEY:' pdl_live_fixture\n'},fetcher:async(_url,options)=>{authorization=options.headers.Authorization;return Response.json({data:[]});}});await api.call('/products');assert.equal(authorization,'Bearer pdl_live_fixture');
});
test('admin diagnostics return safe provider codes without exposing key or response detail',async()=>{
 const api=createPaddleApi({env,fetcher:async()=>Response.json({error:{code:'invalid_token',detail:'private '+env.PADDLE_API_KEY},meta:{request_id:'fixture-request-id'}},{status:403})}),result=await auditPaddle(api),text=JSON.stringify(result);
 assert.equal(result.tax.providerCode,'invalid_token');assert.equal(result.tax.httpStatus,403);assert(!text.includes(env.PADDLE_API_KEY));assert(!text.includes('private '));
});

const pwaSource=await readFile(new URL('../pwa.js',import.meta.url),'utf8');
const errorCode=pwaSource.slice(pwaSource.indexOf("var ERR_KEY = 'lumira_errors_v1';"),pwaSource.indexOf('function openErrorReport()'));
function errorFixture(lang='tr',initial=[]){
 const values=new Map([['lumira_errors_v1',initial]]),handlers={};
 const ctx=vm.createContext({window:{NATIVE_LANG:lang},location:{href:'https://lumira-tr.com/?token=private-fragment#secret',origin:'https://lumira-tr.com'},navigator:{userAgent:'fixture'},URL,Date,JSON,Number,Array,Object,String,CONFIG:{},addEventListener:(name,handler)=>handlers[name]=handler,store:function(key,value){if(arguments.length>1)values.set(key,value);return values.get(key);}});
 vm.runInContext(errorCode+';this.service={logError,setupErrorReporting,errorSource,errorSourceLabel,groupErrors,cleanErrorText};',ctx);
 return{service:ctx.service,handlers,records:()=>values.get('lumira_errors_v1')};
}
const extensionStack="TypeError: Cannot read properties of undefined (reading 'M_ID')\n at Y (chrome-extension://fixture-extension/executors/200.js:1:761)\n at E (chrome-extension://fixture-extension/executors/200.js:1:1442)";
for(const lang of langs)for(const [kind,stack]of [['extension',extensionStack],['app',extensionStack+'\n at checkout (https://lumira-tr.com/billing.js:1:12)'],['external','Error\n at init (https://cdn.paddle.com/paddle.js:1:5)'],['unknown','Error without a source']])test(`error origin ${kind} is labeled in ${lang} without suppressing application errors`,()=>{
 const f=errorFixture(lang);f.service.logError({message:"Cannot read properties of undefined (reading 'M_ID')",stack});assert.equal(f.records().length,1);assert.equal(f.records()[0].kind,kind);assert(f.service.errorSourceLabel(kind).length>3);
});
test('unhandled promise rejection retains its original extension stack',()=>{
 const f=errorFixture();f.service.setupErrorReporting();f.handlers.unhandledrejection({reason:{message:"Cannot read properties of undefined (reading 'M_ID')",stack:extensionStack}});assert.equal(f.records()[0].kind,'extension');assert(f.records()[0].s.includes('executors/200.js:1:761'));
});
test('the same extension failure is counted once while a separate app failure remains visible',()=>{
 const f=errorFixture();for(let i=0;i<100;i++)f.service.logError({message:'M_ID fixture',stack:extensionStack});f.service.logError({message:'Checkout failed',stack:'Error\n at buy (https://lumira-tr.com/billing.js:10:2)'});
 assert.equal(f.records().length,2);assert.equal(f.records()[1].count,100);assert.equal(f.records()[0].kind,'app');
});
test('historical duplicate records are grouped without deleting the stored history',()=>{
 const old=Array.from({length:40},()=>({m:'Promise: M_ID fixture',t:new Date().toISOString(),s:''})),f=errorFixture('tr',old),grouped=f.service.groupErrors(f.records());assert.equal(grouped.length,1);assert.equal(grouped[0].count,40);assert.equal(f.records().length,40);
});
test('diagnostics redact secret API values, bearer tokens, and URL query data',()=>{
 const f=errorFixture();f.service.logError({message:'pdl_live_apikey_fixture_secret Bearer fixture.jwt.value',stack:'Error\n at checkout (https://lumira-tr.com/billing.js?auth=secret:10:2)'});const record=f.records()[0],text=JSON.stringify(record);assert(!text.includes('fixture_secret'));assert(!text.includes('fixture.jwt.value'));assert(!text.includes('auth=secret'));assert(!text.includes('private-fragment'));assert(record.s.includes('billing.js:10:2'));
});

const billingSource=await readFile(new URL('../billing.js',import.meta.url),'utf8');
function browserFixture(lang='tr',{needsClientToken=false,fail=false}={}){
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.attributes={};this.textContent='';this.isConnected=true;}
  append(...items){this.children.push(...items);}
  appendChild(item){this.children.push(item);return item;}
  replaceChildren(...items){this.children=[...items];}
  setAttribute(name,value){this.attributes[name]=value;}
  select(){}
 }
 const user={uid:'alice',email:'learner@example.test'},bodies=[],notices=[],overlays=[],calls=[];
 const config={environment:'production',clientToken:env.PADDLE_CLIENT_TOKEN,checkoutReady:true,catalog};
 const document={currentScript:{src:'https://lumira-tr.com/billing.js'},referrer:'',readyState:'loading',addEventListener(){},createElement:tag=>new Element(tag)};
 const root={NATIVE_LANG:lang,location:{href:'https://lumira-tr.com/',origin:'https://lumira-tr.com'},firebase:{auth:()=>({currentUser:user})},addEventListener(){},LUMIRA_BACKEND:{url:()=> 'https://lumira-tr.com/.netlify/functions/billing'},LUMIRA_ACCESS_COPY:{text:key=>key==='names'?amounts.map(String):key},LUMIRA_ACCESS:{close(){}},LUMIRA_FEATURES:{id:()=> 'fixture-browser-operation',service:async(_service,action,params)=>{
  calls.push({action,params});
  if(action==='setup')return{...config,clientToken:env.PADDLE_CLIENT_TOKEN,needsClientToken};
  if(action==='audit')return{environment:'production',tax:{ok:true,data:{default_tax_mode:'exclusive'}}};
  if(fail)throw Object.assign(Error('fixture'),{featureCode:'billing_unavailable'});
  return{url:'https://lumira-tr.com/checkout/?_ptxn='+id('txn',1),transactionId:id('txn',1)};
 }},PWA:{sheet:(_title,_subtitle,render)=>{const body=new Element('section');bodies.push(body);render(body,{close(){}});},toast:(text,options)=>{const notice={text,kind:options?.kind,visible:true};notices.push(notice);return()=>{notice.visible=false;};},logError(){}}};
 root.LUMIRA_PADDLE_LOADER={initializePaddle:async()=>({PricePreview:async params=>({data:{details:{lineItems:params.items.map(row=>({price:{id:row.priceId},formattedTotals:{total:'Paddle '+row.priceId}}))}}}),Checkout:{open:options=>overlays.push(options)}})};
 vm.runInNewContext(billingSource,{window:root,document,location:{...root.location,assign(){}},crypto:{randomUUID:()=> 'fixture-random-operation'},fetch:async()=>Response.json(config),URL,Map,Set,Date,Promise,Object,Error,Number,String,AbortSignal,setTimeout,clearTimeout,Event});
 const text=element=>[element.textContent,...element.children.map(text)].join(' ');
 return{service:root.LUMIRA_BILLING,bodies,notices,overlays,calls,text};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const lang of langs){
 test(`configured token does not keep asking for Netlify setup in ${lang}`,async()=>{
  const f=browserFixture(lang);f.service.setup();await settle();const body=f.bodies[0];assert(!f.text(body).includes('PADDLE_CLIENT_TOKEN'));assert.equal(body.children.filter(item=>item.tagName==='INPUT').length,1);
 });
 test(`missing token configuration has a localized instruction in ${lang}`,async()=>{
  const f=browserFixture(lang,{needsClientToken:true});f.service.setup();await settle();assert(f.text(f.bodies[0]).includes('PADDLE_CLIENT_TOKEN'));
 });
 test(`repeated account inspections replace their previous result in ${lang}`,async()=>{
  const f=browserFixture(lang);f.service.setup();await settle();const body=f.bodies[0],audit=body.children.find(item=>item.tagName==='BUTTON'),output=body.children.find(item=>item.className==='billing-audit');
  await audit.onclick();const before=output.children.length;await audit.onclick();assert.equal(output.children.length,before);assert.equal(f.calls.filter(row=>row.action==='audit').length,2);
 });
 test(`repeated failed checkout replaces its progress/error notice in ${lang}`,async()=>{
  const f=browserFixture(lang,{fail:true});await f.service.purchase(5);await f.service.purchase(5);assert.equal(f.notices.filter(row=>row.visible).length,1);assert.equal(f.notices.at(-1).kind,'bad');assert(!f.notices.find(row=>row.kind===undefined)?.visible);
 });
 test(`successful checkout closes the progress notice and opens exact one-page transaction in ${lang}`,async()=>{
  const f=browserFixture(lang);await f.service.catalog();await f.service.purchase(10);assert.equal(f.notices.filter(row=>row.visible).length,0);assert.equal(f.overlays.length,1);assert.equal(f.overlays[0].transactionId,id('txn',1));assert.equal(f.overlays[0].settings.variant,'one-page');assert.equal(f.overlays[0].settings.locale,lang);
 });
}
