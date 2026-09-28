import test from 'node:test';
import assert from 'node:assert/strict';
import { GHOSTS, NIGHTS, FRAGMENTS, logbook, endingUnlocked } from '../src/story.mjs';

test('seven nights, numbered 1 to 7, events in route order', () => {
  assert.deepEqual(NIGHTS.map((n) => n.n), [1, 2, 3, 4, 5, 6, 7]);
  for (const night of NIGHTS) {
    const at = night.events.map((e) => e.at);
    assert.deepEqual(at, [...at].sort((a, b) => a - b), `night ${night.n} ordered`);
    assert.ok(at.every((a) => a > 0 && a < 1), `night ${night.n} inside the route`);
  }
});

test('every ghost reference exists and every dropoff follows its pickup the same night', () => {
  for (const night of NIGHTS) {
    const aboard = new Set(['tatay']);
    for (const e of night.events) {
      assert.ok(GHOSTS[e.ghost], `unknown ghost ${e.ghost}`);
      if (e.kind === 'pickup') { assert.ok(!aboard.has(e.ghost), `${e.ghost} boards twice on night ${night.n}`); aboard.add(e.ghost); }
      if (e.kind === 'line') assert.ok(aboard.has(e.ghost), `${e.ghost} speaks before boarding on night ${night.n}`);
      if (e.kind === 'dropoff') { assert.ok(aboard.has(e.ghost), `${e.ghost} drops off unboarded on night ${night.n}`); aboard.delete(e.ghost); }
    }
  }
});

test('fragment ids are unique and each story is numbered 1..n without gaps', () => {
  const ids = FRAGMENTS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const ghost of Object.keys(GHOSTS)) {
    const nums = FRAGMENTS.filter((f) => f.ghost === ghost).map((f) => Number(f.id.split('-')[1]));
    assert.deepEqual(nums, nums.map((_, i) => i + 1), `${ghost} fragments`);
  }
});

test('stops are spaced so a jeepney can stop for one and still reach the next', () => {
  for (const night of NIGHTS) {
    const stops = night.events.filter((e) => e.kind !== 'line').map((e) => e.at);
    for (let i = 1; i < stops.length; i++) assert.ok(stops[i] - stops[i - 1] >= 0.1, `night ${night.n} stops too close`);
  }
});

test('logbook hides the silent passenger\'s name until the last fragment, and the ending needs it', () => {
  const book = logbook(['lola-1']);
  assert.equal(book.find((g) => g.id === 'tatay').name, 'The Silent Passenger');
  assert.equal(book.find((g) => g.id === 'lola').frags[0].earned, true);
  assert.equal(endingUnlocked(['lola-1']), false);
  const all = logbook(FRAGMENTS.map((f) => f.id));
  assert.equal(all.find((g) => g.id === 'tatay').name, 'Tatay Ernesto');
  assert.ok(all.every((g) => g.complete));
  assert.equal(endingUnlocked(['tatay-7']), true);
});
