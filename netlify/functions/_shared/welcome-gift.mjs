import {grantVerifiedEntitlement} from './feature-services.mjs';
import {fault} from './feature-core.mjs';
import {atomic} from './paddle-events.mjs';
export function createWelcomeGift(){let cached=[];return async(ctx,{ack=false}={})=>{
 const ref=ctx.db.ref('serverWelcomeCampaign');let campaign=(await ref.get()).val()||{},rank=Number(campaign.roster?.[ctx.uid]);
 if(ack){if(Number.isInteger(rank)&&rank>=1&&rank<=300)await ctx.db.ref('serverWelcomeAcks/'+ctx.uid).set(true);return{acknowledged:true};}
 if(!Number.isInteger(rank)&&Object.keys(campaign.roster||{}).length<300){
  if(!cached.some(u=>u.uid===ctx.uid)){let token;const all=[],seen=new Set();do{const page=await ctx.auth.listUsers(1000,token);for(const u of page.users){const created=Date.parse(u.metadata?.creationTime);if((u.email||u.providerData?.length)&&Number.isFinite(created))all.push({uid:u.uid,created});}token=page.pageToken;if(token&&(seen.has(token)||seen.size>=100))throw fault('welcome_unavailable',503);seen.add(token);}while(token);cached=all.sort((a,b)=>a.created-b.created||a.uid.localeCompare(b.uid)).slice(0,300);}
  campaign=await atomic(ref,value=>{const roster={...(value?.roster||{})};let size=Object.keys(roster).length;for(const u of cached)if(!Object.hasOwn(roster,u.uid)&&size<300)roster[u.uid]=++size;return{version:1,roster};});rank=campaign.roster?.[ctx.uid];
 }
 if(!Number.isInteger(rank)||rank<1||rank>300)return{granted:false};
 if((await ctx.db.ref('serverBadgeOptOut/'+ctx.uid+'/1').get()).val()===true)return{granted:false};
 try{await grantVerifiedEntitlement(ctx,1);}catch(e){if(e.code==='purchase_revoked')return{granted:false};throw e;}
 return{granted:true,rank,show:(await ctx.db.ref('serverWelcomeAcks/'+ctx.uid).get()).val()!==true};
 };}
export const welcomeGift=createWelcomeGift();
