import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step } from '../src/world.mjs';
import { CLOCK_END, STOP_SPEED } from '../src/config.mjs';

const IDLE = { lane: 0, brake: false, horn: false };
const run = (opts = {}) => {
  const s = createRun({ night: 1, seed: 1, upgrades: { brakes: 0, bumper: 0, horn: 0 }, ...opts });
  s.route.hazards = []; s.route.stops = []; s.route.lines = [];
  return s;
};
const advance = (s, seconds, input = IDLE) => { const ev = []; for (let t = 0; t < seconds; t += 1 / 60) ev.push(...step(s, input, 1 / 60)); return ev; };

test('the jeepney speeds up to cruise and braking slows it down', () => {
  const s = run();
  advance(s, 4);
  assert.ok(Math.abs(s.speed - s.route.cruise) < 1);
  advance(s, 1.5, { ...IDLE, brake: true });
  assert.ok(s.speed < s.route.cruise * 0.2);
});

test('better brakes stop sooner', () => {
  const a = run(), b = run({ upgrades: { brakes: 2, bumper: 0, horn: 0 } });
  advance(a, 4); advance(b, 4);
  advance(a, 0.3, { ...IDLE, brake: true }); advance(b, 0.3, { ...IDLE, brake: true });
  assert.ok(b.speed < a.speed);
});

test('lane changes are clamped to the three lanes', () => {
  const s = run();
  step(s, { ...IDLE, lane: -1 }, 1 / 60);
  assert.equal(s.lane, 0);
  step(s, { ...IDLE, lane: 1 }, 1 / 60); step(s, { ...IDLE, lane: 1 }, 1 / 60); step(s, { ...IDLE, lane: 1 }, 1 / 60);
  assert.equal(s.lane, 2);
  advance(s, 0.5);
  assert.ok(Math.abs(s.laneY - 2) < 0.01);
});

test('a manhole in your lane is a hit, then 1.5 s of invulnerability', () => {
  const s = run();
  s.route.hazards = [{ type: 'manhole', x: 400, len: 40, lane: 0 }, { type: 'manhole', x: 700, len: 40, lane: 0 }];
  const ev = advance(s, 3);
  assert.equal(ev.filter((e) => e.type === 'hit').length, 1, 'second manhole falls inside invulnerability');
  assert.equal(s.hits, 1);
});

test('a manhole in another lane is harmless', () => {
  const s = run();
  s.route.hazards = [{ type: 'manhole', x: 400, len: 40, lane: 1 }];
  advance(s, 3);
  assert.equal(s.hits, 0);
});

test('running out of hits breaks the jeepney down; a bumper adds one', () => {
  for (const [bumper, expectBreak] of [[0, true], [1, false]]) {
    const s = run({ upgrades: { brakes: 0, bumper, horn: 0 } });
    s.route.hazards = [0, 1, 2].map((i) => ({ type: 'manhole', x: 400 + i * 800, len: 40, lane: 0 }));
    advance(s, 12);
    assert.equal(s.done === 'breakdown', expectBreak, `bumper ${bumper}`);
  }
});

test('stopping in the curb lane inside a PARA zone boards the ghost; passing it misses', () => {
  const s = run();
  s.route.stops = [{ x: 900, kind: 'pickup', ghost: 'lola', frag: 'lola-1', text: 'Para!', state: 'pending' }];
  advance(s, 2.2);
  let ev = [];
  for (let t = 0; t < 6 && !ev.some((e) => e.type === 'pickup'); t += 1 / 60) {
    const front = s.x;
    ev.push(...step(s, { ...IDLE, brake: front > 880 }, 1 / 60));
  }
  assert.ok(ev.some((e) => e.type === 'pickup' && e.ghost === 'lola'), 'boarded');
  assert.ok(s.aboard.includes('lola'));
  assert.ok(s.fragments.includes('lola-1'));

  const t2 = run();
  t2.route.stops = [{ x: 900, kind: 'pickup', ghost: 'lola', frag: 'lola-1', text: 'Para!', state: 'pending' }];
  const ev2 = advance(t2, 6);
  assert.ok(ev2.some((e) => e.type === 'missed' && e.ghost === 'lola'));
  assert.ok(!t2.aboard.includes('lola'));
});

test('stopping in the wrong lane does not board', () => {
  const s = run();
  s.route.stops = [{ x: 600, kind: 'pickup', ghost: 'lola', frag: 'lola-1', text: 'Para!', state: 'pending' }];
  step(s, { ...IDLE, lane: 1 }, 1 / 60);
  const ev = advance(s, 5, { ...IDLE, brake: true });
  assert.ok(!ev.some((e) => e.type === 'pickup'));
  assert.ok(s.speed <= STOP_SPEED);
});

test('dropping off a ghost pays a fare, with a bonus for a clean ride', () => {
  const s = run();
  s.aboard.push('lola'); s.rideHits.lola = 0;
  s.route.stops = [{ x: 600, kind: 'dropoff', ghost: 'lola', frag: 'lola-2', text: 'Salamat', state: 'pending' }];
  let ev = [];
  for (let t = 0; t < 8 && !ev.some((e) => e.type === 'dropoff'); t += 1 / 60) ev.push(...step(s, { ...IDLE, brake: s.x > 560 }, 1 / 60));
  const d = ev.find((e) => e.type === 'dropoff');
  assert.ok(d);
  assert.equal(d.coins, 17);
  assert.ok(!s.aboard.includes('lola'));
  assert.deepEqual(s.delivered, ['lola']);
});

test('a dropoff for a ghost who is not aboard never appears', () => {
  const s = run();
  s.route.stops = [{ x: 600, kind: 'dropoff', ghost: 'mika', frag: 'mika-2', text: '...', state: 'pending' }];
  const ev = advance(s, 5);
  assert.ok(!ev.some((e) => e.type === 'missed' || e.type === 'dropoff'));
});

test('lines are spoken only while their ghost is aboard, once', () => {
  const s = run();
  s.route.lines = [{ x: 300, ghost: 'tatay', frag: 'tatay-1', text: 'silent' }, { x: 400, ghost: 'mika', text: 'not aboard' }];
  const ev = advance(s, 4);
  const lines = ev.filter((e) => e.type === 'line');
  assert.deepEqual(lines.map((e) => e.ghost), ['tatay']);
  assert.ok(s.fragments.includes('tatay-1'));
});

test('a checkpoint is a hit only if you pass it fast', () => {
  const fast = run();
  fast.route.hazards = [{ type: 'checkpoint', x: 900 }];
  advance(fast, 5);
  assert.equal(fast.hits, 1);
  const slow = run();
  slow.route.hazards = [{ type: 'checkpoint', x: 900 }];
  for (let t = 0; t < 6; t += 1 / 60) step(slow, { ...IDLE, brake: slow.x > 700 && slow.speed > 90 }, 1 / 60);
  assert.equal(slow.hits, 0);
});

test('a flood slows you down but is not a hit', () => {
  const s = run();
  advance(s, 4);
  s.route.hazards = [{ type: 'flood', x: s.x + 50, len: 1400, lanes: [0, 1] }];
  advance(s, 2);
  assert.ok(s.speed < s.route.cruise * 0.6);
  assert.equal(s.hits, 0);
});

test('the horn makes a tricycle ahead in your lane pull over', () => {
  const s = run();
  s.route.hazards = [{ type: 'tricycle', x: 500, len: 90, lane: 0 }];
  const ev = step(s, { ...IDLE, horn: true }, 1 / 60);
  assert.ok(ev.some((e) => e.type === 'horn'));
  assert.notEqual(s.route.hazards[0].lane, 0);
  advance(s, 4);
  assert.equal(s.hits, 0);
  const again = step(s, { ...IDLE, horn: true }, 1 / 60);
  assert.ok(!again.some((e) => e.type === 'horn') || s.hornCd > 0);
});

test('the night ends at the terminal, or at sunrise if you are too slow', () => {
  const s = run();
  s.route.length = 2000;
  advance(s, 12);
  assert.equal(s.done, 'complete');
  const late = run();
  late.clock = CLOCK_END - 0.5;
  advance(late, 3, { ...IDLE, brake: true });
  assert.equal(late.done, 'sunrise');
});

test('the silent passenger is aboard from the start of every night', () => {
  assert.deepEqual(run().aboard, ['tatay']);
});

test('a tricycle keeps driving when you stop, so you can wait for it to pull ahead', () => {
  const s = run();
  s.route.hazards = [{ type: 'tricycle', x: 400, len: 90, lane: 0 }];
  step(s, IDLE, 1 / 60);
  const before = s.route.hazards[0].x;
  advance(s, 2, { ...IDLE, brake: true });
  assert.ok(s.route.hazards[0].x > before + 150, 'moved on while the jeepney was stopped');
});
