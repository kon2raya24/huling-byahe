// The simulation: one step moves the jeepney, hazards, stops and story lines, and returns events
// (hit, pickup, dropoff, missed, line, horn, checkpoint, barya, nearmiss, done). Rendering and audio
// only read it.
import {
  JEEP_LEN, STOP_LEN, STOP_SPEED, CLOCK_END, CLOCK_RATE, ACCEL, COAST_DECEL, BRAKE_DECEL, BRAKE_PER_LEVEL,
  LANE_TIME, INVULN, BASE_HITS, HORN_CD, HORN_CD_PER_LEVEL, HORN_RANGE, CHECKPOINT_SPEED, FLOOD_FACTOR,
  TRICYCLE_FACTOR, DOG_LANES_PER_SEC, DOG_TRIGGER, BOARD_TIME, FARE, CLEAN_BONUS, NIGHT_BONUS,
  GAS_FACTOR, NEAR_DIST, COMBO_TIME, COMBO_MAX, SAKTO_WINDOW, SAKTO_BONUS, DOG_SCARE,
} from './config.mjs';
import { buildRoute } from './route.mjs';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Barya multiplier for a combo of near misses: ×2 at 2, ×3 at 4, up to COMBO_MAX.
export const multiplier = (combo) => Math.min(COMBO_MAX, 1 + Math.floor(combo / 2));

export function createRun({ night, seed, upgrades = {} }) {
  const up = { brakes: 0, bumper: 0, horn: 0, ...upgrades };
  return {
    night, seed, upgrades: up, route: buildRoute(night, seed),
    x: 0, lane: 0, laneY: 0, speed: 0, clock: 0, t: 0,
    hits: 0, maxHits: BASE_HITS + up.bumper, invuln: 0, hornCd: 0, boarding: 0, inFlood: false,
    aboard: ['tatay'], rideHits: { tatay: 0 }, delivered: [], fragments: [], coins: 0, done: null,
    braking: false, gassing: false, combo: 0, comboT: 0, bestCombo: 0, nearMisses: 0, sakto: 0,
  };
}

export function step(s, input, dt) {
  if (s.done) return [];
  const ev = [];
  const cruise = s.route.cruise;
  s.t += dt;

  // lanes
  if (input.lane) s.lane = clamp(s.lane + input.lane, 0, 2);
  const move = dt / LANE_TIME;
  s.laneY = Math.abs(s.lane - s.laneY) <= move ? s.lane : s.laneY + Math.sign(s.lane - s.laneY) * move;
  const myLane = Math.round(s.laneY);

  // horn: tricycles ahead in your lane pull over to a free neighbouring lane
  s.hornCd = Math.max(0, s.hornCd - dt);
  if (input.horn && s.hornCd === 0) {
    s.hornCd = HORN_CD - HORN_CD_PER_LEVEL * s.upgrades.horn;
    ev.push({ type: 'horn' });
    for (const h of s.route.hazards) {
      if (h.type !== 'tricycle' || h.lane !== myLane || h.x < s.x || h.x > s.x + HORN_RANGE) continue;
      const busy = (l) => s.route.hazards.some((o) => o !== h && o.type === 'tricycle' && o.lane === l && Math.abs(o.x - h.x) < 200);
      // never pull over into the lane you are steering towards
      const options = [h.lane + 1, h.lane - 1].filter((l) => l >= 0 && l <= 2 && l !== s.lane && !busy(l));
      if (options.length) { h.lane = options[0]; h.pulled = true; }
    }
    // dogs ahead bolt across
    for (const h of s.route.hazards) if (h.type === 'dog' && !h.gone && h.x > s.x && h.x < s.x + HORN_RANGE) h.scared = true;
  }

  // speed
  s.inFlood = s.route.hazards.some((h) => h.type === 'flood' && s.x >= h.x && s.x <= h.x + h.len && h.lanes.includes(myLane));
  if (s.boarding > 0) {
    s.speed = 0;
    s.boarding = Math.max(0, s.boarding - dt);
  } else {
    const target = input.brake ? 0 : cruise * (s.inFlood ? FLOOD_FACTOR : input.gas ? GAS_FACTOR : 1);
    if (s.speed < target) s.speed = Math.min(target, s.speed + ACCEL * dt);
    else s.speed = Math.max(target, s.speed - (input.brake ? BRAKE_DECEL * (1 + BRAKE_PER_LEVEL * s.upgrades.brakes) : COAST_DECEL) * dt);
  }
  s.braking = !!input.brake;
  s.gassing = !!input.gas && !input.brake && !s.inFlood && s.boarding === 0;
  const prevX = s.x;
  s.x += s.speed * dt;
  s.clock += CLOCK_RATE * dt;

  // hazards
  s.invuln = Math.max(0, s.invuln - dt);
  s.comboT = Math.max(0, s.comboT - dt);
  if (s.comboT === 0) s.combo = 0;
  const hit = (what) => {
    s.hits++;
    s.combo = 0; s.comboT = 0;
    s.invuln = INVULN;
    for (const g of s.aboard) s.rideHits[g] = (s.rideHits[g] || 0) + 1;
    ev.push({ type: 'hit', what });
    if (s.hits >= s.maxHits) { s.done = 'breakdown'; ev.push({ type: 'done', reason: 'breakdown' }); }
  };
  const lo = s.x - JEEP_LEN;
  for (const h of s.route.hazards) {
    // Tricycles drive at a fraction of your speed around the spot where the route placed them, so they
    // always meet you exactly there and the generator's fair spacing holds.
    // When you slow down, they keep going at their own pace (extra), so stopping behind one lets it
    // pull ahead instead of freezing with you.
    if (h.type === 'tricycle') {
      if (h.x0 === undefined) { h.x0 = h.x; h.extra = 0; }
      if (h.x - s.x < 1400 && h.x - s.x > -400) h.extra += Math.max(0, cruise - s.speed) * dt;
      h.x = h.x0 + TRICYCLE_FACTOR * (s.x - h.x0 + h.extra);
    }
    if (h.type === 'dog' && !h.gone && (h.scared || h.x - s.x < DOG_TRIGGER)) {
      h.laneF += h.dir * DOG_LANES_PER_SEC * (h.scared ? DOG_SCARE : 1) * dt;
      if (h.laneF < -0.6 || h.laneF > 2.6) h.gone = true;
    }
    if (h.spent || h.type === 'flood') continue;
    if (h.type === 'checkpoint') {
      if (prevX < h.x && s.x >= h.x) {
        h.spent = true;
        const ok = s.speed <= CHECKPOINT_SPEED;
        ev.push({ type: 'checkpoint', ok });
        if (!ok && s.invuln === 0) hit('checkpoint');
      }
      continue;
    }
    if (h.type === 'dog' && h.gone) continue;
    const laneOf = h.type === 'dog' ? h.laneF : h.lane;
    // near miss: it was close ahead in your lane, and you got past it untouched
    const rel = h.x - s.x;
    if (rel > 0 && rel < NEAR_DIST && Math.abs(s.laneY - laneOf) < 0.5) h.close = true;
    if (!h.passed && h.x + h.len < lo) {
      h.passed = true;
      if (h.close) {
        s.combo++; s.comboT = COMBO_TIME; s.nearMisses++;
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        const value = multiplier(s.combo);
        s.coins += value;
        ev.push({ type: 'nearmiss', what: h.type, combo: s.combo, value, x: h.x, lane: Math.round(laneOf) });
      }
      continue;
    }
    if (Math.abs(s.laneY - laneOf) >= 0.5) continue;
    if (h.x < s.x && h.x + h.len > lo) {
      h.spent = true;
      if (s.invuln === 0) hit(h.type);
    }
    if (s.done) return ev;
  }
  if (s.done) return ev;

  // barya
  for (const c of s.route.coins || []) {
    if (c.taken || c.x > s.x || c.x < lo) continue;
    if (Math.abs(s.laneY - c.lane) >= 0.5) continue;
    c.taken = true;
    const value = multiplier(s.combo);
    s.coins += value;
    ev.push({ type: 'barya', value, x: c.x, lane: c.lane });
  }

  // PARA stops
  const curb = Math.abs(s.laneY) < 0.25;
  for (const st of s.route.stops) {
    if (st.state !== 'pending') continue;
    const past = s.x > st.x + STOP_LEN;
    if (st.kind === 'dropoff' && !s.aboard.includes(st.ghost)) { if (past) st.state = 'skipped'; continue; }
    const inZone = s.x >= st.x && !past;
    if (inZone && curb && s.speed <= STOP_SPEED && s.boarding === 0) {
      st.state = 'done';
      s.boarding = BOARD_TIME;
      s.speed = 0;
      // sakto: the front bumper stopped right at the sign
      const sakto = Math.abs(s.x - (st.x + STOP_LEN / 2)) <= SAKTO_WINDOW;
      if (sakto) { s.coins += SAKTO_BONUS; s.sakto++; }
      if (st.frag && !s.fragments.includes(st.frag)) s.fragments.push(st.frag);
      if (st.kind === 'pickup') {
        s.aboard.push(st.ghost);
        s.rideHits[st.ghost] = 0;
        ev.push({ type: 'pickup', ghost: st.ghost, text: st.text, frag: st.frag, sakto });
      } else {
        s.aboard = s.aboard.filter((g) => g !== st.ghost);
        s.delivered.push(st.ghost);
        const coins = FARE + (s.rideHits[st.ghost] === 0 ? CLEAN_BONUS : 0);
        s.coins += coins;
        ev.push({ type: 'dropoff', ghost: st.ghost, text: st.text, frag: st.frag, coins, final: st.final, bantay: st.bantay, sakto });
      }
    } else if (past) {
      st.state = 'missed';
      ev.push({ type: 'missed', ghost: st.ghost, kind: st.kind });
    }
  }

  // story lines, once each, only while the ghost is aboard
  for (const l of s.route.lines) {
    if (l.done || !(prevX < l.x && s.x >= l.x)) continue;
    l.done = true;
    if (!s.aboard.includes(l.ghost)) continue;
    if (l.frag && !s.fragments.includes(l.frag)) s.fragments.push(l.frag);
    ev.push({ type: 'line', ghost: l.ghost, text: l.text, frag: l.frag });
  }

  // end of the night
  if (s.x >= s.route.length) {
    s.done = 'complete';
    s.coins += NIGHT_BONUS;
    ev.push({ type: 'done', reason: 'complete' });
  } else if (s.clock >= CLOCK_END) {
    s.done = 'sunrise';
    ev.push({ type: 'done', reason: 'sunrise' });
  }
  return ev;
}
