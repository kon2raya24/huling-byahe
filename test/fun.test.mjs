// The arcade layer: gas, barya on the road, near misses and the combo, sakto stops, the horn
// scattering dogs, and stars.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step, multiplier } from '../src/world.mjs';
import { buildRoute } from '../src/route.mjs';
import { NIGHTS } from '../src/story.mjs';
import { starsFor, applyRun, defaultSave, deserialize, serialize } from '../src/save.mjs';
import { GAS_FACTOR, STOP_LEN, SAKTO_BONUS, COMBO_TIME } from '../src/config.mjs';

const IDLE = { lane: 0, brake: false, horn: false, gas: false };
const run = (opts = {}) => {
  const s = createRun({ night: 1, seed: 1, upgrades: {}, ...opts });
  s.route.hazards = []; s.route.stops = []; s.route.lines = []; s.route.coins = [];
  return s;
};
const advance = (s, seconds, input = IDLE) => { const ev = []; for (let t = 0; t < seconds; t += 1 / 60) ev.push(...step(s, input, 1 / 60)); return ev; };

test('holding gas goes faster than cruise, and floods still slow you', () => {
  const s = run();
  advance(s, 4, { ...IDLE, gas: true });
  assert.ok(Math.abs(s.speed - s.route.cruise * GAS_FACTOR) < 1);
  assert.ok(s.gassing);
  s.route.hazards = [{ type: 'flood', x: s.x + 20, len: 3000, lanes: [0] }];
  advance(s, 2, { ...IDLE, gas: true });
  assert.ok(s.speed < s.route.cruise * 0.6);
  advance(s, 0.1, { ...IDLE, gas: true, brake: true });
  assert.ok(s.braking && !s.gassing, 'brake wins over gas');
});

test('barya in your lane is collected once; barya in another lane is not', () => {
  const s = run();
  s.route.coins = [{ x: 500, lane: 0, taken: false }, { x: 560, lane: 1, taken: false }];
  const ev = advance(s, 4);
  const got = ev.filter((e) => e.type === 'barya');
  assert.equal(got.length, 1);
  assert.equal(got[0].value, 1);
  assert.equal(s.coins, 1);
  assert.ok(s.route.coins[0].taken && !s.route.coins[1].taken);
});

test('swerving late around a hazard is a near miss that builds the combo and multiplies barya', () => {
  const s = run();
  advance(s, 3);
  const x0 = s.x;
  s.route.hazards = [0, 1, 2, 3].map((i) => ({ type: 'manhole', x: x0 + 400 + i * 700, len: 40, lane: i % 2 }));
  s.route.coins = [{ x: x0 + 400 + 3 * 700 + 300, lane: 0, taken: false }];
  const ev = [];
  for (let t = 0; t < 12; t += 1 / 60) {
    const next = s.route.hazards.find((h) => h.x > s.x);
    const inp = { ...IDLE };
    // wait until the hazard is close, then dodge to the other lane
    if (next && next.lane === s.lane && next.x - s.x < 150) inp.lane = s.lane === 0 ? 1 : -1;
    if (!next && s.lane !== 0) inp.lane = -1;
    ev.push(...step(s, inp, 1 / 60));
  }
  assert.equal(s.hits, 0);
  assert.equal(ev.filter((e) => e.type === 'nearmiss').length, 4);
  assert.equal(multiplier(4), 3);
  const b = ev.find((e) => e.type === 'barya');
  assert.equal(b.value, 3, 'the combo multiplies barya');
});

test('passing a hazard from far away is not a near miss; a hit resets the combo', () => {
  const s = run();
  s.lane = 2; s.laneY = 2;
  s.route.hazards = [{ type: 'manhole', x: 600, len: 40, lane: 0 }];
  assert.ok(!advance(s, 4).some((e) => e.type === 'nearmiss'));
  const h = run();
  h.combo = 5; h.comboT = COMBO_TIME;
  h.route.hazards = [{ type: 'manhole', x: 500, len: 40, lane: 0 }];
  advance(h, 3);
  assert.equal(h.combo, 0);
});

test('the combo fades if you go too long without a near miss', () => {
  const s = run();
  s.combo = 3; s.comboT = COMBO_TIME;
  advance(s, COMBO_TIME + 0.2);
  assert.equal(s.combo, 0);
});

test('stopping with the bumper at the sign is sakto and pays a bonus', () => {
  const stopAt = (target) => {
    const s = run();
    s.route.stops = [{ x: 1200, kind: 'pickup', ghost: 'lola', frag: 'lola-1', text: 'Para!', state: 'pending' }];
    advance(s, 3);
    const ev = [];
    // coast in at crawling speed, then brake hard at the target
    for (let t = 0; t < 10 && !ev.some((e) => e.type === 'pickup'); t += 1 / 60) {
      const crawl = s.x > 900 && s.speed > 60;
      ev.push(...step(s, { ...IDLE, brake: crawl || s.x >= target }, 1 / 60));
    }
    return { s, e: ev.find((e) => e.type === 'pickup') };
  };
  const good = stopAt(1200 + STOP_LEN / 2 - 8);
  assert.ok(good.e.sakto);
  assert.equal(good.s.coins, SAKTO_BONUS);
  const early = stopAt(1200);
  assert.ok(early.e && !early.e.sakto);
  assert.equal(early.s.coins, 0);
});

test('the horn makes a dog ahead bolt across and get out of the way sooner', () => {
  const calm = run(), honked = run();
  for (const s of [calm, honked]) s.route.hazards = [{ type: 'dog', x: 600, len: 40, laneF: 0, dir: 1, gone: false }];
  step(honked, { ...IDLE, horn: true }, 1 / 60);
  assert.ok(honked.route.hazards[0].scared);
  const gone = (s) => { for (let i = 0; i < 600; i++) { step(s, IDLE, 1 / 60); if (s.route.hazards[0].gone) return i; } return 999; };
  assert.ok(gone(honked) < gone(calm));
});

test('routes lay barya only in lanes clear of hazards and away from stops', () => {
  for (const night of NIGHTS) {
    for (const seed of [1, 2, 3]) {
      const r = buildRoute(night.n, seed);
      assert.ok(r.coins.length > 20, `night ${night.n} has barya`);
      for (const c of r.coins) {
        for (const h of r.hazards) {
          const lo = h.x - 250, hi = h.x + (h.len || 0) + 250;
          if (c.x < lo || c.x > hi) continue;
          const lanes = h.type === 'flood' ? h.lanes : h.type === 'tricycle' || h.type === 'manhole' ? [h.lane] : [0, 1, 2];
          assert.ok(!lanes.includes(c.lane), `night ${night.n} seed ${seed}: coin at ${c.x} lane ${c.lane} near ${h.type}`);
        }
        for (const st of r.stops) assert.ok(c.x <= st.x - 500 || c.x >= st.x + STOP_LEN + 150, 'clear of stops');
      }
    }
  }
  assert.deepEqual(buildRoute(2, 9).coins, buildRoute(2, 9).coins);
});

test('stars: one for the terminal, one for every stop made, one for no bumps', () => {
  const r = (over) => ({ night: 1, done: 'complete', hits: 0, route: { stops: [{ state: 'done' }, { state: 'done' }] }, ...over });
  assert.equal(starsFor(r()), 3);
  assert.equal(starsFor(r({ hits: 1 })), 2);
  assert.equal(starsFor(r({ route: { stops: [{ state: 'done' }, { state: 'missed' }] } })), 2);
  assert.equal(starsFor(r({ done: 'breakdown' })), 0);
});

test('the best stars per night are saved and survive a round-trip', () => {
  const base = { night: 2, done: 'complete', coins: 0, fragments: [], delivered: [], hits: 0, route: { stops: [{ state: 'done' }] } };
  let s = applyRun(defaultSave(), base);
  assert.equal(s.stars[2], 3);
  s = applyRun(s, { ...base, hits: 2 });
  assert.equal(s.stars[2], 3, 'a worse run never lowers the best');
  assert.deepEqual(deserialize(serialize(s)).stars, { 2: 3 });
  assert.deepEqual(deserialize(JSON.stringify({ ...defaultSave(), stars: undefined })).stars, {});
});
