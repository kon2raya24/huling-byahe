import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, applyRun, buyUpgrade, serialize, deserialize } from '../src/save.mjs';

const run = (over) => ({ night: 1, done: 'complete', coins: 30, fragments: ['tatay-1', 'lola-1'], delivered: ['lola'], ...over });

test('a completed night unlocks the next and banks coins and fragments', () => {
  const s = applyRun(defaultSave(), run());
  assert.equal(s.unlocked, 2);
  assert.equal(s.coins, 30);
  assert.deepEqual(s.fragments.sort(), ['lola-1', 'tatay-1']);
  assert.deepEqual(s.completed, [1]);
});

test('a failed night keeps coins and fragments but unlocks nothing', () => {
  const s = applyRun(defaultSave(), run({ done: 'breakdown' }));
  assert.equal(s.unlocked, 1);
  assert.equal(s.coins, 30);
  assert.deepEqual(s.completed, []);
});

test('night 7 only counts as complete once Tatay is delivered', () => {
  const base = { ...defaultSave(), unlocked: 7 };
  assert.deepEqual(applyRun(base, run({ night: 7, delivered: [] })).completed, []);
  const done = applyRun(base, run({ night: 7, delivered: ['tatay'], fragments: ['tatay-7'] }));
  assert.deepEqual(done.completed, [7]);
  assert.equal(done.unlocked, 7);
});

test('fragments never duplicate across replays', () => {
  let s = applyRun(defaultSave(), run());
  s = applyRun(s, run());
  assert.equal(s.fragments.length, 2);
});

test('upgrades cost coins, cap at level 2, and refuse when broke', () => {
  let s = { ...defaultSave(), coins: 200 };
  let r = buyUpgrade(s, 'brakes');
  assert.ok(r.ok); assert.equal(r.save.upgrades.brakes, 1); assert.equal(r.save.coins, 140);
  r = buyUpgrade(r.save, 'brakes');
  assert.ok(r.ok); assert.equal(r.save.upgrades.brakes, 2); assert.equal(r.save.coins, 20);
  assert.equal(buyUpgrade(r.save, 'brakes').ok, false, 'maxed');
  assert.equal(buyUpgrade(r.save, 'bumper').ok, false, 'too poor');
});

test('saves round-trip; junk and other versions give a fresh save', () => {
  const s = applyRun(defaultSave(), run());
  assert.deepEqual(deserialize(serialize(s)), s);
  assert.deepEqual(deserialize('nope'), defaultSave());
  assert.deepEqual(deserialize(JSON.stringify({ ...s, v: 99 })), defaultSave());
  assert.deepEqual(deserialize(null), defaultSave());
});

test('a save from before the settings screen loads with the default settings, and settings survive a round trip', async () => {
  const { deserialize, serialize, defaultSave, defaultSettings } = await import('../src/save.mjs');
  const old = { ...defaultSave() }; delete old.settings; old.coins = 42;
  const s = deserialize(JSON.stringify(old));
  assert.equal(s.coins, 42);
  assert.deepEqual(s.settings, defaultSettings());
  s.settings.gfx = 1; s.settings.calm = true; s.settings.music = 0.3;
  const back = deserialize(serialize(s));
  assert.equal(back.settings.gfx, 1); assert.equal(back.settings.calm, true); assert.equal(back.settings.music, 0.3); assert.equal(back.settings.sfx, 1);
});
