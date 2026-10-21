import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const billingSource=await readFile(new URL('../billing.js',import.meta.url),'utf8');
const pageSource=await readFile(new URL('../web-pages.js',import.meta.url),'utf8');
const transactionId='txn_'+String(4).padStart(26,'0');
const priceId='pri_'+String(4).padStart(26,'0');
const languages=['tr','en','de','ar','fr','es','ru'];
const accounts=[
 {name:'username account',user:{uid:'alice',email:'su@dilkartlari-user.app'}},
 {name:'uppercase username address',user:{uid:'alice',email:'SU@DILKARTLARI-USER.APP'}},
 {name:'account without email',user:{uid:'alice'}},
 {name:'invalid email',user:{uid:'alice',email:'invalid email'}},
 {name:'real email',user:{uid:'alice',email:'learner@example.test'},email:'learner@example.test'},
 {name:'trimmed real email',user:{uid:'alice',email:' learner@example.test '},email:'learner@example.test'}
];

// Paddle's public contract: supplying customer/address requires email or id.
// The real CDN runtime is also exercised separately before delivery.
function validateCheckout(options){
 assert.match(options.transactionId,/^txn_[a-z\d]{26}$/);
 assert.equal(options.items,undefined);
 assert.equal(options.settings.displayMode,'overlay');
 assert.equal(options.settings.variant,'one-page');
 assert.equal(new URL(options.settings.successUrl).origin,'https://lumira-tr.com');
 if(options.customer){
  assert(Boolean(options.customer.email)!==Boolean(options.customer.id),'customer ID or email is required');
  assert(!/@dilkartlari-user\.app$/i.test(options.customer.email||''),'internal login address must stay private');
 }
}

export function checkoutFixture({language='tr',country,user={uid:'alice',email:'su@dilkartlari-user.app'},standalone=false,onOpen=()=>{}}={}){
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.dataset={};this.attributes={};this.classList={add(){}};this.textContent='';}
  append(...items){this.children.push(...items);}
  appendChild(item){this.children.push(item);return item;}
  setAttribute(key,value){this.attributes[key]=value;}
  insertAdjacentHTML(){}
 }
 const errors=[],overlays=[],calls=[],navigation=[],previews=[],main=new Element('main');
 const config={environment:'production',clientToken:'live_fixture_public',checkoutReady:true,...(country!==undefined?{country}:{}),catalog:[{amount:10,priceId,lifetime:false}]};
 const location={origin:'https://lumira-tr.com',href:'https://lumira-tr.com/'+(standalone?'checkout/?_ptxn='+transactionId+'&return=github&lang='+language:'?web=1'),assign:url=>navigation.push(url)};
 const document={readyState:'loading',referrer:'',currentScript:{src:'https://lumira-tr.com/billing.js'},documentElement:{},body:{dataset:{page:'checkout'}},querySelector:()=>main,createElement:tag=>new Element(tag),addEventListener(){}};
 const auth={currentUser:user,onAuthStateChanged:callback=>queueMicrotask(()=>callback(user))};
 const root={NATIVE_LANG:language,location,document,navigator:{language},firebase:{apps:[{}],auth:()=>auth},addEventListener(){},LUMIRA_BACKEND:{url:()=> 'https://lumira-tr.com/.netlify/functions/billing'},LUMIRA_ACCESS:{close(){}},LUMIRA_FEATURES:{id:()=> 'fixture-checkout-1104',service:async(_service,action,params)=>{
  calls.push({action,params});return{url:'https://lumira-tr.com/checkout/?_ptxn='+transactionId,transactionId};
 }},PWA:{toast:()=>()=>{},logError:error=>errors.push(error)}};
 const paddle={PricePreview:async options=>{previews.push(options);return{data:{details:{lineItems:options.items.map(item=>({price:{id:item.priceId},formattedTotals:{total:'10,00 €'}}))}}};},Checkout:{open:options=>{onOpen(options);validateCheckout(options);overlays.push(options);}}};
 root.LUMIRA_PADDLE_LOADER={initializePaddle:async()=>paddle};
 const ctx=vm.createContext({...root,window:root,document,location,navigator:root.navigator,URL,AbortSignal,setTimeout,clearTimeout,Event,queueMicrotask,fetch:async()=>Response.json(config)});
 vm.runInContext(billingSource,ctx);
 if(standalone){ctx.LUMIRA_BILLING=root.LUMIRA_BILLING;vm.runInContext(pageSource,ctx);}
 return{service:root.LUMIRA_BILLING,ctx,root,config,overlays,errors,calls,navigation,previews,main,transactionId};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

for(const standalone of [false,true])for(const language of languages)for(const country of ['AT',undefined])for(const account of accounts){
 test(`${standalone?'payment page':'app overlay'}: ${account.name}, ${country||'IP detection'}, ${language}`,async()=>{
  const f=checkoutFixture({standalone,language,country,user:account.user});
  if(standalone)await settle();else{await f.service.catalog();await f.service.purchase(10,{priceId});}
  assert.equal(f.errors.length,0);assert.equal(f.navigation.length,0);assert.equal(f.overlays.length,1,'checkout must actually reach the SDK');
  const options=f.overlays[0];assert.equal(options.transactionId,transactionId);assert.equal(options.settings.locale,language);
  if(account.email){assert.equal(options.customer.email,account.email);assert.equal(options.customer.address?.countryCode,country);}
  else assert.equal(Object.hasOwn(options,'customer'),false,'let Paddle collect the real buyer email instead of sending address alone');
  assert.equal(new URL(options.settings.successUrl).pathname,'/welcome/');
  if(standalone)assert.equal(new URL(options.settings.successUrl).searchParams.get('return'),'github');
  else{assert.equal(f.calls.length,1);assert.equal(f.calls[0].params.priceId,priceId);assert.equal(f.previews[0].address?.countryCode,country);}
 });
}
test('signed-out payment-link visitors can supply their details directly in Paddle',async()=>{
 const f=checkoutFixture({standalone:true,country:'AT',user:null});await settle();assert.equal(f.overlays.length,1);assert.equal(Object.hasOwn(f.overlays[0],'customer'),false);
});
test('customer prefill omits incomplete details and unknown country sentinels',()=>{
 const {service}=checkoutFixture();for(const user of [null,{}, {email:null},{email:42},{email:' '},{email:'@example.test'},{email:'learner@'},{email:'su@dilkartlari-user.app '}])assert.equal(service.checkoutCustomer(user,'AT'),null);
 for(const country of [undefined,null,'','OTHERS','AT?','at',{},['AT']]){
  const customer=service.checkoutCustomer({email:'learner@example.test'},country);assert.equal(customer.email,'learner@example.test');assert.equal(Object.hasOwn(customer,'address'),false);
 }
});
