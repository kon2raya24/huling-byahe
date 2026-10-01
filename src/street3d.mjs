// The barangay at night, along the route. The road runs along +x; the curb lane and the near sidewalk face
// the camera (+z); across the road stand the frontages: sari-sari stores with lit grilles, houses with
// capiz windows and parols, a karinderya, a botika, a lugawan open all night, closed roll-up shutters, a
// kapilya, a vacant lot with a tree. Electric posts carry sodium lamps and a tangle of wires; behind it all,
// the LRT on its viaduct and the city. The street is endless: frontages sit in 7 m slots chosen from the
// slot's number, and fixed-period things (posts, curbs, lane paint) snap along with the camera.
import * as THREE from './vendor/three.module.min.js';
import * as T from './tex.mjs';
import { mesh, roundedBox, std, mergeStatic, glowTex, streakTex, hash, clamp, TAU, ROAD_HALF, LANE_W, signTex } from './kit3d.mjs';

export const FRONT_Z = -8.2; // the building fronts across the road
export const WALK_NEAR = [ROAD_HALF + 0.12, 8.6];
const SLOT = 7;
export const POLE_P = 26; // electric posts, each with a street lamp
const PX = 44; // facade pixels per metre

const WALLS = ['#e8c9a0', '#9fc8b8', '#e0b0a0', '#b8c4e0', '#f0e2c0', '#d8a8c0', '#c8d8a0', '#e8d0b0', '#a8b8c8'];
const TRIM = ['#2e5a3a', '#7a2a2a', '#2f4f8e', '#5a3a6a', '#3a3a3a', '#8a5a2a'];

// ---------- painting the frontages: a colour map and a light map (what glows at night) ----------
function canvasPair(w, h) {
  const W = Math.round(w * PX), H = Math.round(h * PX);
  const c = T.canvas(W, H), e = T.canvas(W, H);
  const x = c.getContext('2d'), l = e.getContext('2d');
  l.fillStyle = '#000'; l.fillRect(0, 0, W, H);
  return { c, e, x, l, W, H, m: (v) => v * PX, Y: (v) => H - v * PX };
}
function wall(P, color, r) {
  const { x, W, H } = P;
  const base = T.concrete(Math.floor(r() * 1e5), color, { size: 128, grime: 1.2 }).canvas;
  x.fillStyle = x.createPattern(base, 'repeat'); x.fillRect(0, 0, W, H);
  // rain streaks down from the sills and the roof
  for (let k = 0; k < 16; k++) { x.fillStyle = `rgba(40,30,25,${0.05 + r() * 0.08})`; x.fillRect(r() * W, r() * H * 0.3, 1 + r() * 3, H * (0.2 + r() * 0.6)); }
  const g = x.createLinearGradient(0, H - 40, 0, H); g.addColorStop(0, 'rgba(30,24,20,0)'); g.addColorStop(1, 'rgba(30,24,20,0.5)'); x.fillStyle = g; x.fillRect(0, H - 40, W, 40);
}
function rect(ctx, c, x0, y0, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x0), Math.round(y0), Math.round(w), Math.round(h)); }
function glowRect(P, c, x0, y0, w, h, k = 1) {
  rect(P.x, c, x0, y0, w, h);
  P.l.globalAlpha = k; rect(P.l, c, x0, y0, w, h); P.l.globalAlpha = 1;
}
// a window: frame, glass (dark, or lit warm), a grille; capiz panes if asked
function windowAt(P, x0, y0, w, h, { lit = 0, capiz = false, grille = true, frame = '#e8e2d6', curtain = null, tv = false, r }) {
  const { x, l } = P;
  rect(x, frame, x0 - 4, y0 - 4, w + 8, h + 8);
  if (lit > 0) {
    const g = x.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, tv ? '#9ab8ff' : '#ffe2a0'); g.addColorStop(1, tv ? '#5a78d0' : '#ff9a40');
    x.fillStyle = g; x.fillRect(x0, y0, w, h);
    l.globalAlpha = lit; l.fillStyle = g; l.fillRect(x0, y0, w, h); l.globalAlpha = 1;
    if (curtain) { rect(x, curtain, x0, y0, w * 0.28, h); rect(x, curtain, x0 + w * 0.72, y0, w * 0.28, h); l.globalAlpha = lit * 0.5; rect(l, curtain, x0, y0, w * 0.28, h); rect(l, curtain, x0 + w * 0.72, y0, w * 0.28, h); l.globalAlpha = 1; }
  } else {
    const g = x.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#2a3448'); g.addColorStop(1, '#10141c'); x.fillStyle = g; x.fillRect(x0, y0, w, h);
    x.fillStyle = 'rgba(160,180,220,0.14)'; x.beginPath(); x.moveTo(x0, y0 + h * 0.7); x.lineTo(x0 + w * 0.5, y0); x.lineTo(x0 + w * 0.7, y0); x.lineTo(x0, y0 + h); x.fill();
  }
  if (capiz) { // a grid of shell panes, the old way
    x.fillStyle = 'rgba(70,45,25,0.85)';
    for (let i = 0; i <= 6; i++) x.fillRect(x0 + (w * i) / 6 - 1, y0, 2.5, h);
    for (let j = 0; j <= 5; j++) x.fillRect(x0, y0 + (h * j) / 5 - 1, w, 2.5);
    if (lit > 0) { l.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i <= 6; i++) l.fillRect(x0 + (w * i) / 6 - 1, y0, 2.5, h); for (let j = 0; j <= 5; j++) l.fillRect(x0, y0 + (h * j) / 5 - 1, w, 2.5); }
  } else if (grille) {
    x.fillStyle = '#16161a';
    for (let b = x0 + 5; b < x0 + w; b += 8) x.fillRect(b, y0, 2, h);
    x.fillRect(x0, y0 + h / 2 - 1, w, 2);
    if (lit > 0) { l.fillStyle = '#000'; for (let b = x0 + 5; b < x0 + w; b += 8) l.fillRect(b, y0, 2, h); }
  }
  rect(x, 'rgba(0,0,0,0.3)', x0 - 6, y0 + h + 4, w + 12, 4);
}
function doorAt(P, x0, w, h, color) {
  const { x, Y } = P, y0 = Y(0) - h;
  rect(x, color, x0, y0, w, h);
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; x.strokeRect(x0 + 6, y0 + 6, w - 12, h / 2 - 9); x.strokeRect(x0 + 6, y0 + h / 2 + 3, w - 12, h / 2 - 9);
  rect(x, '#d8c080', x0 + w - 12, y0 + h * 0.5, 5, 5);
}
function gate(P, x0, w, h, color) {
  const { x, Y } = P, y0 = Y(0) - h;
  rect(x, 'rgba(10,10,14,0.85)', x0, y0, w, h);
  x.fillStyle = color;
  for (let b = x0; b < x0 + w; b += 7) x.fillRect(b, y0, 2.5, h);
  x.fillRect(x0, y0, w, 4); x.fillRect(x0, y0 + h * 0.5, w, 3); x.fillRect(x0, Y(0) - 4, w, 4);
  for (let b = x0 + 3; b < x0 + w; b += 14) { x.beginPath(); x.arc(b, y0 + h * 0.25, 5, 0, TAU); x.strokeStyle = color; x.lineWidth = 2; x.stroke(); }
}
function paintSign(P, lines, x0, y0, w, h, bg, fg, { lit = 0.7, border = null } = {}) {
  const s = signTex(lines, { w: Math.max(64, Math.round(w)), h: Math.max(24, Math.round(h)), bg, fg, border });
  P.x.drawImage(s, x0, y0, w, h);
  if (lit) { P.l.globalAlpha = lit; P.l.drawImage(s, x0, y0, w, h); P.l.globalAlpha = 1; }
}
function neon(P, text, cx, cy, size, color, k = 1) {
  for (const ctx of [P.x, P.l]) {
    ctx.font = `italic 900 ${size}px "Barlow Condensed", system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = size * 0.5; ctx.fillStyle = color; ctx.globalAlpha = ctx === P.l ? k : 1;
    ctx.fillText(text, cx, cy); ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = (ctx === P.l ? k : 1) * 0.7; ctx.fillText(text, cx, cy); ctx.globalAlpha = 1;
  }
}
function products(P, x0, y0, w, h, r) {
  const { x } = P;
  const C = ['#e8384f', '#ffd23f', '#2f6fd6', '#3fae5a', '#f4f1e6', '#ff9f43', '#b56bff', '#ff5fb0'];
  for (let row = 0; row < 3; row++) { rect(x, 'rgba(80,60,40,0.9)', x0, y0 + h * (0.33 + row * 0.3), w, 3); for (let k = 0; k < w / 7; k++) rect(x, C[Math.floor(r() * C.length)], x0 + k * 7 + r() * 2, y0 + h * (0.33 + row * 0.3) - 5 - r() * 9, 5, 5 + r() * 8); }
  // strips of sachets hanging in the window: shampoo, coffee, snacks
  for (let k = 0; k < 7; k++) { const sx = x0 + 6 + k * (w - 12) / 6, c = C[k % C.length]; for (let j = 0; j < 5; j++) rect(x, j % 2 ? T.shade(c, 0.8) : c, sx - 3, y0 + 2 + j * 7, 6, 6); }
}

// Each kind of frontage: paint(P, r, o) plus what stands in front of it (built later as geometry).
const KINDS = {
  sari: { h: [5.6, 6.6], w: 1.4, paint(P, r, o) {
    wall(P, o.color, r);
    const { m, Y } = P, sx = m(1.2), sw = m(3.6), sy = Y(2.3), sh = m(1.35);
    // the store window: lit by a tube light, shelves of goods, a wire grille, and the counter ledge
    glowRect(P, '#ffe8b0', sx, sy, sw, sh, 0.95);
    products(P, sx, sy, sw, sh, r);
    P.x.fillStyle = 'rgba(30,30,30,0.55)'; for (let b = sx; b < sx + sw; b += 5) P.x.fillRect(b, sy, 1, sh); for (let b = sy; b < sy + sh; b += 5) P.x.fillRect(sx, b, sw, 1);
    P.l.fillStyle = 'rgba(0,0,0,0.35)'; for (let b = sx; b < sx + sw; b += 5) P.l.fillRect(b, sy, 1, sh);
    rect(P.x, '#6a4a2a', sx - 8, sy + sh, sw + 16, 10);
    paintSign(P, [[o.name, 12, '#c0102e'], [o.sub, 7, '#1a1a2a', 800]], sx - m(0.3), Y(3.05), sw + m(0.6), m(0.72), '#f6f0dc', '#c0102e', { lit: 0.55 });
    doorAt(P, m(5.3), m(1.1), m(2.1), pickC(r, TRIM));
    windowAt(P, m(1.3), Y(5.0), m(1.3), m(1.3), { lit: r() < 0.5 ? 0.8 : 0, capiz: true, r });
    windowAt(P, m(4.2), Y(5.0), m(1.3), m(1.3), { lit: r() < 0.3 ? 0.7 : 0, capiz: true, r });
  } },
  house: { h: [5.8, 7.2], w: 1.5, paint(P, r, o) {
    wall(P, o.color, r);
    const { m, Y, x, W } = P;
    // the upper floor in wood, over a concrete ground floor
    const wood = T.planks(Math.floor(r() * 1e5), { size: 128, repeat: null, color: pickC(r, ['#8a5a32', '#6a4a2a', '#a07040']) }).map.image;
    x.fillStyle = x.createPattern(wood, 'repeat'); x.fillRect(0, 0, W, Y(3.1));
    rect(x, 'rgba(255,255,255,0.35)', 0, Y(3.1) - 4, W, 6); rect(x, 'rgba(0,0,0,0.3)', 0, Y(3.1) + 2, W, 5);
    gate(P, m(0.5), m(2.6), m(2.3), pickC(r, TRIM));
    windowAt(P, m(4.0), Y(2.3), m(2.2), m(1.2), { lit: r() < 0.4 ? 0.7 : 0, r, curtain: '#c86a8a' });
    for (let k = 0; k < 3; k++) windowAt(P, m(0.6 + k * 2.15), Y(5.2), m(1.7), m(1.5), { lit: r() < 0.55 ? 0.85 : 0, capiz: true, r });
  } },
  shutter: { h: [5.2, 6.4], w: 1.2, paint(P, r, o) {
    wall(P, o.color, r);
    const { m, Y, x } = P, sx = m(0.7), sw = m(5.6), sy = Y(2.8), sh = m(2.8);
    const g = x.createLinearGradient(0, sy, 0, sy + sh); g.addColorStop(0, '#8a9098'); g.addColorStop(1, '#6a7078'); x.fillStyle = g; x.fillRect(sx, sy, sw, sh);
    for (let k = 0; k < sh; k += 6) { rect(x, 'rgba(0,0,0,0.28)', sx, sy + k, sw, 1.5); rect(x, 'rgba(255,255,255,0.12)', sx, sy + k + 2, sw, 1); }
    for (let k = 0; k < 8; k++) rect(x, 'rgba(120,60,30,0.3)', sx + r() * sw, sy + r() * sh, 4 + r() * 20, 3 + r() * 30);
    // posters and a sprayed tag
    for (let k = 0; k < 3; k++) rect(x, pickC(r, ['#f4f1e6', '#ffd23f', '#e8e0ff']), sx + r() * (sw - 40), sy + sh * 0.3 + r() * sh * 0.4, 30 + r() * 20, 40);
    x.font = 'italic 900 38px "Barlow Condensed", system-ui'; x.fillStyle = pickC(r, ['#e8384f', '#2f6fd6', '#3fae5a']); x.globalAlpha = 0.7; x.fillText(pickC(r, ['BRGY 143', 'LODI', 'SANA ALL', 'ETIVAC']), sx + sw * 0.55, sy + sh * 0.6); x.globalAlpha = 1;
    paintSign(P, [[o.name, 12]], sx, Y(3.6), sw, m(0.7), pickC(r, ['#1e6b3e', '#2a4a8a', '#8a2a2a']), '#ffffff', { lit: 0.25 });
    windowAt(P, m(1.5), Y(5.2), m(1.5), m(1.3), { lit: 0, r });
    windowAt(P, m(4.2), Y(5.2), m(1.5), m(1.3), { lit: r() < 0.35 ? 0.7 : 0, tv: r() < 0.5, r });
  } },
  karinderya: { h: [5.4, 6.2], w: 1.1, paint(P, r, o) {
    wall(P, o.color, r);
    const { m, Y, x } = P, sx = m(0.5), sw = m(6), sy = Y(2.6), sh = m(2.2);
    glowRect(P, '#ffdca0', sx, sy, sw, sh, 0.8);
    // the kitchen inside: a tiled wall, a counter of pots
    for (let i = 0; i < sw; i += 12) for (let j = 0; j < sh * 0.6; j += 12) rect(x, (i + j) % 24 ? '#f2eee4' : '#dcd6c8', sx + i, sy + j, 11, 11);
    rect(x, '#7a5a3a', sx, sy + sh * 0.62, sw, sh * 0.38);
    for (let k = 0; k < 5; k++) { x.fillStyle = '#9aa0a8'; x.beginPath(); x.ellipse(sx + 30 + k * (sw - 60) / 4, sy + sh * 0.6, 16, 8, 0, 0, TAU); x.fill(); }
    if (o.neon) neon(P, o.name, m(3.5), Y(3.3), m(0.62), o.neon, 0.95);
    else paintSign(P, [[o.name, 12, '#c0102e'], [o.sub, 7, '#1a1a2a', 800]], sx, Y(3.6), sw, m(0.8), '#ffe070', '#c0102e', { lit: 0.6 });
    windowAt(P, m(1), Y(5.1), m(2), m(1.2), { lit: r() < 0.5 ? 0.7 : 0, r });
    windowAt(P, m(4), Y(5.1), m(2), m(1.2), { lit: 0, r });
  } },
  botika: { h: [5.6, 6.4], w: 0.8, paint(P, r, o) {
    wall(P, o.color, r);
    const { m, Y } = P, sx = m(0.8), sw = m(5.4), sy = Y(2.6), sh = m(2.2);
    glowRect(P, '#e8f6ff', sx, sy, sw, sh, 0.9);
    products(P, sx + 10, sy + 10, sw - 20, sh - 20, r);
    rect(P.x, 'rgba(255,255,255,0.25)', sx, sy, sw, 4);
    neon(P, '✚', m(1.3), Y(3.25), m(0.75), '#3ddc84', 1);
    neon(P, o.name, m(3.8), Y(3.25), m(0.55), '#3ddc84', 0.95);
    windowAt(P, m(1.4), Y(5.2), m(1.6), m(1.2), { lit: 0, r }); windowAt(P, m(4.0), Y(5.2), m(1.6), m(1.2), { lit: 0.6, r });
  } },
  apartment: { h: [8.4, 9.6], w: 0.9, paint(P, r, o) {
    wall(P, o.color, r);
    const { m, Y } = P;
    gate(P, m(0.4), m(1.4), m(2.2), pickC(r, TRIM));
    for (let f = 0; f < 3; f++) for (let k = 0; k < 3; k++) {
      if (f === 0 && k === 0) continue;
      const lit = r() < 0.4 ? 0.75 : 0;
      windowAt(P, m(0.8 + k * 2.1), Y(2.3 + f * 3), m(1.3), m(1.2), { lit, tv: lit && r() < 0.3, r, curtain: lit && r() < 0.5 ? pickC(r, ['#c86a8a', '#6a8ac8', '#e8c060']) : null });
    }
  } },
  kapilya: { h: [7.0, 7.6], w: 0.35, paint(P, r, o) {
    wall(P, '#f0ead8', r);
    const { m, Y, x, W } = P;
    // an arched door, open, candles inside; a rose window; a lit cross on top
    const dx = W / 2 - m(0.9), dw = m(1.8), dh = m(2.6);
    x.fillStyle = '#2a1a10'; x.beginPath(); x.moveTo(dx, Y(0)); x.lineTo(dx, Y(0) - dh + dw / 2); x.arc(W / 2, Y(0) - dh + dw / 2, dw / 2, Math.PI, 0); x.lineTo(dx + dw, Y(0)); x.fill();
    P.l.fillStyle = 'rgba(255,170,80,0.7)'; P.l.beginPath(); P.l.moveTo(dx + 10, Y(0)); P.l.lineTo(dx + 10, Y(0) - dh * 0.7); P.l.lineTo(dx + dw - 10, Y(0) - dh * 0.7); P.l.lineTo(dx + dw - 10, Y(0)); P.l.fill();
    x.fillStyle = 'rgba(255,190,110,0.8)'; x.fillRect(dx + 10, Y(0) - dh * 0.7, dw - 20, dh * 0.7);
    const rg = x.createRadialGradient(W / 2, Y(4.4), 2, W / 2, Y(4.4), m(0.6)); rg.addColorStop(0, '#ffe0f0'); rg.addColorStop(0.6, '#b86ad0'); rg.addColorStop(1, '#4a2a6a');
    x.fillStyle = rg; x.beginPath(); x.arc(W / 2, Y(4.4), m(0.6), 0, TAU); x.fill();
    P.l.fillStyle = rg; P.l.globalAlpha = 0.8; P.l.beginPath(); P.l.arc(W / 2, Y(4.4), m(0.6), 0, TAU); P.l.fill(); P.l.globalAlpha = 1;
    paintSign(P, [[o.name, 11, '#4a2a10']], W / 2 - m(1.8), Y(3.3), m(3.6), m(0.45), '#e8dcc0', '#4a2a10', { lit: 0.3 });
  } },
  lot: { h: [2.2, 2.4], w: 0.9, paint(P, r, o) {
    // a hollow-block wall, painted once, long ago; a gate of GI sheet
    const { x, W, H, m } = P;
    const blk = T.concrete(Math.floor(r() * 1e5), '#9a9488', { size: 128 }).canvas;
    x.fillStyle = x.createPattern(blk, 'repeat'); x.fillRect(0, 0, W, H);
    for (let j = 0; j < H; j += m(0.2)) rect(x, 'rgba(0,0,0,0.18)', 0, j, W, 1.5);
    for (let j = 0, row = 0; j < H; j += m(0.2), row++) for (let i = (row % 2) * m(0.2); i < W; i += m(0.4)) rect(x, 'rgba(0,0,0,0.15)', i, j, 1.5, m(0.2));
    x.font = 'italic 900 34px "Barlow Condensed", system-ui'; x.fillStyle = 'rgba(200,30,40,0.75)'; x.textAlign = 'center';
    x.fillText(pickC(r, ['BAWAL UMIHI DITO', 'BAWAL MAGTAPON NG BASURA', 'NO PARKING', 'MAG-INGAT SA ASO']), W / 2, H * 0.55);
  } },
  vulcanizing: { h: [4.4, 5.0], w: 0.7, paint(P, r, o) {
    wall(P, '#c8c0b0', r);
    const { m, Y, x } = P, sx = m(0.6), sw = m(5.8), sy = Y(2.8), sh = m(2.8);
    glowRect(P, '#fff0c0', sx, sy, sw, sh, 0.55);
    rect(x, '#3a3632', sx, sy + sh * 0.5, sw, sh * 0.5);
    paintSign(P, [['VULCANIZING', 13, '#1a1a1a'], ['24 HOURS · HANGIN ₱5', 7, '#c0102e', 800]], sx, Y(4.1), sw, m(1.1), '#ffd23f', '#1a1a1a', { lit: 0.45, border: '#1a1a1a' });
  } },
  pisonet: { h: [5.4, 6.0], w: 0.6, paint(P, r, o) {
    wall(P, o.color, r);
    const { m, Y, x } = P, sx = m(0.8), sw = m(5.4), sy = Y(2.5), sh = m(2);
    glowRect(P, '#6a9aff', sx, sy, sw, sh, 0.7);
    for (let k = 0; k < 5; k++) { rect(x, '#101828', sx + 12 + k * (sw - 24) / 5, sy + sh * 0.35, (sw - 24) / 5 - 8, sh * 0.35); P.l.globalAlpha = 0.9; rect(P.l, '#7ab0ff', sx + 16 + k * (sw - 24) / 5, sy + sh * 0.38, (sw - 24) / 5 - 16, sh * 0.28); P.l.globalAlpha = 1; }
    neon(P, 'PISO NET · 24/7', m(3.5), Y(3.1), m(0.5), '#4db8ff', 0.95);
    windowAt(P, m(1.4), Y(5.0), m(1.6), m(1.2), { lit: 0.7, tv: true, r }); windowAt(P, m(4.0), Y(5.0), m(1.6), m(1.2), { lit: 0, r });
  } },
};
const pickC = (r, a) => a[Math.floor(r() * a.length)];
const NAMES = {
  sari: [['SARI-SARI STORE', 'NI ALING NENA · BAWAL ANG UTANG'], ['TINDAHAN NI MANG KANOR', 'LOAD · YELO · ICE WATER'], ['JOY-ANN STORE', 'MAY LOAD · MAY YELO'], ['SARI-SARI NI LOLA BINING', 'BUKAS HANGGANG HATINGGABI']],
  karinderya: [['KARINDERYA NI ALING SUSING', 'ADOBO · SINIGANG · TAPSILOG'], ['LUGAWAN 24/7', null, '#ff5fb0'], ['GOTO KING', null, '#ffb040'], ['EAT ALL YOU CAN · ₱99', 'LUTONG BAHAY']],
  shutter: [['BIGASAN'], ['HARDWARE AT ELECTRICAL'], ['PATAHIAN NI ALING ROSA'], ['BARBERSHOP'], ['WATER REFILLING STATION']],
  botika: [['BOTIKA NG BAYAN'], ['BOTICA SAN ROQUE']],
  kapilya: [['KAPILYA NI SAN ROQUE'], ['KAPILYA NG STO. NIÑO']],
};

// ---------- geometry in front of each frontage ----------
function frontage(kind, v, { low }) {
  const K = KINDS[kind], r = T.rng(kind.length * 1000 + v * 77 + 11);
  const h = K.h[0] + r() * (K.h[1] - K.h[0]), w = SLOT;
  const names = NAMES[kind] ? NAMES[kind][v % NAMES[kind].length] : [''];
  const o = { color: pickC(r, WALLS), name: names[0], sub: names[1] || '', neon: names[2] || null };
  const P = canvasPair(w, h);
  K.paint(P, r, o);
  const map = T.toTex(P.c), emap = T.toTex(P.e);
  for (const t of [map, emap]) t.anisotropy = 4;
  const g = new THREE.Group();
  const facadeM = std({ map, emissive: '#ffffff', emissiveMap: emap, emissiveIntensity: 0.75, roughness: 0.9 });
  facadeM.userData.surface = { kind: 'plaster', w, h, detail: true };
  const depth = 7;
  g.add(mesh(new THREE.PlaneGeometry(w, h), facadeM, { y: h / 2, z: 0.01, cast: false }));
  const sideM = std({ color: T.shade(o.color, 0.6), roughness: 0.95 });
  g.add(mesh(new THREE.BoxGeometry(w - 0.02, h, depth), sideM, { y: h / 2, z: -depth / 2 }));
  const extra = { lights: [], neon: [], kind, h };
  const gi = std({ color: '#9aa0a8', metalness: 0.5, roughness: 0.55 }); gi.userData.surface = { kind: 'roof', w: 8, h: 4 };
  const rust = std({ color: '#a86a44', metalness: 0.3, roughness: 0.7 }); rust.userData.surface = { kind: 'roof', w: 8, h: 4, tint: '#c88a64' };
  if (kind !== 'lot') {
    // the roof: a slope of GI sheet down toward the street, or a flat slab with a water tank
    if (kind === 'apartment' || r() < 0.3) {
      g.add(mesh(roundedBox(w + 0.1, 0.3, 0.3, 0.05), std({ color: T.shade(o.color, 1.05), roughness: 0.9 }), { y: h + 0.15, z: -0.1 }));
      if (r() < 0.6) g.add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.3, 18), std({ color: pickC(r, ['#2f6fd6', '#1a5ab0', '#e8e4dc']), roughness: 0.45 }), { x: (r() - 0.5) * 3, y: h + 0.95, z: -2.5 }));
    } else {
      const roof = mesh(new THREE.PlaneGeometry(w + 0.6, 4.2), r() < 0.5 ? gi : rust, { y: h + 0.9, z: -1.6, rx: -Math.PI / 2 + 0.42 });
      g.add(roof);
      g.add(mesh(new THREE.BoxGeometry(w + 0.6, 0.12, 0.12), std({ color: '#6a5a4a', roughness: 0.8 }), { y: h + 0.02, z: 0.28 }));
    }
    // a sill ledge above the ground floor, a concrete eave
    g.add(mesh(roundedBox(w, 0.14, 0.35, 0.03), std({ color: T.shade(o.color, 1.1), roughness: 0.9 }), { y: 3.05, z: 0.16 }));
  }
  const tin = std({ color: '#b8bcc4', metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide });
  const wood = std({ color: '#6a4a2e', roughness: 0.85 });
  if (kind === 'sari') {
    // a tin awning over the window, a bench, a crate of empty bottles; the tube light over the counter
    g.add(mesh(new THREE.PlaneGeometry(4.4, 1.3), tin, { x: -0.1, y: 2.75, z: 0.62, rx: -Math.PI / 2 + 0.35 }));
    g.add(mesh(roundedBox(2.2, 0.08, 0.4, 0.02), wood, { x: -0.3, y: 0.46, z: 0.8 }));
    for (const bx of [-1.2, 0.6]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.46, 0.36), wood, { x: bx, y: 0.23, z: 0.8 }));
    g.add(mesh(roundedBox(0.5, 0.3, 0.36, 0.02), std({ color: '#c0182e', roughness: 0.6 }), { x: 1.6, y: 0.15, z: 0.6 }));
    g.add(mesh(roundedBox(0.5, 0.3, 0.36, 0.02), std({ color: '#c0182e', roughness: 0.6 }), { x: 1.62, y: 0.45, z: 0.62, ry: 0.2 }));
    extra.lights.push({ x: -0.3, y: 2.1, z: 0.9, color: '#ffe8b8', k: 1 });
  } else if (kind === 'house') {
    // a parol in the upper window, and a potted plant by the gate
    extra.neon.push({ parol: true, x: (r() - 0.5) * 3, y: 4.6, z: 0.35, color: pickC(r, ['#ff5fb0', '#ffd23f', '#35d0e0', '#ff7a3a']) });
    g.add(mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.4, 14), std({ color: '#a8583a', roughness: 0.8 }), { x: -2.8, y: 0.2, z: 0.4 }));
    g.add(mesh(new THREE.IcosahedronGeometry(0.4, 1), std({ color: '#2e5a2a', roughness: 0.8 }), { x: -2.8, y: 0.72, z: 0.4 }));
    if (r() < 0.6) { // a small balcony with laundry
      g.add(mesh(new THREE.BoxGeometry(w - 1, 0.1, 0.9), std({ color: T.shade(o.color, 0.95), roughness: 0.9 }), { y: 3.25, z: 0.45 }));
      for (let k = 0; k < 16; k++) g.add(mesh(new THREE.BoxGeometry(0.03, 0.8, 0.03), std({ color: '#1a1a1a', roughness: 0.6 }), { x: -2.9 + k * 0.39, y: 3.7, z: 0.88, cast: false }));
      g.add(mesh(new THREE.BoxGeometry(w - 1, 0.05, 0.05), std({ color: '#1a1a1a' }), { y: 4.1, z: 0.88 }));
    }
  } else if (kind === 'karinderya') {
    g.add(mesh(new THREE.PlaneGeometry(6.4, 1.6), std({ color: pickC(r, ['#c0182e', '#2f6fd6', '#e8742a']), roughness: 0.8, side: THREE.DoubleSide }), { y: 2.85, z: 0.75, rx: -Math.PI / 2 + 0.5 }));
    for (const tx of [-1.8, 1.4]) { g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 18), std({ color: '#f4f1e6', roughness: 0.5 }), { x: tx, y: 0.72, z: 1.0 })); g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), std({ color: '#f4f1e6' }), { x: tx, y: 0.35, z: 1.0 })); }
    extra.lights.push({ x: 0, y: 2.3, z: 1.0, color: '#ffd8a0', k: 1.1 });
    if (o.neon) extra.neon.push({ sign: true, x: 0, y: 3.3, z: 0.4, color: o.neon });
  } else if (kind === 'botika') {
    extra.lights.push({ x: 0, y: 2.2, z: 0.9, color: '#e0f4ff', k: 1 });
    extra.neon.push({ sign: true, x: -2.2, y: 3.25, z: 0.4, color: '#3ddc84' });
  } else if (kind === 'pisonet') {
    extra.lights.push({ x: 0, y: 2, z: 0.9, color: '#7ab0ff', k: 0.9 });
    extra.neon.push({ sign: true, x: 0, y: 3.1, z: 0.4, color: '#4db8ff' });
  } else if (kind === 'vulcanizing') {
    const tyreG = new THREE.TorusGeometry(0.3, 0.12, 10, 20);
    for (let k = 0; k < 5; k++) g.add(mesh(tyreG, std({ color: '#141414', roughness: 0.9 }), { x: 2.2 + (k > 2 ? 0.7 : 0), y: 0.12 + (k % 3) * 0.24, z: 0.7, rx: Math.PI / 2 }));
    extra.lights.push({ x: -0.5, y: 2.6, z: 0.8, color: '#fff0c0', k: 0.8 });
  } else if (kind === 'shutter') {
    extra.lights.push({ x: 0, y: 3.2, z: 0.4, color: '#ffc880', k: 0.5, bulb: true });
  } else if (kind === 'kapilya') {
    const crossM = std({ color: '#ffffff', emissive: '#fff0c0', emissiveIntensity: 2.5, toneMapped: false });
    g.add(mesh(new THREE.BoxGeometry(0.14, 1.4, 0.14), crossM, { y: h + 0.9, z: -0.2, cast: false }));
    g.add(mesh(new THREE.BoxGeometry(0.8, 0.14, 0.14), crossM, { y: h + 1.2, z: -0.2, cast: false }));
    // a gable over the facade
    const gs = new THREE.Shape(); gs.moveTo(-w / 2, 0); gs.lineTo(0, 2); gs.lineTo(w / 2, 0); gs.closePath();
    g.add(mesh(new THREE.ExtrudeGeometry(gs, { depth: 0.4, bevelEnabled: false }), std({ color: '#e8e2d0', roughness: 0.9 }), { y: h, z: -0.3 }));
    extra.lights.push({ x: 0, y: 1.2, z: 0.6, color: '#ffb060', k: 0.8 });
  } else if (kind === 'lot') {
    extra.tree = true;
  }
  if (!low) mergeStatic(g);
  g.userData.extra = extra;
  return g;
}

// A parol: the five-pointed Christmas star lantern, lit from inside (September in Manila: the -ber months).
function parolGeo() {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) { const rr = k % 2 ? 0.16 : 0.4, a = Math.PI / 2 + (k * Math.PI) / 5; (k ? s.lineTo : s.moveTo).call(s, Math.cos(a) * rr, Math.sin(a) * rr); }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  g.translate(0, 0, -0.03);
  return g;
}

// A procedural tree: a trunk and clumps of leaves pushed around by noise (a real scanned tree replaces it).
function treeModel(r, leafM, barkM) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.14, 0.24, 3.4, 10), barkM, { y: 1.7 }));
  for (let k = 0; k < 6; k++) {
    const geo = new THREE.IcosahedronGeometry(1.2 + r() * 0.8, 2), p = geo.attributes.position, v = new THREE.Vector3(), ph = r() * 10;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 1 + 0.2 * Math.sin(v.x * 3 + ph) * Math.sin(v.y * 2.6 + ph) + 0.12 * Math.sin(v.z * 5 - ph); p.setXYZ(i, v.x * n, v.y * n * 0.75, v.z * n); }
    geo.computeVertexNormals();
    g.add(mesh(geo, leafM, { x: (r() - 0.5) * 2.6, y: 3.6 + r() * 1.6, z: (r() - 0.5) * 2.2 }));
  }
  return g;
}

// ---------- the street ----------
export function createStreet(scene, { low = false } = {}) {
  const group = new THREE.Group(); group.name = 'street'; scene.add(group);
  const TS = low ? 256 : 512;
  const surfaces = [];
  const tagS = (m, kind, w, h, extra = {}) => { m.userData.surface = { kind, w, h, ...extra }; surfaces.push(m); return m; };

  // the road: wet asphalt, puddles darker and glossier; one long strip that snaps along with the camera
  const SNAP = 24, LEN = 300;
  const asph = T.asphalt(21, { size: TS, repeat: [LEN / 4, (ROAD_HALF * 2) / 4] });
  const puddle = T.fbm(256, 256, 48, 3, T.rng(42)), rc = T.canvas(256, 256), rx = rc.getContext('2d'), img = rx.createImageData(256, 256);
  for (let i = 0; i < puddle.length; i++) { const e = clamp((puddle[i] - 0.5) / 0.12, 0, 1), v = 150 - e * e * (3 - 2 * e) * 125; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  rx.putImageData(img, 0, 0);
  const wetMap = T.toTex(rc, { color: false, repeat: [LEN / 12, 1] });
  const roadM = std({ map: asph.map, normalMap: asph.normalMap, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 1, roughnessMap: wetMap, color: '#9a9aa2', envMapIntensity: 1 });
  tagS(roadM, 'asphalt', LEN, ROAD_HALF * 2, { keepRough: wetMap, tile: 4 });
  const road = mesh(new THREE.PlaneGeometry(LEN, ROAD_HALF * 2), roadM, { rx: -Math.PI / 2, cast: false });
  group.add(road);
  // lane paint: dashes between the lanes, solid lines by the curbs, worn
  const mk = T.canvas(512, 256), mx = mk.getContext('2d'), mr = T.rng(3);
  const zPx = (z) => ((z + ROAD_HALF) / (ROAD_HALF * 2)) * 256, xPx = (m) => (m / 24) * 512;
  mx.fillStyle = 'rgba(236,232,220,0.9)';
  for (const z of [-LANE_W / 2, LANE_W / 2]) for (let m0 = 0; m0 < 24; m0 += 6) mx.fillRect(xPx(m0), zPx(z) - 1.5, xPx(3), 3);
  mx.fillStyle = 'rgba(240,200,60,0.85)'; for (const z of [-ROAD_HALF + 0.3, ROAD_HALF - 0.3]) mx.fillRect(0, zPx(z) - 1.5, 512, 3);
  mx.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 900; k++) { mx.fillStyle = `rgba(0,0,0,${0.3 + mr() * 0.7})`; mx.fillRect(mr() * 512, mr() * 256, 1 + mr() * 4, 1 + mr() * 2); }
  const mkT = T.toTex(mk, { repeat: [LEN / 24, 1] });
  const marks = mesh(new THREE.PlaneGeometry(LEN, ROAD_HALF * 2), std({ map: mkT, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }), { rx: -Math.PI / 2, y: 0.003, cast: false });
  group.add(marks);
  // curbs, painted black and yellow; the sidewalks; on the near side a low wall, then rooftops
  const cc = T.canvas(128, 16), cx = cc.getContext('2d');
  for (let k = 0; k < 128; k += 64) { cx.fillStyle = '#e8c83a'; cx.fillRect(k, 0, 32, 16); cx.fillStyle = '#1a1a1c'; cx.fillRect(k + 32, 0, 32, 16); }
  const curbT = T.toTex(cc, { repeat: [LEN / 4, 1] });
  const curbM = std({ map: curbT, roughness: 0.7 });
  const walkTex = T.concrete(22, '#8e8a84', { size: 256, repeat: [LEN / 3, 1.2] });
  const walkM = tagS(std({ map: walkTex.map, normalMap: walkTex.normalMap, roughness: 0.75, color: '#bcb8b0' }), 'pavement', LEN, 3.5, { tile: 3 });
  const strip = new THREE.Group(); group.add(strip);
  for (const s of [1, -1]) {
    strip.add(mesh(new THREE.BoxGeometry(LEN, 0.22, 0.24), curbM, { y: 0.11, z: s * (ROAD_HALF + 0.12), cast: false }));
    const wd = s > 0 ? WALK_NEAR[1] - WALK_NEAR[0] : -FRONT_Z - WALK_NEAR[0];
    strip.add(mesh(new THREE.PlaneGeometry(LEN, wd), walkM, { rx: -Math.PI / 2, y: 0.2, z: s * (WALK_NEAR[0] + wd / 2), cast: false }));
  }
  const blockTex = T.concrete(23, '#8a847a', { size: 128, repeat: [LEN / 2, 1] });
  strip.add(mesh(new THREE.BoxGeometry(LEN, 1.0, 0.2), std({ map: blockTex.map, normalMap: blockTex.normalMap, roughness: 0.9 }), { y: 0.6, z: WALK_NEAR[1] + 0.1 }));
  const lotTex = T.dirt(27, { size: 256, repeat: [LEN / 4, 10] });
  strip.add(mesh(new THREE.PlaneGeometry(LEN, 40), std({ map: lotTex.map, normalMap: lotTex.normalMap, color: '#6a6660', roughness: 1 }), { rx: -Math.PI / 2, y: 0.0, z: 28.8, cast: false }));
  // behind the frontages: a dark ground so gaps never show sky
  strip.add(mesh(new THREE.PlaneGeometry(LEN, 60), std({ color: '#141418', roughness: 1 }), { rx: -Math.PI / 2, y: 0.18, z: FRONT_Z - 30, cast: false }));

  // ---------- electric posts, each with its sodium lamp and wires to the next ----------
  const concreteM = std({ map: T.concrete(25, '#9a968c', { size: 128, repeat: [1, 4] }).map, roughness: 0.85 });
  const armM = std({ color: '#5a5e66', metalness: 0.6, roughness: 0.45 });
  const lampHeadM = std({ color: '#fff0c8', emissive: '#ffb050', emissiveIntensity: 5, toneMapped: false });
  const wireM = std({ color: '#0e0e10', roughness: 0.6 });
  const transM = std({ color: '#6a7078', metalness: 0.5, roughness: 0.5 });
  const POLE_Z = FRONT_Z + 2.4, LAMP_REACH = 2.9;
  const lampHead = new THREE.Vector3(0, 6.9, POLE_Z + LAMP_REACH + 0.2);
  function poleModel() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.13, 0.19, 9.4, 12), concreteM, { y: 4.7, z: POLE_Z }));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 1.9), armM, { y: 8.5, z: POLE_Z })); // the crossarm
    for (const cz of [-0.8, -0.3, 0.3, 0.8]) g.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 8), std({ color: '#d8d0c0', roughness: 0.4 }), { y: 8.62, z: POLE_Z + cz, cast: false }));
    // the lamp arm curving out over the road, a cobra head
    const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 6.2, POLE_Z), new THREE.Vector3(0, 7.1, POLE_Z + 0.6), new THREE.Vector3(0, 7.2, POLE_Z + LAMP_REACH - 0.6), new THREE.Vector3(0, 7.05, POLE_Z + LAMP_REACH)]);
    g.add(mesh(new THREE.TubeGeometry(arm, 12, 0.05, 8), armM));
    g.add(mesh(roundedBox(0.5, 0.16, 0.9, 0.07), armM, { y: 7.04, z: POLE_Z + LAMP_REACH + 0.1 }));
    const head = mesh(roundedBox(0.36, 0.05, 0.62, 0.02), lampHeadM, { y: 6.95, z: POLE_Z + LAMP_REACH + 0.15, cast: false });
    head.userData.dynamic = true; g.add(head);
    // the wires, sagging to the next post, and a couple of service drops into the houses
    const pts = (a, b, sag, n = 14) => { const out = []; for (let k = 0; k <= n; k++) { const t = k / n; out.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * sag, a.z + (b.z - a.z) * t)); } return out; };
    for (const [wy, wz, sag] of [[8.6, -0.8, 0.5], [8.6, -0.3, 0.55], [8.6, 0.3, 0.5], [8.6, 0.8, 0.6], [7.6, 0.2, 0.9], [7.2, -0.2, 1.1], [7.0, 0.05, 1.3]]) {
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts(new THREE.Vector3(0, wy, POLE_Z + wz), new THREE.Vector3(POLE_P, wy, POLE_Z + wz), sag)), 16, 0.016, 4), wireM, { cast: false }));
    }
    for (const dx of [5, 14, 20]) g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts(new THREE.Vector3(0, 7.4, POLE_Z), new THREE.Vector3(dx, 5.2, FRONT_Z + 0.05), 0.4, 8)), 10, 0.012, 4), wireM, { cast: false }));
    // the tangle at the post: coils and loops of spare cable
    for (let k = 0; k < 3; k++) g.add(mesh(new THREE.TorusGeometry(0.28 + k * 0.05, 0.015, 4, 20), wireM, { y: 7.3 - k * 0.2, z: POLE_Z + 0.15, ry: 0.4 * k, rx: 1.2, cast: false }));
    const trans = new THREE.Group(); trans.userData.dynamic = true;
    trans.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.0, 16), transM, { y: 7.7, z: POLE_Z - 0.45 }));
    trans.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 16), transM, { y: 8.22, z: POLE_Z - 0.45 }));
    g.add(trans);
    g.userData.trans = trans;
    mergeStatic(g);
    return g;
  }
  // the pool of light each lamp throws on the road, and its streak across the wet asphalt
  const poolM = new THREE.MeshBasicMaterial({ map: glowTex(), color: '#ff9a3a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: true, polygonOffset: true, polygonOffsetFactor: -4 });
  const streakM = new THREE.MeshBasicMaterial({ map: streakTex(), color: '#ffa850', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: true, polygonOffset: true, polygonOffsetFactor: -4 });
  const haloM = new THREE.SpriteMaterial({ map: glowTex(), color: '#ffb060', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const poles = [];
  const NP = 9;
  for (let i = 0; i < NP; i++) {
    const p = poleModel();
    const pool = mesh(new THREE.PlaneGeometry(11, 9), poolM, { rx: -Math.PI / 2, y: 0.02, z: lampHead.z - 0.5, cast: false, receive: false });
    const streak = mesh(new THREE.PlaneGeometry(1.4, 9), streakM, { rx: -Math.PI / 2, y: 0.025, z: lampHead.z + 5, cast: false, receive: false });
    const halo = new THREE.Sprite(haloM); halo.position.copy(lampHead).add(new THREE.Vector3(0, -0.15, 0)); halo.scale.setScalar(2.6);
    p.add(pool, streak, halo);
    p.userData.parts = { pool, streak, halo };
    group.add(p); poles.push(p);
  }

  // ---------- the near side: lamp posts of its own, planters and hedges along the low wall ----------
  const nearG = new THREE.Group(); group.add(nearG);
  const NEAR_P = 13;
  const hedgeM = std({ color: '#3a6a34', roughness: 0.8, emissive: '#0a1408', emissiveIntensity: 1 }), planterM = std({ color: '#8a847a', roughness: 0.9 });
  const nearItems = [];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    g.add(mesh(roundedBox(2.4, 0.5, 0.7, 0.05), planterM, { y: 0.45, z: WALK_NEAR[1] - 0.45 }));
    for (let k = 0; k < 3; k++) { const b = new THREE.IcosahedronGeometry(0.5, 1); g.add(mesh(b, hedgeM, { x: -0.8 + k * 0.8, y: 0.85, z: WALK_NEAR[1] - 0.45, sx: 0.8, sy: 0.6, sz: 0.7 })); }
    const lamp = new THREE.Group(); lamp.userData.dynamic = true;
    lamp.add(mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.4, 10), concreteM, { y: 3.2, z: WALK_NEAR[0] + 0.5 }));
    lamp.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 5.6, WALK_NEAR[0] + 0.5), new THREE.Vector3(0, 6.3, WALK_NEAR[0] + 0.1), new THREE.Vector3(0, 6.35, WALK_NEAR[0] - 1.2)]), 10, 0.045, 6), armM));
    lamp.add(mesh(roundedBox(0.34, 0.12, 0.7, 0.05), armM, { y: 6.3, z: WALK_NEAR[0] - 1.35 }));
    const lh = mesh(roundedBox(0.26, 0.04, 0.5, 0.02), lampHeadM, { y: 6.23, z: WALK_NEAR[0] - 1.35, cast: false }); lamp.add(lh);
    const halo = new THREE.Sprite(haloM); halo.position.set(0, 6.05, WALK_NEAR[0] - 1.35); halo.scale.setScalar(2.2); lamp.add(halo);
    lamp.add(mesh(new THREE.PlaneGeometry(9, 8), poolM, { rx: -Math.PI / 2, y: 0.22, z: WALK_NEAR[0] - 0.5, cast: false, receive: false }));
    g.add(lamp); g.userData.lamp = lamp;
    nearG.add(g); nearItems.push(g);
  }
  // ---------- frontages ----------
  const MIX = { sari: 5, house: 7, shutter: 4, karinderya: 3, botika: 1, apartment: 3, kapilya: 1, lot: 2, vulcanizing: 1, pisonet: 1 };
  const pools = {};
  const leafM = std({ color: '#1e3a22', roughness: 0.85 }), barkM = std({ color: '#3a2e24', roughness: 0.95 });
  const parolG = parolGeo(), parolMats = new Map();
  const parolMat = (c) => { if (!parolMats.has(c)) parolMats.set(c, std({ color: c, emissive: c, emissiveIntensity: 3.2, toneMapped: false })); return parolMats.get(c); };
  const signGlowM = new Map();
  const signGlow = (c) => { if (!signGlowM.has(c)) signGlowM.set(c, new THREE.SpriteMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); return signGlowM.get(c); };
  const spillM = new Map();
  const spill = (c) => { if (!spillM.has(c)) spillM.set(c, new THREE.MeshBasicMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 })); return spillM.get(c); };
  const bulbM = std({ color: '#fff0d0', emissive: '#ffc070', emissiveIntensity: 4, toneMapped: false });
  const per = low ? 2 : 3;
  const allFronts = [];
  for (const kind of Object.keys(MIX)) {
    pools[kind] = [];
    const variants = NAMES[kind] ? Math.min(2, NAMES[kind].length) : 2;
    for (let n = 0; n < per * (kind === 'house' || kind === 'sari' ? 2 : 1); n++) {
      const v = n % variants;
      const f = frontage(kind, v, { low });
      const ex = f.userData.extra;
      for (const nl of ex.neon) {
        if (nl.parol) { const p = mesh(parolG, parolMat(nl.color), { x: nl.x, y: nl.y, z: nl.z, cast: false }); p.userData.dynamic = true; p.userData.parol = true; f.add(p); const s = new THREE.Sprite(signGlow(nl.color)); s.position.set(nl.x, nl.y, nl.z + 0.1); s.scale.setScalar(2.2); f.add(s); }
        else { const s = new THREE.Sprite(signGlow(nl.color)); s.position.set(nl.x, nl.y, nl.z); s.scale.set(5, 1.8, 1); f.add(s); }
      }
      for (const li of ex.lights) {
        // light spilling from the shop onto the sidewalk and the road
        f.add(mesh(new THREE.PlaneGeometry(6, 5), spill(li.color), { rx: -Math.PI / 2, x: li.x, y: 0.215, z: 2.6, cast: false, receive: false }));
        const st = mesh(new THREE.PlaneGeometry(2.2, 7), streakM.clone(), { rx: -Math.PI / 2, x: li.x, y: 0.03, z: 7.6, cast: false, receive: false });
        st.material.color.set(li.color); st.material.opacity = 0.22 * li.k; f.add(st);
        if (li.bulb) f.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), bulbM, { x: li.x, y: li.y, z: li.z, cast: false }));
      }
      if (ex.tree) { const tr = treeModel(T.rng(n * 31 + 5), leafM, barkM); tr.position.set(0.5, 0, -2.4); tr.userData.standIn = true; f.add(tr); f.userData.tree = tr; }
      f.visible = false; f.userData.kind = kind; f.userData.slot = null;
      group.add(f); pools[kind].push(f); allFronts.push(f);
    }
  }
  const kinds = Object.keys(MIX), bag = kinds.flatMap((k) => Array(MIX[k]).fill(k));
  let mix = bag;
  const kindOf = (k) => {
    let kind = mix[Math.floor(hash(k * 1.37 + 0.11) * mix.length)];
    const prev = mix[Math.floor(hash((k - 1) * 1.37 + 0.11) * mix.length)];
    if (kind === prev) kind = mix[(mix.indexOf(kind) + 1 + Math.floor(hash(k + 9.1) * 3)) % mix.length];
    return kind;
  };
  const used = new Map(); // slot → frontage

  // ---------- the LRT on its viaduct, a train now and then, and the city beyond ----------
  const LRT_Z = -36, LRT_Y = 11, LRT_P = 32;
  const vConc = std({ map: T.concrete(26, '#7a7a80', { size: 128, repeat: [8, 1] }).map, roughness: 0.9 });
  const deck = mesh(roundedBox(LEN, 1.4, 5, 0.1), vConc, { y: LRT_Y, z: LRT_Z, cast: false });
  strip.add(deck);
  strip.add(mesh(new THREE.BoxGeometry(LEN, 0.9, 0.2), vConc, { y: LRT_Y + 1.1, z: LRT_Z + 2.4, cast: false }));
  const cols = [];
  for (let i = 0; i < 10; i++) { const c = mesh(roundedBox(1.4, LRT_Y - 0.6, 1.8, 0.2), vConc, { y: (LRT_Y - 0.6) / 2, z: LRT_Z, cast: false }); group.add(c); cols.push(c); }
  const train = new THREE.Group(); group.add(train);
  const winC = T.canvas(512, 64), wx = winC.getContext('2d');
  wx.fillStyle = '#d8dce4'; wx.fillRect(0, 0, 512, 64); wx.fillStyle = '#6a2ad0'; wx.fillRect(0, 44, 512, 8);
  for (let k = 0; k < 10; k++) { wx.fillStyle = '#ffe8b0'; wx.fillRect(14 + k * 50, 12, 36, 26); }
  const winE = T.canvas(512, 64), we = winE.getContext('2d'); we.fillStyle = '#000'; we.fillRect(0, 0, 512, 64);
  for (let k = 0; k < 10; k++) { we.fillStyle = '#ffe0a0'; we.fillRect(14 + k * 50, 12, 36, 26); }
  const carM = std({ map: T.toTex(winC), emissive: '#ffffff', emissiveMap: T.toTex(winE), emissiveIntensity: 1.6, roughness: 0.5, metalness: 0.3 });
  for (let c = 0; c < 3; c++) train.add(mesh(roundedBox(16, 3, 2.8, 0.3), carM, { x: c * 16.6, y: LRT_Y + 2.2, z: LRT_Z + 0.2, cast: false }));
  const trainHead = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#fff4d0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  trainHead.position.set(41, LRT_Y + 2, LRT_Z + 0.2); trainHead.scale.setScalar(5); train.add(trainHead);
  // the city: towers with lit windows, a church dome, a radio mast with its red light
  const city = new THREE.Group(); group.add(city);
  const towerTex = (() => {
    const c = T.canvas(128, 256), x = c.getContext('2d'), e = T.canvas(128, 256), l = e.getContext('2d'), r = T.rng(77);
    x.fillStyle = '#1a1c28'; x.fillRect(0, 0, 128, 256); l.fillStyle = '#000'; l.fillRect(0, 0, 128, 256);
    for (let j = 4; j < 256; j += 8) for (let i = 4; i < 128; i += 8) if (r() < 0.32) { const cc = r() < 0.7 ? '#ffd8a0' : '#b8d0ff'; x.fillStyle = cc; x.fillRect(i, j, 5, 5); l.fillStyle = cc; l.globalAlpha = 0.5 + r() * 0.5; l.fillRect(i, j, 5, 5); l.globalAlpha = 1; }
    return { map: T.toTex(c, { repeat: [1, 1] }), emap: T.toTex(e, { repeat: [1, 1] }) };
  })();
  towerTex.map.wrapS = towerTex.map.wrapT = towerTex.emap.wrapS = towerTex.emap.wrapT = THREE.RepeatWrapping;
  const towerM = std({ map: towerTex.map, emissive: '#ffffff', emissiveMap: towerTex.emap, emissiveIntensity: 1.1, roughness: 0.8, fog: false });
  const cr = T.rng(88);
  for (let k = 0; k < 26; k++) {
    const w = 8 + cr() * 14, h = 18 + cr() * (k % 5 === 0 ? 80 : 40), geo = new THREE.BoxGeometry(w, h, 10);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 16, uv.getY(i) * h / 32);
    const t = mesh(geo, towerM, { x: -260 + k * 21 + cr() * 8, y: h / 2 - 2, z: -150 - cr() * 60, cast: false, receive: false });
    city.add(t);
    if (h > 60) { const bl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ff2a2a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })); bl.position.set(t.position.x, h - 1, t.position.z); bl.scale.setScalar(4); bl.userData.blink = cr() * 3; city.add(bl); }
  }

  // ---------- each frame ----------
  let lastMix = null;
  function update(camX, t, { lampsOn = 1, lampColor = '#ffb050', mood = null, trainK = 1, cityK = 1 } = {}) {
    towerM.emissiveIntensity = 1.1 * cityK; towerM.color.setScalar(cityK); towerM.opacity = cityK; towerM.transparent = cityK < 0.99;
    const snap = Math.floor(camX / SNAP) * SNAP;
    road.position.x = snap; marks.position.x = snap; strip.position.x = snap;
    // posts: the ones around the camera
    const p0 = Math.floor((camX - 60) / POLE_P);
    for (let i = 0; i < NP; i++) {
      const k = p0 + i, p = poles[i];
      p.position.x = k * POLE_P;
      p.userData.trans.visible = hash(k * 3.1) < 0.35;
      p.userData.k = k;
    }
    const n0 = Math.floor((camX - 50) / NEAR_P);
    nearItems.forEach((g, i) => { const k = n0 + i; g.position.x = k * NEAR_P + 4; g.userData.lamp.visible = false; g.visible = hash(k * 5.3) < 0.7; });
    lampHeadM.emissiveIntensity = 0.3 + 5 * lampsOn; lampHeadM.emissive.set(lampColor);
    poolM.opacity = 0.5 * lampsOn; streakM.opacity = 0.45 * lampsOn; haloM.opacity = 0.9 * lampsOn;
    poolM.color.set(lampColor); streakM.color.set(lampColor); haloM.color.set(lampColor);
    // frontages: fill the slots around the camera, free the ones behind
    if (mood && mood.mix !== lastMix) { lastMix = mood.mix; mix = mood.mix ? kinds.flatMap((k) => Array(mood.mix[k] ?? MIX[k]).fill(k)) : bag; for (const f of used.values()) { f.visible = false; f.userData.slot = null; } used.clear(); }
    const s0 = Math.floor((camX - 55) / SLOT), s1 = Math.floor((camX + 120) / SLOT);
    for (const [k, f] of used) if (k < s0 || k > s1) { f.visible = false; f.userData.slot = null; used.delete(k); }
    for (let k = s0; k <= s1; k++) {
      if (used.has(k)) continue;
      let kind = kindOf(k), f = pools[kind].find((x) => x.userData.slot === null);
      if (!f) f = pools.house.find((x) => x.userData.slot === null) || pools.sari.find((x) => x.userData.slot === null);
      if (!f) continue;
      f.userData.slot = k; f.visible = true;
      f.position.set(k * SLOT + SLOT / 2, 0, FRONT_Z + (hash(k * 7.7) - 0.5) * 0.3);
      used.set(k, f);
    }
    // parols sway a little
    for (const f of used.values()) for (const c of f.children) if (c.userData.parol) c.rotation.z = Math.sin(t * 1.3 + f.position.x) * 0.08;
    // the viaduct's columns, the train, the city far off (it moves with the camera, a little slower)
    const c0 = Math.floor((camX - 80) / LRT_P);
    cols.forEach((c, i) => { c.position.x = (c0 + i) * LRT_P; });
    const cyc = 38, ph = (t % cyc) / cyc;
    train.position.x = camX + 160 - ph * 380; train.visible = trainK > 0;
    city.position.x = camX * 0.9;
    for (const c of city.children) if (c.isSprite) c.material.opacity = Math.sin(t * 2 + c.userData.blink) > 0.2 ? 1 : 0.1;
  }
  // the lamps near x, nearest first, for the few real lights
  const lampSpots = (x, n, out = []) => {
    out.length = 0;
    const k0 = Math.round(x / POLE_P);
    for (let d = 0; out.length < n; d++) { for (const k of d ? [k0 + d, k0 - d] : [k0]) if (out.length < n) out.push(new THREE.Vector3(k * POLE_P, lampHead.y - 0.3, lampHead.z)); }
    return out;
  };
  return { group, update, lampSpots, surfaces, fronts: allFronts, poles, lampHead };
}
