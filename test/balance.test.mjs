// A simple autopilot proves every night can be finished before sunrise with every ghost delivered,
// on many seeds. It only uses what a player can see: the road ahead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step } from '../src/world.mjs';
import { NIGHTS } from '../src/story.mjs';
import { autopilot } from '../src/autopilot.mjs';

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
