import { changeUsage, summary, fault } from './_shared/feature-core.mjs';
import { identity, speechToken, checkWriting, verifyPlayPurchase, sha256 } from './_shared/feature-services.mjs';
import { configuredProviders, connectProvider } from './_shared/live-providers.mjs';
import { withCors } from './_shared/cors.mjs';
import {welcomeGift} from './_shared/welcome-gift.mjs';
import{assertAvailable}from'./_shared/maintenance.mjs';
import {PLAY_PRODUCTS} from './_shared/play-billing.mjs';

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Lumira-Features-Version': '1.10.0' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const operationId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(id);
// Dependency injection lets tests exercise the actual endpoint without real accounts.
export function createHandler(services = { identity, speechToken, checkWriting, verifyPlayPurchase, sha256, configuredProviders, connectProvider }, clock = Date.now) {
  return withCors(async request => {
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
    let ctx, ref, zone = process.env.LUMIRA_TIME_ZONE || 'Europe/Vienna';
    try {
      if (Number(request.headers.get('content-length')) > 40000) throw fault('invalid_input', 413);
      const raw = await request.text();
      if (raw.length > 30000) throw fault('invalid_input', 413);
      let body;
      try { body = JSON.parse(raw); } catch { throw fault('invalid_input'); }
      if (!body || typeof body !== 'object') throw fault('invalid_input');
      if (!['status', 'check', 'liveStart', 'liveRenew', 'liveStop', 'liveConnect', 'pdfBegin', 'pdfCommit', 'pdfCancel', 'verifyPurchase','welcome','welcomeAck'].includes(body.action)) throw fault('invalid_action');
      ctx = await services.identity(request);
      if(body.action==='check')await(services.assertAvailable||assertAvailable)(ctx,'writing');
      if(['liveStart','liveConnect','liveRenew'].includes(body.action))await(services.assertAvailable||assertAvailable)(ctx,'live');
      if(['welcome','welcomeAck'].includes(body.action))return reply({welcome:await (services.welcomeGift||welcomeGift)(ctx,{ack:body.action==='welcomeAck'})});
      ref = ctx.db.ref(`serverFeatureUsage/${ctx.uid}`);
      const quota = value => summary(value, ctx.tier, clock(), zone);
      const mutate = async (action, params) => {
        // The SDK's first transaction callback can receive an uncached null,
        // even when the server has a pending check or a live session. Returning
        // undefined there aborts immediately, before Firebase can retry with
        // the real value. Keep a listener while loading the authoritative
        // value and running the compare-and-retry transaction. A get() alone
        // is insufficient: without a listener the SDK can discard that cache.
        const keepCurrent = () => {};
        ref.on('value', keepCurrent);
        try {
          await ref.get();
          let reason;
          const result = await ref.transaction(value => {
            reason = null;
            try { return changeUsage(value, ctx.tier, action, params, clock(), zone); }
            catch (e) { reason = e; return; }
          }, undefined, false);
          if (!result.committed) throw reason || fault('usage_unavailable', 503);
          return result.snapshot.val();
        } finally {
          ref.off('value', keepCurrent);
        }
      };
      if (body.action === 'status') {
        const value = (await ref.get()).val();
        const providers = (services.configuredProviders || configuredProviders)();
        return reply({ quota: quota(value), providers, speechConfigured: providers.includes('azure'), localFallback: true, playProducts: Object.keys(PLAY_PRODUCTS) });
      }
      if (body.action === 'verifyPurchase') {
        await services.verifyPlayPurchase(ctx, body.sku, body.purchaseToken);
        return reply({ verified: true });
      }
      if (!operationId(body.id)) throw fault('invalid_operation');
      if (body.action === 'liveConnect') {
        await mutate('liveConnect', { id: body.id });
        return reply(await (services.connectProvider || connectProvider)(body.provider, body.target,{source:body.source||'auto'}));
      }
      if (body.action.startsWith('pdf')) {
        const value = await mutate(body.action, { id: body.id });
        return reply({ quota: quota(value) });
      }
      if (body.action === 'check') {
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4000 || !['tr','de','en','ar','fr','es','ru'].includes(body.language)) throw fault(body.language === 'ar' || body.language === 'tr' ? 'unsupported_language' : 'invalid_input', 422);
        const params = { id: body.id, hash: services.sha256(body.language + '\n' + body.text.trim()) };
        await mutate('writingBegin', params);
        try {
          const uiLanguage = ['tr','en','de','ar','fr','es','ru'].includes(body.uiLanguage) ? body.uiLanguage : 'tr';
          const matches = await services.checkWriting(body.text.trim(), body.language, uiLanguage);
          const value = await mutate('writingCommit', params);
          return reply({ matches, quota: quota(value) });
        } catch (error) {
          try { await mutate('writingCancel', params); } catch { /* Pending reservation expires after 60 seconds. */ }
          throw error;
        }
      }
      // Obtain provider credentials before reserving minutes. A missing/broken
      // service never charges a session that cannot start.
      if (body.provider !== undefined && !['azure', 'local'].includes(body.provider)) throw fault('invalid_input');
      const speech = body.provider !== 'local' && (body.action === 'liveStart' || (body.action === 'liveRenew' && body.refreshToken)) ? await services.speechToken() : null;
      const value = await mutate(body.action, { id: body.id });
      return reply({ quota: quota(value), session: value.live?.session || null, ...(speech ? { speech } : {}), ...(body.provider === 'local' ? { provider: 'local' } : {}) });
    } catch (e) {
      const code = e.code || 'usage_unavailable';
      const status = e.status || 503;
      // Never log credentials, request bodies, speech or learners' writing.
      console.error('[Lumira features]', code);
      let quota;
      if (ctx && ref && ['writing_limit','live_limit','pdf_limit','pdf_badge_required'].includes(code)) {
        try { quota = summary((await ref.get()).val(), ctx.tier, clock(), zone); } catch {}
      }
      return reply({ error: code, ...(quota ? { quota } : {}) }, status);
    }
  });
}
export default createHandler();
