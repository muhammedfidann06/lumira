(function(root){'use strict';
 const store='https://play.google.com/store/apps/details?id=com.lumira.dilkartlari';
 function shouldRedirect(c){
  const{ua='',platform='',touch=0,referrer='',search='',standalone=false,digitalGoods=false,native=false,embedded=false}=c,q=new URLSearchParams(search);
  if(/iPhone|iPad|iPod/i.test(ua)||(/Mac/i.test(platform)&&touch>1)||(!/Android/i.test(ua)&&platform!=='Android'))return false;
  if(standalone||digitalGoods||native||embedded||/android-app:\/\//i.test(referrer)||/\bwv\b|Version\/4\.0.*Chrome\//i.test(ua))return false;
  if(['twa','pwa','shortcut','play','playstore'].includes((q.get('src')||'').toLowerCase())||q.get('web')==='1'||/play\.google\.com/i.test(referrer))return false;
  if([...q.keys()].some(k=>/^(mode|oobCode|_ptxn|transaction_id|checkout|payment|purchaseToken)$/i.test(k)))return false;
  return true;
 }
 root.LUMIRA_PLATFORM={shouldRedirect,storeUrl:store};
 const route=()=>{let embedded=true;try{embedded=root.self!==root.top;}catch{}
  if(!shouldRedirect({ua:navigator.userAgent,platform:navigator.userAgentData?.platform||navigator.platform,touch:navigator.maxTouchPoints,referrer:document.referrer,search:location.search,standalone:!!(navigator.standalone||['standalone','fullscreen','minimal-ui'].some(m=>root.matchMedia?.('(display-mode: '+m+')').matches)),digitalGoods:typeof root.getDigitalGoodsService==='function',native:!!(root.Android||root.ReactNativeWebView||root.Capacitor?.isNativePlatform?.()),embedded}))return;
  try{if(sessionStorage.getItem('lumira_store_visit'))return;sessionStorage.setItem('lumira_store_visit','1');}catch{return;}
  location.replace(store);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',route,{once:true});else route();
})(window);
