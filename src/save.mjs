// Progress: unlocked nights, story fragments, coins and upgrades. Pure; the page does the storage.
import { UPGRADES } from './config.mjs';

const VERSION = 1;
export const defaultSave = () => ({ v: VERSION, unlocked: 1, completed: [], fragments: [], coins: 0, upgrades: { brakes: 0, bumper: 0, horn: 0 }, stars: {}, muted: false, seenIntro: false, settings: defaultSettings() });
// graphics (auto steps down on slow devices), music and effects volume, and calm: no shake, flashes or camera swings
export const defaultSettings = () => ({ gfx: 'auto', music: 0.8, sfx: 1, calm: false });

// Stars for a night: one for reaching the terminal, one for making every stop, one for no bumps.
export function starsFor(run) {
  if (run.done !== 'complete') return 0;
  return 1 + (run.route.stops.every((st) => st.state === 'done') ? 1 : 0) + (run.hits === 0 ? 1 : 0);
}

// A night counts as completed when you reach the terminal; night 7 also needs Tatay delivered.
export function applyRun(save, run) {
  const s = structuredClone(save);
  s.coins += run.coins;
  for (const f of run.fragments) if (!s.fragments.includes(f)) s.fragments.push(f);
  const finished = run.done === 'complete' && (run.night !== 7 || run.delivered.includes('tatay'));
  if (finished && !s.completed.includes(run.night)) s.completed.push(run.night);
  if (finished) s.unlocked = Math.min(7, Math.max(s.unlocked, run.night + 1));
  if (run.route) s.stars = { ...s.stars, [run.night]: Math.max(s.stars?.[run.night] || 0, finished ? starsFor(run) : 0) };
  return s;
}

export function buyUpgrade(save, key) {
  const level = save.upgrades[key];
  const cost = UPGRADES[key].costs[level];
  if (cost === undefined || save.coins < cost) return { ok: false, save };
  const s = structuredClone(save);
  s.coins -= cost;
  s.upgrades[key] = level + 1;
  return { ok: true, save: s };
}

export const serialize = (s) => JSON.stringify(s);

export function deserialize(text) {
  try {
    const s = JSON.parse(text);
    if (!s || s.v !== VERSION || !Array.isArray(s.fragments) || !Array.isArray(s.completed)) return defaultSave();
    return { ...defaultSave(), ...s, upgrades: { ...defaultSave().upgrades, ...s.upgrades }, stars: { ...s.stars }, settings: { ...defaultSettings(), ...(s.settings && typeof s.settings === 'object' ? s.settings : {}) } };
  } catch {
    return defaultSave();
  }
}
