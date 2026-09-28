// Draws one frame of the world state onto a 960×540 canvas. Reads state only; never changes it.
import { JEEP_LEN, STOP_LEN, CLOCK_END, CHECKPOINT_SPEED } from './config.mjs';
import { GHOSTS } from './story.mjs';

export const W = 960, H = 540;
const LANE_Y = [448, 392, 336]; // wheel line per lane; lane 0 is the curb
const ROAD_TOP = 300, ROAD_BOTTOM = 478;
const JEEP_X = 360; // screen x of the jeepney's front bumper
const laneY = (l) => LANE_Y[0] + (LANE_Y[1] - LANE_Y[0]) * l;

// Deterministic "random" for scenery, so buildings don't flicker between frames.
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function clockText(minutes) {
  const total = 23 * 60 + Math.floor(minutes);
  const h24 = Math.floor(total / 60) % 24, m = total % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const drops = Array.from({ length: 140 }, (_, i) => ({ x: hash(i) * W, y: hash(i + 500) * H, s: 0.6 + hash(i + 900) * 0.8 }));
  const stars = Array.from({ length: 60 }, (_, i) => ({ x: hash(i + 40) * W, y: hash(i + 80) * 150, r: hash(i + 120) * 1.2 + 0.3 }));
  let flash = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  // ---------- scenery ----------
  function sky(s, t) {
    const dawn = Math.max(0, (s.clock - (CLOCK_END - 45)) / 45); // the last 45 minutes before 5 AM
    const g = ctx.createLinearGradient(0, 0, 0, ROAD_TOP);
    g.addColorStop(0, mix('#070a1f', '#2b3a67', dawn));
    g.addColorStop(0.7, mix('#1a1340', '#e0906a', dawn));
    g.addColorStop(1, mix('#2a1846', '#f6c177', dawn));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, ROAD_TOP);
    ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - dawn)})`;
    for (const st of stars) { ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill(); }
    // moon
    ctx.fillStyle = `rgba(246, 240, 220, ${0.9 - dawn * 0.6})`;
    ctx.beginPath(); ctx.arc(820, 70, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mix('#070a1f', '#2b3a67', dawn);
    ctx.beginPath(); ctx.arc(832, 62, 24, 0, Math.PI * 2); ctx.fill();
  }

  function skyline(s) {
    const off = s.x * 0.08;
    const bw = 70;
    const first = Math.floor(off / bw) - 1;
    for (let i = first; i < first + W / bw + 3; i++) {
      const x = i * bw - off;
      const h = 60 + hash(i) * 110;
      const top = 250 - h;
      ctx.fillStyle = '#10112a';
      ctx.fillRect(x, top, bw - 6, h + 60);
      for (let wy = top + 10; wy < 240; wy += 14) for (let wx = x + 8; wx < x + bw - 14; wx += 12) {
        if (hash(i * 97 + wx * 3 + wy) > 0.72) { ctx.fillStyle = hash(wx + wy) > 0.5 ? 'rgba(246,193,119,0.55)' : 'rgba(156,207,216,0.35)'; ctx.fillRect(wx, wy, 5, 7); }
      }
    }
  }

  function lrt(s) {
    const off = s.x * 0.25;
    ctx.fillStyle = '#181633';
    ctx.fillRect(0, 168, W, 16);
    ctx.fillStyle = '#23204a';
    ctx.fillRect(0, 164, W, 5);
    const gap = 260;
    for (let x = -(off % gap); x < W + gap; x += gap) {
      ctx.fillStyle = '#15132c';
      ctx.fillRect(x, 184, 22, 120);
    }
  }

  function storefronts(s, t, reduced) {
    const off = s.x * 0.5;
    const sw = 180;
    const first = Math.floor(off / sw) - 1;
    for (let i = first; i < first + W / sw + 3; i++) {
      const x = i * sw - off;
      const kind = Math.floor(hash(i + 3000) * 5);
      const base = 300;
      if (kind === 0) { // sari-sari store
        ctx.fillStyle = '#2a2447'; ctx.fillRect(x, base - 70, 150, 70);
        ctx.fillStyle = 'rgba(246,193,119,0.85)'; ctx.fillRect(x + 12, base - 50, 126, 34);
        ctx.fillStyle = '#eb6f92'; ctx.fillRect(x, base - 84, 150, 16);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillText('SARI-SARI STORE', x + 22, base - 72);
        ctx.fillStyle = 'rgba(40,20,20,0.5)'; for (let k = 0; k < 6; k++) ctx.fillRect(x + 16 + k * 20, base - 46, 12, 26);
      } else if (kind === 1) { // capiz-window house
        ctx.fillStyle = '#231f3d'; ctx.fillRect(x + 10, base - 96, 130, 96);
        ctx.fillStyle = '#1a1631'; ctx.beginPath(); ctx.moveTo(x, base - 96); ctx.lineTo(x + 75, base - 130); ctx.lineTo(x + 150, base - 96); ctx.fill();
        for (let k = 0; k < 3; k++) { ctx.fillStyle = hash(i + k) > 0.4 ? 'rgba(246,220,170,0.6)' : 'rgba(60,50,90,0.8)'; ctx.fillRect(x + 22 + k * 38, base - 80, 26, 30); }
      } else if (kind === 2) { // church facade
        ctx.fillStyle = '#2d2850'; ctx.fillRect(x + 20, base - 120, 110, 120);
        ctx.beginPath(); ctx.moveTo(x + 20, base - 120); ctx.lineTo(x + 75, base - 160); ctx.lineTo(x + 130, base - 120); ctx.fill();
        ctx.fillStyle = 'rgba(246,193,119,0.5)'; ctx.fillRect(x + 64, base - 150, 22, 4); ctx.fillRect(x + 73, base - 159, 4, 22);
        ctx.fillStyle = 'rgba(196,167,231,0.45)'; ctx.beginPath(); ctx.arc(x + 75, base - 90, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#120f24'; ctx.fillRect(x + 58, base - 48, 34, 48);
      } else if (kind === 3) { // carinderia with neon
        ctx.fillStyle = '#26203f'; ctx.fillRect(x + 6, base - 62, 150, 62);
        const on = reduced || Math.sin(t * 3 + i) > -0.6;
        ctx.fillStyle = on ? '#9ccfd8' : 'rgba(156,207,216,0.25)'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillText('KAINAN', x + 50, base - 42);
        ctx.fillStyle = 'rgba(246,193,119,0.4)'; ctx.fillRect(x + 20, base - 30, 120, 24);
      } else { // gap with a tree
        ctx.fillStyle = '#141231'; ctx.beginPath(); ctx.arc(x + 80, base - 70, 40, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x + 76, base - 40, 8, 40);
      }
    }
  }

  function streetlights(s) {
    const gap = 320;
    const off = s.x % gap;
    for (let x = -off; x < W + gap; x += gap) {
      ctx.fillStyle = '#0d0c1c'; ctx.fillRect(x, ROAD_TOP - 110, 5, 112);
      ctx.fillRect(x, ROAD_TOP - 110, 34, 4);
      const pool = ctx.createRadialGradient(x + 30, ROAD_TOP + 60, 5, x + 30, ROAD_TOP + 60, 170);
      pool.addColorStop(0, 'rgba(255,170,80,0.22)'); pool.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = pool; ctx.fillRect(x - 150, ROAD_TOP, 360, ROAD_BOTTOM - ROAD_TOP);
      ctx.fillStyle = '#ffb65c'; ctx.beginPath(); ctx.arc(x + 32, ROAD_TOP - 104, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function road(s) {
    ctx.fillStyle = '#1b1a2b'; ctx.fillRect(0, ROAD_TOP, W, ROAD_BOTTOM - ROAD_TOP);
    ctx.fillStyle = '#2a2838'; ctx.fillRect(0, ROAD_TOP, W, 6);
    // lane dashes between lanes
    const dash = 60, period = 110;
    ctx.fillStyle = 'rgba(230,220,200,0.45)';
    for (const y of [(LANE_Y[0] + LANE_Y[1]) / 2 - 2, (LANE_Y[1] + LANE_Y[2]) / 2 - 2]) {
      for (let x = -((s.x) % period); x < W; x += period) ctx.fillRect(x, y, dash, 3);
    }
    // curb + sidewalk
    ctx.fillStyle = '#d9c9a3'; ctx.fillRect(0, ROAD_BOTTOM, W, 4);
    ctx.fillStyle = '#2b2740'; ctx.fillRect(0, ROAD_BOTTOM + 4, W, H - ROAD_BOTTOM);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = -((s.x) % 48); x < W; x += 48) ctx.fillRect(x, ROAD_BOTTOM + 4, 2, H - ROAD_BOTTOM);
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
        ctx.fillStyle = 'rgba(80,140,200,0.38)';
        ctx.fillRect(x, y - 30, h.len, 34);
        ctx.strokeStyle = 'rgba(190,230,255,0.35)'; ctx.lineWidth = 1.5;
        for (let k = 0; k < h.len; k += 46) { ctx.beginPath(); ctx.ellipse(x + k + 20 + Math.sin(t * 2 + k) * 4, y - 12, 12, 3, 0, 0, Math.PI * 2); ctx.stroke(); }
      }
    }
  }

  function stops(s, t, reduced) {
    for (const st of s.route.stops) {
      const x = sx(s, st.x);
      if (x > W + 80 || x + STOP_LEN < -80) continue;
      const active = st.state === 'pending' && (st.kind === 'pickup' || s.aboard.includes(st.ghost));
      const g = GHOSTS[st.ghost];
      if (active) {
        const pulse = reduced ? 0.5 : 0.35 + 0.25 * Math.sin(t * 4);
        ctx.fillStyle = hexA(g.color, pulse);
        ctx.fillRect(x, LANE_Y[0] - 30, STOP_LEN, 32);
        ctx.strokeStyle = hexA(g.color, 0.9); ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
        ctx.strokeRect(x, LANE_Y[0] - 30, STOP_LEN, 32); ctx.setLineDash([]);
      }
      // PARA sign on the sidewalk
      const px = x + STOP_LEN / 2;
      ctx.fillStyle = '#0d0c1c'; ctx.fillRect(px - 2, ROAD_BOTTOM - 44, 4, 70);
      ctx.fillStyle = active ? '#f6c177' : '#6e6a86';
      roundRect(px - 26, ROAD_BOTTOM - 62, 52, 22, 4); ctx.fill();
      ctx.fillStyle = '#1b1a2b'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(st.kind === 'pickup' ? 'PARA' : 'BABA', px, ROAD_BOTTOM - 46); ctx.textAlign = 'left';
      if (st.kind === 'pickup' && st.state === 'pending') ghostFigure(px + 34, ROAD_BOTTOM + 28, g.color, t, 1);
      if (st.bantay && st.state === 'pending') dogFigure(px + 40, ROAD_BOTTOM + 30, t, true);
      if (st.kind === 'dropoff' && active) {
        const glow = ctx.createRadialGradient(px, ROAD_BOTTOM + 10, 2, px, ROAD_BOTTOM + 10, 60);
        glow.addColorStop(0, hexA(g.color, 0.45)); glow.addColorStop(1, hexA(g.color, 0));
        ctx.fillStyle = glow; ctx.fillRect(px - 60, ROAD_BOTTOM - 50, 120, 110);
      }
    }
  }

  function hazards(s, t, reduced) {
    const items = [];
    for (const h of s.route.hazards) {
      if (h.type === 'flood') continue;
      const x = sx(s, h.x);
      if (x > W + 120 || x < -200) continue;
      if (h.type === 'checkpoint') { items.push({ y: 999, draw: () => checkpoint(x, t, reduced, s.speed > CHECKPOINT_SPEED && h.x > s.x) }); continue; }
      if (h.type === 'dog') { if (!h.gone) items.push({ y: laneY(h.laneF), draw: () => dogFigure(x + 20, laneY(h.laneF), t, false) }); continue; }
      items.push({ y: laneY(h.lane), draw: () => (h.type === 'manhole' ? manhole(x, laneY(h.lane)) : tricycle(x, laneY(h.lane), t, h.pulled)) });
    }
    return items;
  }

  function manhole(x, y) {
    ctx.fillStyle = '#070610'; ctx.beginPath(); ctx.ellipse(x + 20, y - 8, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a4660'; ctx.lineWidth = 2; ctx.stroke();
    // cone
    ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.moveTo(x - 8, y - 4); ctx.lineTo(x - 2, y - 30); ctx.lineTo(x + 4, y - 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 18, 7, 3);
  }

  function tricycle(x, y, t, pulled) {
    const bob = Math.sin(t * 18 + x) * 0.8;
    ctx.fillStyle = pulled ? '#7c86b0' : '#3e8fb0';
    roundRect(x + 30, y - 42 + bob, 60, 32, 6); ctx.fill(); // sidecar cab
    ctx.fillStyle = '#1b1a2b'; ctx.fillRect(x + 38, y - 36 + bob, 20, 14);
    ctx.fillStyle = '#c0392b'; roundRect(x, y - 30 + bob, 34, 18, 4); ctx.fill(); // motorcycle
    ctx.fillStyle = '#f2d0a4'; ctx.beginPath(); ctx.arc(x + 14, y - 38 + bob, 6, 0, Math.PI * 2); ctx.fill(); // driver
    wheel(x + 8, y - 6, t); wheel(x + 74, y - 6, t);
    ctx.fillStyle = 'rgba(255,60,60,0.8)'; ctx.fillRect(x + 1, y - 26 + bob, 3, 5); // tail light
  }

  function checkpoint(x, t, reduced, warn) {
    for (let l = 0; l < 3; l++) {
      const y = laneY(l);
      ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.moveTo(x - 6, y - 2); ctx.lineTo(x, y - 26); ctx.lineTo(x + 6, y - 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 15, 6, 3);
    }
    const on = reduced ? true : Math.sin(t * 10) > 0;
    ctx.fillStyle = on ? '#ff4d6d' : '#4d7dff';
    ctx.beginPath(); ctx.arc(x + 20, ROAD_TOP - 8, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = warn ? '#ffdd57' : '#e0def4'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('CHECKPOINT · SLOW', x + 20, ROAD_TOP - 22); ctx.textAlign = 'left';
  }

  function dogFigure(x, y, t, sitting) {
    const leg = sitting ? 0 : Math.sin(t * 16) * 4;
    ctx.fillStyle = '#8b5a2b';
    roundRect(x - 16, y - 22, 30, 13, 6); ctx.fill(); // body
    ctx.beginPath(); ctx.arc(x + 16, y - 24, 8, 0, Math.PI * 2); ctx.fill(); // head
    ctx.fillStyle = '#f5f0e6'; ctx.beginPath(); ctx.ellipse(x + 13, y - 32, 3, 5, -0.4, 0, Math.PI * 2); ctx.fill(); // the white ear
    ctx.fillStyle = '#6b431f'; ctx.beginPath(); ctx.ellipse(x + 20, y - 31, 3, 5, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x - 12 + leg, y - 10, 4, 10); ctx.fillRect(x + 6 - leg, y - 10, 4, 10);
    ctx.fillRect(x - 20, y - 24, 6, 3); // tail
  }

  function wheel(x, y, t) {
    ctx.fillStyle = '#0b0a14'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8f8aa8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 5, t * 12, t * 12 + 4); ctx.stroke();
  }

  function ghostFigure(x, y, color, t, alpha) {
    const float = Math.sin(t * 2 + x) * 3;
    const g = ctx.createRadialGradient(x, y - 30 + float, 2, x, y - 30 + float, 34);
    g.addColorStop(0, hexA(color, 0.55 * alpha)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - 34, y - 70 + float, 68, 70);
    ctx.fillStyle = hexA(color, 0.75 * alpha);
    ctx.beginPath(); ctx.arc(x, y - 44 + float, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 12, y - 8 + float); ctx.quadraticCurveTo(x, y - 46 + float, x + 12, y - 8 + float); ctx.fill();
  }

  function jeepney(s, t, reduced) {
    const x = JEEP_X - JEEP_LEN, y = laneY(s.laneY);
    const shake = !reduced && s.speed > 50 ? Math.sin(t * 40) * 0.6 : 0;
    const blink = s.invuln > 0 && !reduced && Math.floor(t * 12) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.45;
    // headlight cone
    const cone = ctx.createLinearGradient(JEEP_X, 0, JEEP_X + 260, 0);
    cone.addColorStop(0, 'rgba(255,240,180,0.35)'); cone.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(JEEP_X - 4, y - 28); ctx.lineTo(JEEP_X + 260, y - 60); ctx.lineTo(JEEP_X + 260, y + 6); ctx.lineTo(JEEP_X - 4, y - 16); ctx.fill();
    const by = y + shake;
    // body
    ctx.fillStyle = '#d7dbe8'; roundRect(x, by - 58, JEEP_LEN - 26, 48, 6); ctx.fill(); // passenger box (chrome)
    ctx.fillStyle = '#c0392b'; ctx.fillRect(x, by - 24, JEEP_LEN - 26, 8); // red stripe
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(x, by - 30, JEEP_LEN - 26, 5); // yellow stripe
    ctx.fillStyle = '#2e86de'; ctx.fillRect(x, by - 58, JEEP_LEN - 26, 8); // roof trim
    // hood + front
    ctx.fillStyle = '#e8ebf5'; roundRect(JEEP_X - 30, by - 38, 30, 28, 5); ctx.fill();
    ctx.fillStyle = '#9aa3bd'; ctx.fillRect(JEEP_X - 4, by - 34, 4, 20); // grille
    ctx.fillStyle = '#ffeaa7'; ctx.beginPath(); ctx.arc(JEEP_X - 5, by - 22, 4, 0, Math.PI * 2); ctx.fill(); // headlight
    // chrome horse on the hood
    ctx.fillStyle = '#f5f6fa'; ctx.beginPath(); ctx.moveTo(JEEP_X - 20, by - 38); ctx.lineTo(JEEP_X - 14, by - 50); ctx.lineTo(JEEP_X - 10, by - 42); ctx.fill();
    // windows with passengers
    const seats = 5;
    for (let k = 0; k < seats; k++) {
      const wx = x + 8 + k * 21;
      ctx.fillStyle = '#1b1a2b'; ctx.fillRect(wx, by - 48, 16, 16);
      const ghost = s.aboard[k];
      if (ghost) {
        const c = GHOSTS[ghost].color;
        ctx.fillStyle = hexA(c, ghost === 'tatay' ? 0.45 : 0.8);
        ctx.beginPath(); ctx.arc(wx + 8, by - 42, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(wx + 4, by - 38, 8, 6);
      }
    }
    // sign board on the roof
    ctx.fillStyle = '#1b1a2b'; roundRect(x + 14, by - 72, 92, 14, 3); ctx.fill();
    ctx.fillStyle = '#f6c177'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.fillText('HULING BYAHE', x + 22, by - 62);
    wheel(x + 22, by - 8, t * (s.speed / 300)); wheel(JEEP_X - 24, by - 8, t * (s.speed / 300));
    // brake light
    ctx.fillStyle = s.speed < 200 && s.speed > 0 ? '#ff3b3b' : '#7a1f1f'; ctx.fillRect(x - 2, by - 26, 4, 8);
    ctx.globalAlpha = 1;
  }

  function weather(s, t, reduced) {
    if (s.route.rain) {
      ctx.strokeStyle = 'rgba(180,200,255,0.35)'; ctx.lineWidth = 1;
      const n = reduced ? 50 : drops.length;
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        const x = (d.x - (t * 120 * d.s + s.x * 0.3)) % W, y = (d.y + t * 520 * d.s) % H;
        const px = x < 0 ? x + W : x;
        ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px - 4, y + 12); ctx.stroke();
      }
    }
    if (s.route.fog) {
      const f = ctx.createLinearGradient(0, 0, W, 0);
      f.addColorStop(0, 'rgba(160,160,200,0)'); f.addColorStop(0.55, 'rgba(160,160,200,0.08)'); f.addColorStop(1, 'rgba(160,160,200,0.42)');
      ctx.fillStyle = f; ctx.fillRect(0, ROAD_TOP - 120, W, H - ROAD_TOP + 120);
    }
  }

  function hud(s) {
    // progress to the terminal
    const barX = 250, barW = 460;
    ctx.fillStyle = 'rgba(10,10,25,0.6)'; roundRect(barX - 10, 14, barW + 20, 26, 13); ctx.fill();
    ctx.fillStyle = '#3b3760'; ctx.fillRect(barX, 26, barW, 3);
    for (const st of s.route.stops) {
      if (st.kind === 'dropoff' && st.state === 'pending' && !s.aboard.includes(st.ghost)) continue;
      const px = barX + (st.x / s.route.length) * barW;
      ctx.fillStyle = st.state === 'pending' ? GHOSTS[st.ghost].color : '#55526f';
      ctx.beginPath(); ctx.arc(px, 27.5, 4, 0, Math.PI * 2); ctx.fill();
    }
    const jx = barX + Math.min(1, s.x / s.route.length) * barW;
    ctx.fillStyle = '#f6c177'; roundRect(jx - 7, 21, 14, 12, 3); ctx.fill();
    // clock
    ctx.fillStyle = 'rgba(10,10,25,0.6)'; roundRect(16, 14, 132, 36, 8); ctx.fill();
    ctx.fillStyle = s.clock > CLOCK_END - 45 ? '#f6c177' : '#e0def4';
    ctx.font = 'bold 22px ui-monospace, Menlo, monospace'; ctx.fillText(clockText(s.clock), 26, 40);
    // hits and coins
    ctx.fillStyle = 'rgba(10,10,25,0.6)'; roundRect(W - 176, 14, 160, 36, 8); ctx.fill();
    for (let k = 0; k < s.maxHits; k++) {
      ctx.fillStyle = k < s.maxHits - s.hits ? '#9ccfd8' : '#3b3760';
      roundRect(W - 166 + k * 18, 24, 13, 16, 3); ctx.fill();
    }
    ctx.fillStyle = '#f6c177'; ctx.font = 'bold 18px system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`₱${s.coins}`, W - 26, 39); ctx.textAlign = 'left';
    // horn cooldown
    if (s.hornCd > 0) { ctx.fillStyle = 'rgba(224,222,244,0.5)'; ctx.font = '12px system-ui, sans-serif'; ctx.fillText('busina…', 26, 68); }
    // hit flash
    if (flash > 0) { ctx.fillStyle = `rgba(235,111,146,${flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- helpers ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function draw(s, t, { reduced = false, showHud = true } = {}) {
    flash = Math.max(0, flash - 1 / 30);
    sky(s, t); skyline(s); lrt(s); storefronts(s, t, reduced); streetlights(s); road(s);
    floods(s, t); stops(s, t, reduced);
    const items = hazards(s, t, reduced);
    items.push({ y: laneY(s.laneY) + 0.1, draw: () => jeepney(s, t, reduced) });
    items.sort((a, b) => (a.y === 999 ? -1 : b.y === 999 ? 1 : a.y - b.y));
    for (const it of items) it.draw();
    weather(s, t, reduced);
    if (showHud) hud(s);
  }

  return { draw, resize, hit: (reduced) => { if (!reduced) flash = 1; } };
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
