import {createSign} from 'node:crypto';
import {fault} from './feature-core.mjs';
let cached;
export async function googlePlayToken({env=process.env,fetcher=fetch,clock=Date.now}={}){
 if(cached?.until>clock()+60000&&cached.source===(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON||env.FIREBASE_SERVICE_ACCOUNT_JSON))return cached.token;
 const raw=env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON||env.FIREBASE_SERVICE_ACCOUNT_JSON;
 if(!raw)throw fault('purchase_verification_unavailable',503);
 try{
  const account=JSON.parse(raw),now=Math.floor(clock()/1000),b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned=b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:account.client_email,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const signature=createSign('RSA-SHA256').update(unsigned).end().sign(account.private_key,'base64url');
  const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature}),signal:AbortSignal.timeout(6000)}),data=await response.json();
  if(!response.ok||typeof data.access_token!=='string')throw Error();
  cached={token:data.access_token,until:clock()+Math.min(3500,Number(data.expires_in)||3500)*1000,source:raw};return cached.token;
 }catch{throw fault('purchase_verification_unavailable',503);}
}
export function createPlayApi({env=process.env,fetcher=(...args)=>globalThis.fetch(...args),authorize=()=>googlePlayToken({env,fetcher})}={}){
 const packageName=env.GOOGLE_PLAY_PACKAGE_NAME||'com.lumira.dilkartlari',base='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+encodeURIComponent(packageName);
 return{packageName,async call(path,{method='GET',body}={}){
  if(!path.startsWith('/')||path.includes('://')||path.includes('..'))throw fault('invalid_input');
  let response;try{const token=await authorize();response=await fetcher(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(6000)});}catch(error){throw error.status?error:fault('purchase_verification_unavailable',503);}
  if(!response.ok){let activationProject,code=[401,403].includes(response.status)?'play_verification_permissions':[400,404,410].includes(response.status)?'invalid_purchase':'purchase_verification_unavailable';
   if(response.status===403)try{const data=await response.json(),disabled=data.error?.details?.find(row=>row.reason==='SERVICE_DISABLED');if(disabled||data.error?.errors?.some(row=>row.reason==='accessNotConfigured')){code='play_api_disabled';const consumer=/^projects\/(\d{1,20})$/.exec(disabled?.metadata?.consumer||'');if(consumer)activationProject=consumer[1];}}catch{}
   const error=fault(code,[400,404,410].includes(response.status)?422:503);if(activationProject)error.activationProject=activationProject;throw error;
  }
  if(response.status===204||method==='POST')return{};
  try{return await response.json();}catch{throw fault('purchase_verification_unavailable',503);}
 }};
}
