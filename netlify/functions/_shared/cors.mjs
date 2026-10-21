// The installed GitHub Pages app uses the same authenticated account API as
// Netlify. This allow-list is intentionally exact; never reflect arbitrary sites.
const APP_ORIGINS=new Set(['https://muhammedfidann06.github.io','https://lumira-tr.com']);
const DEFAULT_EXPOSE=['X-Lumira-Features-Version','X-Lumira-Examples-Version'];
const jsonError=(code,status=403)=>new Response(JSON.stringify({error:code}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'}});
export function withCors(handler,{methods=['POST'],headers=['Authorization','Content-Type'],media=false}={}){
  const allowedMethods=new Set(methods),allowedHeaders=new Set(headers.map(h=>h.toLowerCase()));
  return async (request,...context)=>{
    const origin=request.headers.get('origin'),same=origin===new URL(request.url).origin;
    if((origin && !same && !APP_ORIGINS.has(origin)) || (!origin && request.headers.get('sec-fetch-site')==='cross-site'))return jsonError('cross_origin_request');
    const crossHeaders=new Headers({'Vary':'Origin'});
    if(origin){
      crossHeaders.set('Access-Control-Allow-Origin',origin);
      crossHeaders.set('Access-Control-Expose-Headers',[...DEFAULT_EXPOSE,...(media?['Content-Range','Accept-Ranges']:[])].join(', '));
    }
    if(request.method==='OPTIONS'){
      const method=request.headers.get('access-control-request-method');
      const requested=(request.headers.get('access-control-request-headers')||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
      if(!origin || !allowedMethods.has(method) || requested.some(h=>!allowedHeaders.has(h)))return jsonError('cross_origin_request');
      crossHeaders.set('Access-Control-Allow-Methods',[...methods,'OPTIONS'].join(', '));
      crossHeaders.set('Access-Control-Allow-Headers',headers.join(', '));
      crossHeaders.set('Access-Control-Max-Age','600');
      crossHeaders.set('Cache-Control','private, no-store');
      return new Response(null,{status:204,headers:crossHeaders});
    }
    const response=await handler(request,...context),merged=new Headers(response.headers);
    const vary=new Set((merged.get('Vary')||'').split(',').map(v=>v.trim()).filter(Boolean));vary.add('Origin');
    for(const [name,value]of crossHeaders)if(name!=='vary')merged.set(name,value);
    merged.set('Vary',[...vary].join(', '));
    if(media && origin && !same)merged.set('Cross-Origin-Resource-Policy','cross-origin');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers:merged});
  };
}
