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
 const errorText=error=>text(({store_item_unavailable:2,store_backend_pending:3,store_unsupported:5,store_plan_unavailable:6})[error?.featureCode]??1);
 const uid=()=>{try{return root.firebase.auth().currentUser?.uid||'';}catch{return'';}};
 const isNative=()=>typeof root.getDigitalGoodsService==='function'||/^android-app:/i.test(root.document.referrer)||new URL(root.location.href).searchParams.get('src')==='twa';
 const bounded=promise=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(failure('store_unavailable')),5000);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
 let pending,cache,until=0,cacheUid='',readyUid='',readyProducts=new Set();
 async function catalog({refresh=false}={}){
  const account=uid();
  if(!refresh&&cache&&cacheUid===account&&until>Date.now())return cache;if(pending&&pending.uid===account)return pending.promise;
  const task=(async()=>{
   if(typeof root.getDigitalGoodsService!=='function')throw failure('store_unsupported');
   const backend=account?(async()=>{try{const data=await root.LUMIRA_FEATURES.api('status',{}, {timeoutMs:8000});if(uid()!==account)throw failure('login_required');if(!Array.isArray(data.playProducts))throw failure('store_backend_pending');return new Set(data.playProducts);}catch(error){throw failure(error.featureCode==='login_required'?'login_required':'store_backend_pending');}})():Promise.resolve(null);
   backend.catch(()=>{});
   let service;try{service=await bounded(root.getDigitalGoodsService('https://play.google.com/billing'));}catch{throw failure('store_unsupported');}
   const result=new Map();result.errors=new Map();
   function accept(items){if(!Array.isArray(items))return;for(const item of items){const product=products.find(row=>row.sku===item.itemId);if(!product||!item.price||!Number.isFinite(Number(item.price.value))||Number(item.price.value)<0)continue;
    if(!product.lifetime&&item.subscriptionPeriod&&item.subscriptionPeriod!=='P1M'){result.errors.set(product.sku,failure('store_plan_unavailable'));continue;}
    try{result.set(item.itemId,{...product,price:new Intl.NumberFormat(root.NATIVE_LANG||'tr',{style:'currency',currency:item.price.currency}).format(Number(item.price.value))});result.errors.delete(product.sku);}catch{}
   }}
   // Some Play bridges reject a mixed list of in-app products and subscriptions.
   await Promise.allSettled([products.slice(0,5),products.slice(5)].map(async group=>accept(await bounded(service.getDetails(group.map(row=>row.sku))))));
   // A missing or invalid product must not disable the remaining products.
   const missing=products.filter(row=>!result.has(row.sku)&&!result.errors.has(row.sku));
   await Promise.allSettled(missing.map(async row=>{try{accept(await bounded(service.getDetails([row.sku])));}catch{result.errors.set(row.sku,failure('store_item_unavailable'));}}));
   const supported=await backend;if(uid()!==account)throw failure('login_required');
   if(supported){readyUid=account;readyProducts=supported;for(const row of products)if(!supported.has(row.sku)){result.delete(row.sku);result.errors.set(row.sku,failure('store_backend_pending'));}}
   for(const row of products)if(!result.has(row.sku)&&!result.errors.has(row.sku))result.errors.set(row.sku,failure('store_item_unavailable'));
   cache=result;cacheUid=account;until=Date.now()+(result.size===products.length?30000:5000);return result;
  })();
  pending={uid:account,promise:task};try{return await task;}finally{if(pending?.promise===task)pending=null;}
 }
 const clear=()=>{cache=null;until=0;readyUid='';readyProducts=new Set();};
 root.LUMIRA_PLAY={products,catalog,text,errorText,isNative,canPurchase:sku=>!!uid()&&readyUid===uid()&&readyProducts.has(sku)};
 root.addEventListener('lumira:localechange',()=>{cache=null;until=0;});root.addEventListener('lumira:featureauthchange',clear);
})(window);
