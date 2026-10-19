import {TIERS,tierFor} from './feature-core.mjs';
export function activeMembership(value,now){
 return !!value && !value.removed && ['active','trialing','past_due'].includes(value.status) && (value.lifetime===true||Number.isFinite(value.endsAt)&&value.endsAt>now) && !(value.cancelAt&&value.cancelAt<=now);
}
export function accountMemberships(grants={},verified={},billing={},optOut={},now=Date.now()){
 const rows=[];
 for(const tier of TIERS.filter(t=>t.amount)){
  const sources=[];
  if(grants[tier.amount]===true)sources.push({id:'gift-'+tier.amount,provider:'gift',status:'active',lifetime:true,endsAt:null});
  if(verified[tier.amount]===true)sources.push({id:'verified-'+tier.amount,provider:'verified',status:'active',lifetime:true,endsAt:null});
  for(const value of [...Object.values(billing.subscriptions||{}),...Object.values(billing.purchases||{})])if(value.amount===tier.amount)sources.push(value);
  const revoked=verified[tier.amount]===false,removed=optOut[tier.amount]===true;
  const active=sources.filter(source=>activeMembership(source,now));
  if(sources.length||revoked||removed)rows.push({amount:tier.amount,badge:tier.badge,active:!revoked&&!removed&&active.length>0,revoked,removed,sources:sources.map(source=>({id:source.id,provider:source.provider,status:source.status,lifetime:source.lifetime===true,startsAt:source.startsAt||null,endsAt:source.endsAt||null,renewsAt:source.renewsAt||null,cancelAt:source.cancelAt||null,active:activeMembership(source,now)}))});
 }
 const supportAmounts=rows.filter(row=>row.active).map(row=>row.amount),revokedSupport=rows.filter(row=>row.revoked||row.removed).map(row=>row.amount);
 const effective=Object.fromEntries(supportAmounts.map(amount=>[amount,true]));
 return {memberships:rows,tier:{...tierFor(effective,{}),supportAmounts,revokedSupport,memberships:rows}};
}
