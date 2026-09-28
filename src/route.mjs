// Builds one night's road: stops and lines from the story, hazards from a seeded layout that is
// always fair (curb lane clear around every stop, a reaction gap between hazards).
import { NIGHT_CONFIG, ROUTE_SECONDS, STOP_LEN, MAX_CHECKPOINTS, MAX_FLOODS, BARYA_GAP } from './config.mjs';
import { nightByNumber } from './story.mjs';
import { rng } from './rng.mjs';

export function buildRoute(n, seed) {
  const cfg = NIGHT_CONFIG[n];
  const night = nightByNumber(n);
  const length = Math.round(cfg.cruise * ROUTE_SECONDS);
  const stops = [], lines = [];
  for (const e of night.events) {
    const x = Math.round(e.at * length);
    if (e.kind === 'line') lines.push({ x, ghost: e.ghost, frag: e.frag, text: e.text, done: false });
    else stops.push({ x, kind: e.kind, ghost: e.ghost, frag: e.frag, text: e.text, bantay: !!e.bantay, final: !!e.final, state: 'pending' });
  }
  const rand = rng(seed * 1009 + n * 7919);
  const int = (k) => Math.floor(rand() * k);
  const bag = Object.entries(cfg.types).flatMap(([type, w]) => Array(w).fill(type));
  const nearStop = (lo, hi) => stops.some((s) => hi > s.x - 500 && lo < s.x + STOP_LEN + 150);
  const hazards = [];
  let x = 900 + int(200);
  while (x < length - 700) {
    let type = bag[int(bag.length)];
    const count = (t) => hazards.filter((h) => h.type === t).length;
    if ((type === 'checkpoint' && count('checkpoint') >= MAX_CHECKPOINTS) || (type === 'flood' && count('flood') >= MAX_FLOODS)) type = rand() < 0.5 ? 'manhole' : 'tricycle';
    const len = type === 'flood' ? 300 + int(260) : type === 'tricycle' ? 90 : type === 'checkpoint' ? 0 : 40;
    const near = nearStop(x, x + Math.max(len, 40));
    if (near && (type === 'checkpoint' || type === 'dog')) type = rand() < 0.5 ? 'manhole' : 'tricycle';
    let h;
    if (type === 'checkpoint') h = { type, x };
    else if (type === 'flood') {
      const first = near ? 1 : int(3);
      const lanes = first === 2 || rand() < 0.4 ? [first] : [first, first + 1];
      h = { type, x, len, lanes };
    } else if (type === 'dog') {
      const from = rand() < 0.5 ? 0 : 2;
      h = { type, x, len: 40, laneF: from, dir: from === 0 ? 1 : -1, gone: false };
    } else {
      const lane = near ? 1 + int(2) : int(3);
      h = { type, x, len: type === 'tricycle' ? 90 : 40, lane };
    }
    hazards.push(h);
    // A tricycle keeps driving beside you for a while after you pass it, and you need speed back after
    // a checkpoint, so both get extra room before the next hazard.
    x += cfg.gapMin + int(cfg.gapMax - cfg.gapMin + 1) + (type === 'checkpoint' ? 300 : type === 'tricycle' ? 260 : 0);
  }
  return { night: n, length, cruise: cfg.cruise, gapMin: cfg.gapMin, rain: cfg.rain, fog: cfg.fog, stops, lines, hazards, coins: barya(n, seed, length, hazards, nearStop) };
}

// Trails of barya (coins) in the gaps between hazards, only in lanes nothing blocks nearby. A separate
// random stream, so adding coins never moves a hazard.
function barya(n, seed, length, hazards, nearStop) {
  const rand = rng(seed * 4099 + n * 104729 + 17);
  const blocked = (lo, hi) => {
    const lanes = new Set();
    for (const h of hazards) {
      if (h.x + (h.len || 0) + 250 < lo || h.x - 250 > hi) continue;
      if (h.type === 'flood') h.lanes.forEach((l) => lanes.add(l));
      else if (h.type === 'tricycle' || h.type === 'manhole') lanes.add(h.lane);
      else [0, 1, 2].forEach((l) => lanes.add(l));
    }
    return lanes;
  };
  const coins = [];
  for (let x = 700; x < length - 500; x += 700 + Math.floor(rand() * 700)) {
    const count = 3 + Math.floor(rand() * 3), end = x + (count - 1) * BARYA_GAP;
    if (rand() < 0.25 || nearStop(x, end)) continue;
    const bad = blocked(x, end);
    const free = [0, 1, 2].filter((l) => !bad.has(l));
    if (!free.length) continue;
    const lane = free[Math.floor(rand() * free.length)];
    for (let k = 0; k < count; k++) coins.push({ x: x + k * BARYA_GAP, lane, taken: false });
    x = end;
  }
  return coins;
}
