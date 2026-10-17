import { changeUsage, summary, fault } from './_shared/feature-core.mjs';
import { identity, speechToken, checkWriting, verifyPlayPurchase, sha256 } from './_shared/feature-services.mjs';

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Lumira-Features-Version': '1.9.2' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const operationId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(id);
// Dependency injection lets tests exercise the actual endpoint without real accounts.
export function createHandler(services = { identity, speechToken, checkWriting, verifyPlayPurchase, sha256 }, clock = Date.now) {
  return async request => {
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return reply({ error: 'cross_origin_request' }, 403);
    let ctx, ref, zone = process.env.LUMIRA_TIME_ZONE || 'Europe/Vienna';
    try {
      if (Number(request.headers.get('content-length')) > 40000) throw fault('invalid_input', 413);
      const raw = await request.text();
      if (raw.length > 30000) throw fault('invalid_input', 413);
      let body;
      try { body = JSON.parse(raw); } catch { throw fault('invalid_input'); }
      if (!body || typeof body !== 'object') throw fault('invalid_input');
      if (!['status', 'check', 'liveStart', 'liveRenew', 'liveStop', 'verifyPurchase'].includes(body.action)) throw fault('invalid_action');
      ctx = await services.identity(request);
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
        return reply({ quota: quota(value), speechConfigured: !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) });
      }
      if (body.action === 'verifyPurchase') {
        await services.verifyPlayPurchase(ctx, body.sku, body.purchaseToken);
        return reply({ verified: true });
      }
      if (!operationId(body.id)) throw fault('invalid_operation');
      if (body.action === 'check') {
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4000 || !['de','en','ar','fr','es','ru'].includes(body.language)) throw fault(body.language === 'ar' || body.language === 'tr' ? 'unsupported_language' : 'invalid_input', 422);
        const params = { id: body.id, hash: services.sha256(body.language + '\n' + body.text.trim()) };
        await mutate('writingBegin', params);
        try {
          const matches = await services.checkWriting(body.text.trim(), body.language);
          const value = await mutate('writingCommit', params);
          return reply({ matches, quota: quota(value) });
        } catch (error) {
          try { await mutate('writingCancel', params); } catch { /* Pending reservation expires after 60 seconds. */ }
          throw error;
        }
      }
      // Obtain provider credentials before reserving minutes. A missing/broken
      // service never charges a session that cannot start.
      const speech = body.action === 'liveStart' || (body.action === 'liveRenew' && body.refreshToken) ? await services.speechToken() : null;
      const value = await mutate(body.action, { id: body.id });
      return reply({ quota: quota(value), session: value.live?.session || null, ...(speech ? { speech } : {}) });
    } catch (e) {
      const code = e.code || 'usage_unavailable';
      const status = e.status || 503;
      // Never log credentials, request bodies, speech or learners' writing.
      console.error('[Lumira features]', code);
      return reply({ error: code }, status);
    }
  };
}
export default createHandler();
