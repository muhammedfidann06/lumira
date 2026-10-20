(function(root){'use strict';
 const products=[1,5,10,25,50,100].map(amount=>({amount,sku:'lumira_support_'+amount+(amount===100?'':'_monthly'),lifetime:amount===100}));
 let pending,cache,until=0;
 async function catalog(){
  if(cache&&until>Date.now())return cache;if(pending)return pending;
  pending=(async()=>{if(typeof root.getDigitalGoodsService!=='function')throw Error('store unavailable');const service=await root.getDigitalGoodsService('https://play.google.com/billing'),items=await service.getDetails(products.map(row=>row.sku)),result=new Map();
   for(const item of items){const product=products.find(row=>row.sku===item.itemId);if(!product||!item.price||!Number.isFinite(Number(item.price.value))||Number(item.price.value)<0)continue;if(!product.lifetime&&item.subscriptionPeriod&&item.subscriptionPeriod!=='P1M')continue;
    try{result.set(item.itemId,{...product,price:new Intl.NumberFormat(root.NATIVE_LANG||'tr',{style:'currency',currency:item.price.currency}).format(Number(item.price.value))});}catch{}
   }cache=result;until=Date.now()+30000;return result;
  })().finally(()=>pending=null);return pending;
 }
 root.LUMIRA_PLAY={products,catalog};
 root.addEventListener('lumira:localechange',()=>{cache=null;until=0;});
})(window);
