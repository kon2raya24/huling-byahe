// A simple driver that plays like a careful player, using only the road ahead. Used by the balance
// test (to prove nights are winnable) and by the title screen's attract mode.
import { STOP_LEN, JEEP_LEN, DOG_LANES_PER_SEC, DOG_TRIGGER } from './config.mjs';

export function autopilot(s) {
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
