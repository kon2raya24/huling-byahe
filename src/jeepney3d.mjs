// The jeepney, built in code: a stainless hood with chrome horses, a split windshield under a lit
// signboard, airbrushed sides with the owner's name, open windows with ghosts on the benches inside, a
// colourful ceiling light, chase lights on the roof, flags, mirrors, a chrome step at the open back, and
// real headlights and tail lights. The front bumper is at x = 0; the body runs back along -x; +z is the
// right side, the curb side, which faces the camera.
import * as THREE from './vendor/three.module.min.js';
import * as T from './tex.mjs';
import { mesh, roundedBox, std, phys, mergeStatic, glowTex, TAU } from './kit3d.mjs';

export const JEEP = { len: 5.4, frontAxle: -1.05, rearAxle: -4.2, wheelR: 0.37, track: 0.8 };

// A rearing horse, in profile: the ornament every jeepney hood carries.
function horseShape() {
  const P = [[0, 0], [0.1, 0], [0.12, 0.18], [0.22, 0.34], [0.4, 0.46], [0.52, 0.55], [0.62, 0.6], [0.78, 0.57], [0.87, 0.47], [0.83, 0.42], [0.74, 0.5], [0.61, 0.67], [0.66, 0.8], [0.78, 0.9], [0.9, 0.91], [0.94, 0.98], [0.85, 1.06], [0.77, 1.12], [0.74, 1.21], [0.7, 1.11], [0.58, 1.01], [0.46, 0.85], [0.36, 0.72], [0.18, 0.64], [0.06, 0.6], [-0.04, 0.55], [-0.17, 0.36], [-0.1, 0.33], [0, 0.44], [0.04, 0.28], [-0.02, 0.1]];
  const s = new THREE.Shape();
  P.forEach(([x, y], i) => (i ? s.lineTo(x - 0.4, y) : s.moveTo(x - 0.4, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 2 });
  g.translate(0, 0, -0.025); g.computeVertexNormals();
  return g;
}

// The side painting: cream above, airbrushed swooshes, the name in a big script with a gold outline, the
// owner's name and route, pressed stainless ridges along the bottom, rivets, pinstripes, small stars.
function sidePainting(w, h, { name = 'HULING BYAHE', owner = 'TATAY ERNESTO', route = 'TAYUMAN — CUBAO', base = '#f4efe2', seed = 5 } = {}) {
  const W = 1536, H = Math.round((W * h) / w), c = T.canvas(W, H), x = c.getContext('2d'), r = T.rng(seed);
  const steel = H * 0.34; // the stainless band along the bottom
  const g = x.createLinearGradient(0, 0, 0, H - steel); g.addColorStop(0, T.shade(base, 1.04)); g.addColorStop(1, T.shade(base, 0.9));
  x.fillStyle = g; x.fillRect(0, 0, W, H - steel);
  // airbrushed swooshes, sweeping back from the front
  const sw = [['#1f6fd1', '#35d0e0'], ['#e8235a', '#ff9f43'], ['#6a2bd1', '#ff5fb0']];
  sw.forEach(([a, b], i) => {
    const gr = x.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, a); gr.addColorStop(0.55, b); gr.addColorStop(1, a);
    x.fillStyle = gr; x.globalAlpha = 0.92;
    x.beginPath();
    const y0 = H * (0.16 + i * 0.1), th = H * 0.055;
    x.moveTo(0, y0);
    for (let px = 0; px <= W; px += 24) x.lineTo(px, y0 + Math.sin(px / 190 + i * 1.3) * H * 0.05 - (px > W * 0.7 ? (px - W * 0.7) * 0.12 : 0));
    for (let px = W; px >= 0; px -= 24) x.lineTo(px, y0 + th + Math.sin(px / 190 + i * 1.3) * H * 0.05 - (px > W * 0.7 ? (px - W * 0.7) * 0.1 : 0));
    x.fill();
  });
  x.globalAlpha = 1;
  // the flame tip at the front
  x.fillStyle = '#ffd23f';
  for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(W * 0.86, H * (0.12 + k * 0.08)); x.quadraticCurveTo(W * 0.95, H * (0.1 + k * 0.08), W * 0.99, H * (0.16 + k * 0.06)); x.quadraticCurveTo(W * 0.93, H * (0.2 + k * 0.08), W * 0.86, H * (0.2 + k * 0.08)); x.fill(); }
  // the name, big, in the owner's hand: a dark drop, a gold outline, red letters
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const fy = H * 0.43;
  x.font = `italic 900 ${Math.round(H * 0.3)}px "Barlow Condensed", "Baloo 2", system-ui`;
  x.lineJoin = 'round';
  x.lineWidth = H * 0.05; x.strokeStyle = '#1a1030'; x.strokeText(name, W * 0.46 + 5, fy + 6, W * 0.7);
  x.lineWidth = H * 0.035; x.strokeStyle = '#ffd23f'; x.strokeText(name, W * 0.46, fy, W * 0.7);
  const ng = x.createLinearGradient(0, fy - H * 0.14, 0, fy + H * 0.14); ng.addColorStop(0, '#ff4a6e'); ng.addColorStop(0.55, '#c0102e'); ng.addColorStop(1, '#7a0a22');
  x.fillStyle = ng; x.fillText(name, W * 0.46, fy, W * 0.7);
  x.font = `italic 800 ${Math.round(H * 0.085)}px "Barlow Condensed", system-ui`; x.fillStyle = '#1a1030';
  x.fillText(`${owner} · ${route}`, W * 0.46, H * 0.6, W * 0.8);
  // small stars and a parol
  for (let k = 0; k < 9; k++) { const sx = W * (0.05 + k * 0.035), sy = H * 0.6; x.fillStyle = ['#1f6fd1', '#e8235a', '#ffd23f'][k % 3]; star(x, sx, sy, H * 0.025); }
  // pinstripes
  x.strokeStyle = '#c0102e'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, H - steel - 10); x.lineTo(W, H - steel - 10); x.stroke();
  x.strokeStyle = '#ffd23f'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, H - steel - 16); x.lineTo(W, H - steel - 16); x.stroke();
  // pressed stainless along the bottom: brushed, with ridges and a row of rivets
  const fine = T.noise(512, 64, 2, r);
  const img = x.getImageData(0, H - steel, W, steel);
  for (let j = 0; j < steel; j++) for (let i = 0; i < W; i++) {
    const p = (j * W + i) * 4, br = (fine[(j % 64) * 512 + ((i * 3) % 512)] - 0.5) * 30;
    const rd = [0.18, 0.5, 0.8].reduce((a, y0) => a + Math.max(0, 1 - Math.abs(j / steel - y0) * 30), 0);
    const v = 196 + br + rd * 45 - (j / steel) * 30;
    img.data[p] = v; img.data[p + 1] = v + 2; img.data[p + 2] = v + 6; img.data[p + 3] = 255;
  }
  x.putImageData(img, 0, H - steel);
  x.fillStyle = 'rgba(40,40,50,0.5)';
  for (let i = 12; i < W; i += 26) { x.beginPath(); x.arc(i, H - steel + 6, 2.5, 0, TAU); x.fill(); }
  const map = T.toTex(c);
  // relief: the ridges and rivets, and the lettering raised a touch
  const hc = T.canvas(W / 2, H / 2), hx = hc.getContext('2d');
  hx.drawImage(c, 0, 0, W / 2, H / 2);
  const hd = hx.getImageData(0, 0, W / 2, H / 2), hgt = new Float32Array((W / 2) * (H / 2));
  for (let i = 0; i < hgt.length; i++) hgt[i] = (hd.data[i * 4] + hd.data[i * 4 + 1] + hd.data[i * 4 + 2]) / 765;
  return { map, normalMap: T.normalMap(hgt, W / 2, H / 2, 3), canvas: c };
}
function star(x, cx, cy, r) { x.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.45 : r, a = -Math.PI / 2 + (k * Math.PI) / 5; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); }

function bandTex(text, sub, { w = 1024, h = 64, bg = '#141a3a', fg = '#ffd23f' } = {}) {
  const c = T.canvas(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, T.shade(bg, 1.3)); g.addColorStop(1, T.shade(bg, 0.8));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#c0102e'; x.fillRect(0, h - 6, w, 3); x.fillStyle = '#ffd23f'; x.fillRect(0, 2, w, 2);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `italic 900 ${h * 0.62}px "Barlow Condensed", system-ui`; x.fillStyle = fg; x.fillText(text, w * 0.5, h * 0.52, w * 0.6);
  if (sub) { x.font = `italic 800 ${h * 0.4}px "Barlow Condensed", system-ui`; x.fillStyle = '#e8e4ff'; x.fillText(sub, w * 0.14, h * 0.52); x.fillText(sub, w * 0.86, h * 0.52); }
  return c;
}

export function buildJeepney({ low = false, paint = {} } = {}) {
  const root = new THREE.Group(); root.name = 'jeepney';
  const body = new THREE.Group(); root.add(body); // everything that rides on the springs
  const add = (o, parent = body) => { parent.add(o); return o; };
  const L = JEEP.len;
  // materials
  const chrome = std({ color: '#f4f6fa', metalness: 1, roughness: 0.1, envMapIntensity: 1.4 });
  const steel = std({ color: '#c8ccd4', metalness: 0.9, roughness: 0.26 });
  const dark = std({ color: '#141418', roughness: 0.7 });
  const tyre = std({ color: '#111113', roughness: 0.92 });
  const glass = phys({ color: '#0c1420', roughness: 0.04, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.55 });
  const red = phys({ color: paint.accent || '#b3122e', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.2 });
  const blue = phys({ color: '#1a3f9a', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.2 });
  const seat = std({ color: '#7a1020', roughness: 0.5 });
  const floor = std({ color: '#2a2622', roughness: 0.9 });

  // the chassis and the wheels
  add(mesh(new THREE.BoxGeometry(L - 0.5, 0.2, 1.4), dark, { x: -L / 2 + 0.05, y: 0.52 }));
  const tyreG = new THREE.LatheGeometry([[0.22, -0.12], [0.3, -0.125], [0.35, -0.11], [0.37, -0.06], [0.372, 0.06], [0.35, 0.11], [0.3, 0.125], [0.22, 0.12]].map(([a, b]) => new THREE.Vector2(a, b)), 28);
  tyreG.rotateX(Math.PI / 2);
  const hubG = new THREE.CylinderGeometry(0.2, 0.22, 0.05, 24); hubG.rotateX(Math.PI / 2);
  const capG = new THREE.SphereGeometry(0.09, 16, 8, 0, TAU, 0, Math.PI / 2); capG.rotateX(Math.PI / 2);
  const lugG = new THREE.BoxGeometry(0.035, 0.18, 0.03);
  const wheels = [];
  for (const [wx, wz] of [[JEEP.frontAxle, 1], [JEEP.frontAxle, -1], [JEEP.rearAxle, 1], [JEEP.rearAxle, -1]]) {
    const w = new THREE.Group(); w.position.set(wx, JEEP.wheelR, wz * JEEP.track); w.userData.dynamic = true;
    w.add(mesh(tyreG, tyre));
    const face = new THREE.Group(); face.position.z = wz * 0.1; face.rotation.y = wz < 0 ? Math.PI : 0; w.add(face);
    face.add(mesh(hubG, chrome, { cast: false }));
    face.add(mesh(capG, chrome, { z: 0.03, cast: false }));
    for (let k = 0; k < 6; k++) face.add(mesh(lugG, steel, { rz: (k / 6) * TAU, z: 0.03, cast: false }));
    root.add(w); wheels.push(w);
  }
  // mud flaps and fenders
  for (const wz of [1, -1]) {
    add(mesh(roundedBox(0.04, 0.34, 0.3, 0.01), dark, { x: JEEP.rearAxle - 0.52, y: 0.4, z: wz * 0.8 }));
    add(mesh(roundedBox(1.25, 0.14, 0.36, 0.06), red, { x: JEEP.frontAxle, y: 0.86, z: wz * 0.86 }));
    add(mesh(roundedBox(1.0, 0.1, 0.3, 0.04), red, { x: JEEP.rearAxle, y: 0.82, z: wz * 0.9 }));
  }

  // the front: bumper, bull bar, grille, headlights, the stainless hood with its horses
  add(mesh(roundedBox(0.16, 0.18, 1.95, 0.06), chrome, { x: 0.02, y: 0.55 }));
  for (const bz of [-0.55, -0.2, 0.2, 0.55]) add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 10), chrome, { x: 0.06, y: 0.8, z: bz }));
  add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 10), chrome, { x: 0.06, y: 1.05, rx: Math.PI / 2 }));
  add(mesh(roundedBox(0.1, 0.5, 1.1, 0.03), chrome, { x: -0.16, y: 0.93 }));
  for (let k = 0; k < 9; k++) add(mesh(new THREE.BoxGeometry(0.03, 0.44, 0.03), dark, { x: -0.105, y: 0.93, z: -0.46 + k * 0.115, cast: false }));
  add(mesh(roundedBox(1.55, 0.5, 1.5, 0.14), steel, { x: -0.9, y: 0.98 }));
  add(mesh(new THREE.BoxGeometry(1.4, 0.02, 0.04), chrome, { x: -0.92, y: 1.235, z: 0 })); // the centre crease
  const headMat = std({ color: '#fff8e6', emissive: '#fff2cc', emissiveIntensity: 3.2, toneMapped: false });
  const parkMat = std({ color: '#ffcf7a', emissive: '#ffb040', emissiveIntensity: 2 });
  const bezelG = new THREE.TorusGeometry(0.13, 0.03, 10, 24); bezelG.rotateY(Math.PI / 2);
  const lensG = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24); lensG.rotateZ(Math.PI / 2);
  for (const hz of [0.64, -0.64]) {
    add(mesh(bezelG, chrome, { x: -0.1, y: 0.96, z: hz, cast: false }));
    add(mesh(lensG, headMat, { x: -0.11, y: 0.96, z: hz, cast: false }));
    add(mesh(new THREE.SphereGeometry(0.045, 12, 8), parkMat, { x: -0.12, y: 0.72, z: hz * 1.1, cast: false }));
  }
  // the horses, and a winged one in the middle
  const hg = horseShape();
  for (const [hz, s] of [[0.36, 0.32], [-0.36, 0.32], [0, 0.4]]) add(mesh(hg, chrome, { x: -0.5 - (hz === 0 ? 0.25 : 0), y: 1.24, z: hz, sx: s, sy: s, sz: s }));
  add(mesh(roundedBox(0.5, 0.03, 1.1, 0.01), chrome, { x: -0.55, y: 1.235 }));

  // the cab: the windshield, the visor and the lit signboard
  add(mesh(roundedBox(0.06, 0.55, 1.62, 0.02), glass, { x: -1.72, y: 1.52, rz: -0.18, cast: false }));
  add(mesh(new THREE.BoxGeometry(0.07, 0.56, 0.05), chrome, { x: -1.71, y: 1.52, rz: -0.18 }));
  for (const wz of [0.83, -0.83]) add(mesh(new THREE.BoxGeometry(0.4, 0.58, 0.06), red, { x: -1.9, y: 1.52, z: wz, rz: -0.1 }));
  const nameC = bandTex(paint.name || 'HULING BYAHE', '★', { w: 1024, h: 96 });
  const nameT = T.toTex(nameC);
  const nameMat = std({ map: nameT, emissive: '#ffffff', emissiveMap: nameT, emissiveIntensity: 0.9, roughness: 0.4 });
  add(mesh(roundedBox(0.3, 0.26, 2.0, 0.04), blue, { x: -1.92, y: 1.93 }));
  add(mesh(new THREE.PlaneGeometry(1.9, 0.2), nameMat, { x: -1.76, y: 1.93, ry: Math.PI / 2, cast: false }));
  // the route board on the roof, lit from inside
  const routeC = T.canvas(512, 96), rx = routeC.getContext('2d');
  rx.fillStyle = '#fff6dc'; rx.fillRect(0, 0, 512, 96); rx.fillStyle = '#c0102e'; rx.font = 'italic 900 64px "Barlow Condensed", system-ui'; rx.textAlign = 'center'; rx.textBaseline = 'middle';
  rx.fillText(paint.route || 'TAYUMAN · CUBAO', 256, 52, 490);
  const routeT = T.toTex(routeC);
  const routeMat = std({ map: routeT, emissive: '#fff4d8', emissiveMap: routeT, emissiveIntensity: 1.6, toneMapped: false });
  add(mesh(roundedBox(0.36, 0.3, 1.5, 0.03), dark, { x: -2.05, y: 2.24 }));
  add(mesh(new THREE.PlaneGeometry(1.36, 0.24), routeMat, { x: -1.865, y: 2.24, ry: Math.PI / 2, cast: false }));
  add(mesh(new THREE.PlaneGeometry(1.36, 0.24), routeMat, { x: -2.05, y: 2.24, z: 0.001, cast: false, ry: 0 }));
  const sideRoute = new THREE.PlaneGeometry(0.34, 0.24);
  add(mesh(sideRoute, routeMat, { x: -2.05, y: 2.24, z: 0.755, cast: false }));

  // the passenger body: the painted lower sides, the pillars of the open windows, the eyebrow band, the roof
  const bodyL = 3.75, bx = -1.85 - bodyL / 2;
  const art = sidePainting(bodyL, 0.72, paint);
  for (const t of [art.map, art.normalMap]) { t.repeat.set(1 / bodyL, 1 / 0.72); t.offset.set(0.5, 0.5); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
  const artMat = phys({ map: art.map, normalMap: art.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.25 });
  add(mesh(roundedBox(bodyL, 0.72, 1.96, 0.07), artMat, { x: bx, y: 0.98 }));
  add(mesh(roundedBox(bodyL + 0.02, 0.05, 2.0, 0.02), chrome, { x: bx, y: 1.36 })); // the sill
  add(mesh(roundedBox(bodyL + 0.02, 0.05, 2.0, 0.02), chrome, { x: bx, y: 0.62 }));
  // pillars: the jeepney's windows are open, so you see who's riding
  for (let k = 0; k <= 7; k++) {
    const px = -1.95 - k * (bodyL - 0.2) / 7;
    for (const pz of [0.955, -0.955]) add(mesh(new THREE.BoxGeometry(k === 0 || k === 7 ? 0.12 : 0.055, 0.44, 0.05), k % 2 ? chrome : red, { x: px, y: 1.6, z: pz }));
  }
  // the eyebrow band: dark blue, gold lettering
  const browC = bandTex(paint.brow || 'GOD BLESS OUR TRIP', '✦', { w: 1536, h: 96, bg: '#12184a' });
  const browT = T.toTex(browC); browT.repeat.set(1 / bodyL, 1 / 0.24); browT.offset.set(0.5, 0.5); browT.wrapS = browT.wrapT = THREE.ClampToEdgeWrapping;
  add(mesh(roundedBox(bodyL, 0.24, 1.98, 0.05), phys({ map: browT, roughness: 0.3, clearcoat: 1, metalness: 0.2 }), { x: bx, y: 1.93 }));
  add(mesh(roundedBox(bodyL + 0.5, 0.09, 2.06, 0.04), red, { x: bx + 0.15, y: 2.09 }));
  for (const rz of [0.99, -0.99]) add(mesh(new THREE.CylinderGeometry(0.02, 0.02, bodyL, 8), chrome, { x: bx, y: 2.16, z: rz, rz: Math.PI / 2 }));
  // the back: panels either side of the open entrance, the step, a grab bar, tail lights
  for (const s of [1, -1]) add(mesh(roundedBox(0.08, 1.35, 0.62, 0.03), red, { x: -L + 0.2, y: 1.3, z: s * 0.66 }));
  add(mesh(roundedBox(0.4, 0.06, 0.9, 0.02), chrome, { x: -L + 0.08, y: 0.5 }));
  add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 8), chrome, { x: -L + 0.22, y: 1.4, z: 0.36 }));
  add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 8), chrome, { x: -L + 0.22, y: 1.4, z: -0.36 }));
  const tailMat = std({ color: '#ff2a1a', emissive: '#ff1a0a', emissiveIntensity: 1.2, toneMapped: false });
  for (const tz of [0.8, -0.8]) add(mesh(roundedBox(0.06, 0.22, 0.14, 0.02), tailMat, { x: -L + 0.14, y: 0.95, z: tz, cast: false }));
  const tailRefl = std({ color: '#ffb040', emissive: '#ff8a20', emissiveIntensity: 0.8 });
  for (const tz of [0.8, -0.8]) add(mesh(roundedBox(0.05, 0.08, 0.14, 0.02), tailRefl, { x: -L + 0.14, y: 0.78, z: tz, cast: false }));
  // mirrors, the antenna and its flags, the exhaust
  for (const s of [1, -1]) {
    add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8), chrome, { x: -1.72, y: 1.46, z: s * 1.04, rx: s * 0.9 }));
    add(mesh(roundedBox(0.04, 0.22, 0.15, 0.02), chrome, { x: -1.72, y: 1.62, z: s * 1.2 }));
  }
  add(mesh(new THREE.CylinderGeometry(0.006, 0.01, 1.2, 6), chrome, { x: -1.9, y: 2.7, z: 0.9, cast: false }));
  const flags = [];
  const flagG = new THREE.PlaneGeometry(0.34, 0.2, 8, 1); flagG.translate(-0.17, 0, 0);
  for (const [fy, c] of [[3.18, '#1f3fa8'], [3.0, '#c0102e']]) {
    const f = mesh(flagG, std({ color: c, side: THREE.DoubleSide, roughness: 0.8 }), { x: -1.9, y: fy, z: 0.9, cast: false });
    f.userData.dynamic = true; flags.push(f); add(f);
  }
  add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 12), steel, { x: -L + 0.3, y: 0.38, z: 0.55, rz: Math.PI / 2 }));

  // inside: the floor, two long benches, and the ceiling light
  add(mesh(new THREE.BoxGeometry(bodyL - 0.3, 0.04, 1.8), floor, { x: bx, y: 0.66, cast: false }));
  for (const s of [1, -1]) {
    add(mesh(roundedBox(bodyL - 0.5, 0.12, 0.42, 0.04), seat, { x: bx - 0.05, y: 0.92, z: s * 0.64, cast: false }));
    add(mesh(roundedBox(bodyL - 0.5, 0.36, 0.08, 0.03), seat, { x: bx - 0.05, y: 1.15, z: s * 0.9, cast: false }));
  }
  const ceilMat = std({ color: '#ffffff', emissive: '#ff5fd0', emissiveIntensity: 1.1, toneMapped: false });
  const ceil = mesh(new THREE.BoxGeometry(bodyL - 0.6, 0.03, 0.08), ceilMat, { x: bx, y: 1.82, cast: false });
  ceil.userData.dynamic = true; add(ceil);
  const inner = new THREE.PointLight('#ff7ad8', 1.3, 5.5, 1.8); inner.position.set(bx, 1.6, 0); add(inner); inner.userData.dynamic = true;

  // chase lights all round the roof edge: one instanced mesh, recoloured each frame
  const bulbs = [];
  for (let k = 0; k < 24; k++) bulbs.push([-1.9 - (k / 23) * (bodyL - 0.1), 2.14, 1.03]);
  for (let k = 0; k < 24; k++) bulbs.push([-1.9 - (k / 23) * (bodyL - 0.1), 2.14, -1.03]);
  for (let k = 0; k < 8; k++) bulbs.push([-1.72, 2.02, -0.8 + k * 0.23]);
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), std({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2.2, toneMapped: false }), bulbs.length);
  const dummy = new THREE.Object3D();
  bulbs.forEach(([px, py, pz], i) => { dummy.position.set(px, py, pz); dummy.updateMatrix(); bulbMesh.setMatrixAt(i, dummy.matrix); bulbMesh.setColorAt(i, new THREE.Color('#ffffff')); });
  bulbMesh.castShadow = false; bulbMesh.userData.dynamic = true; add(bulbMesh);
  const BULB_C = ['#ff3d7f', '#ffd23f', '#35e0a0', '#3db8ff', '#b56bff'].map((c) => new THREE.Color(c));

  // seats for the passengers: along the far bench, facing out to the camera, the silent one at the back
  const seats = [];
  for (let k = 0; k < 5; k++) { const s = new THREE.Group(); s.position.set(-2.35 - k * 0.62, 0.98, -0.6); s.userData.dynamic = true; add(s); seats.push(s); }

  // the real lights: two headlights reaching down the road, the tail lights' glow, the brake lights
  const heads = [];
  for (const hz of [0.64, -0.64]) {
    const sp = new THREE.SpotLight('#fff0d0', 0, 34, 0.42, 0.55, 1.6);
    sp.position.set(-0.05, 0.96, hz); sp.target.position.set(14, -0.2, hz * 1.4);
    sp.userData.dynamic = true; sp.target.userData.dynamic = true;
    add(sp); add(sp.target); heads.push(sp);
  }
  const tailLight = new THREE.PointLight('#ff2010', 0, 7, 2); tailLight.position.set(-L - 0.3, 0.9, 0); tailLight.userData.dynamic = true; add(tailLight);
  // the headlight beams in the haze, and the glow of the lamps themselves
  // the light the headlamps throw on the road ahead
  const poolT = (() => { const c = T.canvas(128, 64), x = c.getContext('2d'); x.save(); x.scale(1, 0.5); const g = x.createRadialGradient(34, 64, 2, 52, 64, 64); g.addColorStop(0, 'rgba(255,245,220,0.9)'); g.addColorStop(0.45, 'rgba(255,240,210,0.3)'); g.addColorStop(1, 'rgba(255,240,210,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.restore(); return T.toTex(c); })();
  const beamMat = new THREE.MeshBasicMaterial({ map: poolT, color: '#fff0d0', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -5 });
  const beams = [mesh(new THREE.PlaneGeometry(13, 5), beamMat, { rx: -Math.PI / 2, x: 5.2, y: 0.03, cast: false, receive: false })];
  beams[0].userData.dynamic = true; add(beams[0], root);
  const flare = new THREE.SpriteMaterial({ map: glowTex(), color: '#fff2d0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  for (const hz of [0.64, -0.64]) { const s = new THREE.Sprite(flare); s.position.set(0.05, 0.96, hz); s.scale.setScalar(0.9); s.userData.dynamic = true; add(s); }
  const tailFlareMat = new THREE.SpriteMaterial({ map: glowTex(), color: '#ff3020', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  for (const tz of [0.8, -0.8]) { const s = new THREE.Sprite(tailFlareMat); s.position.set(-L + 0.05, 0.95, tz); s.scale.setScalar(0.55); s.userData.dynamic = true; add(s); }

  mergeStatic(body);
  root.traverse((o) => { if (o.isMesh && o.material === glass) o.renderOrder = 2; });

  // ---------- each frame ----------
  let spin = 0, pitch = 0, roll = 0, bounce = 0, bounceV = 0, prevSpeed = 0, prevLane = null;
  function update(s, dt, t, { speedMS = 0, braking = false, gassing = false, lane = 0, lampsOn = 1, calm = false, flood = false, idle = false, ceilColor = null } = {}) {
    // wheels roll with the road
    spin -= (speedMS / JEEP.wheelR) * dt;
    for (const w of wheels) w.rotation.z = spin;
    // the springs: the nose dips under braking and lifts on the gas, the body leans into a lane change,
    // and the old diesel shakes it gently at a stop
    const acc = dt > 0 ? (speedMS - prevSpeed) / dt : 0; prevSpeed = speedMS;
    const lv = prevLane === null || dt <= 0 ? 0 : (lane - prevLane) / dt; prevLane = lane;
    const tp = THREE.MathUtils.clamp(-acc * 0.006, -0.035, 0.05), tr = THREE.MathUtils.clamp(lv * 0.03, -0.06, 0.06);
    pitch += (tp - pitch) * Math.min(1, dt * 7); roll += (tr - roll) * Math.min(1, dt * 8);
    bounceV += (-bounce * 180 - bounceV * 12) * dt; bounce += bounceV * dt;
    const rough = calm ? 0 : speedMS > 1 ? Math.sin(t * 31) * 0.004 + Math.sin(t * 17.3) * 0.004 + (flood ? Math.sin(t * 9) * 0.012 : 0) : Math.sin(t * 44) * 0.0025;
    body.position.y = bounce + rough;
    body.rotation.z = calm ? pitch * 0.5 : pitch; body.rotation.x = calm ? 0 : roll;
    // flags in the wind
    for (let i = 0; i < flags.length; i++) { const f = flags[i]; f.rotation.y = Math.PI + Math.sin(t * (6 + speedMS * 0.6) + i) * (0.2 + Math.min(0.3, speedMS * 0.02)); f.scale.x = 1 + Math.min(0.3, speedMS * 0.02); }
    // lights
    for (const h of heads) h.intensity = (gassing ? 160 : 130) * lampsOn + 20;
    beamMat.opacity = (gassing ? 0.34 : 0.26) * (0.3 + 0.7 * lampsOn);
    tailMat.emissiveIntensity = braking ? 6 : 1.4;
    tailFlareMat.opacity = braking ? 1 : 0.45; tailFlareMat.color.set(braking ? '#ff2a14' : '#ff3020');
    tailLight.intensity = braking ? 5 : 1.2;
    // chase lights run round the roof, faster on the gas
    const run = Math.floor(t * (gassing ? 18 : 9));
    for (let i = 0; i < bulbs.length; i++) bulbMesh.setColorAt(i, (i + run) % 4 === 0 ? BULB_C[4].clone().multiplyScalar(0.15) : BULB_C[(i + Math.floor(run / 4)) % 4]);
    bulbMesh.instanceColor.needsUpdate = true;
    if (ceilColor) { ceilMat.emissive.copy(ceilColor); inner.color.copy(ceilColor); } else { const k = 0.5 + 0.5 * Math.sin(t * 0.6); ceilMat.emissive.setRGB(1, 0.35 + k * 0.2, 0.8 + k * 0.2); inner.color.copy(ceilMat.emissive); }
    inner.intensity = 1.3 + (idle ? 0 : 0.2 * Math.sin(t * 13));
  }
  function kick(v) { bounceV -= v; }
  return { root, body, wheels, seats, heads, update, kick, exhaust: new THREE.Vector3(-L + 0.02, 0.38, 0.55) };
}
