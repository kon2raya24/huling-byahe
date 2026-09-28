import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoute } from '../src/route.mjs';
import { NIGHTS } from '../src/story.mjs';
import { STOP_LEN } from '../src/config.mjs';

test('routes are deterministic per night and seed', () => {
  assert.deepEqual(buildRoute(3, 42), buildRoute(3, 42));
  assert.notDeepEqual(buildRoute(3, 42).hazards, buildRoute(3, 43).hazards);
});

test('every night has stops and lines at their story positions', () => {
  for (const night of NIGHTS) {
    const r = buildRoute(night.n, 7);
    assert.equal(r.stops.length + r.lines.length, night.events.length);
    for (const s of r.stops) assert.ok(s.x > 0 && s.x < r.length);
  }
});

test('the curb lane is always clear around every stop', () => {
  for (const night of NIGHTS) for (let seed = 1; seed <= 40; seed++) {
    const r = buildRoute(night.n, seed);
    for (const s of r.stops) {
      const lo = s.x - 500, hi = s.x + STOP_LEN + 150;
      for (const h of r.hazards) {
        const inWindow = h.x + (h.len || 0) > lo && h.x < hi;
        if (!inWindow) continue;
        assert.ok(!['checkpoint', 'dog'].includes(h.type), `night ${night.n} seed ${seed}: ${h.type} near a stop`);
        if (h.type === 'flood') assert.ok(!h.lanes.includes(0), `night ${night.n} seed ${seed}: flood on the curb near a stop`);
        if (h.lane !== undefined) assert.notEqual(h.lane, 0, `night ${night.n} seed ${seed}: ${h.type} on the curb near a stop`);
      }
    }
  }
});

test('hazards leave a reaction gap and never start before the jeepney gets going', () => {
  for (const night of NIGHTS) for (let seed = 1; seed <= 40; seed++) {
    const r = buildRoute(night.n, seed);
    const xs = r.hazards.map((h) => h.x);
    assert.ok(xs[0] >= 900);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= r.gapMin, `night ${night.n} seed ${seed}: gap ${xs[i] - xs[i - 1]}`);
  }
});

test('hazard types follow the night: no dogs before night 4, rain from night 2', () => {
  for (let seed = 1; seed <= 20; seed++) {
    assert.ok(!buildRoute(1, seed).hazards.some((h) => h.type === 'dog'));
    assert.ok(!buildRoute(3, seed).hazards.some((h) => h.type === 'dog'));
  }
  assert.equal(buildRoute(1, 1).rain, false);
  assert.equal(buildRoute(2, 1).rain, true);
});
