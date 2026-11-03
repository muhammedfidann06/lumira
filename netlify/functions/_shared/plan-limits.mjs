// Per-badge allowances beyond writing checks and translation minutes.
// Keys are badge amounts: 0 none, 1 Thanks, 5 Coffee, 10 Supporter, 25 Friend,
// 50 Star, 100 King. null means unlimited. usage-limits.js shows the same table.
export const STORY_DAILY = { 1: 3, 5: 5, 10: 8, 25: 12, 50: 20, 100: 30 };
export const STORY_SAVED = { 0: 1, 1: 5, 5: 10, 10: 20, 25: 30, 50: 50, 100: 100 };
// Notes and favourites: 50 in total without a badge, unlimited with any badge.
export const NOTES_DAILY = { 1: null, 5: null, 10: null, 25: null, 50: null, 100: null };
export const PRACTICE_DAILY = { 0: 10, 1: 25, 5: 50, 10: 100, 25: 150, 50: 300, 100: null };
export const FREE_NOTES = 50;
export const FREE_GOETHE_EXAMS = 1;
export const MAX_SAVED_STORIES = 100;
export const DAY_MS = 86400000;

const amountOf = tier => Number(tier?.amount ?? tier) || 0;
export const savedStoryLimit = tier => STORY_SAVED[amountOf(tier)] ?? STORY_SAVED[0];
export const dailyStoryLimit = tier => amountOf(tier) === 0 ? 0 : STORY_DAILY[amountOf(tier)] ?? STORY_DAILY[1];

// Badge-less accounts get one story per learning language, ever; badges get a
// rolling 24-hour allowance. Pending reservations stop parallel requests from
// overshooting and expire if a generation never finishes.
export function reserveStory(value, { tier, id, language, now, usedLanguage }) {
  const v = value && typeof value === 'object' ? value : {};
  const events = Object.fromEntries(Object.entries(v.events || {}).filter(([, at]) => Number.isFinite(at) && at > now - DAY_MS));
  const pending = Object.fromEntries(Object.entries(v.pending || {}).filter(([key, row]) => row && Number.isFinite(row.at) && row.at > now - 120000 && key !== id));
  const free = v.free && typeof v.free === 'object' ? { ...v.free } : {};
  if (amountOf(tier) === 0) {
    if (free[language] || usedLanguage || Object.values(pending).some(row => row.language === language)) throw Object.assign(new Error('story_badge_required'), { code: 'story_badge_required', status: 403 });
  } else if (Object.keys(events).length + Object.keys(pending).length >= dailyStoryLimit(tier)) {
    throw Object.assign(new Error('story_limit'), { code: 'story_limit', status: 429 });
  }
  pending[id] = { at: now, language };
  return { events, pending, free };
}
export function commitStory(value, { id, language, now }) {
  const v = value && typeof value === 'object' ? value : {};
  const pending = { ...(v.pending || {}) }, events = { ...(v.events || {}) }, free = { ...(v.free || {}) };
  delete pending[id];
  events[id] = now;
  free[language] = free[language] || now;
  return { events, pending, free };
}
export function releaseStory(value, { id }) {
  if (!value?.pending?.[id]) return value;
  const pending = { ...value.pending };
  delete pending[id];
  return { ...value, pending };
}
export function storyAllowance(value, { tier, saved, now }) {
  const v = value && typeof value === 'object' ? value : {};
  const used = Object.values(v.events || {}).filter(at => Number.isFinite(at) && at > now - DAY_MS);
  return {
    tier: amountOf(tier),
    savedLimit: savedStoryLimit(tier),
    saved,
    dailyLimit: dailyStoryLimit(tier),
    usedToday: used.length,
    resetsAt: used.length ? Math.min(...used) + DAY_MS : null,
    freeLanguages: Object.keys(v.free || {})
  };
}
