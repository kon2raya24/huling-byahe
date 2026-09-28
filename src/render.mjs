// Draws one frame of the world state onto a 960×540 canvas, plus the juice: particles, popups,
// screen shake and passenger reactions. Reads the state only; never changes it.
import { JEEP_LEN, STOP_LEN, CLOCK_END, CHECKPOINT_SPEED, COMBO_TIME, SAKTO_WINDOW, GAS_FACTOR } from './config.mjs';
import { GHOSTS } from './story.mjs';
import { multiplier } from './world.mjs';

export const W = 960, H = 540;
const LANE_Y = [448, 392, 336]; // wheel line per lane; lane 0 is the curb
const ROAD_TOP = 300, ROAD_BOTTOM = 478;
const JEEP_X = 360; // screen x of the jeepney's front bumper
const laneY = (l) => LANE_Y[0] + (LANE_Y[1] - LANE_Y[0]) * l;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Deterministic "random" for scenery, so buildings don't flicker between frames.
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const FLAG_COLORS = ['#eb6f92', '#f6c177', '#9ccfd8', '#c4a7e7', '#8bd5a0', '#ff8a3d'];
const ROOF_LIGHTS = ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0', '#c77dff'];
const OUCH = ['Aray!', 'Dahan-dahan!', 'Ingat, boss!', 'Susmaryosep!', 'Ay, kabayo!'];
const WOW = ['Grabe!', 'Galing, boss!', 'Lusot!', 'Astig!', 'Wow!'];
const FAST = ['Bilis!', 'Hala, bilis!', 'Kapit!'];

export function clockText(minutes) {
  const total = 23 * 60 + Math.floor(minutes);
  const h24 = Math.floor(total / 60) % 24, m = total % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const drops = Array.from({ length: 160 }, (_, i) => ({ x: hash(i) * W, y: hash(i + 500) * H, s: 0.6 + hash(i + 900) * 0.8 }));
  const stars = Array.from({ length: 70 }, (_, i) => ({ x: hash(i + 40) * W, y: hash(i + 80) * 150, r: hash(i + 120) * 1.2 + 0.3, tw: hash(i + 160) * 6 }));
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,8,0.55)');

  // juice
  const parts = [], popups = [];
  let bubble = null, flash = 0, shake = 0, lastT = null, pitch = 0, prevSpeed = 0, puff = 0, splashT = 0, comboPop = 0, lastCombo = 0, gasTalk = 0;
  let reducedNow = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }

  // ---------- effects ----------
  const emit = (p) => { if (parts.length < 500) parts.push({ g: 0, size: 3, ...p, max: p.life }); };
  const popup = (text, x, y, color, size = 18) => popups.push({ text, x, y, color, size, life: 1.1, max: 1.1 });
  const say = (s, lines, force) => {
    const talkers = s.aboard.filter((g) => g !== 'tatay');
    if (!talkers.length || (bubble && !force)) return;
    const g = pick(talkers);
    bubble = { text: pick(lines), color: GHOSTS[g].color, life: 1.6 };
  };

  function event(e, s) {
    const jy = laneY(s.laneY);
    const few = reducedNow ? 0.3 : 1;
    switch (e.type) {
      case 'hit':
        flash = 1; shake = reducedNow ? 0 : 12;
        for (let i = 0; i < 26 * few; i++) {
          const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
          emit({ kind: 'spark', wx: s.x - 10, y: jy - 22, vx: Math.cos(a) * v + s.speed, vy: Math.sin(a) * v - 80, g: 600, life: 0.4 + Math.random() * 0.4, color: pick(['#ffd166', '#ff8a3d', '#fff3c4']) });
        }
        for (let i = 0; i < 6 * few; i++) emit({ kind: 'smoke', wx: s.x - 20, y: jy - 30, vx: s.speed * 0.6, vy: -30 - Math.random() * 30, life: 0.9, size: 10, color: '80,76,100' });
        popup(pick(['BOGSH!', 'BLAG!', 'KALABOG!']), JEEP_X - 40, jy - 90, '#ff6b6b', 24);
        say(s, OUCH, true);
        break;
      case 'nearmiss':
        shake = Math.max(shake, reducedNow ? 0 : 3);
        comboPop = 1;
        popup(e.combo > 1 ? `LUSOT! ×${multiplier(e.combo)}` : 'LUSOT!', JEEP_X - 20, jy - 96, '#f6c177', 20 + Math.min(10, e.combo * 2));
        for (let i = 0; i < 10 * few; i++) emit({ kind: 'streak', wx: e.x, y: laneY(e.lane) - 10 - Math.random() * 30, vx: -200 - Math.random() * 200, vy: 0, life: 0.35, color: '#fff3c4' });
        if (e.combo >= 2 && Math.random() < 0.6) say(s, WOW);
        break;
      case 'barya':
        popup(`+${e.value}`, JEEP_X + 6, jy - 70, e.value > 1 ? '#ffd166' : '#f6e0a8', 14 + e.value * 2);
        for (let i = 0; i < 7 * few; i++) {
          const a = Math.random() * Math.PI * 2;
          emit({ kind: 'glint', wx: e.x, y: laneY(e.lane) - 22, vx: s.speed * 0.9 + Math.cos(a) * 90, vy: Math.sin(a) * 90 - 40, life: 0.45, color: '#ffd166', size: 3 });
        }
        break;
      case 'pickup': case 'dropoff': {
        const c = GHOSTS[e.ghost].color;
        for (let i = 0; i < 26 * few; i++) emit({ kind: 'wisp', wx: s.x - 60 + Math.random() * 80, y: ROAD_BOTTOM + 20 - Math.random() * 40, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 90, life: 1.2 + Math.random() * 0.8, color: c, size: 4 + Math.random() * 4 });
        if (e.sakto) { popup('SAKTO! +₱3', JEEP_X - 50, jy - 100, '#8bd5a0', 24); shake = Math.max(shake, reducedNow ? 0 : 2); }
        if (e.type === 'dropoff') popup(`+₱${e.coins}`, JEEP_X - 30, jy - (e.sakto ? 128 : 100), '#f6c177', 22);
        else if (!e.sakto) popup('Sakay na!', JEEP_X - 50, jy - 100, c, 18);
        break;
      }
      case 'horn':
        emit({ kind: 'ring', wx: s.x + 10, y: jy - 26, vx: s.speed, vy: 0, life: 0.6, color: '#f6c177', size: 10 });
        emit({ kind: 'ring', wx: s.x + 10, y: jy - 26, vx: s.speed, vy: 0, life: 0.45, color: '#fff3c4', size: 4 });
        popup('BEEP BEEP!', JEEP_X + 40, jy - 70, '#fff3c4', 14);
        break;
      case 'checkpoint':
        if (e.ok) popup('✓ Ingat!', JEEP_X, jy - 90, '#9ccfd8', 18);
        break;
      case 'missed':
        popup('Lampas!', JEEP_X - 60, jy - 90, '#908caa', 18);
        break;
      default: break;
    }
  }

  function updateFx(s, dt, reduced) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.wx += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
    }
    for (let i = popups.length - 1; i >= 0; i--) { const p = popups[i]; p.life -= dt; p.y -= 34 * dt; if (p.life <= 0) popups.splice(i, 1); }
    if (bubble) { bubble.life -= dt; if (bubble.life <= 0) bubble = null; }
    flash = Math.max(0, flash - dt * 2.2);
    shake = Math.max(0, shake - dt * 40);
    comboPop = Math.max(0, comboPop - dt * 3);
    if (s.combo > lastCombo) comboPop = 1;
    lastCombo = s.combo;
    if (reduced) return;
    const jy = laneY(s.laneY);
    // exhaust, thicker when you floor it
    puff -= dt;
    if (puff <= 0 && s.speed > 0) {
      puff = s.gassing ? 0.04 : 0.11;
      emit({ kind: 'smoke', wx: s.x - JEEP_LEN - 4, y: jy - 12, vx: -30, vy: -12 - Math.random() * 16, life: s.gassing ? 0.8 : 0.6, size: s.gassing ? 6 : 4, color: s.gassing ? '70,66,90' : '120,116,140' });
    }
    // spray in a flood
    splashT -= dt;
    if (s.inFlood && s.speed > 20 && splashT <= 0) {
      splashT = 0.02;
      for (const wx of [s.x - 24, s.x - JEEP_LEN + 22]) emit({ kind: 'drop', wx, y: jy - 4, vx: s.speed * (0.5 + Math.random() * 0.5), vy: -90 - Math.random() * 120, g: 700, life: 0.45, color: '#bfe6ff', size: 2 + Math.random() * 2 });
    }
    // rain rings on the road
    if (s.route.rain && Math.random() < dt * 30) {
      const y = ROAD_TOP + 10 + Math.random() * (ROAD_BOTTOM - ROAD_TOP - 10);
      emit({ kind: 'ripple', wx: s.x - JEEP_X + Math.random() * W, y, vx: 0, vy: 0, life: 0.5, color: '#bcd0ff', size: 2 });
    }
    // passengers enjoy (or fear) the speed
    gasTalk = s.gassing ? gasTalk + dt : Math.min(0, gasTalk + dt);
    if (gasTalk > 2.5) { gasTalk = -6; say(s, FAST); }
  }

  function drawParts(s) {
    for (const p of parts) {
      const x = sx(s, p.wx), a = p.life / p.max;
      if (x < -60 || x > W + 60) continue;
      switch (p.kind) {
        case 'smoke':
          ctx.fillStyle = `rgba(${p.color},${0.35 * a})`;
          ctx.beginPath(); ctx.arc(x, p.y, p.size * (1 + (1 - a) * 2.2), 0, Math.PI * 2); ctx.fill();
          break;
        case 'spark': case 'streak': {
          ctx.strokeStyle = hexA(p.color, a); ctx.lineWidth = p.kind === 'spark' ? 2 : 1.5;
          const k = p.kind === 'spark' ? 0.03 : 0.12;
          ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x - (p.vx - s.speed) * k, p.y - p.vy * k); ctx.stroke();
          break;
        }
        case 'drop':
          ctx.fillStyle = hexA(p.color, 0.8 * a); ctx.beginPath(); ctx.arc(x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        case 'glint':
          ctx.fillStyle = hexA(p.color, a); star4(x, p.y, p.size * (0.6 + a));
          break;
        case 'wisp': {
          const r = p.size * (1 + (1 - a));
          const g = ctx.createRadialGradient(x, p.y, 0, x, p.y, r * 2.2);
          g.addColorStop(0, hexA(p.color, 0.7 * a)); g.addColorStop(1, hexA(p.color, 0));
          ctx.fillStyle = g; ctx.fillRect(x - r * 2.2, p.y - r * 2.2, r * 4.4, r * 4.4);
          break;
        }
        case 'ring': {
          const r = p.size + (1 - a) * 140;
          ctx.strokeStyle = hexA(p.color, a * 0.8); ctx.lineWidth = 3 * a + 1;
          ctx.beginPath(); ctx.ellipse(x, p.y, r, r * 0.45, 0, -1.1, 1.1); ctx.stroke();
          break;
        }
        case 'ripple':
          ctx.strokeStyle = hexA(p.color, 0.35 * a); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(x, p.y, 2 + (1 - a) * 9, 1 + (1 - a) * 3, 0, 0, Math.PI * 2); ctx.stroke();
          break;
        default: break;
      }
    }
  }

  function drawPopups() {
    ctx.textAlign = 'center';
    for (const p of popups) {
      const a = clamp((p.life / p.max) * 1.6, 0, 1);
      const pop = 1 + Math.max(0, (p.life - p.max + 0.15) / 0.15) * 0.5;
      ctx.font = `900 ${Math.round(p.size * pop)}px system-ui, -apple-system, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = `rgba(10,8,24,${0.85 * a})`; ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = hexA(p.color, a); ctx.fillText(p.text, p.x, p.y);
    }
    ctx.textAlign = 'left';
  }

  function drawBubble(s) {
    if (!bubble) return;
    const a = clamp(bubble.life * 3, 0, 1);
    const x = JEEP_X - 96, y = laneY(s.laneY) - 112;
    ctx.font = 'bold 14px system-ui, sans-serif';
    const w = ctx.measureText(bubble.text).width + 20;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fbf7ef'; roundRect(x - w / 2, y - 16, w, 26, 12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 4, y + 9); ctx.lineTo(x + 8, y + 9); ctx.lineTo(x + 2, y + 20); ctx.fill();
    ctx.strokeStyle = bubble.color; ctx.lineWidth = 2; roundRect(x - w / 2, y - 16, w, 26, 12); ctx.stroke();
    ctx.fillStyle = '#1b1a2b'; ctx.textAlign = 'center'; ctx.fillText(bubble.text, x, y + 2); ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // ---------- scenery ----------
  function sky(s, t, dawn) {
    const g = ctx.createLinearGradient(0, 0, 0, ROAD_TOP);
    g.addColorStop(0, mix('#060920', '#2b3a67', dawn));
    g.addColorStop(0.6, mix('#1c1446', '#e0906a', dawn));
    g.addColorStop(1, mix('#3a1d52', '#f6c177', dawn));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, ROAD_TOP);
    for (const st of stars) {
      ctx.fillStyle = `rgba(255,255,255,${(0.45 + 0.4 * Math.sin(t * 1.5 + st.tw)) * (1 - dawn)})`;
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
    }
    // moon with a halo
    const halo = ctx.createRadialGradient(820, 70, 20, 820, 70, 120);
    halo.addColorStop(0, `rgba(246,240,220,${0.28 * (1 - dawn)})`); halo.addColorStop(1, 'rgba(246,240,220,0)');
    ctx.fillStyle = halo; ctx.fillRect(700, 0, 240, 200);
    ctx.fillStyle = `rgba(246, 240, 220, ${0.95 - dawn * 0.6})`;
    ctx.beginPath(); ctx.arc(820, 70, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mix('#0a0c26', '#2b3a67', dawn);
    ctx.beginPath(); ctx.arc(832, 62, 24, 0, Math.PI * 2); ctx.fill();
    // drifting clouds
    for (let i = 0; i < 5; i++) {
      const cx = ((hash(i + 700) * 1400 - t * (6 + i * 2) - s.x * 0.02) % 1400 + 1400) % 1400 - 220;
      const cy = 40 + hash(i + 710) * 90;
      ctx.fillStyle = `rgba(${dawn > 0.5 ? '255,200,170' : '70,60,120'},${0.22 + dawn * 0.15})`;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(cx + k * 34, cy + (k % 2) * 6, 38, 12, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function skyline(s) {
    const off = s.x * 0.08;
    const bw = 70;
    const first = Math.floor(off / bw) - 1;
    for (let i = first; i < first + W / bw + 3; i++) {
      const x = i * bw - off;
      const h = 60 + hash(i) * 110;
      const top = 250 - h;
      ctx.fillStyle = '#121231';
      ctx.fillRect(x, top, bw - 6, h + 60);
      if (hash(i + 55) > 0.8) { ctx.fillStyle = '#ff4d6d'; ctx.fillRect(x + bw / 2 - 5, top - 8, 2, 8); ctx.beginPath(); ctx.arc(x + bw / 2 - 4, top - 9, 2.5, 0, Math.PI * 2); ctx.fill(); }
      for (let wy = top + 10; wy < 240; wy += 14) for (let wx = x + 8; wx < x + bw - 14; wx += 12) {
        if (hash(i * 97 + wx * 3 + wy) > 0.7) { ctx.fillStyle = hash(wx + wy) > 0.5 ? 'rgba(246,193,119,0.6)' : 'rgba(156,207,216,0.4)'; ctx.fillRect(wx, wy, 5, 7); }
      }
    }
  }

  function lrt(s, t) {
    const off = s.x * 0.25;
    // a train crosses now and then, lit windows and all
    const cycle = 24, p = (t % cycle) / cycle;
    const tx = W + 300 - p * (W + 1500);
    for (let c = 0; c < 3; c++) {
      const x = tx + c * 150;
      if (x > W || x + 146 < 0) continue;
      ctx.fillStyle = '#2d2a58'; roundRect(x, 140, 146, 24, 5); ctx.fill();
      ctx.fillStyle = '#7f5af0'; ctx.fillRect(x, 156, 146, 3);
      for (let k = 0; k < 7; k++) { ctx.fillStyle = hash(c * 9 + k) > 0.2 ? 'rgba(255,230,160,0.85)' : 'rgba(80,80,120,0.8)'; ctx.fillRect(x + 8 + k * 19, 145, 12, 8); }
      if (c === 0) { const hl = ctx.createRadialGradient(x, 152, 1, x, 152, 40); hl.addColorStop(0, 'rgba(255,245,200,0.7)'); hl.addColorStop(1, 'rgba(255,245,200,0)'); ctx.fillStyle = hl; ctx.fillRect(x - 40, 112, 50, 80); }
    }
    ctx.fillStyle = '#1b1838';
    ctx.fillRect(0, 164, W, 18);
    ctx.fillStyle = '#2a2656';
    ctx.fillRect(0, 162, W, 4);
    const gap = 260;
    for (let x = -(off % gap); x < W + gap; x += gap) {
      ctx.fillStyle = '#16142f';
      ctx.fillRect(x, 182, 22, 122);
    }
  }

  function neonText(text, x, y, color, on, size = 13) {
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    if (on) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
    ctx.fillStyle = on ? color : hexA(color, 0.25);
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function parol(x, y, t, color, reduced) {
    const swing = reduced ? 0 : Math.sin(t * 1.6 + x * 0.01) * 0.12;
    ctx.save(); ctx.translate(x, y); ctx.rotate(swing);
    ctx.strokeStyle = '#0d0c1c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -8); ctx.stroke();
    const g = ctx.createRadialGradient(0, 4, 1, 0, 4, 30);
    g.addColorStop(0, hexA(color, 0.55)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(-30, -26, 60, 60);
    ctx.fillStyle = color; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 5 : 12, a = -Math.PI / 2 + (k * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, 4 + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hexA(color, 0.8); ctx.beginPath(); ctx.moveTo(-3, 14); ctx.lineTo(-5, 26); ctx.moveTo(3, 14); ctx.lineTo(5, 26); ctx.stroke();
    ctx.restore();
  }

  function storefronts(s, t, reduced) {
    const off = s.x * 0.5;
    const sw = 180;
    const first = Math.floor(off / sw) - 1;
    const base = 300;
    for (let i = first; i < first + W / sw + 3; i++) {
      const x = i * sw - off;
      const kind = Math.floor(hash(i + 3000) * 8);
      const flick = reduced || hash(i + Math.floor(t * 8)) > 0.06;
      if (kind === 0) { // sari-sari store
        ctx.fillStyle = '#2d2650'; ctx.fillRect(x, base - 70, 150, 70);
        const glow = ctx.createLinearGradient(0, base - 50, 0, base - 16);
        glow.addColorStop(0, 'rgba(255,214,140,0.95)'); glow.addColorStop(1, 'rgba(246,160,90,0.8)');
        ctx.fillStyle = glow; ctx.fillRect(x + 12, base - 50, 126, 34);
        ctx.fillStyle = '#eb6f92'; ctx.fillRect(x, base - 84, 150, 16);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillText('SARI-SARI STORE', x + 22, base - 72);
        ctx.fillStyle = 'rgba(40,20,20,0.5)'; for (let k = 0; k < 6; k++) ctx.fillRect(x + 16 + k * 20, base - 46, 12, 26);
        for (let k = 0; k < 5; k++) { ctx.fillStyle = FLAG_COLORS[(i + k + 60) % 6]; ctx.fillRect(x + 20 + k * 24, base - 48, 8, 10); } // hanging snack packs
      } else if (kind === 1) { // capiz-window house with a parol
        ctx.fillStyle = '#272247'; ctx.fillRect(x + 10, base - 96, 130, 96);
        ctx.fillStyle = '#1b1735'; ctx.beginPath(); ctx.moveTo(x, base - 96); ctx.lineTo(x + 75, base - 130); ctx.lineTo(x + 150, base - 96); ctx.fill();
        for (let k = 0; k < 3; k++) { ctx.fillStyle = hash(i + k) > 0.4 ? 'rgba(246,220,170,0.7)' : 'rgba(60,50,90,0.8)'; ctx.fillRect(x + 22 + k * 38, base - 80, 26, 30); ctx.strokeStyle = 'rgba(20,16,40,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x + 22 + k * 38, base - 80, 26, 30); }
        parol(x + 75, base - 106, t, FLAG_COLORS[(i + 60) % 6], reduced);
      } else if (kind === 2) { // church facade
        ctx.fillStyle = '#302a58'; ctx.fillRect(x + 20, base - 120, 110, 120);
        ctx.beginPath(); ctx.moveTo(x + 20, base - 120); ctx.lineTo(x + 75, base - 160); ctx.lineTo(x + 130, base - 120); ctx.fill();
        ctx.fillStyle = 'rgba(246,193,119,0.7)'; ctx.fillRect(x + 64, base - 150, 22, 4); ctx.fillRect(x + 73, base - 159, 4, 22);
        const rose = ctx.createRadialGradient(x + 75, base - 90, 2, x + 75, base - 90, 16);
        rose.addColorStop(0, 'rgba(255,200,240,0.9)'); rose.addColorStop(1, 'rgba(196,167,231,0.3)');
        ctx.fillStyle = rose; ctx.beginPath(); ctx.arc(x + 75, base - 90, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#120f24'; ctx.fillRect(x + 58, base - 48, 34, 48);
        ctx.fillStyle = 'rgba(255,190,110,0.35)'; ctx.fillRect(x + 62, base - 44, 26, 44);
      } else if (kind === 3) { // carinderia with neon
        ctx.fillStyle = '#2a2244'; ctx.fillRect(x + 6, base - 62, 150, 62);
        neonText('KARINDERYA', x + 34, base - 42, '#9ccfd8', flick && (reduced || Math.sin(t * 3 + i) > -0.7));
        ctx.fillStyle = 'rgba(246,193,119,0.5)'; ctx.fillRect(x + 20, base - 30, 120, 24);
        for (let k = 0; k < 4; k++) { ctx.fillStyle = '#5b4a3a'; ctx.beginPath(); ctx.ellipse(x + 38 + k * 28, base - 24, 9, 4, 0, 0, Math.PI * 2); ctx.fill(); } // pots
      } else if (kind === 4) { // gap with a tree and fireflies
        ctx.fillStyle = '#16143a'; ctx.beginPath(); ctx.arc(x + 80, base - 70, 40, 0, Math.PI * 2); ctx.arc(x + 56, base - 58, 26, 0, Math.PI * 2); ctx.arc(x + 104, base - 56, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x + 76, base - 40, 8, 40);
        for (let k = 0; k < 6; k++) {
          const fx = x + 50 + hash(i * 7 + k) * 70 + (reduced ? 0 : Math.sin(t * 1.3 + k) * 6), fy = base - 90 + hash(i * 11 + k) * 60 + (reduced ? 0 : Math.cos(t + k) * 5);
          ctx.fillStyle = `rgba(220,255,150,${reduced ? 0.6 : 0.3 + 0.5 * Math.abs(Math.sin(t * 2 + k * 3))})`; ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, Math.PI * 2); ctx.fill();
        }
      } else if (kind === 5) { // botika with a green cross
        ctx.fillStyle = '#23304a'; ctx.fillRect(x + 8, base - 78, 140, 78);
        ctx.fillStyle = 'rgba(200,240,255,0.55)'; ctx.fillRect(x + 20, base - 46, 116, 40);
        if (flick) { ctx.shadowColor = '#3ddc84'; ctx.shadowBlur = 14; }
        ctx.fillStyle = flick ? '#3ddc84' : 'rgba(61,220,132,0.25)';
        ctx.fillRect(x + 26, base - 72, 6, 18); ctx.fillRect(x + 20, base - 66, 18, 6);
        ctx.shadowBlur = 0;
        neonText('BOTIKA', x + 50, base - 57, '#3ddc84', flick, 14);
      } else if (kind === 6) { // lugawan, open all night
        ctx.fillStyle = '#35203f'; ctx.fillRect(x + 4, base - 66, 150, 66);
        neonText('LUGAWAN 24/7', x + 22, base - 46, '#ff6fb5', flick && (reduced || Math.sin(t * 5 + i * 2) > -0.9), 14);
        ctx.fillStyle = 'rgba(255,200,150,0.5)'; ctx.fillRect(x + 16, base - 34, 126, 28);
        if (!reduced) for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(255,255,255,${0.15 + 0.1 * Math.sin(t * 2 + k)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 50 + k * 30, base - 36); ctx.quadraticCurveTo(x + 44 + k * 30 + Math.sin(t * 2 + k) * 6, base - 48, x + 52 + k * 30, base - 60); ctx.stroke(); } // steam
      } else { // vulcanizing shop
        ctx.fillStyle = '#2a2640'; ctx.fillRect(x + 10, base - 58, 140, 58);
        ctx.fillStyle = '#f1c40f'; ctx.fillRect(x + 14, base - 76, 120, 18);
        ctx.fillStyle = '#1b1a2b'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillText('VULCANIZING', x + 36, base - 63);
        for (let k = 0; k < 3; k++) { ctx.fillStyle = '#0d0c16'; ctx.beginPath(); ctx.ellipse(x + 40, base - 8 - k * 12, 16, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#3b3760'; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.fillStyle = 'rgba(246,193,119,0.35)'; ctx.fillRect(x + 70, base - 48, 70, 48);
      }
    }
  }

  function streetlights(s, t, dawn, reduced) {
    const gap = 320;
    const off = s.x % gap;
    const lamp = 1 - clamp((dawn - 0.6) / 0.4, 0, 1);
    const pole0 = Math.floor(s.x / gap);
    for (let j = -1, x = -off - gap; x < W + gap; x += gap, j++) {
      // banderitas strung to the next pole
      ctx.strokeStyle = 'rgba(20,18,40,0.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 4, 196); ctx.quadraticCurveTo(x + gap / 2, 222, x + gap + 4, 196); ctx.stroke();
      for (let k = 1; k < 19; k++) {
        const u = k / 19, fx = x + 4 + u * gap, fy = 196 + 52 * u * (1 - u);
        const flap = reduced ? 0 : Math.sin(t * 5 + k + j) * 2.5;
        ctx.fillStyle = FLAG_COLORS[(k + pole0 + j + 60) % 6];
        ctx.beginPath(); ctx.moveTo(fx - 6, fy); ctx.lineTo(fx + 6, fy); ctx.lineTo(fx + flap, fy + 13); ctx.fill();
      }
    }
    for (let x = -off; x < W + gap; x += gap) {
      ctx.fillStyle = '#0d0c1c'; ctx.fillRect(x, ROAD_TOP - 110, 5, 112);
      ctx.fillRect(x, ROAD_TOP - 110, 34, 4);
      if (lamp > 0) {
        const pool = ctx.createRadialGradient(x + 30, ROAD_TOP + 60, 5, x + 30, ROAD_TOP + 60, 180);
        pool.addColorStop(0, `rgba(255,170,80,${0.26 * lamp})`); pool.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = pool; ctx.fillRect(x - 150, ROAD_TOP, 360, ROAD_BOTTOM - ROAD_TOP);
        const bulb = ctx.createRadialGradient(x + 32, ROAD_TOP - 104, 1, x + 32, ROAD_TOP - 104, 22);
        bulb.addColorStop(0, `rgba(255,200,120,${0.8 * lamp})`); bulb.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = bulb; ctx.fillRect(x + 10, ROAD_TOP - 126, 44, 44);
        // light falling from the lamp
        const beam = ctx.createLinearGradient(0, ROAD_TOP - 100, 0, ROAD_TOP + 40);
        beam.addColorStop(0, `rgba(255,190,110,${0.12 * lamp})`); beam.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x + 26, ROAD_TOP - 100); ctx.lineTo(x + 38, ROAD_TOP - 100); ctx.lineTo(x + 100, ROAD_TOP + 40); ctx.lineTo(x - 36, ROAD_TOP + 40); ctx.fill();
      }
      ctx.fillStyle = lamp > 0 ? '#ffc070' : '#6e6a86'; ctx.beginPath(); ctx.arc(x + 32, ROAD_TOP - 104, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function road(s, t, dawn) {
    const g = ctx.createLinearGradient(0, ROAD_TOP, 0, ROAD_BOTTOM);
    g.addColorStop(0, '#1e1c30'); g.addColorStop(1, '#16152a');
    ctx.fillStyle = g; ctx.fillRect(0, ROAD_TOP, W, ROAD_BOTTOM - ROAD_TOP);
    ctx.fillStyle = '#2a2838'; ctx.fillRect(0, ROAD_TOP, W, 6);
    // asphalt grit
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    const gp = 37, g0 = Math.floor(s.x / gp);
    for (let i = g0; i < g0 + W / gp + 2; i++) {
      const x = i * gp - s.x;
      for (let k = 0; k < 3; k++) ctx.fillRect(x + hash(i * 3 + k) * gp, ROAD_TOP + 8 + hash(i * 5 + k) * (ROAD_BOTTOM - ROAD_TOP - 12), 2, 1);
    }
    // wet reflections of the streetlights
    if (s.route.rain && dawn < 0.9) {
      const gap = 320, off = s.x % gap;
      for (let x = -off; x < W + gap; x += gap) {
        const r = ctx.createLinearGradient(0, ROAD_TOP, 0, ROAD_BOTTOM);
        r.addColorStop(0, 'rgba(255,180,100,0.2)'); r.addColorStop(1, 'rgba(255,180,100,0)');
        ctx.fillStyle = r; ctx.fillRect(x + 22 + Math.sin(t * 3 + x) * 2, ROAD_TOP + 6, 18, ROAD_BOTTOM - ROAD_TOP - 6);
      }
    }
    // lane dashes between lanes
    const dash = 60, period = 110;
    ctx.fillStyle = 'rgba(230,220,200,0.5)';
    for (const y of [(LANE_Y[0] + LANE_Y[1]) / 2 - 2, (LANE_Y[1] + LANE_Y[2]) / 2 - 2]) {
      for (let x = -((s.x) % period); x < W; x += period) ctx.fillRect(x, y, dash, 3);
    }
    // painted curb + sidewalk
    const cp = 40;
    for (let x = -((s.x) % (cp * 2)); x < W; x += cp * 2) {
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x, ROAD_BOTTOM, cp, 5);
      ctx.fillStyle = '#2d2a3c'; ctx.fillRect(x + cp, ROAD_BOTTOM, cp, 5);
    }
    ctx.fillStyle = '#2b2740'; ctx.fillRect(0, ROAD_BOTTOM + 5, W, H - ROAD_BOTTOM);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = -((s.x) % 48); x < W; x += 48) ctx.fillRect(x, ROAD_BOTTOM + 5, 2, H - ROAD_BOTTOM);
  }

  // ---------- things on the road ----------
  const sx = (s, x) => JEEP_X + (x - s.x);

  function floods(s, t) {
    for (const h of s.route.hazards) {
      if (h.type !== 'flood') continue;
      const x = sx(s, h.x);
      if (x > W + 20 || x + h.len < -20) continue;
      for (const l of h.lanes) {
        const y = laneY(l);
        const g = ctx.createLinearGradient(0, y - 30, 0, y + 4);
        g.addColorStop(0, 'rgba(90,150,220,0.3)'); g.addColorStop(1, 'rgba(70,120,200,0.5)');
        ctx.fillStyle = g;
        roundRect(x, y - 30, h.len, 34, 14); ctx.fill();
        ctx.strokeStyle = 'rgba(190,230,255,0.4)'; ctx.lineWidth = 1.5;
        for (let k = 0; k < h.len - 20; k += 46) { ctx.beginPath(); ctx.ellipse(x + k + 22 + Math.sin(t * 2 + k) * 4, y - 12 + ((k / 46) % 2) * 8, 12, 3, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,220,160,0.18)'; ctx.fillRect(x + 10, y - 22 + Math.sin(t * 1.5) * 2, h.len - 20, 2); // light on the water
      }
    }
  }

  function stops(s, t, reduced) {
    for (const st of s.route.stops) {
      const x = sx(s, st.x);
      if (x > W + 80 || x + STOP_LEN < -80) continue;
      const active = st.state === 'pending' && (st.kind === 'pickup' || s.aboard.includes(st.ghost));
      const g = GHOSTS[st.ghost];
      const px = x + STOP_LEN / 2;
      if (active) {
        const pulse = reduced ? 0.5 : 0.35 + 0.25 * Math.sin(t * 4);
        ctx.fillStyle = hexA(g.color, pulse * 0.6);
        ctx.fillRect(x, LANE_Y[0] - 30, STOP_LEN, ROAD_BOTTOM - LANE_Y[0] + 28);
        ctx.strokeStyle = hexA(g.color, 0.9); ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
        ctx.strokeRect(x, LANE_Y[0] - 30, STOP_LEN, ROAD_BOTTOM - LANE_Y[0] + 28); ctx.setLineDash([]);
        // the sakto sweet spot, painted on the road below the wheels: stop with your front bumper here
        ctx.fillStyle = hexA('#8bd5a0', 0.55 + (reduced ? 0 : 0.25 * Math.sin(t * 8)));
        ctx.fillRect(px - SAKTO_WINDOW, LANE_Y[0] + 4, SAKTO_WINDOW * 2, ROAD_BOTTOM - LANE_Y[0] - 6);
        ctx.fillStyle = '#0f2a1a'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('SAKTO', px, LANE_Y[0] + 22); ctx.textAlign = 'left';
        ctx.fillStyle = '#e9fff0'; ctx.fillRect(px - 1, LANE_Y[0] + 4, 2, ROAD_BOTTOM - LANE_Y[0] - 6);
      }
      // PARA sign on the sidewalk
      ctx.fillStyle = '#0d0c1c'; ctx.fillRect(px - 2, ROAD_BOTTOM - 44, 4, 70);
      if (active) { const sg = ctx.createRadialGradient(px, ROAD_BOTTOM - 51, 2, px, ROAD_BOTTOM - 51, 44); sg.addColorStop(0, 'rgba(246,193,119,0.5)'); sg.addColorStop(1, 'rgba(246,193,119,0)'); ctx.fillStyle = sg; ctx.fillRect(px - 44, ROAD_BOTTOM - 95, 88, 88); }
      ctx.fillStyle = active ? '#f6c177' : '#6e6a86';
      roundRect(px - 26, ROAD_BOTTOM - 62, 52, 22, 4); ctx.fill();
      ctx.fillStyle = '#1b1a2b'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(st.kind === 'pickup' ? 'PARA' : 'BABA', px, ROAD_BOTTOM - 46); ctx.textAlign = 'left';
      if (st.kind === 'pickup' && st.state === 'pending') {
        ghostFigure(px + 34, ROAD_BOTTOM + 28, g.color, t, 1);
        if (!reduced && Math.sin(t * 5) > 0) { ctx.fillStyle = hexA(g.color, 0.9); ctx.font = 'bold 12px system-ui, sans-serif'; ctx.fillText('Para po!', px + 46, ROAD_BOTTOM - 22); } // waving for a ride
      }
      if (st.bantay && st.state === 'pending') dogFigure(px + 40, ROAD_BOTTOM + 30, t, true);
      if (st.kind === 'dropoff' && active) {
        const glow = ctx.createRadialGradient(px, ROAD_BOTTOM + 10, 2, px, ROAD_BOTTOM + 10, 60);
        glow.addColorStop(0, hexA(g.color, 0.45)); glow.addColorStop(1, hexA(g.color, 0));
        ctx.fillStyle = glow; ctx.fillRect(px - 60, ROAD_BOTTOM - 50, 120, 110);
      }
    }
  }

  function items(s, t, reduced) {
    const list = [];
    for (const c of s.route.coins || []) {
      if (c.taken) continue;
      const x = sx(s, c.x);
      if (x > W + 20 || x < -20) continue;
      list.push({ y: laneY(c.lane) - 0.2, draw: () => coin(x, laneY(c.lane), t, c.x, reduced) });
    }
    for (const h of s.route.hazards) {
      if (h.type === 'flood') continue;
      const x = sx(s, h.x);
      if (x > W + 120 || x < -200) continue;
      if (h.type === 'checkpoint') { list.push({ y: 999, draw: () => checkpoint(x, t, reduced, s.speed > CHECKPOINT_SPEED && h.x > s.x) }); continue; }
      if (h.type === 'dog') {
        if (!h.gone) list.push({ y: laneY(h.laneF), draw: () => { dogFigure(x + 20, laneY(h.laneF), t, false, h.scared); if (h.x > s.x && h.x - s.x < 900) warn(x + 20, laneY(h.laneF) - 46, t, h.scared ? '!!' : '!'); } });
        continue;
      }
      list.push({ y: laneY(h.lane), draw: () => (h.type === 'manhole' ? manhole(x, laneY(h.lane), t, reduced) : tricycle(x, laneY(h.lane), t, h)) });
    }
    return list;
  }

  function warn(x, y, t, text) {
    const b = Math.abs(Math.sin(t * 8)) * 3;
    ctx.fillStyle = '#ffdd57'; ctx.beginPath(); ctx.arc(x, y - b, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1a2b'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, x, y + 4 - b); ctx.textAlign = 'left';
  }

  function coin(x, y, t, id, reduced) {
    const bob = reduced ? 0 : Math.sin(t * 4 + id * 0.05) * 3;
    const spin = reduced ? 1 : Math.abs(Math.cos(t * 5 + id * 0.02));
    const cy = y - 24 + bob;
    const g = ctx.createRadialGradient(x, cy, 1, x, cy, 16);
    g.addColorStop(0, 'rgba(255,214,102,0.45)'); g.addColorStop(1, 'rgba(255,214,102,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 16, cy - 16, 32, 32);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y - 4, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e0a526'; ctx.beginPath(); ctx.ellipse(x, cy, 7 * spin + 1.5, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.ellipse(x, cy, 5 * spin + 1, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (spin > 0.6) { ctx.fillStyle = '#fff6d8'; ctx.fillRect(x - 1.5 * spin, cy - 3, 1.5, 3); }
  }

  function manhole(x, y, t, reduced) {
    ctx.fillStyle = '#070610'; ctx.beginPath(); ctx.ellipse(x + 20, y - 8, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a4660'; ctx.lineWidth = 2; ctx.stroke();
    if (!reduced) for (let k = 0; k < 2; k++) { // steam
      const u = (t * 0.6 + k * 0.5) % 1;
      ctx.fillStyle = `rgba(200,200,230,${0.18 * (1 - u)})`; ctx.beginPath(); ctx.arc(x + 20 + Math.sin(t * 2 + k) * 5, y - 12 - u * 34, 6 + u * 10, 0, Math.PI * 2); ctx.fill();
    }
    // cone with a blinking light
    ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.moveTo(x - 8, y - 4); ctx.lineTo(x - 2, y - 30); ctx.lineTo(x + 4, y - 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 18, 7, 3);
    if (reduced || Math.sin(t * 7 + x * 0.01) > 0) { const b = ctx.createRadialGradient(x - 2, y - 32, 0, x - 2, y - 32, 12); b.addColorStop(0, 'rgba(255,170,60,0.9)'); b.addColorStop(1, 'rgba(255,170,60,0)'); ctx.fillStyle = b; ctx.fillRect(x - 14, y - 44, 24, 24); }
  }

  function tricycle(x, y, t, h) {
    const id = h.x0 || h.x;
    const bob = Math.sin(t * 18 + id) * 0.8;
    const colors = ['#3e8fb0', '#2fa36b', '#d9822b', '#8e5fd0'];
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 45, y - 2, 50, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = h.pulled ? '#7c86b0' : colors[Math.floor(hash(id) * 4)];
    roundRect(x + 30, y - 42 + bob, 60, 32, 6); ctx.fill(); // sidecar cab
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + 30, y - 42 + bob, 60, 4);
    ctx.fillStyle = '#1b1a2b'; ctx.fillRect(x + 38, y - 36 + bob, 20, 14);
    ctx.fillStyle = '#f5f0e6'; ctx.font = 'bold 7px system-ui, sans-serif'; ctx.fillText('TODA', x + 64, y - 24 + bob);
    ctx.fillStyle = '#c0392b'; roundRect(x, y - 30 + bob, 34, 18, 4); ctx.fill(); // motorcycle
    ctx.fillStyle = '#f2d0a4'; ctx.beginPath(); ctx.arc(x + 14, y - 38 + bob, 6, 0, Math.PI * 2); ctx.fill(); // driver
    ctx.fillStyle = '#2b2b3b'; ctx.fillRect(x + 8, y - 45 + bob, 12, 4); // cap
    wheel(x + 8, y - 6, t); wheel(x + 74, y - 6, t);
    const tl = ctx.createRadialGradient(x + 2, y - 23 + bob, 0, x + 2, y - 23 + bob, 12);
    tl.addColorStop(0, 'rgba(255,60,60,0.9)'); tl.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = tl; ctx.fillRect(x - 10, y - 35 + bob, 24, 24); // tail light
  }

  function checkpoint(x, t, reduced, warnFast) {
    for (let l = 0; l < 3; l++) {
      const y = laneY(l);
      ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.moveTo(x - 6, y - 2); ctx.lineTo(x, y - 26); ctx.lineTo(x + 6, y - 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 15, 6, 3);
    }
    // booth with a tanod waving a flashlight
    ctx.fillStyle = '#2d3a5a'; ctx.fillRect(x + 6, ROAD_TOP - 46, 30, 44);
    ctx.fillStyle = '#e0def4'; ctx.fillRect(x + 6, ROAD_TOP - 50, 30, 6);
    const on = reduced ? true : Math.sin(t * 10) > 0;
    const siren = ctx.createRadialGradient(x + 21, ROAD_TOP - 56, 1, x + 21, ROAD_TOP - 56, 40);
    siren.addColorStop(0, on ? 'rgba(255,77,109,0.8)' : 'rgba(77,125,255,0.8)'); siren.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = siren; ctx.fillRect(x - 20, ROAD_TOP - 96, 82, 82);
    ctx.fillStyle = on ? '#ff4d6d' : '#4d7dff'; ctx.beginPath(); ctx.arc(x + 21, ROAD_TOP - 56, 5, 0, Math.PI * 2); ctx.fill();
    const wave = reduced ? 0 : Math.sin(t * 6) * 0.6;
    ctx.strokeStyle = 'rgba(255,245,200,0.35)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(x - 6, ROAD_TOP + 4); ctx.lineTo(x - 6 + Math.cos(-1.2 + wave) * 40, ROAD_TOP + 4 + Math.sin(-1.2 + wave) * 40); ctx.stroke();
    ctx.fillStyle = warnFast ? '#ffdd57' : '#e0def4'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(warnFast ? 'BAGAL! SLOW DOWN' : 'CHECKPOINT · SLOW', x + 20, ROAD_TOP - 104); ctx.textAlign = 'left';
  }

  function dogFigure(x, y, t, sitting, scared) {
    const leg = sitting ? 0 : Math.sin(t * (scared ? 30 : 16)) * 4;
    const tail = sitting ? Math.sin(t * 12) * 3 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y - 1, 18, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8b5a2b';
    roundRect(x - 16, y - 22, 30, 13, 6); ctx.fill(); // body
    ctx.beginPath(); ctx.arc(x + 16, y - 24, 8, 0, Math.PI * 2); ctx.fill(); // head
    ctx.fillStyle = '#f5f0e6'; ctx.beginPath(); ctx.ellipse(x + 13, y - 32, 3, 5, -0.4, 0, Math.PI * 2); ctx.fill(); // the white ear
    ctx.fillStyle = '#6b431f'; ctx.beginPath(); ctx.ellipse(x + 20, y - 31, 3, 5, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1a2b'; ctx.beginPath(); ctx.arc(x + 19, y - 25, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x - 12 + leg, y - 10, 4, 10); ctx.fillRect(x + 6 - leg, y - 10, 4, 10);
    ctx.fillRect(x - 20, y - 24 + tail, 6, 3); // tail
  }

  function wheel(x, y, t) {
    ctx.fillStyle = '#0b0a14'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9cede'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8f8aa8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 6.5, t * 12, t * 12 + 3); ctx.stroke();
  }

  function ghostFigure(x, y, color, t, alpha) {
    const float = Math.sin(t * 2 + x * 0.01) * 3;
    const g = ctx.createRadialGradient(x, y - 30 + float, 2, x, y - 30 + float, 34);
    g.addColorStop(0, hexA(color, 0.55 * alpha)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - 34, y - 70 + float, 68, 70);
    ctx.fillStyle = hexA(color, 0.75 * alpha);
    ctx.beginPath(); ctx.arc(x, y - 44 + float, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 12, y - 8 + float); ctx.quadraticCurveTo(x, y - 46 + float, x + 12, y - 8 + float); ctx.fill();
    // a waving arm
    ctx.strokeStyle = hexA(color, 0.75 * alpha); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 6, y - 30 + float); ctx.lineTo(x + 14 + Math.sin(t * 6) * 3, y - 48 + float); ctx.stroke();
  }

  function jeepney(s, t, reduced, dt) {
    const x = JEEP_X - JEEP_LEN, y = laneY(s.laneY);
    // pitch: the nose dips when you brake and lifts when you floor it
    if (dt > 0) {
      const accel = (s.speed - prevSpeed) / dt;
      pitch += (clamp(-accel / 14000, -0.03, 0.035) - pitch) * Math.min(1, dt * 8);
    }
    prevSpeed = s.speed;
    const bump = !reduced && s.speed > 50 ? Math.sin(t * 40) * 0.6 + (s.inFlood ? Math.sin(t * 13) * 1.5 : 0) : 0;
    const blink = s.invuln > 0 && !reduced && Math.floor(t * 12) % 2 === 0;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(x + 70, y - 1, 84, 7, 0, 0, Math.PI * 2); ctx.fill();
    // headlight cone, longer when you floor it
    const reach = s.gassing ? 330 : 270;
    const cone = ctx.createLinearGradient(JEEP_X, 0, JEEP_X + reach, 0);
    cone.addColorStop(0, 'rgba(255,240,180,0.42)'); cone.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(JEEP_X - 4, y - 28); ctx.lineTo(JEEP_X + reach, y - 64); ctx.lineTo(JEEP_X + reach, y + 8); ctx.lineTo(JEEP_X - 4, y - 16); ctx.fill();
    if (blink) ctx.globalAlpha = 0.45;
    ctx.save();
    ctx.translate(x + 22, y - 8); ctx.rotate(reduced ? 0 : pitch); ctx.translate(-(x + 22), -(y - 8));
    const by = y + bump;
    const bodyW = JEEP_LEN - 26;
    // rear step and mudflap
    ctx.fillStyle = '#9aa3bd'; ctx.fillRect(x - 8, by - 16, 12, 4);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(x + 30, by - 12, 5, 10);
    // passenger box in chrome
    const chrome = ctx.createLinearGradient(0, by - 62, 0, by - 12);
    chrome.addColorStop(0, '#f4f6fb'); chrome.addColorStop(0.5, '#c9cfdf'); chrome.addColorStop(1, '#eef1f8');
    ctx.fillStyle = chrome; roundRect(x, by - 62, bodyW, 50, 6); ctx.fill();
    // painted swoosh and stripes
    ctx.fillStyle = '#eb6f92'; ctx.beginPath(); ctx.moveTo(x, by - 36); ctx.bezierCurveTo(x + 40, by - 46, x + 80, by - 26, bodyW + x, by - 38); ctx.lineTo(bodyW + x, by - 32); ctx.bezierCurveTo(x + 80, by - 20, x + 40, by - 40, x, by - 30); ctx.fill();
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(x, by - 26, bodyW, 4);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(x, by - 22, bodyW, 7);
    ctx.fillStyle = '#2e86de'; for (let k = 0; k < 4; k++) star5(x + 16 + k * 30, by - 18.5, 2.6);
    // roof with a rack of chase lights
    ctx.fillStyle = '#2e86de'; roundRect(x - 4, by - 70, bodyW + 8, 10, 4); ctx.fill();
    ctx.fillStyle = '#6fb3ff'; ctx.fillRect(x - 2, by - 70, bodyW + 4, 2);
    for (let k = 0; k < 8; k++) {
      const on = reduced || (Math.floor(t * 10) + k) % 4 !== 0;
      const c = ROOF_LIGHTS[k % ROOF_LIGHTS.length];
      if (on) { const lg = ctx.createRadialGradient(x + 6 + k * 16, by - 73, 0, x + 6 + k * 16, by - 73, 7); lg.addColorStop(0, hexA(c, 0.8)); lg.addColorStop(1, hexA(c, 0)); ctx.fillStyle = lg; ctx.fillRect(x - 1 + k * 16, by - 80, 14, 14); }
      ctx.fillStyle = on ? c : '#3b3760'; ctx.beginPath(); ctx.arc(x + 6 + k * 16, by - 73, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    // lit sign board
    ctx.fillStyle = '#0d0c1c'; ctx.fillRect(x + 30, by - 76, 3, 6); ctx.fillRect(x + 88, by - 76, 3, 6);
    ctx.fillStyle = '#1b1a2b'; roundRect(x + 14, by - 90, 92, 15, 3); ctx.fill();
    ctx.shadowColor = '#f6c177'; ctx.shadowBlur = reduced ? 0 : 8;
    ctx.fillStyle = '#f6c177'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.fillText('HULING BYAHE', x + 22, by - 79);
    ctx.shadowBlur = 0;
    // hood + front
    ctx.fillStyle = chrome; roundRect(JEEP_X - 32, by - 40, 32, 30, 5); ctx.fill();
    ctx.fillStyle = '#9aa3bd'; for (let k = 0; k < 3; k++) ctx.fillRect(JEEP_X - 5, by - 36 + k * 7, 5, 4); // grille
    ctx.fillStyle = '#7d869f'; ctx.fillRect(JEEP_X - 34, by - 14, 38, 4); // chrome bumper
    const hl = ctx.createRadialGradient(JEEP_X - 4, by - 23, 0, JEEP_X - 4, by - 23, 14);
    hl.addColorStop(0, 'rgba(255,245,200,1)'); hl.addColorStop(1, 'rgba(255,245,200,0)');
    ctx.fillStyle = hl; ctx.fillRect(JEEP_X - 18, by - 37, 28, 28);
    ctx.fillStyle = '#fff8dc'; ctx.beginPath(); ctx.arc(JEEP_X - 5, by - 23, 4, 0, Math.PI * 2); ctx.fill();
    // two chrome horses and fluttering flags on the hood
    horse(JEEP_X - 22, by - 40, 1); horse(JEEP_X - 12, by - 40, 0.75);
    for (const [fx, c] of [[JEEP_X - 30, '#eb6f92'], [JEEP_X - 4, '#9ccfd8']]) {
      ctx.strokeStyle = '#c9cede'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(fx, by - 40); ctx.lineTo(fx, by - 64); ctx.stroke();
      const flap = reduced ? 0 : Math.sin(t * 14 + fx) * 3;
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(fx, by - 64); ctx.lineTo(fx - 14 - s.speed / 60, by - 60 + flap); ctx.lineTo(fx, by - 56); ctx.fill();
    }
    ctx.fillStyle = '#1b1a2b'; ctx.fillRect(JEEP_X - 34, by - 52, 3, 12); ctx.fillStyle = '#9aa3bd'; ctx.fillRect(JEEP_X - 38, by - 54, 6, 5); // mirror
    // windows with passengers who sway with the ride
    for (let k = 0; k < 5; k++) {
      const wx = x + 8 + k * 22;
      ctx.fillStyle = '#1b1a2b'; ctx.fillRect(wx, by - 56, 17, 17);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(wx, by - 56, 17, 3);
      const ghost = s.aboard[k];
      if (ghost) {
        const c = GHOSTS[ghost].color;
        const sway = reduced ? 0 : Math.sin(t * 3 + k * 1.3) * 1.2 - pitch * 60;
        const gg = ctx.createRadialGradient(wx + 8, by - 48, 0, wx + 8, by - 48, 12);
        gg.addColorStop(0, hexA(c, ghost === 'tatay' ? 0.25 : 0.5)); gg.addColorStop(1, hexA(c, 0));
        ctx.fillStyle = gg; ctx.fillRect(wx - 4, by - 60, 25, 25);
        ctx.fillStyle = hexA(c, ghost === 'tatay' ? 0.45 : 0.85);
        ctx.beginPath(); ctx.arc(wx + 8 + sway, by - 50, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(wx + 4 + sway, by - 46, 8, 7);
      }
    }
    wheel(x + 24, by - 8, t * (s.speed / 300)); wheel(JEEP_X - 24, by - 8, t * (s.speed / 300));
    // bumper guide, so you can line up a sakto stop
    const near = s.route.stops.some((st) => st.state === 'pending' && (st.kind === 'pickup' || s.aboard.includes(st.ghost)) && st.x - s.x < 600 && st.x + STOP_LEN > s.x);
    if (near && s.laneY < 0.5) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(JEEP_X - 1, y + 4, 2, ROAD_BOTTOM - y - 6); ctx.beginPath(); ctx.moveTo(JEEP_X - 5, ROAD_BOTTOM - 2); ctx.lineTo(JEEP_X + 5, ROAD_BOTTOM - 2); ctx.lineTo(JEEP_X, ROAD_BOTTOM - 9); ctx.fill(); }
    // brake lights glow when you brake
    if (s.braking && s.speed > 1) { const bl = ctx.createRadialGradient(x - 2, by - 30, 0, x - 2, by - 30, 30); bl.addColorStop(0, 'rgba(255,50,50,0.85)'); bl.addColorStop(1, 'rgba(255,50,50,0)'); ctx.fillStyle = bl; ctx.fillRect(x - 32, by - 60, 60, 60); }
    ctx.fillStyle = s.braking ? '#ff3b3b' : '#7a1f1f'; ctx.fillRect(x - 2, by - 34, 4, 9);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function horse(x, y, k) {
    ctx.fillStyle = '#f5f6fa';
    ctx.beginPath(); ctx.moveTo(x - 4 * k, y); ctx.lineTo(x - 2 * k, y - 8 * k); ctx.lineTo(x + 2 * k, y - 14 * k); ctx.lineTo(x + 6 * k, y - 12 * k); ctx.lineTo(x + 3 * k, y - 7 * k); ctx.lineTo(x + 5 * k, y); ctx.fill();
  }

  function speedLines(s, t) {
    const over = (s.speed - s.route.cruise) / (s.route.cruise * (GAS_FACTOR - 1));
    if (over <= 0.05) return;
    ctx.strokeStyle = `rgba(255,255,255,${0.16 * Math.min(1, over)})`; ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      const y = ROAD_TOP - 60 + hash(i + 300) * (H - ROAD_TOP + 40);
      const len = 60 + hash(i + 330) * 90;
      const x = W - ((t * 1400 + hash(i + 360) * W * 2) % (W + len * 2));
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    }
  }

  function weather(s, t, reduced) {
    if (s.route.rain) {
      ctx.strokeStyle = 'rgba(180,200,255,0.38)'; ctx.lineWidth = 1;
      const n = reduced ? 50 : drops.length;
      const slant = 4 + s.speed / 60;
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        const x = (d.x - (t * 120 * d.s + s.x * 0.3)) % W, y = (d.y + t * 520 * d.s) % H;
        const px = x < 0 ? x + W : x;
        ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px - slant, y + 12); ctx.stroke();
      }
    }
    if (s.route.fog) {
      const f = ctx.createLinearGradient(0, 0, W, 0);
      f.addColorStop(0, 'rgba(160,160,200,0)'); f.addColorStop(0.55, 'rgba(160,160,200,0.08)'); f.addColorStop(1, 'rgba(160,160,200,0.42)');
      ctx.fillStyle = f; ctx.fillRect(0, ROAD_TOP - 120, W, H - ROAD_TOP + 120);
      if (!reduced) for (let i = 0; i < 5; i++) {
        const fx = W - ((t * 30 + s.x * 0.4 + i * 260) % (W + 400)) + 200, fy = ROAD_TOP - 30 + hash(i + 900) * 180;
        const g = ctx.createRadialGradient(fx, fy, 10, fx, fy, 160);
        g.addColorStop(0, 'rgba(180,180,220,0.14)'); g.addColorStop(1, 'rgba(180,180,220,0)');
        ctx.fillStyle = g; ctx.fillRect(fx - 160, fy - 160, 320, 320);
      }
    }
  }

  function hud(s, t) {
    // progress to the terminal
    const barX = 250, barW = 460;
    ctx.fillStyle = 'rgba(10,10,25,0.65)'; roundRect(barX - 14, 12, barW + 28, 30, 15); ctx.fill();
    ctx.fillStyle = '#3b3760'; ctx.fillRect(barX, 26, barW, 3);
    const jx = barX + Math.min(1, s.x / s.route.length) * barW;
    ctx.fillStyle = '#f6c177'; ctx.fillRect(barX, 26, jx - barX, 3);
    for (const st of s.route.stops) {
      if (st.kind === 'dropoff' && st.state === 'pending' && !s.aboard.includes(st.ghost)) continue;
      const px = barX + (st.x / s.route.length) * barW;
      ctx.fillStyle = st.state === 'pending' ? GHOSTS[st.ghost].color : st.state === 'done' ? '#8bd5a0' : '#55526f';
      ctx.beginPath(); ctx.arc(px, 27.5, st.state === 'pending' ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // a tiny jeepney marker
    ctx.fillStyle = '#f6c177'; roundRect(jx - 8, 20, 16, 12, 3); ctx.fill();
    ctx.fillStyle = '#1b1a2b'; ctx.fillRect(jx - 5, 23, 4, 3); ctx.fillRect(jx + 1, 23, 4, 3);
    // clock
    ctx.fillStyle = 'rgba(10,10,25,0.65)'; roundRect(16, 12, 132, 38, 8); ctx.fill();
    const late = s.clock > CLOCK_END - 45;
    ctx.fillStyle = late ? (Math.sin(t * 6) > 0 ? '#f6c177' : '#ff8a3d') : '#e0def4';
    ctx.font = 'bold 22px ui-monospace, Menlo, monospace'; ctx.fillText(clockText(s.clock), 26, 39);
    // hits and coins
    ctx.fillStyle = 'rgba(10,10,25,0.65)'; roundRect(W - 176, 12, 160, 38, 8); ctx.fill();
    for (let k = 0; k < s.maxHits; k++) {
      ctx.fillStyle = k < s.maxHits - s.hits ? '#9ccfd8' : '#3b3760';
      roundRect(W - 166 + k * 18, 23, 13, 16, 3); ctx.fill();
    }
    ctx.fillStyle = '#f6c177'; ctx.font = 'bold 18px system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`₱${s.coins}`, W - 26, 38);
    // speed gauge
    ctx.fillStyle = 'rgba(10,10,25,0.65)'; roundRect(W - 176, 56, 160, 26, 8); ctx.fill();
    const frac = clamp(s.speed / (s.route.cruise * GAS_FACTOR), 0, 1);
    ctx.fillStyle = '#3b3760'; ctx.fillRect(W - 166, 67, 80, 5);
    ctx.fillStyle = s.speed > s.route.cruise + 5 ? '#ff8a3d' : '#9ccfd8'; ctx.fillRect(W - 166, 67, 80 * frac, 5);
    ctx.fillStyle = '#e0def4'; ctx.fillRect(W - 166 + 80 / GAS_FACTOR, 64, 2, 11);
    ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
    ctx.fillText(`${Math.round(s.speed / 5)} km/h`, W - 24, 74);
    ctx.textAlign = 'left';
    // combo
    if (s.combo > 0) {
      const pop = 1 + comboPop * 0.35;
      ctx.save(); ctx.translate(W - 16, 104); ctx.scale(pop, pop);
      ctx.fillStyle = 'rgba(40,24,10,0.8)'; roundRect(-160, -16, 160, 30, 8); ctx.fill();
      ctx.strokeStyle = '#f6c177'; ctx.lineWidth = 1.5; roundRect(-160, -16, 160, 30, 8); ctx.stroke();
      ctx.fillStyle = '#f6c177'; ctx.font = '900 15px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`LUSOT ×${multiplier(s.combo)} · ${s.combo} combo`, -80, 2);
      ctx.fillStyle = '#ff8a3d'; ctx.fillRect(-152, 8, 144 * (s.comboT / COMBO_TIME), 3);
      ctx.restore(); ctx.textAlign = 'left';
    }
    // horn cooldown
    if (s.hornCd > 0) { ctx.fillStyle = 'rgba(224,222,244,0.55)'; ctx.font = '12px system-ui, sans-serif'; ctx.fillText('busina…', 156, 36); }
    // next stop, before it is on screen
    const next = s.route.stops.find((st) => st.state === 'pending' && (st.kind === 'pickup' || s.aboard.includes(st.ghost)) && st.x + STOP_LEN > s.x);
    if (next) {
      const d = next.x + STOP_LEN / 2 - s.x;
      const c = GHOSTS[next.ghost].color;
      if (sx(s, next.x + STOP_LEN / 2) > W - 40 && d < 3000) {
        const y = LANE_Y[0] - 14, bob = Math.sin(t * 6) * 3;
        ctx.fillStyle = 'rgba(10,10,25,0.75)'; roundRect(W - 136 + bob, y - 16, 108, 30, 8); ctx.fill();
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(W - 20 + bob, y - 1); ctx.lineTo(W - 34 + bob, y - 13); ctx.lineTo(W - 34 + bob, y + 11); ctx.fill();
        ctx.font = 'bold 12px system-ui, sans-serif'; ctx.fillText(`${next.kind === 'pickup' ? 'PARA' : 'BABA'} ${Math.round(d / 10)}m`, W - 128 + bob, y + 4);
      }
      if (s.lane !== 0 && d < 1300 && d > 0) {
        ctx.fillStyle = hexA(c, 0.6 + 0.4 * Math.sin(t * 8));
        ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('▼ curb lane for the stop', JEEP_X - 70, H - 12); ctx.textAlign = 'left';
      }
    }
    // checkpoint warning
    const cp = s.route.hazards.find((h) => h.type === 'checkpoint' && !h.spent && h.x > s.x && h.x - s.x < 700);
    if (cp && s.speed > CHECKPOINT_SPEED && Math.sin(t * 12) > -0.3) {
      ctx.fillStyle = '#ffdd57'; ctx.font = '900 20px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,8,24,0.8)'; ctx.strokeText('BAGAL! Hold brake', W / 2, 78); ctx.fillText('BAGAL! Hold brake', W / 2, 78); ctx.textAlign = 'left';
    }
    // hit flash
    if (flash > 0) { ctx.fillStyle = `rgba(235,111,146,${flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- helpers ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function star4(x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r * 2); ctx.lineTo(x + r * 0.5, y - r * 0.5); ctx.lineTo(x + r * 2, y); ctx.lineTo(x + r * 0.5, y + r * 0.5); ctx.lineTo(x, y + r * 2); ctx.lineTo(x - r * 0.5, y + r * 0.5); ctx.lineTo(x - r * 2, y); ctx.lineTo(x - r * 0.5, y - r * 0.5); ctx.closePath(); ctx.fill(); }
  function star5(x, y, r) { ctx.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.45 : r, a = -Math.PI / 2 + (k * Math.PI) / 5; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

  function draw(s, t, { reduced = false, showHud = true } = {}) {
    reducedNow = reduced;
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.1);
    lastT = t;
    updateFx(s, dt, reduced);
    const k = canvas.width / W, kh = canvas.height / H;
    ctx.setTransform(k, 0, 0, kh, 0, 0);
    const dawn = Math.max(0, (s.clock - (CLOCK_END - 45)) / 45); // the last 45 minutes before 5 AM
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    sky(s, t, dawn); skyline(s); lrt(s, t); storefronts(s, t, reduced); streetlights(s, t, dawn, reduced); road(s, t, dawn);
    floods(s, t); stops(s, t, reduced);
    const list = items(s, t, reduced);
    list.push({ y: laneY(s.laneY) + 0.1, draw: () => jeepney(s, t, reduced, dt) });
    list.sort((a, b) => (a.y === 999 ? -1 : b.y === 999 ? 1 : a.y - b.y));
    for (const it of list) it.draw();
    drawParts(s);
    if (!reduced) speedLines(s, t);
    weather(s, t, reduced);
    if (dawn > 0) { ctx.fillStyle = `rgba(255,170,110,${dawn * 0.12})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
    ctx.fillStyle = vignette; ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.setTransform(k, 0, 0, kh, 0, 0);
    if (showHud) { drawPopups(); drawBubble(s); hud(s, t); }
  }

  return { draw, resize, event };
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (sh) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
