// Progress: unlocked nights, story fragments, coins and upgrades. Pure; the page does the storage.
import { UPGRADES } from './config.mjs';

const VERSION = 1;
export const defaultSave = () => ({ v: VERSION, unlocked: 1, completed: [], fragments: [], coins: 0, upgrades: { brakes: 0, bumper: 0, horn: 0 }, muted: false, seenIntro: false });

// A night counts as completed when you reach the terminal; night 7 also needs Tatay delivered.
export function applyRun(save, run) {
  const s = structuredClone(save);
  s.coins += run.coins;
  for (const f of run.fragments) if (!s.fragments.includes(f)) s.fragments.push(f);
  const finished = run.done === 'complete' && (run.night !== 7 || run.delivered.includes('tatay'));
  if (finished && !s.completed.includes(run.night)) s.completed.push(run.night);
  if (finished) s.unlocked = Math.min(7, Math.max(s.unlocked, run.night + 1));
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
    return { ...defaultSave(), ...s, upgrades: { ...defaultSave().upgrades, ...s.upgrades } };
  } catch {
    return defaultSave();
  }
}
