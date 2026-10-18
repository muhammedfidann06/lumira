import { createHash, createSign } from 'node:crypto';
import { fault, tierFor } from './feature-core.mjs';
import { checkWritingAI } from './writing-ai.mjs';

export const PROJECT = 'mhamzac-ca73d';
export const DATABASE = 'https://mhamzac-ca73d-default-rtdb.firebaseio.com';
export const sha256 = text => createHash('sha256').update(text).digest('hex');
let adminPromise, speechCache, googleCache;
export async function admin() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw fault('server_not_configured', 503);
  if (!adminPromise) adminPromise = (async () => {
    const [{ initializeApp, getApps, cert }, { getAuth }, { getDatabase }] = await Promise.all([
      import('firebase-admin/app'), import('firebase-admin/auth'), import('firebase-admin/database')
    ]);
    const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (account.project_id !== PROJECT) throw fault('server_not_configured', 503);
    const app = getApps().find(a => a.name === 'lumira-features') || initializeApp({ credential: cert(account), projectId: PROJECT, databaseURL: DATABASE }, 'lumira-features');
    return { auth: getAuth(app), db: getDatabase(app) };
  })().catch(e => { adminPromise = null; throw e; });
  return adminPromise;
}
export async function identity(request) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!bearer) throw fault('login_required', 401);
  const services = await admin();
  let claims;
  try { claims = await services.auth.verifyIdToken(bearer, true); }
  catch { throw fault('login_required', 401); }
  const [grants, verified] = await Promise.all([
    services.db.ref(`progress/${claims.uid}/meta/supportGrants`).get(),
    services.db.ref(`serverFeatureEntitlements/${claims.uid}`).get()
  ]);
  return { ...services, uid: claims.uid, tier: tierFor(grants.val(), verified.val()) };
}
export async function speechToken() {
  const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION;
  if (!key || !/^[a-z0-9-]+$/.test(region || '')) throw fault('speech_not_configured', 503);
  if (speechCache?.expiresAt > Date.now() + 60000) return speechCache;
  let token;
  try {
    const response = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key }, signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('provider_unavailable');
    token = (await response.text()).trim();
  } catch { throw fault('speech_unavailable', 502); }
  if (!token || token.length > 20000) throw fault('speech_unavailable', 502);
  speechCache = { token, region, expiresAt: Date.now() + 9 * 60000 };
  return speechCache;
}
export async function checkWriting(text, language, uiLanguage = 'tr') {
  const languages = { tr: 'tr', de: 'de-DE', en: 'en-US', ar: 'ar', fr: 'fr', es: 'es', ru: 'ru-RU' };
  if (!languages[language]) throw fault('unsupported_language', 422);
  if (language === 'ar' || language === 'tr') return checkWritingAI(text, language, uiLanguage);
  const body = new URLSearchParams({ text, language: languages[language], level: 'picky' });
  if (process.env.LANGUAGETOOL_USERNAME && process.env.LANGUAGETOOL_API_KEY) {
    body.set('username', process.env.LANGUAGETOOL_USERNAME);
    body.set('apiKey', process.env.LANGUAGETOOL_API_KEY);
  }
  let response;
  try {
    response = await fetch(process.env.LANGUAGETOOL_API_KEY ? 'https://api.languagetoolplus.com/v2/check' : 'https://api.languagetool.org/v2/check', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(18000)
    });
  } catch { throw fault('writing_unavailable', 502); }
  if (!response.ok) throw fault(response.status === 429 ? 'writing_service_busy' : 'writing_unavailable', 502);
  let result;
  try { result = await response.json(); } catch { throw fault('writing_invalid_result', 502); }
  if (!Array.isArray(result?.matches)) throw fault('writing_invalid_result', 502);
  return result.matches;
}
async function googleToken() {
  if (googleCache?.expiresAt > Date.now() + 60000) return googleCache.token;
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw fault('purchase_verification_unavailable', 503);
  const account = JSON.parse(raw), now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const signature = createSign('RSA-SHA256').update(unsigned).end().sign(account.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + signature }), signal: AbortSignal.timeout(8000) });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw fault('purchase_verification_unavailable', 503);
  googleCache = { token: data.access_token, expiresAt: Date.now() + 3500000 };
  return googleCache.token;
}
export async function verifyPlayPurchase(ctx, sku, token) {
  const amounts = { lumira_support_1: 1, lumira_support_5: 5, lumira_support_10: 10, lumira_support_25: 25, lumira_support_50: 50, lumira_support_100: 100 };
  if (!amounts[sku] || typeof token !== 'string' || token.length < 10 || token.length > 4096) throw fault('invalid_purchase');
  const authorization = await googleToken();
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.lumira.dilkartlari';
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${authorization}` }, signal: AbortSignal.timeout(8000) });
  if (response.status === 401 || response.status === 403) throw fault('purchase_verification_unavailable', 503);
  if (!response.ok) throw fault('invalid_purchase', 422);
  const data = await response.json();
  if (data.purchaseState !== 0) throw fault('purchase_not_completed', 422);
  if (data.acknowledgementState === 0) {
    const acknowledgement = await fetch(url + ':acknowledge', {
      method: 'POST', headers: { Authorization: `Bearer ${authorization}`, 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(8000)
    });
    if (!acknowledgement.ok) throw fault('purchase_verification_unavailable', 503);
  }
  // Bind a verified Play purchase to exactly one Firebase account.
  const claim = await ctx.db.ref(`serverFeaturePurchases/${sha256(token)}`).transaction(value => {
    if (value && value.uid !== ctx.uid) return;
    return value || { uid: ctx.uid, sku, at: Date.now() };
  }, undefined, false);
  if (!claim.committed) throw fault('purchase_already_linked', 409);
  await ctx.db.ref(`serverFeatureEntitlements/${ctx.uid}/${amounts[sku]}`).set(true);
  return amounts[sku];
}
