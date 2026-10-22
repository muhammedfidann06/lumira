import{assertAvailable}from'./_shared/maintenance.mjs';
import { identity } from './_shared/feature-services.mjs';
import { changeUsage, fault } from './_shared/feature-core.mjs';
import { decodeWave, translateAudio } from './_shared/live-providers.mjs';
import { withCors } from './_shared/cors.mjs';
const headers = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' };
export function createAudioHandler(services = { identity, translateAudio }, clock = Date.now) {
  return withCors(async request => {
    if (request.method !== 'POST') return new Response('{}',{status:405,headers});
    let ref, lockId;
    try {
      if (Number(request.headers.get('content-length')) > 950000) throw fault('invalid_input',413);
      const raw = await request.text();
      if (raw.length > 950000) throw fault('invalid_input',413);
      let body; try { body = JSON.parse(raw); } catch { throw fault('invalid_input'); }
      if (!/^[a-zA-Z0-9_-]{16,80}$/.test(body.id || '') || !['groq','cloudflare'].includes(body.provider) || !['tr','de','en','ar','fr','es','ru'].includes(body.target)) throw fault('invalid_input',422);
      if(body.source!==undefined&&!['auto','tr','de','en','ar','fr','es','ru'].includes(body.source))throw fault('invalid_input',422);
      const audio = decodeWave(body.audio);
      const ctx = await services.identity(request);
      await(services.assertAvailable||assertAvailable)(ctx,'live');
      ref = ctx.db.ref('serverFeatureUsage/' + ctx.uid);
      const listener = () => {}; ref.on('value',listener);
      try {
        await ref.get(); let reason;
        lockId = crypto.randomUUID();
        const result = await ref.transaction(value => {
          try {
            const state = changeUsage(value,ctx.tier,'liveAudioBegin',{id:body.id},clock());
            if (state.live.audioLock?.until > clock()) throw fault('speech_busy',429);
            state.live.audioLock = { id:lockId, until:clock()+12000 };
            return state;
          } catch (e) { reason = e; return; }
        },undefined,false);
        if (!result.committed) throw reason || fault('usage_unavailable',503);
      } finally { ref.off('value',listener); }
      const data = await services.translateAudio(body.provider,body.target,audio,{source:body.source||'auto'});
      // A stop/account switch while inference was pending cannot revive a session.
      const current = (await ref.get()).val()?.live?.session;
      if (!current || current.id !== body.id || current.until <= clock()) throw fault('session_expired',409);
      return new Response(JSON.stringify(data),{headers});
    } catch (e) {
      return new Response(JSON.stringify({error:e.code || 'speech_unavailable'}),{status:e.status || 502,headers});
    } finally {
      if (ref && lockId) {
        try { await ref.transaction(value => { if (value?.live?.audioLock?.id === lockId) { delete value.live.audioLock; return value; } return; },undefined,false); } catch {}
      }
    }
  });
}
export default createAudioHandler();
