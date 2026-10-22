import{fault}from'./feature-core.mjs';
export const SECTIONS=['cards','quiz','live','writing','personal','notebook','placement','stories'];
const category=v=>typeof v==='string'&&v.length>0&&v.length<=80&&!/[.#$\[\]/\u0000-\u001f]/u.test(v);
export function cleanMaintenance(v){return{sections:Object.fromEntries(SECTIONS.filter(k=>v?.sections?.[k]===true).map(k=>[k,true])),categories:Object.fromEntries(Object.entries(v?.categories||{}).filter(([k,on])=>on===true&&category(k))),updatedAt:Number(v?.updatedAt)||0};}
export function maintenanceChange(v){if(!v||!['sections','categories'].includes(v.kind)||typeof v.enabled!=='boolean'||(v.kind==='sections'?!SECTIONS.includes(v.key):!category(v.key)))throw fault('invalid_input',422);return{kind:v.kind,key:v.key,enabled:v.enabled};}
export async function assertAvailable(ctx,section,cat){const state=cleanMaintenance((await ctx.db.ref('serverMaintenance').get()).val());if(!state.sections[section]&&!(cat&&state.categories[cat]))return;if((await ctx.db.ref('admins/'+ctx.uid).get()).val()===true)return;throw fault('maintenance',503);}
