// The page: screens, input (keyboard, touch, controller), the game loop, subtitles, the HUD and saving.
// Rules live in world.mjs. The 3D view (view3d.mjs) draws the night; if WebGL won't start, the original 2D
// renderer (render.mjs) takes over and the game plays the same.
import { createRun, step } from './world.mjs';
import { autopilot } from './autopilot.mjs';
import { createRenderer } from './render.mjs';
import { createAudio } from './audio.mjs';
import { createHud } from './hud.mjs';
import { NIGHTS, GHOSTS, FRAGMENTS, logbook, endingUnlocked, nightByNumber } from './story.mjs';
import { applyRun, buyUpgrade, serialize, deserialize, starsFor } from './save.mjs';
import { UPGRADES } from './config.mjs';
import { multiplier } from './world.mjs';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1';
const KEY = 'hulingbyahe.v1';
const store = {
  get() { if (TEST) return null; try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v) { if (TEST) return; try { localStorage.setItem(KEY, v); } catch { /* storage unavailable: play on */ } },
};
let save = deserialize(store.get());
const persist = () => store.set(serialize(save));
const calm = () => !!save.settings.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
const seed = () => (TEST && Q.get('seed') ? Number(Q.get('seed')) : Math.floor(Math.random() * 1e9));
const $ = (id) => document.getElementById(id);
const touch = matchMedia('(pointer: coarse)').matches;

const A = createAudio();
A.setMuted(save.muted); A.setMix(save.settings);
let view = null, R2D = null, hud = null;
const OUCH = ['Aray!', 'Dahan-dahan!', 'Ingat, boss!', 'Susmaryosep!', 'Ay, kabayo!'];
const WOW = ['Grabe!', 'Galing, boss!', 'Lusot!', 'Astig!', 'Wow!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const SCREENS = ['title', 'nights', 'intro', 'pause', 'results', 'logbook', 'garage', 'ending', 'settings'];
let mode = 'title';
let backTo = 'title', settingsFrom = 'title';
let touchUI = touch;
function show(name) {
  for (const id of SCREENS) $(id).hidden = id !== name;
  mode = name;
  const playing = name === 'play';
  $('hud').hidden = !playing || !view;
  $('touch').hidden = !(playing && touchUI);
  document.body.classList.toggle('playing', playing || name === 'pause' || name === 'intro');
  if (!playing) { hideSubtitle(); if (hud) hud.clear(); }
  const first = !playing && $(name)?.querySelector('button.primary:not(:disabled), button:not(:disabled)');
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
  $('night-label').textContent = `Gabi ${n} · ${night.title}`;
  $('intro-help').innerHTML = n === 1 || !save.seenIntro
    ? 'Stop in the <b>curb lane</b> (nearest you) at a glowing <b>PARA</b> sign to pick up a passenger, and at <b>BABA</b> to drop them off. Put your front bumper on the green line for a <b>SAKTO</b> bonus.<br>Grab <b>barya</b> on the road, and swerve late past hazards for a <b>LUSOT</b> combo that multiplies it.<br><kbd>↑</kbd><kbd>↓</kbd> lanes · hold <kbd>→</kbd> gas · hold <kbd>Space</kbd> brake · <kbd>H</kbd> horn'
    : `Reach the terminal before sunrise.${save.stars[n] ? ` Best: ${starText(save.stars[n])}` : ''}`;
  show('intro');
}

function begin() {
  save.seenIntro = true;
  persist();
  A.ui('confirm');
  show('play');
  if (run.night === 1) {
    say(null, 'Last trip of the night. The route is empty. Almost.', true);
    say(null, 'Hold → for gas. Grab the barya on the road.', true);
    say(null, 'Swerve late past a hazard for LUSOT! Chain them to multiply your barya.', true);
  }
}

const starText = (k) => '★'.repeat(k) + '☆'.repeat(3 - k);

function endRun() {
  const r = run;
  const best = save.stars[r.night] || 0;
  save = applyRun(save, r);
  const stars = starsFor(r);
  const se = $('res-stars'); se.innerHTML = '';
  for (let k = 0; k < 3; k++) { const sp = document.createElement('span'); sp.textContent = '★'; if (k >= stars) sp.className = 'off'; se.appendChild(sp); }
  se.setAttribute('aria-label', `${stars} of 3 stars`);
  const stats = $('res-stats'); stats.innerHTML = '';
  for (const [text, cls] of [[stars > best && stars > 0 ? 'Bagong best! New best' : null, 'best'], [`Lusot ×${r.nearMisses}`], [`Best combo ${r.bestCombo}`], [`Sakto ${r.sakto}`], [r.hits === 0 ? 'No bumps' : `${r.hits} bump${r.hits === 1 ? '' : 's'}`]]) {
    if (!text) continue; const sp = document.createElement('span'); sp.textContent = text; if (cls) sp.className = cls; stats.appendChild(sp);
  }
  persist();
  const reason = r.done;
  const finalDelivered = r.night === 7 && r.delivered.includes('tatay');
  $('res-kicker').textContent = `Gabi ${r.night} · ${nightByNumber(r.night).title}`;
  $('res-title').textContent = reason === 'complete' ? (finalDelivered ? 'Nakarating ka. You made it.' : 'Nakarating sa terminal') : reason === 'sunrise' ? 'Sumikat na ang araw' : 'Nasira ang jeep';
  $('res-sub').textContent = reason === 'complete'
    ? (r.night === 7 && !finalDelivered ? 'The man at the back is still waiting for his stop.' : `Terminal reached. Gabi ${r.night} complete.`)
    : reason === 'sunrise' ? 'The sun came up. The passengers faded with the light. Try again tonight.' : 'Breakdown: too many bumps. The jeepney needs a rest.';
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
  const add = (label, fn, primary) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (primary) b.className = 'primary'; b.onclick = () => { A.ui('select'); fn(); }; actions.appendChild(b); };
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
const endingCard = (text) => { const c = $('ending-card'); c.textContent = text; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; };
function playEnding() {
  A.ending();
  endingIndex = 0;
  if (!run || run.night !== 7) run = createRun({ night: 7, seed: seed(), upgrades: save.upgrades });
  endingCard(ENDING[0]);
  $('btn-ending-next').textContent = 'Next';
  show('ending');
}
$('btn-ending-next').onclick = () => {
  endingIndex++;
  if (endingIndex < ENDING.length) { endingCard(ENDING[endingIndex]); if (endingIndex === ENDING.length - 1) $('btn-ending-next').textContent = 'Back to the menu'; return; }
  const have = save.fragments.length, total = FRAGMENTS.length;
  if (endingIndex === ENDING.length) { endingCard(`Talaan: ${have} of ${total} story fragments. ${have < total ? 'Replay nights to hear the rest.' : 'Every story, heard.'}\n\nA game by Lemmuel Turaya.`); return; }
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
  if (!current) { el.hidden = true; $('bars').classList.remove('on'); return; }
  const g = current.ghost && GHOSTS[current.ghost];
  const revealed = current.ghost === 'tatay' && save.fragments.includes('tatay-7');
  $('sub-name').textContent = g ? (revealed ? g.trueName : g.name) : '';
  $('sub-text').textContent = current.text;
  el.style.setProperty('--c', g ? g.color : '#ffd23f');
  el.classList.toggle('narration', current.narration);
  el.hidden = false;
  // a story beat: letterbox bars, gently, while a passenger speaks
  $('bars').classList.toggle('on', !!g && !current.narration && !calm());
  current.until = performance.now() + Math.max(2600, current.text.length * 55);
}
function hideSubtitle() { queue.length = 0; current = null; $('subtitle').hidden = true; $('bars').classList.remove('on'); }

// ---------- what happens on the road ----------
let hitStop = 0;
function onEvent(e) {
  if (view) view.event(e, run); else R2D.event(e, run);
  const J = { x: run.x - 40, lane: run.laneY, y: 3 };
  const pop = (text, at, cls, life) => hud && hud.popup(text, at, cls, life);
  const talk = (lines) => { const t = run.aboard.filter((g) => g !== 'tatay'); if (t.length && hud) hud.bubble(pick(lines), GHOSTS[pick(t)].color); };
  switch (e.type) {
    case 'hit':
      A.hit(e.what); hitStop = 0.09;
      pop(pick(['BOGSH!', 'BLAG!', 'KALABOG!']), J, 'big red', 0.9); talk(OUCH);
      if (touchUI && !calm() && navigator.vibrate) navigator.vibrate(60);
      if (run.hits === run.maxHits - 1) say(null, 'The engine coughs. One more bump and she\'s done.', true);
      break;
    case 'pickup':
      A.ghost(); if (e.sakto) { A.sakto(); hud && hud.toast('SAKTO!', '+₱3 · perfect stop', 'green'); }
      else pop('Sakay na!', J, 'ghost', 1.4);
      say(e.ghost, e.text); break;
    case 'dropoff':
      A.coin(); if (e.sakto) { A.sakto(); hud && hud.toast('SAKTO!', '+₱3 · perfect stop', 'green'); }
      pop(`+₱${e.coins}`, J, 'big', 1.5);
      say(e.ghost, `${e.text}  (+₱${e.coins})`); break;
    case 'barya': A.barya(e.value); pop(`+${e.value}`, { x: e.x, lane: e.lane, y: 1.4 }, e.value > 1 ? '' : 'small', 0.8); break;
    case 'nearmiss':
      A.nearmiss(e.combo);
      pop(e.combo > 1 ? `LUSOT! ×${multiplier(e.combo)}` : 'LUSOT!', { x: e.x, lane: e.lane, y: 2.4 }, 'white', 1);
      if (e.combo >= 2 && hud) hud.toast('LUSOT!', `×${multiplier(e.combo)} · ${e.combo} combo`);
      if (e.combo >= 2 && Math.random() < 0.6) talk(WOW);
      break;
    case 'missed': A.miss(); pop('Lampas!', J, 'red', 1.2); say(null, e.kind === 'pickup' ? `${GHOSTS[e.ghost].name} waves as you pass. Maybe another night.` : `You passed ${GHOSTS[e.ghost].name}'s stop. They sigh and look out the window.`, true); break;
    case 'line': say(e.ghost, e.text, e.ghost === 'tatay' && run.night < 7); break;
    case 'horn': A.horn(); pop('BEEP BEEP!', { x: run.x + 20, lane: run.laneY, y: 2.6 }, 'white small', 0.8); break;
    case 'checkpoint': A.checkpoint(e.ok); if (e.ok) pop('✓ Ingat!', J, 'green', 1); else { hud && hud.toast('CHECKPOINT!', 'Dahan-dahan · too fast', 'red'); say(null, 'Checkpoint! Dahan-dahan: slow down next time.', true); } break;
    case 'done':
      if (e.reason === 'complete' && hud) hud.toast(run.night === 7 && run.delivered.includes('tatay') ? 'SALAMAT, ANAK' : 'TERMINAL!', `Gabi ${run.night}`, run.night === 7 ? 'ghost' : '');
      if (e.reason === 'sunrise' && hud) hud.toast('SUMIKAT NA', 'the sun is up', 'red');
      if (e.reason === 'breakdown' && hud) hud.toast('NASIRA!', 'breakdown', 'red');
      setTimeout(endRun, e.reason === 'complete' ? 1600 : 1800); break;
    default: break;
  }
}

// ---------- screens ----------
const NIGHT_C = ['#ff8a50', '#7da8e8', '#ff5fb0', '#b8d080', '#ffb060', '#c0d0ff', '#ff9a70'];
function renderNights() {
  const list = $('night-list');
  list.innerHTML = '';
  for (const night of NIGHTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.setProperty('--m', NIGHT_C[night.n - 1]);
    const frags = FRAGMENTS.filter((f) => f.night === night.n);
    const have = frags.filter((f) => save.fragments.includes(f.id)).length;
    const locked = night.n > save.unlocked;
    b.disabled = locked;
    b.innerHTML = '<b></b><span></span><small></small><small class="stars"></small>';
    b.children[0].textContent = `Gabi ${night.n}${save.completed.includes(night.n) ? ' ✓' : ''}`;
    b.children[1].textContent = locked ? 'Locked' : `${night.title} · ${night.subtitle}`;
    b.children[2].textContent = locked ? 'Finish the night before' : `${have}/${frags.length} fragments${[2, 5, 7].includes(night.n) ? ' · ulan' : ''}${[4, 6, 7].includes(night.n) ? ' · hamog' : ''}`;
    b.children[3].textContent = locked ? '' : starText(save.stars[night.n] || 0);
    b.onclick = () => { A.ui('confirm'); startNight(night.n); };
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
    row.className = 'up card';
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

// ---------- settings ----------
function openSettings(from) {
  settingsFrom = from;
  const S = save.settings;
  const seg = (key, list) => `<div class="seg">${list.map(([v, label]) => `<button type="button" data-k="${key}" data-v="${v}" aria-pressed="${String(S[key]) === String(v)}">${label}</button>`).join('')}</div>`;
  $('settings-body').innerHTML = `
    <div><h3>Itsura · Graphics</h3><p class="muted">Kalidad · Quality ${view ? `(now: ${['low', 'medium', 'high'][view.post.level]})` : '(2D mode)'}</p>${seg('gfx', [['auto', 'Auto'], [2, 'Mataas · High'], [1, 'Katamtaman'], [0, 'Mababa · Low']])}
    <p class="muted" style="margin-top:8px">Yanig ng camera · Camera shake and flashes</p>${seg('calm', [[false, 'Buo · Full'], [true, 'Kalmado · Calm']])}
    <p class="muted" style="margin-top:6px">Calm turns off shake, flashes, letterbox bars and camera swings.</p></div>
    <div><h3>Tunog · Sound</h3>
    <label class="slide">Musika · Music <input type="range" min="0" max="1" step="0.05" data-k="music" value="${S.music}"></label>
    <label class="slide">Tunog · Effects <input type="range" min="0" max="1" step="0.05" data-k="sfx" value="${S.sfx}"></label>
    <p class="muted" style="margin-top:8px">Sound</p>${seg('muted', [[false, 'On'], [true, 'Off']])}</div>`;
  for (const b of $('settings-body').querySelectorAll('button')) b.onclick = () => {
    const k = b.dataset.k, raw = b.dataset.v, v = raw === 'auto' ? 'auto' : raw === 'true' ? true : raw === 'false' ? false : +raw;
    if (k === 'muted') { save.muted = v; A.setMuted(v); } else S[k] = v;
    if (k === 'gfx' && view) { view.post.setAuto(v === 'auto'); view.post.setLevel(v === 'auto' ? (touch ? 1 : 2) : v); }
    document.body.classList.toggle('calm', calm());
    persist(); soundLabel(); A.ui('toggle');
    const again = `[data-k="${k}"][data-v="${raw}"]`;
    openSettings(settingsFrom);
    $('settings-body').querySelector(again)?.focus({ preventScroll: true });
  };
  for (const r of $('settings-body').querySelectorAll('input[type=range]')) r.oninput = () => { S[r.dataset.k] = +r.value; A.start(); A.setMix(S); persist(); };
  // the settings pane shows the muted state from the save, not the settings object
  for (const b of $('settings-body').querySelectorAll('[data-k="muted"]')) b.setAttribute('aria-pressed', String(String(save.muted) === b.dataset.v));
  show('settings');
}
$('settings-ok').onclick = () => { A.ui('back'); show(settingsFrom === 'pause' ? 'pause' : 'title'); };

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]')?.dataset.go;
  if (!go) return;
  A.start(); A.ui(go === 'title' || go === 'back' ? 'back' : 'select');
  if (go === 'nights') { renderNights(); show('nights'); }
  else if (go === 'logbook') { renderBook(); show('logbook'); }
  else if (go === 'garage') { backTo = 'title'; renderGarage(); show('garage'); }
  else if (go === 'settings') openSettings(mode === 'pause' ? 'pause' : 'title');
  else if (go === 'back') { if (backTo === 'results') show('results'); else show('title'); }
  else if (go === 'title') { run = null; show('title'); }
});
const soundLabel = () => { $('btn-sound').textContent = save.muted ? 'Tunog: off' : 'Tunog: on'; };
soundLabel();
$('btn-sound').onclick = () => { A.start(); save.muted = !save.muted; A.setMuted(save.muted); persist(); soundLabel(); };
$('btn-begin').onclick = begin;
$('btn-pause').onclick = () => pause();
$('btn-resume').onclick = () => { A.ui('confirm'); show('play'); };
$('btn-restart').onclick = () => startNight(run.night);

function pause() { if (mode === 'play') { show('pause'); A.ui('back'); } }
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------- input ----------
const input = { lane: 0, horn: false, brake: false, gas: false };
document.addEventListener('keydown', (e) => {
  const k = e.key;
  if (mode === 'intro' && (k === ' ' || k === 'Enter')) { e.preventDefault(); begin(); return; }
  if (mode === 'play') {
    if (['ArrowUp', 'ArrowDown', ' ', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    if (e.repeat && k !== ' ') return;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') input.lane = 1;
    else if (k === 'ArrowDown' || k === 's' || k === 'S') input.lane = -1;
    else if (k === ' ' || k === 'ArrowLeft' || k === 'Shift') input.brake = true;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') input.gas = true;
    else if (k === 'h' || k === 'H') input.horn = true;
    else if (k === 'Escape' || k === 'p' || k === 'P') pause();
  } else if (mode === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) show('play');
  else if (mode === 'settings' && k === 'Escape') $('settings-ok').click();
});
document.addEventListener('keyup', (e) => {
  if ([' ', 'ArrowLeft', 'Shift'].includes(e.key)) input.brake = false;
  if (['ArrowRight', 'd', 'D'].includes(e.key)) input.gas = false;
});
window.addEventListener('blur', () => { input.brake = false; input.gas = false; });
const hold = (id, on, off) => {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); A.start(); on(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => off && off());
};
hold('t-up', () => { input.lane = 1; });
hold('t-down', () => { input.lane = -1; });
hold('t-horn', () => { input.horn = true; });
hold('t-brake', () => { input.brake = true; }, () => { input.brake = false; });
hold('t-gas', () => { input.gas = true; }, () => { input.gas = false; });
$('stage').addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !touchUI) { touchUI = true; document.body.classList.add('touch'); if (mode === 'play') $('touch').hidden = false; } });

// a controller: D-pad or stick for lanes, R2 or A for gas, L2 or B for brake, X or Y for the horn,
// Start to pause; in the menus the D-pad moves between buttons and A presses one
let padPrev = [], padAxis = 0, padMenuT = 0;
function pollPad(dt) {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const p = pads[0];
  if (!p) return null;
  const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed), edge = (i) => b(i) && !padPrev[i];
  const ay = p.axes[1] || 0, axis = ay < -0.55 ? 1 : ay > 0.55 ? -1 : 0;
  const lane = edge(12) || (axis === 1 && padAxis !== 1) ? 1 : edge(13) || (axis === -1 && padAxis !== -1) ? -1 : 0;
  padAxis = axis;
  const out = { lane, gas: b(7) || b(0), brake: b(6) || b(1), horn: edge(2) || edge(3), start: edge(9) };
  if (mode !== 'play') {
    padMenuT -= dt;
    const btns = [...document.querySelectorAll(`#${mode} button:not(:disabled)`)];
    const at = btns.indexOf(document.activeElement);
    const dir = edge(13) || edge(15) || (axis === -1 && padMenuT <= 0) ? 1 : edge(12) || edge(14) || (axis === 1 && padMenuT <= 0) ? -1 : 0;
    if (dir && btns.length) { btns[(at + dir + btns.length) % btns.length].focus(); padMenuT = 0.25; A.ui('select'); }
    if (edge(0) && document.activeElement && document.activeElement.tagName === 'BUTTON') { A.start(); document.activeElement.click(); }
    if (edge(1)) { const back = document.querySelector(`#${mode} [data-go="title"], #${mode} [data-go="back"], #${mode} #settings-ok, #${mode} #btn-resume`); if (back) back.click(); }
    if (out.start && mode === 'pause') show('play');
    if (out.start && mode === 'intro') begin();
  } else if (out.start) pause();
  padPrev = p.buttons.map((x) => x.pressed);
  return out;
}

// ---------- loop ----------
const AUTOPLAY = TEST && Q.get('autoplay') === '1';
const SPEED = TEST ? Number(Q.get('speed') || 1) : 1;
let t = 0, last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now; t += dt;
  const pad = pollPad(dt);
  if (hitStop > 0) { hitStop -= dt; } else acc += dt * SPEED;
  const playing = run && ['play', 'pause', 'results', 'intro', 'ending'].includes(mode) || (run && mode === 'garage' && backTo === 'results') || (run && mode === 'settings' && settingsFrom === 'pause');
  let steps = 0;
  while (acc >= 1 / 60 && steps < 12 * SPEED) {
    acc -= 1 / 60; steps++;
    if (run && mode === 'play') {
      const inp = AUTOPLAY ? autopilot(run) : { lane: input.lane || (pad ? pad.lane : 0), brake: input.brake || !!(pad && pad.brake), horn: input.horn || !!(pad && pad.horn), gas: input.gas || !!(pad && pad.gas) };
      input.lane = 0; input.horn = false; if (pad) { pad.lane = 0; pad.horn = false; }
      for (const e of step(run, inp, 1 / 60)) onEvent(e);
      if (hitStop > 0) break;
    } else if (!playing) {
      for (const e of step(attract, autopilot(attract), 1 / 60)) (view ? view.event(e, attract) : R2D.event(e, attract));
      if (attract.done) attract = newAttract();
    }
  }
  if (acc > 1) acc = 0;
  if (current && performance.now() > current.until) nextLine();
  const shown = playing ? run : attract;
  if (view) {
    const vm = mode === 'play' ? 'play' : mode === 'pause' || (mode === 'settings' && settingsFrom === 'pause') ? 'pause' : mode === 'intro' ? 'intro' : mode === 'results' ? 'results' : mode === 'garage' ? 'garage' : mode === 'ending' ? 'ending' : 'title';
    view.frame(shown, dt, { mode: vm, calm: calm(), paused: vm === 'pause', dawn: mode === 'ending' ? 1 : 0 });
    if (mode === 'play') hud.update(run, dt, t, view.project);
  } else R2D.draw(shown, t, { reduced: calm(), showHud: !!playing });
  A.update(shown, mode === 'play');
  requestAnimationFrame(frame);
}

async function boot() {
  document.body.classList.toggle('calm', calm());
  // the painted signs and the HUD want the webfonts
  try { await Promise.race([Promise.all([document.fonts.load('900 italic 40px "Barlow Condensed"'), document.fonts.load('800 20px "Baloo 2"')]), new Promise((r) => setTimeout(r, 1800))]); } catch { /* system fonts */ }
  const wantFlat = Q.get('webgl') === '0';
  if (!wantFlat) {
    try {
      const { createView } = await import('./view3d.mjs');
      const g = Q.get('gfx') ?? (save.settings.gfx === 'auto' ? null : String(save.settings.gfx));
      view = createView($('view'), { low: touch, gfx: g });
      hud = createHud();
    } catch (err) { view = null; if (TEST) console.warn('3D view failed, using 2D', err); }
  }
  if (!view) {
    document.body.classList.add('flat2d');
    $('view').hidden = true; $('flat').hidden = false;
    R2D = createRenderer($('game'));
    window.addEventListener('resize', R2D.resize); R2D.resize();
  } else {
    window.addEventListener('resize', () => view.resize());
    new ResizeObserver(() => view.resize()).observe($('view'));
    view.resize();
    // the scanned street loads in the background; a bar shows how far along
    const bar = $('loading'), pct = $('load-pct');
    const loaded = (f) => { bar.hidden = false; pct.textContent = `${Math.round(f * 100)}%`; bar.style.setProperty('--p', `${Math.round(f * 100)}%`); };
    const doneLoading = () => { bar.classList.add('done'); setTimeout(() => { bar.hidden = true; }, 700); };
    if (Q.get('env') !== '0') import('./envpack.mjs').then(({ loadEnv }) => loadEnv(Q.get('envbase') || 'assets/env/')).then((env) => { loaded(0); return view.setEnv(env, loaded); }).then(() => { window.__envDone = true; doneLoading(); }).catch(() => { window.__envDone = 'none'; doneLoading(); });
  }
  show('title');
  requestAnimationFrame(frame);
  if (TEST) {
    window.__hb = { get run() { return run; }, get mode() { return mode; }, get save() { return save; }, get view() { return view; }, startNight, begin, show, openSettings, pause, playEnding, onEvent };
    if (Q.get('night')) { startNight(Number(Q.get('night'))); if (Q.get('go') === '1') begin(); }
  }
}
boot();
