(function(root){'use strict';
 const products=[1,5,10,25,50,100].map(amount=>({amount,sku:'lumira_support_'+amount+(amount===100?'':'_monthly'),lifetime:amount===100}));
 const copy={
  tr:['Mağaza fiyatları yükleniyor…','Mağaza ürünleri şu anda alınamıyor. Yeniden deneyebilirsin.','Bu ürün Google Play’de henüz satışa hazır değil.','Satın alma hizmeti güncellenmeyi bekliyor. Biraz sonra yeniden dene.','Yeniden dene','Google Play satın alma bağlantısı bu cihazda kullanılamıyor.','Bu ürünün aylık planı uygun değil.','Satın alma tamamlanamadı. Yeniden deneyebilirsin.'],
  en:['Loading store prices…','Store products could not load. You can retry.','This product is not available on Google Play yet.','The purchase service is awaiting an update. Please try again later.','Retry','Google Play purchases are unavailable on this device.','This product does not have the required monthly plan.','The purchase could not finish. You can retry.'],
  de:['Store-Preise werden geladen…','Store-Produkte konnten nicht geladen werden. Versuche es erneut.','Dieses Produkt ist bei Google Play noch nicht verfügbar.','Der Kaufdienst wartet auf ein Update. Versuche es später erneut.','Erneut versuchen','Google-Play-Käufe sind auf diesem Gerät nicht verfügbar.','Der erforderliche Monatsplan fehlt für dieses Produkt.','Der Kauf konnte nicht abgeschlossen werden. Versuche es erneut.'],
  ar:['جارٍ تحميل أسعار المتجر…','تعذر تحميل منتجات المتجر. يمكنك المحاولة مجددًا.','هذا المنتج غير متاح في Google Play بعد.','خدمة الشراء بانتظار تحديث. حاول لاحقًا.','إعادة المحاولة','مشتريات Google Play غير متاحة على هذا الجهاز.','لا تتوفر الخطة الشهرية المطلوبة لهذا المنتج.','تعذر إكمال الشراء. يمكنك المحاولة مجددًا.'],
  fr:['Chargement des prix du Store…','Impossible de charger les produits. Tu peux réessayer.','Ce produit n’est pas encore disponible sur Google Play.','Le service d’achat attend une mise à jour. Réessaie plus tard.','Réessayer','Les achats Google Play ne sont pas disponibles sur cet appareil.','Ce produit ne dispose pas du forfait mensuel requis.','L’achat n’a pas abouti. Tu peux réessayer.'],
  es:['Cargando precios de la tienda…','No se pudieron cargar los productos. Puedes reintentar.','Este producto aún no está disponible en Google Play.','El servicio de compras espera una actualización. Inténtalo más tarde.','Reintentar','Las compras de Google Play no están disponibles en este dispositivo.','Este producto no tiene el plan mensual necesario.','No se pudo completar la compra. Puedes reintentar.'],
  ru:['Загрузка цен магазина…','Не удалось загрузить товары. Можно повторить попытку.','Этот товар пока недоступен в Google Play.','Сервис покупок ожидает обновления. Попробуй позже.','Повторить','Покупки Google Play недоступны на этом устройстве.','У этого товара нет нужного месячного плана.','Не удалось завершить покупку. Можно попробовать снова.']
 };
 const text=i=>(copy[root.NATIVE_LANG]||copy.en)[i],failure=code=>Object.assign(Error(code),{featureCode:code});
 const reason=error=>{const value=String(error?.message||'').replace(/[^a-z]/gi,'').toLowerCase();const allowed=['unsupportedcontext','unsupportedpaymentmethod','clientappunavailable','clientapperror','itemalreadyowned','itemnotowned','itemunavailable','billingunavailable','serviceunavailable','servicedisconnected','error'];return allowed.find(code=>value===code||value.endsWith(code))||String(error?.featureCode||error?.name||'store_unavailable');};
 const log=(step,error)=>root.PWA?.logError?.({message:'Play '+step+': '+(error?.storeReason||reason(error)),stack:''});
 const issues={
 tr:['Google Play bağlantısı kurulamadı. Play Store ve Chrome’u güncelleyip uygulamayı Play Store’den açarak yeniden dene.','Bu uygulama paketinin Google Play ödeme bağlantısı kullanılamıyor. Play Store’deki son Lumira sürümünü yükleyip yeniden dene.','Google Play Store bu cihazda kullanılamıyor. Play Store hesabını ve uygulamanın mağazadan yüklendiğini kontrol et.'],
 en:['Could not connect to Google Play. Update Play Store and Chrome, then reopen Lumira from Play Store and retry.','Google Play billing is unavailable in this app package. Install the latest Lumira release from Play Store and retry.','Google Play Store is unavailable on this device. Check your store account and that the app was installed from Play Store.'],
 de:['Keine Verbindung zu Google Play. Aktualisiere Play Store und Chrome, öffne Lumira aus dem Play Store und versuche es erneut.','Google Play Billing ist in diesem App-Paket nicht verfügbar. Installiere die neueste Lumira-Version aus dem Play Store.','Google Play Store ist auf diesem Gerät nicht verfügbar. Prüfe dein Store-Konto und ob die App aus dem Play Store installiert wurde.'],
 ar:['تعذر الاتصال بـ Google Play. حدّث Play Store وChrome، ثم افتح Lumira من المتجر وحاول مجددًا.','الدفع عبر Google Play غير متاح في حزمة التطبيق هذه. ثبّت أحدث إصدار من Lumira من Play Store وحاول مجددًا.','Play Store غير متاح على هذا الجهاز. تحقق من حساب المتجر ومن تثبيت التطبيق عبر Play Store.'],
 fr:['Connexion à Google Play impossible. Mets à jour Play Store et Chrome, puis rouvre Lumira depuis Play Store et réessaie.','Le paiement Google Play est indisponible dans ce paquet. Installe la dernière version de Lumira depuis Play Store.','Play Store est indisponible sur cet appareil. Vérifie ton compte et que l’application a été installée depuis Play Store.'],
 es:['No se pudo conectar con Google Play. Actualiza Play Store y Chrome, abre Lumira desde Play Store y reintenta.','El pago con Google Play no está disponible en este paquete. Instala la última versión de Lumira desde Play Store.','Play Store no está disponible en este dispositivo. Comprueba tu cuenta y que la aplicación se instaló desde Play Store.'],
 ru:['Не удалось подключиться к Google Play. Обнови Play Store и Chrome, затем открой Lumira из Play Store и повтори.','Оплата Google Play недоступна в этом пакете приложения. Установи последнюю версию Lumira из Play Store.','Play Store недоступен на этом устройстве. Проверь аккаунт магазина и установку приложения через Play Store.']
 };
 const errorText=error=>{const index={store_unavailable:0,store_native_setup:1,store_app_unavailable:2}[error?.featureCode];return index===undefined?text(({store_item_unavailable:2,store_backend_pending:3,store_unsupported:5,store_plan_unavailable:6})[error?.featureCode]??1):(issues[root.NATIVE_LANG]||issues.en)[index];};
 const uid=()=>{try{return root.firebase.auth().currentUser?.uid||'';}catch{return'';}};
 const isNative=()=>typeof root.getDigitalGoodsService==='function'||/^android-app:/i.test(root.document.referrer)||new URL(root.location.href).searchParams.get('src')==='twa';
 const bounded=promise=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(failure('store_unavailable')),5000);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
 let serviceFlight,serviceValue;
 async function service({refresh=false}={}){
  if(refresh){serviceValue=null;serviceFlight=null;}if(serviceValue)return serviceValue;if(serviceFlight)return serviceFlight;
  const task=(async()=>{if(typeof root.getDigitalGoodsService!=='function')throw failure('store_unsupported');let last;for(let attempt=0;attempt<3;attempt++){try{const value=await bounded(root.getDigitalGoodsService('https://play.google.com/billing'));serviceValue=value;return value;}catch(error){last=error;const code=reason(error);if(['unsupportedcontext','unsupportedpaymentmethod','clientappunavailable','clientapperror'].includes(code)){const fault=failure(code==='clientappunavailable'||code==='clientapperror'?'store_app_unavailable':'store_native_setup');fault.storeReason=code;throw fault;}if(attempt<2)await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));}}const fault=failure('store_unavailable');fault.storeReason=reason(last);throw fault;})();serviceFlight=task;try{return await task;}finally{if(serviceFlight===task)serviceFlight=null;}
 }
 let purchases=[],purchasesUid='';
 async function owned(bridge,account){try{const rows=await bounded(bridge.listPurchases());if(uid()===account){purchases=Array.isArray(rows)?rows.filter(row=>products.some(product=>product.sku===row.itemId)&&typeof row.purchaseToken==='string'):[];purchasesUid=account;
    // Bind/verify the old receipt before a replacement can charge a new plan.
    // A Play account can contain purchases linked to another Lumira account.
    await Promise.all(purchases.filter(row=>/_monthly$/.test(row.itemId)).map(async row=>{try{await root.LUMIRA_FEATURES.verifyPurchase(row.itemId,row.purchaseToken,account);if(uid()===account)row.verifiedForAccount=true;}catch(error){row.verificationError=error.featureCode||'purchase_verification_unavailable';}}));
   }}catch{purchases=[];purchasesUid='';}}
 let pending,cache,until=0,cacheUid='',readyUid='',readyProducts=new Set();
 async function catalog({refresh=false}={}){
  const account=uid();
  if(!refresh&&cache&&cacheUid===account&&until>Date.now())return cache;if(pending&&pending.uid===account)return pending.promise;if(refresh){cache=null;until=0;readyUid='';readyProducts=new Set();}
  const task=(async()=>{
   if(typeof root.getDigitalGoodsService!=='function')throw failure('store_unsupported');
   const backend=account?(async()=>{try{const data=await root.LUMIRA_FEATURES.api('status',{}, {timeoutMs:8000});if(uid()!==account)throw failure('login_required');if(!Array.isArray(data.playProducts))throw failure('store_backend_pending');return new Set(data.playProducts);}catch(error){throw failure(error.featureCode==='login_required'?'login_required':'store_backend_pending');}})():Promise.resolve(null);
   backend.catch(()=>{});
   let bridge;try{bridge=await service({refresh});}catch(error){log('bridge',error);throw error;}
   const purchaseRead=owned(bridge,account);
   const result=new Map();result.errors=new Map();
   function accept(items){if(!Array.isArray(items))return;for(const item of items){const product=products.find(row=>row.sku===item.itemId);if(!product||!item.price||!Number.isFinite(Number(item.price.value))||Number(item.price.value)<0)continue;
    if(item.itemType&&item.itemType!==(product.lifetime?'product':'subscription')||!product.lifetime&&item.subscriptionPeriod&&item.subscriptionPeriod!=='P1M'){result.errors.set(product.sku,failure('store_plan_unavailable'));continue;}
    try{result.set(item.itemId,{...product,price:new Intl.NumberFormat(root.NATIVE_LANG||'tr',{style:'currency',currency:item.price.currency}).format(Number(item.price.value))});result.errors.delete(product.sku);}catch{}
   }}
   // Some Play bridges reject a mixed list of in-app products and subscriptions.
   for(const group of[products.slice(0,5),products.slice(5)])try{accept(await bounded(bridge.getDetails(group.map(row=>row.sku))));}catch(error){log('catalog',error);}
   // A missing or invalid product must not disable the remaining products.
   const missing=products.filter(row=>!result.has(row.sku)&&!result.errors.has(row.sku));
   await Promise.allSettled(missing.map(async row=>{try{accept(await bounded(bridge.getDetails([row.sku])));}catch{result.errors.set(row.sku,failure('store_item_unavailable'));}}));
   await purchaseRead;const supported=await backend;if(uid()!==account)throw failure('login_required');
   if(supported){readyUid=account;readyProducts=supported;for(const row of products)if(!supported.has(row.sku)){result.delete(row.sku);result.errors.set(row.sku,failure('store_backend_pending'));}}
   for(const row of products)if(!result.has(row.sku)&&!result.errors.has(row.sku))result.errors.set(row.sku,failure('store_item_unavailable'));
   cache=result;cacheUid=account;until=Date.now()+(result.size===products.length?30000:5000);return result;
  })();
  pending={uid:account,promise:task};try{return await task;}finally{if(pending?.promise===task)pending=null;}
 }
 const clear=()=>{cache=null;until=0;readyUid='';readyProducts=new Set();purchases=[];purchasesUid='';};
 root.LUMIRA_PLAY={products,catalog,service,reason,ownedPurchase:sku=>purchasesUid===uid()?purchases.find(row=>row.itemId===sku):null,replacement:()=>purchasesUid===uid()?purchases.find(row=>/_monthly$/.test(row.itemId)&&row.verifiedForAccount):null,replacementFailure:()=>purchasesUid===uid()?purchases.find(row=>/_monthly$/.test(row.itemId)&&!row.verifiedForAccount)?.verificationError:null,text,errorText,isNative,canPurchase:sku=>!!uid()&&readyUid===uid()&&readyProducts.has(sku)};
 root.addEventListener('lumira:localechange',()=>{cache=null;until=0;});root.addEventListener('lumira:featureauthchange',clear);
})(window);
