/* Serve the application's existing TTS source as same-origin MP3.
   This public upstream has no availability guarantee. Never retry a denial. */
const LANGUAGES = new Set(['de', 'en', 'ar', 'fr', 'es', 'ru', 'tr']);
const HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin'
};
function error(status, code) {
  return new Response(JSON.stringify({ error: code }), {
    status, headers: { ...HEADERS, 'Content-Type': 'application/json' }
  });
}
export default async function tts(request) {
  if (!['GET', 'HEAD'].includes(request.method)) return error(405, 'method_not_allowed');
  const url = new URL(request.url);
  const text = (url.searchParams.get('text') || '').trim();
  const lang = url.searchParams.get('lang');
  if (!text || text.length > 180 || !LANGUAGES.has(lang)) return error(400, 'invalid_input');
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return error(403, 'cross_origin_request');
  if (request.headers.get('sec-fetch-site') === 'cross-site') return error(403, 'cross_origin_request');
  const upstream = new URL('https://translate.google.com/translate_tts');
  upstream.search = new URLSearchParams({
    ie: 'UTF-8', client: 'tw-ob', tl: lang,
    ttsspeed: url.searchParams.get('slow') === '1' ? '0.24' : '1', q: text
  }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(upstream, { signal: controller.signal });
    if (!response.ok) return error(response.status === 429 ? 429 : 502, 'tts_upstream_unavailable');
    if (!/^audio\//i.test(response.headers.get('content-type') || '')) return error(502, 'tts_invalid_audio');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 2 * 1024 * 1024) return error(502, 'tts_invalid_audio');
    const headers = { ...HEADERS, 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes' };
    // Safari can request just the first two bytes before starting playback.
    const range = request.headers.get('range');
    let start = 0, end = bytes.length - 1, status = 200;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, {status:416, headers:{...headers, 'Content-Range':`bytes */${bytes.length}`}});
      if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
      else { start = Math.max(0, bytes.length - Number(match[2])); }
      if (start > end || start >= bytes.length) return new Response(null, {status:416, headers:{...headers, 'Content-Range':`bytes */${bytes.length}`}});
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`;
    }
    const body = bytes.slice(start, end + 1);
    headers['Content-Length'] = String(body.length);
    return new Response(request.method === 'HEAD' ? null : body, {status, headers});
  } catch (e) {
    return error(e.name === 'AbortError' ? 504 : 502, 'tts_upstream_unavailable');
  } finally { clearTimeout(timer); }
}
export const config = { rateLimit: { windowLimit: 90, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
