import {TIERS,tierFor} from './feature-core.mjs';
export function badgePolicySnapshot(value){
 const version=kind=>typeof value?.[kind]==='string'&&value[kind].length<=300?value[kind]:'legacy';
 return {admin:version('admin'),user:version('user')};
}
export function activeMembership(value,now){
 if(!value||value.removed||!['active','trialing','past_due'].includes(value.status))return false;
 // Paddle's actual status is authoritative. A pending cancel/pause is not
 // cancellation; the signed state or reconciliation will close access.
 if(value.provider==='paddle')return true;
 return (value.lifetime===true||Number.isFinite(value.endsAt)&&value.endsAt>now)&&!(value.cancelAt&&value.cancelAt<=now);
}
export function accountMemberships(grants={},verified={},billing={},optOut={},now=Date.now(),play={},policies={}){
 const rows=[];
 for(const tier of TIERS.filter(t=>t.amount)){
  const sources=[];
  if(grants[tier.amount]===true)sources.push({id:'gift-'+tier.amount,provider:'gift',status:'active',lifetime:true,endsAt:null});
  if(verified[tier.amount]===true)sources.push({id:'verified-'+tier.amount,provider:'verified',status:'active',lifetime:true,endsAt:null});
  for(const value of [...Object.values(billing.subscriptions||{}),...Object.values(billing.purchases||{}),...Object.values(play.subscriptions||{})])if(value.amount===tier.amount)sources.push(value);
  const adminBlocked=verified[tier.amount]===false,userBlocked=optOut[tier.amount]===true,policy=badgePolicySnapshot(policies[tier.amount]);
  // Only a new, server-bound, completed checkout can replace an old removal.
  // Later admin/user policy versions still override that purchase and replays.
  const matches=(source,kind)=>source.provider==='paddle'&&source.badgePolicy?.[kind]===policy[kind];
  // An administrator's later gift is a deliberate grant; an earlier removal
  // only keeps old paid sources from returning.
  const adminAllows=source=>source.provider==='gift'||!adminBlocked||matches(source,'admin');
  const allowed=source=>activeMembership(source,now)&&adminAllows(source)&&(!userBlocked||matches(source,'user'));
  const active=sources.filter(allowed),revoked=adminBlocked&&!sources.some(source=>activeMembership(source,now)&&adminAllows(source)),removed=userBlocked&&!active.length;
  // An administrative removal is silent: the badge is simply not owned and can
  // be bought again. Only a still-running paid subscription keeps its row, so
  // the buyer can manage or cancel it.
  if(revoked&&!sources.some(source=>['paddle','google_play'].includes(source.provider)&&activeMembership(source,now)))continue;
  if(sources.length||userBlocked)rows.push({amount:tier.amount,badge:tier.badge,active:active.length>0,revoked,removed,sources:sources.map(source=>({id:source.id,provider:source.provider,status:source.status,lifetime:source.lifetime===true,billingCycle:source.billingCycle||null,startsAt:source.startsAt||null,endsAt:source.endsAt||null,renewsAt:source.renewsAt||null,cancelAt:source.cancelAt||null,active:allowed(source)}))});
 }
 // revokedSupport lists only badges the buyer hid; admin removals lock nothing.
 const supportAmounts=rows.filter(row=>row.active).map(row=>row.amount),revokedSupport=rows.filter(row=>row.removed&&!row.revoked).map(row=>row.amount);
 const effective=Object.fromEntries(supportAmounts.map(amount=>[amount,true]));
 return {memberships:rows,tier:{...tierFor(effective,{}),supportAmounts,revokedSupport,memberships:rows}};
}
