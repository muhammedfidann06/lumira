import{admin}from'./_shared/feature-services.mjs';import{fault}from'./_shared/feature-core.mjs';import{cleanMaintenance,maintenanceChange}from'./_shared/maintenance.mjs';import{withCors}from'./_shared/cors.mjs';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createMaintenanceHandler(services={admin},clock=Date.now){return withCors(async request=>{try{
 if(!['GET','POST'].includes(request.method))return reply({error:'method_not_allowed'},405);const ctx=await services.admin();if(request.method==='GET')return reply(cleanMaintenance((await ctx.db.ref('serverMaintenance').get()).val()));
 const token=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];if(!token)throw fault('login_required',401);let claims;try{claims=await ctx.auth.verifyIdToken(token,true);}catch{throw fault('login_required',401);}if((await ctx.db.ref('admins/'+claims.uid).get()).val()!==true)throw fault('admin_required',403);
 const raw=await request.text();if(raw.length>1000)throw fault('invalid_input',413);let body;try{body=JSON.parse(raw);}catch{throw fault('invalid_input',422);}const{kind,key,enabled}=maintenanceChange(body);await ctx.db.ref('serverMaintenance').update({[kind+'/'+key]:enabled?true:null,updatedAt:clock(),updatedBy:claims.uid});return reply(cleanMaintenance((await ctx.db.ref('serverMaintenance').get()).val()));
 }catch(e){return reply({error:e.code||'maintenance_unavailable'},e.status||503);}},{methods:['GET','POST']});}
export default createMaintenanceHandler();
