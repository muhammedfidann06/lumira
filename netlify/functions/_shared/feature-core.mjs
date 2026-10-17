// Pure quota rules. All times come from the server, never from the client.
export const WINDOW_MS = 30 * 86400000;
export const LEASE_MS = 15000;
export const TIERS = [
  { amount: 0, badge: '', count: 5, minutes: 5 },
  { amount: 1, badge: '👍🏻', count: 100, minutes: 100 },
  { amount: 5, badge: '☕️', count: 200, minutes: 200 },
  { amount: 10, badge: '❤️', count: 300, minutes: 300 },
  { amount: 25, badge: '💛', count: 500, minutes: 500 },
  { amount: 50, badge: '⭐️', count: null, minutes: null },
  { amount: 100, badge: '👑', count: null, minutes: null }
];
export function fault(code, status = 400) {
  return Object.assign(new Error(code), { code, status });
}
export function tierFor(...grants) {
  return TIERS.slice().reverse().find(t => t.amount === 0 || grants.some(g => g?.[t.amount] === true)) || TIERS[0];
}
export function dayKey(now, zone = 'Europe/Vienna') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}
export function nextMidnight(now, zone = 'Europe/Vienna') {
  const day = dayKey(now, zone);
  let lo = Math.floor(now / 1000), hi = lo + 27 * 3600;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (dayKey(mid * 1000, zone) === day) lo = mid;
    else hi = mid;
  }
  return hi * 1000;
}
export function normalizeUsage(value, now, zone = 'Europe/Vienna') {
  const s = structuredClone(value || {});
  s.writing ||= {};
  s.writing.events ||= {};
  s.writing.pending ||= {};
  for (const [id, e] of Object.entries(s.writing.events)) {
    if (!e || e.at <= now - WINDOW_MS) delete s.writing.events[id];
  }
  for (const [id, e] of Object.entries(s.writing.pending)) {
    if (!e || e.at <= now - 60000) delete s.writing.pending[id];
  }
  if (s.live?.day !== dayKey(now, zone)) s.live = { day: dayKey(now, zone), used: 0 };
  s.live.used = Math.max(0, Number(s.live.used) || 0);
  if (s.live.session && s.live.session.until <= now) delete s.live.session;
  return s;
}
export function summary(value, tier, now, zone = 'Europe/Vienna') {
  const s = normalizeUsage(value, now, zone);
  const events = Object.values(s.writing.events);
  const pending = Object.keys(s.writing.pending).length;
  const reserved = s.live.session ? Math.max(0, (s.live.session.until - now) / 1000) : 0;
  const usedSeconds = Math.max(0, Math.ceil(s.live.used - reserved));
  return {
    serverNow: now, tier: tier.amount, badge: tier.badge,
    writing: { limit: tier.count, used: events.length, remaining: tier.count === null ? null : Math.max(0, tier.count - events.length - pending), resetsAt: events.length ? Math.min(...events.map(e => e.at)) + WINDOW_MS : null },
    live: { limitSeconds: tier.minutes === null ? null : tier.minutes * 60, usedSeconds, remainingSeconds: tier.minutes === null ? null : Math.max(0, tier.minutes * 60 - usedSeconds), resetsAt: nextMidnight(now, zone), timeZone: zone }
  };
}
// Return a new state or throw. The Firebase transaction calls this repeatedly.
export function changeUsage(value, tier, action, p, now, zone = 'Europe/Vienna') {
  const s = normalizeUsage(value, now, zone);
  if (action === 'writingBegin') {
    const done = s.writing.events[p.id], pending = s.writing.pending[p.id];
    if (done) {
      if (done.hash !== p.hash) throw fault('operation_conflict', 409);
      return s; // An identical retry never consumes another use.
    }
    if (pending) throw fault(pending.hash === p.hash ? 'operation_busy' : 'operation_conflict', 409);
    if (tier.count !== null && Object.keys(s.writing.events).length + Object.keys(s.writing.pending).length >= tier.count) throw fault('writing_limit', 429);
    s.writing.pending[p.id] = { at: now, hash: p.hash };
  } else if (action === 'writingCommit') {
    if (s.writing.events[p.id]?.hash === p.hash) return s;
    if (s.writing.pending[p.id]?.hash !== p.hash) throw fault('operation_expired', 409);
    delete s.writing.pending[p.id];
    s.writing.events[p.id] = { at: now, hash: p.hash };
  } else if (action === 'writingCancel') {
    if (s.writing.pending[p.id]?.hash === p.hash) delete s.writing.pending[p.id];
  } else if (action === 'liveStart') {
    if (s.live.session && s.live.session.id !== p.id) throw fault('live_already_active', 409);
    if (s.live.session) return s; // Idempotent network retry.
    const remaining = tier.minutes === null ? Infinity : tier.minutes * 60 - s.live.used;
    if (remaining <= 0) throw fault('live_limit', 429);
    const until = Math.min(now + LEASE_MS, now + remaining * 1000, nextMidnight(now, zone));
    s.live.used += (until - now) / 1000;
    s.live.session = { id: p.id, until };
  } else if (action === 'liveRenew') {
    const session = s.live.session;
    if (!session || session.id !== p.id) throw fault('session_expired', 409);
    const remaining = tier.minutes === null ? Infinity : tier.minutes * 60 - s.live.used;
    const until = Math.min(now + LEASE_MS, session.until + Math.max(0, remaining) * 1000, nextMidnight(now, zone));
    if (until > session.until) {
      s.live.used += (until - session.until) / 1000;
      session.until = until;
    }
  } else if (action === 'liveStop') {
    if (s.live.session?.id === p.id) {
      s.live.used = Math.max(0, s.live.used - Math.max(0, (s.live.session.until - now) / 1000));
      delete s.live.session;
    }
  } else throw fault('invalid_action');
  return s;
}
