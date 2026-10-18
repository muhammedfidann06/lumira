/* Exact-sentence translations. Only dictionary examples are sent to the server. */
(function(root){
'use strict';
const copy={
 tr:{loading:'Örnek cümle çevriliyor…',automatic:'Otomatik örnek çevirisi',missing:'Bu örneğin çevirisi şu anda hazır değil.',offline:'Bu örneğin çevirisi henüz bu cihazda saklanmadı.',login:'Örnek çevirisini tamamlamak için giriş yap.',retry:'Yeniden dene'},
 en:{loading:'Translating the example…',automatic:'Automatic example translation',missing:'This example translation is not available right now.',offline:'This example translation has not been saved on this device yet.',login:'Sign in to complete the example translation.',retry:'Try again'},
 de:{loading:'Das Beispiel wird übersetzt…',automatic:'Automatische Beispielübersetzung',missing:'Diese Beispielübersetzung ist gerade nicht verfügbar.',offline:'Diese Beispielübersetzung wurde noch nicht auf diesem Gerät gespeichert.',login:'Melde dich an, um die Beispielübersetzung zu ergänzen.',retry:'Erneut versuchen'},
 ar:{loading:'جارٍ ترجمة المثال…',automatic:'ترجمة تلقائية للمثال',missing:'ترجمة هذا المثال غير متاحة حالياً.',offline:'لم تُحفظ ترجمة هذا المثال على هذا الجهاز بعد.',login:'سجّل الدخول لإكمال ترجمة المثال.',retry:'إعادة المحاولة'},
 fr:{loading:'Traduction de l’exemple…',automatic:'Traduction automatique de l’exemple',missing:'La traduction de cet exemple est indisponible pour le moment.',offline:'La traduction de cet exemple n’a pas encore été enregistrée sur cet appareil.',login:'Connecte-toi pour compléter la traduction de l’exemple.',retry:'Réessayer'},
 es:{loading:'Traduciendo el ejemplo…',automatic:'Traducción automática del ejemplo',missing:'La traducción de este ejemplo no está disponible ahora.',offline:'La traducción de este ejemplo aún no se ha guardado en este dispositivo.',login:'Inicia sesión para completar la traducción del ejemplo.',retry:'Reintentar'},
 ru:{loading:'Переводим пример…',automatic:'Автоматический перевод примера',missing:'Перевод этого примера сейчас недоступен.',offline:'Перевод этого примера ещё не сохранён на этом устройстве.',login:'Войдите, чтобы дополнить перевод примера.',retry:'Повторить'}
};
const LANGS=Object.keys(copy),KEY='lumira_example_translations_v1',MAX=1200,MAX_BYTES=1000000;
const key=(source,target,text)=>JSON.stringify([source,target,text]);
const cache=new Map(),queue=new Map(),pending=new Map(),failures=new Map();
let scheduled=false,running=0,authEpoch=0,cacheBytes=0;const controllers=new Set();
const user=()=>{try{return root.firebase.auth().currentUser;}catch{return null;}};
const language=()=>root.NATIVE_LANG || 'tr';
const label=name=>(copy[language()]||copy.tr)[name];
function valid(item){return item && LANGS.includes(item.source) && LANGS.includes(item.target) && item.source!==item.target && typeof item.sourceText==='string' && item.sourceText.length<=2000 && typeof item.translation==='string' && item.translation.trim() && item.translation.length<=3000;}
const size=item=>JSON.stringify(item).length*2;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(saved))for(const item of saved.slice(-MAX))store(item,false);}catch{}
function persist(){try{localStorage.setItem(KEY,JSON.stringify([...cache.values()].slice(-MAX)));}catch{ /* In-memory translations still work in private browsing. */ }}
function get(source,target,text){return cache.get(key(source,target,text))?.translation || '';}
function store(item,save=true){
 if(!valid(item))return false;
 const id=key(item.source,item.target,item.sourceText);if(cache.has(id))cacheBytes-=size(cache.get(id));cache.delete(id);cache.set(id,item);cacheBytes+=size(item);
 while(cache.size>MAX || cacheBytes>MAX_BYTES){const oldest=cache.keys().next().value;cacheBytes-=size(cache.get(oldest));cache.delete(oldest);}
 failures.delete(id);if(save)persist();return true;
}
function event(){root.dispatchEvent(new Event('lumira:exampletranslation'));}
function finish(job,value){if(pending.get(job.id)!==job)return;pending.delete(job.id);queue.delete(job.id);job.resolve(value);event();}
function request(source,target,text,{retry=false,priority=0}={}){
 const id=key(source,target,text),cached=get(source,target,text);if(cached)return Promise.resolve(cached);
 if(!LANGS.includes(source)||!LANGS.includes(target)||source===target||typeof text!=='string'||!text||text.length>2000)return Promise.resolve('');
 if(navigator.onLine===false){failures.set(id,'offline');return Promise.resolve('');}
 if(!user()){failures.set(id,'login');return Promise.resolve('');}
 if(pending.has(id)){pending.get(id).priority=Math.min(priority,pending.get(id).priority);return pending.get(id).promise;}
 if(!retry && failures.has(id))return Promise.resolve('');
 if(pending.size>=100){failures.set(id,'missing');return Promise.resolve('');}
 failures.delete(id);let resolve;const promise=new Promise(r=>resolve=r);
 const job={id,source,target,text,resolve,promise,retries:0,priority,created:Date.now()};pending.set(id,job);queue.set(id,job);schedule();return promise;
}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;flush();},40);}
async function flush(){
 if(running>=2 || !queue.size)return;
 const ordered=[...queue.values()].sort((a,b)=>a.priority-b.priority || b.created-a.created),first=ordered[0],jobs=ordered.filter(j=>j.source===first.source && j.target===first.target).slice(0,6);
 for(const j of jobs)queue.delete(j.id);
 running++;const uid=user()?.uid,epoch=authEpoch;let retry=[];const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);controllers.add(controller);
 try{
  const account=user();if(!account)throw Error('login');
  const token=await Promise.race([account.getIdToken(),new Promise((resolve,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('missing')),{once:true}))]);if(user()?.uid!==uid || epoch!==authEpoch)throw Error('login');
  let result,response;
  try{response=await fetch(root.LUMIRA_BACKEND?.url('examples') || '/.netlify/functions/examples',{method:'POST',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({source:first.source,target:first.target,texts:jobs.map(j=>j.text)})});result=await response.json();}finally{clearTimeout(timer);}
  if(user()?.uid!==uid || epoch!==authEpoch)throw Error('login');
  if(!response.ok || result?.source!==first.source || result?.target!==first.target || !Array.isArray(result.examples))throw Error(response.status===401?'login':'missing');
  const wanted=new Set(jobs.map(j=>j.text));
  for(const row of result.examples)if(wanted.has(row.sourceText))store({source:first.source,target:first.target,sourceText:row.sourceText,translation:row.translation},false);
  persist();
  for(const job of jobs){const value=get(job.source,job.target,job.text);if(value)finish(job,value);else if(result.pending && job.retries++<1)retry.push(job);else{failures.set(job.id,'missing');finish(job,'');}}
 }catch(e){for(const job of jobs){if(epoch===authEpoch && pending.get(job.id)===job)failures.set(job.id,e.message==='login'?'login':navigator.onLine===false?'offline':'missing');finish(job,'');}}
 finally{clearTimeout(timer);controllers.delete(controller);running--;if(retry.length)setTimeout(()=>{for(const job of retry)if(pending.get(job.id)===job)queue.set(job.id,job);schedule();},1500);if(queue.size)schedule();}
}
function state(source,target,text){const id=key(source,target,text);if(get(source,target,text))return'automatic';if(pending.has(id))return'loading';return failures.get(id) || (navigator.onLine===false?'offline':user()?'missing':'login');}
root.LUMIRA_EXAMPLES={get,request,state,label,copy};
root.addEventListener('online',()=>{failures.clear();root.refreshCardExample?.();});
root.addEventListener('lumira:featureauthchange',()=>{authEpoch++;for(const controller of controllers)controller.abort();queue.clear();for(const job of pending.values())job.resolve('');pending.clear();failures.clear();root.refreshCardExample?.();});
root.addEventListener('lumira:exampletranslation',()=>root.refreshCardExample?.());
root.refreshCardExample?.();
})(window);
