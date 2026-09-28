// The page: screens, input, the game loop, subtitles and saving. Rules live in world.mjs.
import { createRun, step } from './world.mjs';
import { autopilot } from './autopilot.mjs';
import { createRenderer } from './render.mjs';
import { createAudio } from './audio.mjs';
import { NIGHTS, GHOSTS, FRAGMENTS, logbook, endingUnlocked, nightByNumber } from './story.mjs';
import { applyRun, buyUpgrade, serialize, deserialize } from './save.mjs';
import { UPGRADES } from './config.mjs';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1';
const KEY = 'hulingbyahe.v1';
const store = {
  get() { if (TEST) return null; try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v) { if (TEST) return; try { localStorage.setItem(KEY, v); } catch { /* storage unavailable: play on */ } },
};
let save = deserialize(store.get());
const persist = () => store.set(serialize(save));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const seed = () => (TEST && Q.get('seed') ? Number(Q.get('seed')) : Math.floor(Math.random() * 1e9));

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const R = createRenderer(canvas);
const A = createAudio();
A.setMuted(save.muted);

const SCREENS = ['title', 'nights', 'intro', 'pause', 'results', 'logbook', 'garage', 'ending'];
let mode = 'title';
let backTo = 'title';
function show(name) {
  for (const id of SCREENS) $(id).hidden = id !== name;
  mode = name;
  $('corner').hidden = name !== 'play';
  $('touch').hidden = !(name === 'play' && touchUI);
  if (name !== 'play') hideSubtitle();
  const first = name !== 'play' && $(name)?.querySelector('button:not(:disabled)');
  if (first) first.focus({ preventScroll: true });
}

// ---------- runs ----------
let run = null;
let attract = newAttract();
let fragsBefore = [];
function newAttract() { return createRun({ night: 1 + Math.floor(Math.random() * 7), seed: seed(), upgrades: {} }); }

function startNight(n) {
  A.start();
  run = createRun({ night: n, seed: seed(), upgrades: save.upgrades });
  fragsBefore = [...save.fragments];
  const night = nightByNumber(n);
  $('intro-kicker').textContent = `Gabi ${n} · 11:00 PM`;
  $('intro-title').textContent = night.title;
  $('intro-sub').textContent = night.subtitle;
  $('intro-help').innerHTML = n === 1 || !save.seenIntro
    ? 'Stop in the <b>curb lane</b> (bottom) at a glowing <b>PARA</b> sign to pick up a passenger, and at <b>BABA</b> to drop them off. Brake early: you have to be almost stopped.<br><kbd>↑</kbd><kbd>↓</kbd> lanes · hold <kbd>Space</kbd> brake · <kbd>H</kbd> horn moves tricycles'
    : 'Reach the terminal before sunrise.';
  show('intro');
}

function begin() {
  save.seenIntro = true;
  persist();
  show('play');
  if (run.night === 1) say(null, 'Last trip of the night. The route is empty. Almost.', true);
}

function endRun() {
  const r = run;
  save = applyRun(save, r);
  persist();
  const reason = r.done;
  const finalDelivered = r.night === 7 && r.delivered.includes('tatay');
  $('res-title').textContent = reason === 'complete' ? (finalDelivered ? 'Nakarating ka. You made it.' : 'Nakarating sa terminal · Terminal reached') : reason === 'sunrise' ? 'Sumikat na ang araw · The sun came up' : 'Nasira ang jeep · Breakdown';
  $('res-sub').textContent = reason === 'complete'
    ? (r.night === 7 && !finalDelivered ? 'The man at the back is still waiting for his stop.' : `Gabi ${r.night} complete.`)
    : reason === 'sunrise' ? 'The passengers faded with the light. Try again tonight.' : 'Too many bumps. The jeepney needs a rest.';
  const list = $('res-list');
  list.innerHTML = '';
  const earned = r.fragments.map((id) => FRAGMENTS.find((f) => f.id === id)).filter(Boolean);
  for (const f of earned) {
    const li = document.createElement('li');
    const g = GHOSTS[f.ghost];
    li.style.setProperty('--c', g.color);
    const name = f.ghost === 'tatay' && !save.fragments.includes('tatay-7') ? g.name : (g.trueName || g.name);
    li.innerHTML = `<b></b> <span></span>${fragsBefore.includes(f.id) ? '' : '<span class="new">NEW</span>'}`;
    li.querySelector('b').textContent = name;
    li.querySelector('span').textContent = f.text;
    list.appendChild(li);
  }
  $('res-coins').textContent = `₱${r.coins} earned tonight · ₱${save.coins} total · ${r.delivered.filter((g) => g !== 'tatay').length} passenger${r.delivered.length === 1 ? '' : 's'} delivered`;
  const actions = $('res-actions');
  actions.innerHTML = '';
  const add = (label, fn, primary) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (primary) b.className = 'primary'; b.onclick = fn; actions.appendChild(b); };
  if (finalDelivered) add('Continue', () => playEnding(), true);
  else if (reason === 'complete' && r.night < 7) add(`Next night · Gabi ${r.night + 1}`, () => startNight(r.night + 1), true);
  add('Replay night', () => startNight(r.night), !(reason === 'complete'));
  add('Garage', () => { backTo = 'results'; renderGarage(); show('garage'); });
  add('Menu', () => { run = null; show('title'); });
  show('results');
}

// ---------- ending ----------
const ENDING = [
  'Sumikat na ang araw. The sun comes up over the terminal.',
  'Tatay Ernesto drove this route for thirty years.',
  'His last trip stopped one corner short of the terminal, at 4:52 in the morning.',
  'Tonight, his child drove it the rest of the way.',
  'Salamat sa pagsakay. Thank you for riding.',
];
let endingIndex = 0;
function playEnding() {
  A.ending();
  endingIndex = 0;
  $('ending-card').textContent = ENDING[0];
  $('btn-ending-next').textContent = 'Next';
  show('ending');
}
$('btn-ending-next').onclick = () => {
  endingIndex++;
  if (endingIndex < ENDING.length) { $('ending-card').textContent = ENDING[endingIndex]; if (endingIndex === ENDING.length - 1) $('btn-ending-next').textContent = 'Back to the menu'; return; }
  const have = save.fragments.length, total = FRAGMENTS.length;
  if (endingIndex === ENDING.length) { $('ending-card').textContent = `Talaan: ${have} of ${total} story fragments. ${have < total ? 'Replay nights to hear the rest.' : 'Every story, heard.'}\n\nA game by Lemmuel Turaya.`; return; }
  run = null;
  show('title');
};

// ---------- subtitles ----------
const queue = [];
let current = null;
function say(ghost, text, narration = false) {
  queue.push({ ghost, text, narration });
  if (!current) nextLine();
}
function nextLine() {
  current = queue.shift() || null;
  const el = $('subtitle');
  if (!current) { el.hidden = true; return; }
  const g = current.ghost && GHOSTS[current.ghost];
  const revealed = current.ghost === 'tatay' && save.fragments.includes('tatay-7');
  $('sub-name').textContent = g ? (revealed ? g.trueName : g.name) : '';
  $('sub-text').textContent = current.text;
  el.style.setProperty('--c', g ? g.color : '#f6c177');
  el.classList.toggle('narration', current.narration);
  el.hidden = false;
  current.until = performance.now() + Math.max(2600, current.text.length * 55);
}
function hideSubtitle() { queue.length = 0; current = null; $('subtitle').hidden = true; }

function onEvent(e) {
  switch (e.type) {
    case 'hit': A.hit(); R.hit(reduced()); if (run.hits === run.maxHits - 1) say(null, 'The engine coughs. One more bump and she\'s done.', true); break;
    case 'pickup': A.ghost(); say(e.ghost, e.text); break;
    case 'dropoff': A.coin(); say(e.ghost, `${e.text}  (+₱${e.coins})`); break;
    case 'missed': A.miss(); say(null, e.kind === 'pickup' ? `${GHOSTS[e.ghost].name} waves as you pass. Maybe another night.` : `You passed ${GHOSTS[e.ghost].name}'s stop. They sigh and look out the window.`, true); break;
    case 'line': say(e.ghost, e.text, e.ghost === 'tatay' && run.night < 7); break;
    case 'horn': A.horn(); break;
    case 'checkpoint': A.checkpoint(e.ok); if (!e.ok) say(null, 'Checkpoint! Dahan-dahan: slow down next time.', true); break;
    case 'done': setTimeout(endRun, e.reason === 'complete' ? 900 : 1400); break;
    default: break;
  }
}

// ---------- screens ----------
function renderNights() {
  const list = $('night-list');
  list.innerHTML = '';
  for (const night of NIGHTS) {
    const b = document.createElement('button');
    b.type = 'button';
    const frags = FRAGMENTS.filter((f) => f.night === night.n);
    const have = frags.filter((f) => save.fragments.includes(f.id)).length;
    const locked = night.n > save.unlocked;
    b.disabled = locked;
    b.innerHTML = `<span><b>Gabi ${night.n}</b> ${save.completed.includes(night.n) ? '<span class="done-mark">✓</span>' : ''}</span><span></span><small></small>`;
    b.children[1].textContent = locked ? 'Locked' : `${night.title} · ${night.subtitle}`;
    b.children[2].textContent = locked ? 'Finish the night before' : `${have}/${frags.length} fragments`;
    b.onclick = () => startNight(night.n);
    list.appendChild(b);
  }
}

function renderBook() {
  const book = $('book');
  book.innerHTML = '';
  const entries = logbook(save.fragments);
  $('book-count').textContent = `${save.fragments.length} of ${FRAGMENTS.length} fragments heard`;
  for (const g of entries) {
    const div = document.createElement('div');
    div.className = 'ghost';
    div.style.setProperty('--c', g.color);
    const h = document.createElement('h3'); h.textContent = g.name; div.appendChild(h);
    for (const f of g.frags) {
      const p = document.createElement('p');
      p.textContent = f.earned ? f.text : '…';
      if (!f.earned) p.className = 'missing';
      div.appendChild(p);
    }
    book.appendChild(div);
  }
  if (endingUnlocked(save.fragments)) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Watch the ending again'; b.onclick = playEnding; book.appendChild(b);
  }
}

function renderGarage() {
  $('garage-coins').textContent = `₱${save.coins} to spend`;
  const box = $('upgrades');
  box.innerHTML = '';
  for (const [key, u] of Object.entries(UPGRADES)) {
    const level = save.upgrades[key];
    const cost = u.costs[level];
    const row = document.createElement('div');
    row.className = 'up';
    row.innerHTML = '<div><b></b> <span class="muted"></span><div class="pips"></div></div><button type="button"></button>';
    row.querySelector('b').textContent = u.name;
    row.querySelector('.muted').textContent = u.label;
    row.querySelector('.pips').textContent = '●'.repeat(level) + '○'.repeat(u.costs.length - level);
    const btn = row.querySelector('button');
    btn.textContent = cost === undefined ? 'Max' : `Buy ₱${cost}`;
    btn.disabled = cost === undefined || save.coins < cost;
    btn.onclick = () => { const r = buyUpgrade(save, key); if (r.ok) { save = r.save; persist(); A.coin(); renderGarage(); } };
    box.appendChild(row);
  }
}

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]')?.dataset.go;
  if (!go) return;
  A.start();
  if (go === 'nights') { renderNights(); show('nights'); }
  else if (go === 'logbook') { renderBook(); show('logbook'); }
  else if (go === 'garage') { backTo = 'title'; renderGarage(); show('garage'); }
  else if (go === 'back') { if (backTo === 'results') show('results'); else show('title'); }
  else if (go === 'title') { run = null; show('title'); }
});
const soundLabel = () => { $('btn-sound').textContent = save.muted ? 'Sound: off' : 'Sound: on'; };
soundLabel();
$('btn-sound').onclick = () => { A.start(); save.muted = !save.muted; A.setMuted(save.muted); persist(); soundLabel(); };
$('btn-begin').onclick = begin;
$('btn-pause').onclick = () => pause();
$('btn-resume').onclick = () => show('play');
$('btn-restart').onclick = () => startNight(run.night);

function pause() { if (mode === 'play') show('pause'); }
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------- input ----------
const input = { lane: 0, horn: false, brake: false };
let touchUI = matchMedia('(pointer: coarse)').matches;
document.addEventListener('keydown', (e) => {
  const k = e.key;
  if (mode === 'intro' && (k === ' ' || k === 'Enter')) { e.preventDefault(); begin(); return; }
  if (mode === 'play') {
    if (['ArrowUp', 'ArrowDown', ' ', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    if (e.repeat && k !== ' ') return;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') input.lane = 1;
    else if (k === 'ArrowDown' || k === 's' || k === 'S') input.lane = -1;
    else if (k === ' ' || k === 'ArrowLeft' || k === 'Shift') input.brake = true;
    else if (k === 'h' || k === 'H') input.horn = true;
    else if (k === 'Escape' || k === 'p' || k === 'P') pause();
  } else if (mode === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) show('play');
});
document.addEventListener('keyup', (e) => { if ([' ', 'ArrowLeft', 'Shift'].includes(e.key)) input.brake = false; });
const hold = (id, on, off) => {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => off && off());
};
hold('t-up', () => { input.lane = 1; });
hold('t-down', () => { input.lane = -1; });
hold('t-horn', () => { input.horn = true; });
hold('t-brake', () => { input.brake = true; }, () => { input.brake = false; });
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !touchUI) { touchUI = true; if (mode === 'play') $('touch').hidden = false; } });

// ---------- loop ----------
const AUTOPLAY = TEST && Q.get('autoplay') === '1';
const SPEED = TEST ? Number(Q.get('speed') || 1) : 1;
let t = 0, last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now; t += dt; acc += dt * SPEED;
  const playing = run && (mode === 'play' || mode === 'pause' || mode === 'results');
  while (acc >= 1 / 60) {
    acc -= 1 / 60;
    if (run && mode === 'play') {
      const inp = AUTOPLAY ? autopilot(run) : { lane: input.lane, brake: input.brake, horn: input.horn };
      input.lane = 0; input.horn = false;
      for (const e of step(run, inp, 1 / 60)) onEvent(e);
    } else if (!run) {
      step(attract, autopilot(attract), 1 / 60);
      if (attract.done) attract = newAttract();
    }
  }
  if (current && performance.now() > current.until) nextLine();
  const view = playing ? run : attract;
  R.draw(view, t, { reduced: reduced(), showHud: !!playing });
  A.update(view, mode === 'play');
  requestAnimationFrame(frame);
}
window.addEventListener('resize', R.resize);
R.resize();
show('title');
requestAnimationFrame(frame);

if (TEST) {
  window.__hb = { get run() { return run; }, get mode() { return mode; }, get save() { return save; }, startNight, begin, show };
  if (Q.get('night')) { startNight(Number(Q.get('night'))); if (Q.get('go') === '1') begin(); }
}
