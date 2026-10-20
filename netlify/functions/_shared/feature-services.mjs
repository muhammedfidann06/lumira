import { createHash } from 'node:crypto';
import { fault, tierFor, TIERS } from './feature-core.mjs';
import { checkWritingAI } from './writing-ai.mjs';
import {accountMemberships} from './memberships.mjs';
import {reconcileAccount} from './paddle-reconcile.mjs';
import {playBilling} from './play-billing.mjs';

export const PROJECT = 'mhamzac-ca73d';
export const DATABASE = 'https://mhamzac-ca73d-default-rtdb.firebaseio.com';
export const sha256 = text => createHash('sha256').update(text).digest('hex');
let adminPromise, speechCache;
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
  const [grants, verified, billing, optOut, play] = await Promise.all([
    services.db.ref(`progress/${claims.uid}/meta/supportGrants`).get(),
    services.db.ref(`serverFeatureEntitlements/${claims.uid}`).get(),
    services.db.ref(`serverPaddleAccounts/${claims.uid}`).get(),
    services.db.ref(`serverBadgeOptOut/${claims.uid}`).get(),
    services.db.ref(`serverPlayAccounts/${claims.uid}`).get()
  ]);
  const [currentBilling,currentPlay]=await Promise.all([reconcileAccount(services.db,claims.uid,billing.val()||{}),playBilling.reconcile({...services,uid:claims.uid},play.val()||{})]);
  return {...services,uid:claims.uid,tier:accountMemberships(grants.val()||{},verified.val()||{},currentBilling,optOut.val()||{},Date.now(),currentPlay).tier};
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
export async function verifyPlayPurchase(ctx,sku,token){return playBilling.verify(ctx,sku,token);}

// A purchase restore cannot undo a deliberate administrative revocation.
export async function grantVerifiedEntitlement(ctx,amount){
  const ref=ctx.db.ref(`serverFeatureEntitlements/${ctx.uid}/${amount}`),listener=()=>{};
  ref.on('value',listener);
  try{
    await ref.get();
    const result=await ref.transaction(value=>value===false?undefined:true,undefined,false);
    if(!result.committed)throw fault('purchase_revoked',403);
  }finally{ref.off('value',listener);}
}
