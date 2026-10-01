// The HUD over the 3D view: the clock, the route to the terminal with every stop on it, fares and bumps,
// the speed gauge (with the stop and checkpoint speeds marked), the sakto distance when a stop is near,
// the lusot combo, big toasts, and score text floating in the world where things happen.
import { STOP_LEN, STOP_SPEED, CHECKPOINT_SPEED, CLOCK_END, COMBO_TIME, GAS_FACTOR, SAKTO_WINDOW, HORN_CD, HORN_CD_PER_LEVEL } from './config.mjs';
import { GHOSTS } from './story.mjs';
import { multiplier } from './world.mjs';
import { clockText } from './render.mjs';

const $ = (id) => document.getElementById(id);
const PXM = 28;

export function createHud() {
  const el = $('hud'), float = $('floats'), toastEl = $('toast');
  const marks = new Map();
  let route = null, toastT = 0, lastCombo = 0;
  const floats = [];
  function setRoute(r) {
    route = r;
    const bar = $('route-marks'); bar.innerHTML = ''; marks.clear();
    for (const st of r.stops) { const d = document.createElement('i'); d.style.left = `${(100 * (st.x + STOP_LEN / 2)) / r.length}%`; d.style.setProperty('--c', GHOSTS[st.ghost].color); d.title = st.kind; bar.appendChild(d); marks.set(st, d); }
  }
  // a word in the world: follows its spot as the camera moves, rises and fades
  function popup(text, at, cls = '', life = 1.1) {
    const d = document.createElement('div'); d.className = `float ${cls}`; d.textContent = text; float.appendChild(d);
    floats.push({ d, at, t: 0, life });
    if (floats.length > 24) { const f = floats.shift(); f.d.remove(); }
  }
  function toast(big, small = '', cls = '') {
    toastEl.innerHTML = ''; const b = document.createElement('b'); b.textContent = big; toastEl.appendChild(b);
    if (small) { const s = document.createElement('span'); s.textContent = small; toastEl.appendChild(s); }
    toastEl.className = cls; toastEl.hidden = false; void toastEl.offsetWidth; toastEl.classList.add('pop'); toastT = 1.3;
  }
  function hideToast() { toastEl.hidden = true; toastT = 0; }
  function bubble(text, color) { const b = $('bubble'); b.textContent = text; b.style.setProperty('--c', color); b.hidden = false; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); b.dataset.t = '1.8'; }
  function update(s, dt, t, project) {
    if (s.route !== route) setRoute(s.route);
    // the clock, flashing in the last forty-five minutes
    const c = $('clock'); c.textContent = clockText(s.clock); c.classList.toggle('late', s.clock > CLOCK_END - 45 && Math.sin(t * 6) > 0);
    // the route
    $('route-jeep').style.left = `${Math.min(100, (100 * s.x) / s.route.length)}%`;
    $('route-fill').style.width = `${Math.min(100, (100 * s.x) / s.route.length)}%`;
    for (const [st, d] of marks) { const live = st.kind === 'pickup' || s.aboard.includes(st.ghost) || st.state !== 'pending'; d.className = `${st.state} ${live ? '' : 'wait'}`; }
    $('coins').textContent = `₱${s.coins}`;
    const pips = $('bumps'); if (pips.childElementCount !== s.maxHits) { pips.innerHTML = ''; for (let k = 0; k < s.maxHits; k++) pips.appendChild(document.createElement('i')); }
    [...pips.children].forEach((p, k) => p.classList.toggle('gone', k >= s.maxHits - s.hits));
    // speed: the needle, the gas zone, where a stop counts and where a checkpoint lets you through
    const top = s.route.cruise * GAS_FACTOR, f = Math.min(1, s.speed / top);
    $('speed-fill').style.width = `${f * 100}%`;
    $('speed-fill').className = s.gassing ? 'gas' : s.braking ? 'brake' : s.speed <= STOP_SPEED ? 'slow' : '';
    $('speed-num').textContent = Math.round(s.speed / 5);
    $('mk-stop').style.left = `${(STOP_SPEED / top) * 100}%`; $('mk-cp').style.left = `${(CHECKPOINT_SPEED / top) * 100}%`; $('mk-cruise').style.left = `${(s.route.cruise / top) * 100}%`;
    // the next stop: how far, which lane, and, close in, how far your bumper is from the sakto line
    const next = s.route.stops.find((st) => st.state === 'pending' && (st.kind === 'pickup' || s.aboard.includes(st.ghost)) && st.x + STOP_LEN > s.x);
    const guide = $('guide');
    if (next) {
      const d = (next.x + STOP_LEN / 2 - s.x) / PXM, g = GHOSTS[next.ghost];
      guide.hidden = false; guide.style.setProperty('--c', g.color);
      $('guide-kind').textContent = next.kind === 'pickup' ? 'PARA' : 'BABA';
      $('guide-who').textContent = next.ghost === 'tatay' ? 'Ang huling hintuan' : g.name;
      const close = d < 14 && d > -3;
      $('guide-dist').textContent = close ? `${d >= 0 ? '' : '−'}${Math.abs(d).toFixed(1)} m` : `${Math.round(d)} m`;
      const sakto = Math.abs(d) * PXM <= SAKTO_WINDOW;
      guide.classList.toggle('close', close); guide.classList.toggle('sakto', close && sakto);
      $('guide-lane').hidden = !(s.lane !== 0 && d < 60);
      $('guide-hint').textContent = !close ? '' : s.lane !== 0 ? '▼ curb lane' : s.speed > STOP_SPEED ? 'PRENO · brake to stop' : sakto ? 'SAKTO!' : d > 0 ? 'a little more…' : 'past the line';
    } else guide.hidden = true;
    // a checkpoint ahead, and you're too fast
    const cp = s.route.hazards.find((h) => h.type === 'checkpoint' && !h.spent && h.x > s.x && h.x - s.x < 700);
    $('warn').hidden = !(cp && s.speed > CHECKPOINT_SPEED);
    // the combo
    const combo = $('combo');
    if (s.combo > 0) { combo.hidden = false; $('combo-x').textContent = `×${multiplier(s.combo)}`; $('combo-n').textContent = `${s.combo} lusot`; $('combo-t').style.width = `${(100 * s.comboT) / COMBO_TIME}%`; if (s.combo > lastCombo) { combo.classList.remove('pop'); void combo.offsetWidth; combo.classList.add('pop'); } }
    else combo.hidden = true;
    lastCombo = s.combo;
    // the horn, recharging
    const cd = HORN_CD - HORN_CD_PER_LEVEL * s.upgrades.horn;
    document.documentElement.style.setProperty('--horn', `${Math.round((1 - s.hornCd / cd) * 100)}%`);
    // floating words
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.t += dt;
      if (f.t >= f.life) { f.d.remove(); floats.splice(i, 1); continue; }
      const p = project(f.at.x, f.at.lane, f.at.y + f.t * 0.9);
      const a = Math.min(1, (f.life - f.t) * 3), sc = 1 + Math.max(0, 0.15 - f.t) * 3;
      f.d.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${sc})`; f.d.style.opacity = p.on ? a : 0;
    }
    if (toastT > 0 && (toastT -= dt) <= 0) toastEl.hidden = true;
    const b = $('bubble');
    if (!b.hidden) {
      const left = +b.dataset.t - dt; b.dataset.t = left;
      const p = project(s.x - 90, s.laneY, 3.2);
      b.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      if (left <= 0) b.hidden = true;
    }
  }
  function clear() { for (const f of floats) f.d.remove(); floats.length = 0; hideToast(); $('bubble').hidden = true; }
  return { update, popup, toast, hideToast, bubble, clear, el };
}
