import {admin} from './_shared/feature-services.mjs';
import {withCors} from './_shared/cors.mjs';
// Every app used to keep a live listener on the whole `leaderboard` node, so
// each learner's periodic write was pushed to every open app and the whole
// board was re-sorted on every phone. This endpoint reads the board once and
// Netlify's CDN serves the summary for five minutes, so Firebase is read at
// most a few hundred times a day regardless of how many apps are open.
// Only the top five carry names/uids (as before); ranks use bare scores.
export function summarize(board,now=Date.now()){
 const rows=Object.entries(board&&typeof board==='object'?board:{}).filter(([,v])=>v&&typeof v==='object'&&(v.name||v.xp||v.totalSeconds)).map(([uid,v])=>({uid,name:String(v.name||'').trim().slice(0,30),totalSeconds:Math.max(0,Math.floor(Number(v.totalSeconds)||0)),xp:Math.max(0,Math.floor(Number(v.xp)||0))}));
 const byTime=rows.slice().sort((a,b)=>b.totalSeconds-a.totalSeconds),byLevel=rows.slice().sort((a,b)=>b.xp-a.xp);
 return{updatedAt:now,total:rows.length,time:byTime.slice(0,5).map(({uid,name,totalSeconds})=>({uid,name,totalSeconds})),level:byLevel.slice(0,5).map(({uid,name,xp})=>({uid,name,xp})),timeScores:byTime.map(row=>row.totalSeconds),xpScores:byLevel.map(row=>row.xp)};
}
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60','Netlify-CDN-Cache-Control':'public, s-maxage=300, stale-while-revalidate=600, durable','X-Content-Type-Options':'nosniff'};
export function createLeaderboardHandler(services={admin},clock=Date.now){return withCors(async request=>{
 if(request.method!=='GET')return new Response('{"error":"method_not_allowed"}',{status:405,headers:{...headers,'Cache-Control':'no-store'}});
 try{
  const {db}=await services.admin();
  return new Response(JSON.stringify(summarize((await db.ref('leaderboard').get()).val(),clock())),{headers});
 }catch{return new Response('{"error":"leaderboard_unavailable"}',{status:503,headers:{...headers,'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store'}});}
},{methods:['GET'],headers:[]});}
export default createLeaderboardHandler();
