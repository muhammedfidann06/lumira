// Pure quota rules. All times come from the server, never from the client.
export const WINDOW_MS = 86400000;
export const LEASE_MS = 15000;
export const TIERS = [
  { amount: 0, badge: '', count: 10, minutes: 20 },
  { amount: 1, badge: '👍🏻', count: 25, minutes: 60 },
  { amount: 5, badge: '☕️', count: 50, minutes: 90 },
  { amount: 10, badge: '❤️', count: 100, minutes: 120 },
  { amount: 25, badge: '💛', count: 150, minutes: 240 },
  { amount: 50, badge: '⭐️', count: 300, minutes: 480 },
  { amount: 100, badge: '👑', count: null, minutes: null }
];
export function fault(code, status = 400) {
  return Object.assign(new Error(code), { code, status });
}
export function tierFor(grants,verified) {
  return TIERS.slice().reverse().find(t => t.amount === 0 || (verified?.[t.amount]!==false && (grants?.[t.amount]===true || verified?.[t.amount]===true))) || TIERS[0];
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
  // v1 used a calendar-day counter. Migrate that day conservatively once;
  // v2 stores short continuous intervals and expires only actual 24h-old use.
  if (s.live?.version !== 2) {
    const old = s.live;
    s.live = { version: 2, intervals: {} };
    if (old?.day === dayKey(now, zone) && old.used > 0) {
      const end = old.session?.until > now ? old.session.until : now;
      s.live.intervals.legacy = { start: end - Math.min(86400, old.used) * 1000, end };
      if (old.session?.until > now) s.live.session = { ...old.session, key: 'legacy' };
    }
  }
  s.live.intervals ||= {};
  for (const [key, interval] of Object.entries(s.live.intervals)) {
    if (!interval || !Number.isFinite(interval.start) || !Number.isFinite(interval.end) || interval.end <= now - WINDOW_MS || interval.end <= interval.start) delete s.live.intervals[key];
  }
  if (s.live.session && s.live.session.until <= now) delete s.live.session;
  s.pdf ||= { count: 0, events: {}, pending: {} };
  s.pdf.count = Math.max(0, Math.floor(Number(s.pdf.count) || 0));
  s.pdf.events ||= {}; s.pdf.pending ||= {};
  for (const [id, event] of Object.entries(s.pdf.pending)) if (!event || event.at <= now - 90000) delete s.pdf.pending[id];
  return s;
}
export function liveUse(state, now, includeReserved = false) {
  return Object.values(state.live.intervals).reduce((sum, i) => sum + Math.max(0, (includeReserved ? i.end : Math.min(now, i.end)) - Math.max(i.start, now - WINDOW_MS)) / 1000, 0);
}
export function summary(value, tier, now, zone = 'Europe/Vienna') {
  const s = normalizeUsage(value, now, zone);
  const events = Object.values(s.writing.events);
  const pending = Object.keys(s.writing.pending).length;
  const usedSeconds = Math.ceil(liveUse(s, now));
  const starts = Object.values(s.live.intervals).filter(i => i.end > i.start).map(i => Math.max(i.start, now - WINDOW_MS));
  return {
    serverNow: now, tier: tier.amount, badge: tier.badge,
    ...(tier.memberships?{memberships:tier.memberships}:{}),
    ...(tier.supportAmounts?{supportAmounts:tier.supportAmounts,revokedSupport:tier.revokedSupport||[]}:{}),
    writing: { limit: tier.count, used: events.length, remaining: tier.count === null ? null : Math.max(0, tier.count - events.length - pending), resetsAt: events.length ? Math.min(...events.map(e => e.at)) + WINDOW_MS : null },
    live: { limitSeconds: tier.minutes === null ? null : tier.minutes * 60, usedSeconds, remainingSeconds: tier.minutes === null ? null : Math.max(0, tier.minutes * 60 - usedSeconds), resetsAt: starts.length ? Math.min(...starts) + WINDOW_MS : null, timeZone: zone },
    pdf: { limit: tier.amount === 0 ? 0 : tier.amount === 1 ? 5 : null, used: s.pdf.count, remaining: tier.amount === 0 ? 0 : tier.amount === 1 ? Math.max(0, 5 - s.pdf.count - Object.keys(s.pdf.pending).length) : null },
    offline: tier.amount > 0
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
    const remaining = tier.minutes === null ? Infinity : tier.minutes * 60 - liveUse(s, now, true);
    if (remaining <= 0) throw fault('live_limit', 429);
    const until = Math.min(now + LEASE_MS, now + remaining * 1000);
    const key = p.id + '_' + now;
    s.live.intervals[key] = { start: now, end: until };
    s.live.session = { id: p.id, until, key };
  } else if (action === 'liveRenew') {
    const session = s.live.session;
    if (!session || session.id !== p.id) throw fault('session_expired', 409);
    const remaining = tier.minutes === null ? Infinity : tier.minutes * 60 - liveUse(s, now, true);
    const until = Math.min(now + LEASE_MS, session.until + Math.max(0, remaining) * 1000);
    if (until > session.until) {
      s.live.intervals[session.key].end = until;
      session.until = until;
    }
  } else if (action === 'liveStop') {
    if (s.live.session?.id === p.id) {
      const interval = s.live.intervals[s.live.session.key];
      if (interval) interval.end = Math.min(now, interval.end);
      delete s.live.session;
    }
  } else if (action === 'liveConnect' || action === 'liveAudioBegin') {
    if (!s.live.session || s.live.session.id !== p.id) throw fault('session_expired', 409);
    const key = action === 'liveConnect' ? 'connects' : 'requests';
    const maximum = action === 'liveConnect' ? 18 : 30;
    s.live[key] = (s.live[key] || []).filter(at => at > now - 60000);
    if (s.live[key].length >= maximum) throw fault('speech_busy', 429);
    s.live[key].push(now);
  } else if (action === 'pdfBegin') {
    if (tier.amount === 0) throw fault('pdf_badge_required', 403);
    if (s.pdf.events[p.id]) return s;
    if (s.pdf.pending[p.id]) throw fault('operation_busy', 409);
    if (tier.amount === 1 && s.pdf.count + Object.keys(s.pdf.pending).length >= 5) throw fault('pdf_limit', 429);
    s.pdf.pending[p.id] = { at: now };
  } else if (action === 'pdfCommit') {
    if (s.pdf.events[p.id]) return s;
    if (!s.pdf.pending[p.id]) throw fault('operation_expired', 409);
    delete s.pdf.pending[p.id]; s.pdf.count++;
    s.pdf.events[p.id] = now;
    const oldest = Object.keys(s.pdf.events).sort((a,b) => s.pdf.events[b] - s.pdf.events[a]);
    for (const id of oldest.slice(64)) delete s.pdf.events[id];
  } else if (action === 'pdfCancel') {
    delete s.pdf.pending[p.id];
  } else throw fault('invalid_action');
  return s;
}
