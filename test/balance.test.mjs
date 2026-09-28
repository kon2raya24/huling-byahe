// A simple autopilot proves every night can be finished before sunrise with every ghost delivered,
// on many seeds. It only uses what a player can see: the road ahead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step } from '../src/world.mjs';
import { NIGHTS } from '../src/story.mjs';
import { STOP_LEN, JEEP_LEN, DOG_LANES_PER_SEC, DOG_TRIGGER } from '../src/config.mjs';

function autopilot(s) {
  // Clear road ahead in a lane: distance to the first thing that would hit you there (0 if alongside).
  const free = (lane) => {
    let d = Infinity;
    for (const h of s.route.hazards) {
      if (h.spent || h.type === 'checkpoint') continue;
      const rel = h.x - s.x;
      if (rel + (h.len || 0) < -JEEP_LEN || rel > 1200) continue;
      let hits = false;
      if (h.type === 'flood') hits = h.lanes.includes(lane);
      else if (h.type === 'dog') {
        if (h.gone) continue;
        const t = Math.max(0, rel) / Math.max(s.speed, 60);
        const at = h.laneF + h.dir * DOG_LANES_PER_SEC * (rel < DOG_TRIGGER ? t : Math.max(0, t - (rel - DOG_TRIGGER) / Math.max(s.speed, 60)));
        hits = Math.abs(at - lane) < 0.8;
      } else hits = h.lane === lane;
      if (hits) d = Math.min(d, Math.max(0, rel));
    }
    return d;
  };
  const input = { lane: 0, brake: false, horn: false };
  const stop = s.route.stops.find((st) => st.state === 'pending' && (st.kind === 'pickup' || s.aboard.includes(st.ghost)) && st.x + STOP_LEN > s.x);
  const need = Math.max(260, s.speed * 1.1);
  const f = [0, 1, 2].map(free);
  let want = s.lane;
  const heading = stop && stop.x - s.x < 1100;
  if (heading && s.lane > 0 && f[s.lane - 1] > 220) want = s.lane - 1;            // step towards the curb when clear
  else if (f[s.lane] < need) {                                                       // dodge to the clearest neighbour
    const nb = [s.lane - 1, s.lane + 1].filter((l) => l >= 0 && l <= 2).sort((a, b) => f[b] - f[a])[0];
    if (f[nb] > f[s.lane]) want = nb;
  }
  if (want !== s.lane && (heading ? true : f[want] > 120)) input.lane = Math.sign(want - s.lane);
  const stoppingDist = (s.speed * s.speed) / (2 * 520) + 20;
  if (stop && s.x < stop.x + STOP_LEN - 20 && stop.x + 40 - s.x < stoppingDist && s.speed > 30) input.brake = true;
  if (stop && Math.abs(s.laneY) > 0.2 && stop.x - s.x < 260) input.brake = true;
  const cp = s.route.hazards.find((h) => h.type === 'checkpoint' && !h.spent && h.x > s.x && h.x - s.x < 420);
  if (cp && s.speed > 100) input.brake = true;
  if (f[s.lane] < 400 && s.route.hazards.some((h) => h.type === 'tricycle' && h.lane === s.lane && h.x > s.x && h.x - s.x < 500)) input.horn = true;
  return input;
}

function play(n, upgrades) {
  const night = NIGHTS[n - 1];
  const expected = night.events.filter((e) => e.kind === 'dropoff').map((e) => e.ghost).sort().join();
  let wins = 0, latest = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const s = createRun({ night: n, seed, upgrades });
    for (let i = 0; i < 60 * 400 && !s.done; i++) step(s, autopilot(s), 1 / 60);
    if (s.done === 'complete' && [...s.delivered].sort().join() === expected) { wins++; latest = Math.max(latest, s.clock); }
  }
  return { wins, latest };
}

// The autopilot is cruder than a player, so these are floors, not targets.
test('every night is winnable before sunrise with every ghost delivered, without upgrades', () => {
  for (const night of NIGHTS) {
    const { wins, latest } = play(night.n, {});
    assert.ok(wins >= (night.n <= 2 ? 24 : 20), `night ${night.n}: autopilot won ${wins}/25`);
    assert.ok(latest < 345, `night ${night.n}: finished as late as ${(latest / 60 + 23).toFixed(2)}h`);
  }
});

test('from night 4, one bumper level (affordable by then) makes nights nearly always winnable', () => {
  for (const n of [4, 5, 6, 7]) {
    const { wins } = play(n, { bumper: 1 });
    assert.ok(wins >= 23, `night ${n} with a bumper: autopilot won ${wins}/25`);
  }
});
