/* Reset runs in an isolated page: unloading the app first releases model
   workers, pending downloads and open data stores before removing their files. */
(function(root){'use strict';
 const script=document.currentScript,scope=new URL('./',script?.src||location.href),key='lumira_device_reset_request';
 const ownKey=/^(?:lumira[_:]|pwa_|pm_|nb_|lt_|wp_|dc_|deu_|card_|vocab_)/i;
 const authKey=value=>/^firebase:/i.test(value);
 const dedicated=scope.pathname==='/',channelName='lumira-device-reset-'+scope.pathname;
 let channel,flight,request;
 try{channel=new BroadcastChannel(channelName);}catch{}
 const copy={
  tr:['Cihaz verileri temizleniyor','İndirmeler durduruluyor; sözlükler, ses modelleri ve yerel önbellek kaldırılıyor. Girişin korunacak.','Temizlik tamamlandı','Uygulama yeniden açılıyor…','Temizlik tamamlanamadı. Diğer Lumira pencerelerini kapatıp tekrar dene.','Tekrar dene','Bu işlem uygulamadaki veri temizleme düğmesinden başlatılmalı.'],
  en:['Clearing device data','Stopping downloads and removing dictionaries, speech models and local caches. You will stay signed in.','Cleanup complete','Reopening the app…','Cleanup could not finish. Close other Lumira windows and retry.','Retry','Start this operation from the app’s clear-data button.'],
  de:['Gerätedaten werden gelöscht','Downloads werden beendet; Wörterbücher, Sprachmodelle und lokale Caches werden entfernt. Du bleibst angemeldet.','Löschen abgeschlossen','Die App wird wieder geöffnet…','Das Löschen konnte nicht abgeschlossen werden. Schließe andere Lumira-Fenster und versuche es erneut.','Erneut versuchen','Starte diesen Vorgang über die Schaltfläche zum Löschen der Daten in der App.'],
  ar:['جارٍ مسح بيانات الجهاز','جارٍ إيقاف التنزيلات وحذف القواميس ونماذج الصوت والذاكرة المؤقتة المحلية. سيبقى تسجيل دخولك محفوظًا.','اكتمل المسح','جارٍ فتح التطبيق مجددًا…','تعذر إكمال المسح. أغلق نوافذ Lumira الأخرى وحاول مجددًا.','إعادة المحاولة','ابدأ هذه العملية من زر مسح البيانات داخل التطبيق.'],
  fr:['Effacement des données de l’appareil','Arrêt des téléchargements et suppression des dictionnaires, modèles vocaux et caches locaux. Tu resteras connecté.','Nettoyage terminé','Réouverture de l’application…','Le nettoyage n’a pas abouti. Ferme les autres fenêtres Lumira et réessaie.','Réessayer','Lance cette opération avec le bouton d’effacement des données dans l’application.'],
  es:['Borrando los datos del dispositivo','Deteniendo descargas y eliminando diccionarios, modelos de voz y cachés locales. Tu sesión seguirá abierta.','Limpieza completada','Abriendo la aplicación…','No se pudo completar la limpieza. Cierra otras ventanas de Lumira e inténtalo de nuevo.','Reintentar','Inicia esta operación desde el botón de borrar datos de la aplicación.'],
  ru:['Удаление данных устройства','Остановка загрузок и удаление словарей, голосовых моделей и локального кеша. Вход в аккаунт сохранится.','Очистка завершена','Приложение открывается…','Не удалось завершить очистку. Закрой другие окна Lumira и повтори.','Повторить','Запусти эту операцию кнопкой удаления данных в приложении.']
 };
 const lang=value=>Object.hasOwn(copy,value)?value:'tr';
 function quiesce(){
  root.LUMIRA_CLEARING_DATA=true;
  root.LUMIRA_LIVE?.stop('stopped',false,true);root.LUMIRA_STORIES?.unmount();root.VOICE_stop?.();root.speechSynthesis?.cancel();
  root.dispatchEvent(new Event('lumira:storagepause'));
 }
 function send(message){try{channel?.postMessage(message);}catch{}}
 channel?.addEventListener('message',event=>{
  if(event.data?.scope!==scope.pathname)return;
  if(event.data.type==='pause')quiesce();
  if(event.data.type==='done'&&root.LUMIRA_CLEARING_DATA&&!document.body?.hasAttribute('data-storage-reset'))location.replace(scope.href+'?__ping=lumira-reset-'+Date.now());
 });
 navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='LUMIRA_STORAGE_PAUSE')quiesce();});
 const bounded=(promise,ms)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('storage_timeout')),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
 async function workers(){
  if(!navigator.serviceWorker?.getRegistrations)return;
  const registrations=await navigator.serviceWorker.getRegistrations();
  for(const registration of registrations){
   if(registration.scope!==scope.href)continue;
   for(const worker of new Set([registration.active,registration.waiting,registration.installing].filter(Boolean))){
    const pair=new MessageChannel();
    await new Promise(resolve=>{const done=()=>{clearTimeout(timer);pair.port1.close();resolve();},timer=setTimeout(done,1500);pair.port1.onmessage=done;try{worker.postMessage({type:'QUIESCE_STORAGE'},[pair.port2]);}catch{done();}});
   }
   await registration.unregister();
  }
 }
 const ownedCache=name=>dedicated||name.startsWith('lumira-');
 async function clearCaches(){
  if(!root.caches)return;
  for(const name of await caches.keys()){
   if(ownedCache(name)){await caches.delete(name);}
   else if(/transformers|huggingface|onnx|tfjs/i.test(name)){
    const cache=await caches.open(name);for(const item of await cache.keys())if(/\/Xenova\/whisper-(?:base|tiny)\//.test(new URL(item.url).pathname))await cache.delete(item);
   }
  }
  if((await caches.keys()).some(ownedCache))throw Error('cache_still_present');
 }
 const authDatabase=name=>/^firebase.*(?:localstorage|auth)/i.test(name);
 async function clearDatabase(name){
  // Clear first: attempting another open after a blocked delete queues it
  // behind the deletion and cannot make progress while another tab is open.
  await bounded(new Promise((resolve,reject)=>{const open=indexedDB.open(name);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,stores=[...db.objectStoreNames];if(!stores.length){db.close();resolve();return;}const tx=db.transaction(stores,'readwrite');for(const store of stores)tx.objectStore(store).clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};};}),6000);
  await bounded(new Promise((resolve,reject)=>{const deletion=indexedDB.deleteDatabase(name);deletion.onsuccess=resolve;deletion.onblocked=resolve;deletion.onerror=()=>reject(deletion.error);}),6000);
 }
 async function clearDatabases(){
  if(!root.indexedDB)return;
  const list=indexedDB.databases?await indexedDB.databases():['keyval-store','transformers','huggingface','onnxruntime','tfjs-models','localforage'].map(name=>({name}));
  for(const item of list)if(item.name&&!authDatabase(item.name)&&(dedicated||/lumira|whisper|transformers|huggingface|onnx|tfjs/i.test(item.name)))await clearDatabase(item.name);
 }
 async function clearFiles(){
  if(!navigator.storage?.getDirectory)return;
  const directory=await navigator.storage.getDirectory();for await(const [name]of directory.entries())if(dedicated||/^lumira|whisper|transformers|huggingface|onnx/i.test(name))await directory.removeEntry(name,{recursive:true});
 }
 function clearStorage(storage){for(const name of Object.keys(storage))if(!authKey(name)&&(dedicated||ownKey.test(name)))storage.removeItem(name);}
 async function begin(){
  if(flight)return flight;
  flight=(async()=>{
   const nonce=crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(20)),v=>v.toString(16).padStart(2,'0')).join('');
   const target=new URL(scope.href),current=new URL(location.href);for(const param of['src','web'])if(current.searchParams.has(param))target.searchParams.set(param,current.searchParams.get(param));
   const value={nonce,scope:scope.pathname,returnTo:target.href,lang:lang(root.NATIVE_LANG||localStorage.getItem('lumira_native_lang')),createdAt:Date.now()};
   sessionStorage.setItem(key,JSON.stringify(value));quiesce();send({type:'pause',scope:scope.pathname});
   // Navigation unloads this document and its model workers. The reset page
   // contains no Firebase initialization, model imports or worker registration.
   location.assign(new URL('reset/?nonce='+encodeURIComponent(nonce),scope).href);
  })().catch(error=>{flight=null;root.LUMIRA_CLEARING_DATA=false;throw error;});return flight;
 }
 async function finish(){
  if(flight)return flight;
  flight=(async()=>{
   request=request||JSON.parse(sessionStorage.getItem(key)||'null');
   const nonce=new URL(location.href).searchParams.get('nonce'),returnTo=request?.returnTo?new URL(request.returnTo):null;
   if(!request||request.nonce!==nonce||request.scope!==scope.pathname||!returnTo||returnTo.origin!==location.origin||returnTo.pathname!==scope.pathname||Date.now()-request.createdAt>600000)throw Error('invalid_reset_request');
   const language=lang(request.lang),words=copy[language];document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.querySelector('h1').textContent=words[0];document.querySelector('[data-reset-note]').textContent=words[1];
   quiesce();send({type:'pause',scope:scope.pathname});await bounded(workers(),7000);await clearDatabases();await clearFiles();await clearCaches();
   clearStorage(localStorage);clearStorage(sessionStorage);sessionStorage.removeItem(key);
   document.querySelector('h1').textContent=words[2];document.querySelector('[data-reset-note]').textContent=words[3];document.body.dataset.resetComplete='true';send({type:'done',scope:scope.pathname});
   setTimeout(()=>{returnTo.searchParams.set('__ping','lumira-reset-'+Date.now());location.replace(returnTo.href);},1200);
  })().catch(error=>{
   flight=null;const language=lang(request?.lang||'tr'),words=copy[language],note=document.querySelector('[data-reset-note]'),retry=document.querySelector('[data-reset-retry]');if(note)note.textContent=error.message==='invalid_reset_request'?words[6]:words[4];if(retry){retry.textContent=words[5];retry.hidden=error.message==='invalid_reset_request';retry.onclick=()=>{retry.hidden=true;finish().catch(()=>{});};}throw error;
  });return flight;
 }
 root.LUMIRA_STORAGE={begin,finish};
 document.addEventListener('DOMContentLoaded',()=>{if(document.body.hasAttribute('data-storage-reset'))finish().catch(()=>{});},{once:true});
})(window);
