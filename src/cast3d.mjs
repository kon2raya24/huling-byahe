// Everything on the route, in 3D: the ghost passengers (glowing, see-through, each one recognisable), the
// stray dogs (Bantay has one white ear), tricycles with their drivers, open manholes behind a blinking cone,
// floods, the tanod's checkpoint, barya on the road, the PARA and BABA stops and the terminal at the end.
// These read the route (route.mjs) and the run (world.mjs) and never change them.
import * as THREE from './vendor/three.module.min.js';
import * as T from './tex.mjs';
import { STOP_LEN, SAKTO_WINDOW, JEEP_LEN } from './config.mjs';
import { GHOSTS } from './story.mjs';
import { mesh, roundedBox, std, phys, ghostMaterial, glowTex, streakTex, ringTex, signTex, mergeStatic, PXM, laneZ, LANE_W, ROAD_HALF, TAU, hash, clamp, damp } from './kit3d.mjs';
import { WALK_NEAR, FRONT_Z } from './street3d.mjs';

const X = (px) => px / PXM;
const SIDE_Z = 6.1; // where people wait on the near sidewalk
const skinM = std({ color: '#b8845a', roughness: 0.6 });

// ---------- ghosts ----------
const G_GEO = {};
const geo = (k, make) => G_GEO[k] || (G_GEO[k] = make());
const lathe = (pts, n = 18) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);
// A ghost: `seated` on a jeepney bench (the anchor is the seat, they face +z), or standing on the sidewalk.
export function ghostFigure(id, { seated = false } = {}) {
  const g = GHOSTS[id], root = new THREE.Group(), fig = new THREE.Group(); root.add(fig);
  const small = id === 'totoy', s = small ? 0.7 : 1;
  const mat = ghostMaterial(g.color, { base: 0, fadeTo: seated ? 0.5 : 1.0, power: id === 'tatay' ? 0.55 : 1 });
  const add = (gg, o) => { const m = mesh(gg, mat, { cast: false, receive: false, ...o }); fig.add(m); return m; };
  const torso = geo('torso', () => lathe([[0.001, 0], [0.17, 0.02], [0.19, 0.2], [0.21, 0.38], [0.2, 0.5], [0.12, 0.58], [0.06, 0.62], [0.001, 0.64]]));
  const skirt = geo('skirt', () => lathe([[0.001, -0.95], [0.1, -0.95], [0.16, -0.6], [0.19, -0.2], [0.19, 0.02], [0.001, 0.02]]));
  const head = geo('head', () => new THREE.SphereGeometry(0.12, 20, 14));
  const arm = geo('arm', () => { const a = new THREE.CapsuleGeometry(0.045, 0.46, 4, 8); a.translate(0, -0.25, 0); return a; });
  const thigh = geo('thigh', () => { const a = new THREE.CapsuleGeometry(0.07, 0.36, 4, 8); a.rotateX(Math.PI / 2); a.translate(0, 0, 0.2); return a; });
  const shin = geo('shin', () => { const a = new THREE.CapsuleGeometry(0.055, 0.34, 4, 8); a.translate(0, -0.22, 0); return a; });
  const y0 = seated ? 0.02 : 0.95; // the waist
  add(torso, { y: y0 });
  if (seated) { add(thigh, { x: -0.1, y: y0 + 0.02 }); add(thigh, { x: 0.1, y: y0 + 0.02 }); add(shin, { x: -0.1, y: y0 + 0.02, z: 0.4 }); add(shin, { x: 0.1, y: y0 + 0.02, z: 0.4 }); }
  else add(skirt, { y: y0 });
  const h = add(head, { y: y0 + 0.78 });
  const la = add(arm, { x: -0.23, y: y0 + 0.56, rz: -0.12 });
  const ra = add(arm, { x: 0.23, y: y0 + 0.56, rz: 0.12 });
  if (seated) { la.rotation.x = -0.9; ra.rotation.x = -0.9; }
  // what makes each one themselves
  if (id === 'lola') {
    add(geo('bun', () => new THREE.SphereGeometry(0.07, 12, 10)), { y: y0 + 0.86, z: -0.1 });
    add(geo('shawl', () => new THREE.TorusGeometry(0.17, 0.05, 8, 18)), { y: y0 + 0.56, rx: Math.PI / 2 + 0.2 });
    add(geo('bag', () => new THREE.BoxGeometry(0.26, 0.22, 0.14)), { x: seated ? 0 : -0.3, y: seated ? y0 + 0.14 : y0 + 0.05, z: seated ? 0.38 : 0.05 });
  } else if (id === 'mika') {
    add(geo('ncap', () => new THREE.BoxGeometry(0.2, 0.06, 0.14)), { y: y0 + 0.92, rx: -0.2 });
    add(geo('strap', () => new THREE.TorusGeometry(0.22, 0.012, 4, 20)), { y: y0 + 0.42, rz: 0.7, ry: Math.PI / 2 });
  } else if (id === 'ben') {
    add(geo('cap', () => new THREE.CylinderGeometry(0.125, 0.13, 0.08, 16)), { y: y0 + 0.87 });
    add(geo('brim', () => new THREE.BoxGeometry(0.2, 0.02, 0.14)), { y: y0 + 0.84, z: 0.14 });
    add(geo('towel', () => new THREE.BoxGeometry(0.14, 0.04, 0.34)), { x: 0.14, y: y0 + 0.62, rz: 0.4 });
  } else if (id === 'tatay') {
    add(geo('cap', () => new THREE.CylinderGeometry(0.125, 0.13, 0.08, 16)), { y: y0 + 0.87 });
    add(geo('brim', () => new THREE.BoxGeometry(0.2, 0.02, 0.14)), { y: y0 + 0.84, z: 0.14 });
    fig.rotation.x = 0.08; // a little stooped, after thirty years at the wheel
  }
  fig.scale.setScalar(s);
  if (!seated) { // a soft glow on the ground under them
    const pool = mesh(geo('gpool', () => new THREE.PlaneGeometry(1.8, 1.8)), new THREE.MeshBasicMaterial({ map: glowTex(), color: g.color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), { rx: -Math.PI / 2, y: 0.23, cast: false, receive: false });
    root.add(pool); root.userData.pool = pool;
  }
  const phase = hash(id.length * 3.3) * TAU;
  let alpha = 1;
  function update(t, { wave = 0, bob = 1, look = 0 } = {}) {
    mat.uniforms.time.value = t;
    mat.uniforms.base.value = root.getWorldPosition(TMP).y + (seated ? -0.05 : 0.1);
    fig.position.y = seated ? Math.sin(t * 1.6 + phase) * 0.01 : Math.sin(t * 1.8 + phase) * 0.06 * bob;
    ra.rotation.z = 0.12 + wave * (2.5 + Math.sin(t * 9) * 0.4);
    if (!seated) ra.rotation.x = -wave * 0.3;
    h.rotation.y = look + Math.sin(t * 0.7 + phase) * 0.15;
  }
  const setAlpha = (a) => { alpha = a; mat.uniforms.alpha.value = a; if (root.userData.pool) root.userData.pool.material.opacity = 0.5 * a; };
  return { root, mat, update, setAlpha, get alpha() { return alpha; }, id };
}
const TMP = new THREE.Vector3();

// ---------- a stray dog: an aspin, brown, and for Bantay, one white ear ----------
export function dogModel({ bantay = false, color = '#8b5a2b' } = {}) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fur = std({ color, roughness: 0.9 }), dark = std({ color: T.shade(color, 0.6), roughness: 0.9 }), white = std({ color: '#f2ece0', roughness: 0.9 });
  const torso = new THREE.CapsuleGeometry(0.14, 0.42, 6, 12); torso.rotateZ(Math.PI / 2);
  body.add(mesh(torso, fur, { y: 0.48 }));
  const head = new THREE.Group(); head.position.set(0.36, 0.64, 0); body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.11, 14, 10), fur));
  const snout = new THREE.CapsuleGeometry(0.055, 0.1, 4, 8); snout.rotateZ(Math.PI / 2);
  head.add(mesh(snout, fur, { x: 0.12, y: -0.03 }));
  head.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), std({ color: '#111', roughness: 0.3 }), { x: 0.2, y: -0.02 }));
  const earG = new THREE.ConeGeometry(0.04, 0.12, 8);
  const earL = mesh(earG, bantay ? white : dark, { x: -0.02, y: 0.1, z: 0.06, rx: 0.3 }), earR = mesh(earG, dark, { x: -0.02, y: 0.1, z: -0.06, rx: -0.3 });
  head.add(earL, earR);
  // eyes that catch the headlights
  const eyeM = std({ color: '#203020', emissive: '#b8ff9a', emissiveIntensity: 1.2, toneMapped: false });
  for (const ez of [0.05, -0.05]) head.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeM, { x: 0.09, y: 0.03, z: ez, cast: false }));
  const legG = new THREE.CapsuleGeometry(0.035, 0.3, 4, 8); legG.translate(0, -0.18, 0);
  const legs = [];
  for (const [lx, lz] of [[0.22, 0.08], [0.22, -0.08], [-0.22, 0.08], [-0.22, -0.08]]) { const l = mesh(legG, fur, { x: lx, y: 0.4, z: lz }); body.add(l); legs.push(l); }
  const tailG = new THREE.CapsuleGeometry(0.025, 0.22, 4, 6); tailG.translate(0, 0.12, 0);
  const tail = mesh(tailG, fur, { x: -0.34, y: 0.55, rz: 0.7 }); body.add(tail);
  const shadow = mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ map: glowTex(), color: '#000000', transparent: true, opacity: 0.45, depthWrite: false }), { rx: -Math.PI / 2, y: 0.01, cast: false, receive: false });
  root.add(shadow);
  let ph = 0;
  function update(t, dt, { speed = 0, sit = false, scared = false } = {}) {
    ph += dt * (4 + speed * 5);
    const sw = sit ? 0 : Math.min(1, speed * 0.7 + 0.15) * 0.7;
    legs.forEach((l, i) => { l.rotation.z = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * sw; });
    body.position.y = sit ? -0.12 : Math.abs(Math.sin(ph)) * 0.03 * sw;
    body.rotation.z = sit ? 0.35 : 0;
    if (sit) { legs[2].rotation.z = -1.3; legs[3].rotation.z = -1.3; }
    tail.rotation.z = scared ? -0.4 : 0.7 + Math.sin(t * (sit ? 14 : 8)) * (sit ? 0.5 : 0.25);
    tail.rotation.x = Math.sin(t * (sit ? 14 : 8)) * 0.4;
    earL.rotation.z = earR.rotation.z = scared ? 0.9 : 0;
    head.rotation.z = sit ? -0.25 + Math.sin(t * 2) * 0.05 : Math.sin(ph * 0.5) * 0.05;
  }
  return { root, update };
}

// ---------- a tricycle: a motorcycle with its sidecar cab, the driver in a cap ----------
const TRIKE_C = ['#1f8fd1', '#2fa36b', '#d9822b', '#8e5fd0', '#c0182e', '#e0b020'];
function tricycleModel(k) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = phys({ color: TRIKE_C[k % TRIKE_C.length], roughness: 0.35, clearcoat: 1, metalness: 0.2 });
  const chrome = std({ color: '#e8eaee', metalness: 1, roughness: 0.15 }), dark = std({ color: '#161618', roughness: 0.7 }), tyre = std({ color: '#111', roughness: 0.9 });
  const wheel = new THREE.TorusGeometry(0.24, 0.08, 8, 18);
  const wheels = [];
  for (const [wx, wz] of [[0.55, -0.45], [2.3, -0.45], [1.1, 0.95]]) { const w = mesh(wheel, tyre, { x: wx, y: 0.3, z: wz }); w.userData.dynamic = true; root.add(w); wheels.push(w); }
  // the motorcycle
  body.add(mesh(roundedBox(1.5, 0.35, 0.3, 0.1), paint, { x: 1.4, y: 0.72, z: -0.45 }));
  body.add(mesh(roundedBox(0.7, 0.14, 0.3, 0.06), dark, { x: 1.2, y: 0.95, z: -0.45 })); // the seat
  body.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), chrome, { x: 2.15, y: 1.12, z: -0.45, rx: Math.PI / 2 })); // handlebar
  body.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), chrome, { x: 2.25, y: 0.7, z: -0.45, rz: 0.35 })); // fork
  // the sidecar cab, with its roof out over the driver
  const cabM = paint;
  body.add(mesh(roundedBox(2.1, 0.95, 1.0, 0.12), cabM, { x: 1.35, y: 1.0, z: 0.55 }));
  body.add(mesh(roundedBox(2.4, 0.07, 1.9, 0.03), std({ color: '#1a1a1c', roughness: 0.5 }), { x: 1.3, y: 1.95, z: 0.1 }));
  for (const [px, pz] of [[0.25, 1.0], [2.4, 1.0], [0.25, -0.8], [2.4, -0.2]]) body.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), chrome, { x: px, y: 1.5, z: pz }));
  body.add(mesh(roundedBox(0.04, 0.5, 0.8, 0.02), phys({ color: '#101820', roughness: 0.05, transparent: true, opacity: 0.6 }), { x: 2.42, y: 1.55, z: 0.55 }));
  const lbl = signTex([[['TODA', 'BATANG TONDO', 'SAMPALOC TODA', 'KALYE TODA'][k % 4], 16, '#ffffff']], { w: 256, h: 64, bg: null });
  const lblT = T.toTex(lbl);
  body.add(mesh(new THREE.PlaneGeometry(1.5, 0.36), std({ map: lblT, transparent: true, roughness: 0.5 }), { x: 1.35, y: 1.12, z: 1.056, cast: false }));
  // the tail light and its glow
  const tl = std({ color: '#ff2a1a', emissive: '#ff1a0a', emissiveIntensity: 3, toneMapped: false });
  body.add(mesh(new THREE.BoxGeometry(0.05, 0.1, 0.16), tl, { x: 0.28, y: 0.8, z: 0.55, cast: false }));
  body.add(mesh(new THREE.BoxGeometry(0.05, 0.08, 0.1), tl, { x: 0.62, y: 0.82, z: -0.45, cast: false }));
  const glowM = new THREE.SpriteMaterial({ map: glowTex(), color: '#ff3020', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const sp = new THREE.Sprite(glowM); sp.position.set(0.22, 0.8, 0.55); sp.scale.setScalar(0.9); body.add(sp);
  // the blinker, when the horn makes them pull over
  const blinkM = std({ color: '#ffb020', emissive: '#ff9a10', emissiveIntensity: 0, toneMapped: false });
  const blink = mesh(new THREE.SphereGeometry(0.05, 8, 6), blinkM, { x: 0.28, y: 1.1, z: 1.0, cast: false }); body.add(blink);
  // the driver
  const shirt = std({ color: ['#e8e4d8', '#3a5a8a', '#c0182e', '#2a2a2a'][k % 4], roughness: 0.8 });
  body.add(mesh(new THREE.CapsuleGeometry(0.16, 0.34, 4, 10), shirt, { x: 1.15, y: 1.3, z: -0.45, rz: -0.2 }));
  body.add(mesh(new THREE.SphereGeometry(0.11, 12, 10), skinM, { x: 1.28, y: 1.66, z: -0.45 }));
  body.add(mesh(new THREE.CylinderGeometry(0.115, 0.12, 0.08, 12), std({ color: '#2a2a3a' }), { x: 1.28, y: 1.74, z: -0.45 }));
  const armG = new THREE.CapsuleGeometry(0.045, 0.45, 4, 6); armG.rotateZ(Math.PI / 2 - 0.4);
  body.add(mesh(armG, shirt, { x: 1.55, y: 1.3, z: -0.25 })); body.add(mesh(armG, shirt, { x: 1.55, y: 1.3, z: -0.65 }));
  const shadow = mesh(new THREE.PlaneGeometry(3.4, 2.4), new THREE.MeshBasicMaterial({ map: glowTex(), color: '#000000', transparent: true, opacity: 0.5, depthWrite: false }), { rx: -Math.PI / 2, x: 1.4, y: 0.01, z: 0.2, cast: false, receive: false });
  root.add(shadow);
  mergeStatic(body);
  return { root, body, wheels, blinkM };
}

// ---------- an open manhole behind a cone, its cover pushed aside, steam rising ----------
function manholeModel() {
  const root = new THREE.Group();
  root.add(mesh(new THREE.CircleGeometry(0.42, 24), std({ color: '#050506', roughness: 1 }), { rx: -Math.PI / 2, x: 0.7, y: 0.006, cast: false }));
  root.add(mesh(new THREE.TorusGeometry(0.44, 0.05, 6, 28), std({ color: '#3a3a3e', metalness: 0.6, roughness: 0.5 }), { rx: -Math.PI / 2, x: 0.7, y: 0.02, cast: false }));
  const cover = mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.05, 24), std({ color: '#4a4a50', metalness: 0.7, roughness: 0.45 }), { x: 1.35, y: 0.04, z: 0.35, rz: 0.12 });
  cover.userData.standIn = true; root.add(cover); root.userData.cover = cover;
  const coneM = std({ color: '#ff6a1a', roughness: 0.5 }), band = std({ color: '#f4f4f4', emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.3 });
  const cone = new THREE.Group(); cone.position.set(0, 0, 0.1); root.add(cone);
  cone.add(mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), std({ color: '#1a1a1a' }), { y: 0.02 }));
  cone.add(mesh(new THREE.ConeGeometry(0.16, 0.7, 16), coneM, { y: 0.37 }));
  cone.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.09, 16), band, { y: 0.4 }));
  const blinkM = std({ color: '#ffc040', emissive: '#ffa020', emissiveIntensity: 4, toneMapped: false });
  cone.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), blinkM, { y: 0.77, cast: false }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffa020', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.position.set(0, 0.8, 0.1); glow.scale.setScalar(1.3); root.add(glow);
  // a hand-painted warning on a sawhorse
  const sg = signTex([['MAY BUTAS!', 14, '#c0102e'], ['INGAT', 9, '#1a1a1a']], { w: 256, h: 128, bg: '#f4efe0' });
  const sign = mesh(new THREE.PlaneGeometry(0.8, 0.4), std({ map: T.toTex(sg), roughness: 0.8, side: THREE.DoubleSide }), { x: 1.3, y: 0.7, z: -0.45, ry: 0.35 });
  root.add(sign);
  for (const lx of [0.95, 1.65]) root.add(mesh(new THREE.BoxGeometry(0.05, 0.62, 0.05), std({ color: '#6a4a2a' }), { x: lx, y: 0.31, z: -0.48 + (lx - 1.3) * 0.35 }));
  return { root, blinkM, glow };
}

// ---------- the barangay checkpoint: cones at the lane lines, a booth, a tanod with a flashlight ----------
function checkpointModel() {
  const root = new THREE.Group();
  const coneM = std({ color: '#ff6a1a', roughness: 0.5 }), band = std({ color: '#f4f4f4', emissive: '#ffffff', emissiveIntensity: 0.3 });
  const coneG = new THREE.ConeGeometry(0.15, 0.62, 14), bandG = new THREE.CylinderGeometry(0.09, 0.11, 0.08, 14);
  const cones = [];
  for (const z of [ROAD_HALF - 0.25, LANE_W / 2, -LANE_W / 2, -ROAD_HALF + 0.25]) for (const dx of [-0.6, 0.6]) {
    const c = new THREE.Group(); c.position.set(dx, 0, z);
    c.add(mesh(coneG, coneM, { y: 0.33 })); c.add(mesh(bandG, band, { y: 0.36 }));
    c.userData.home = c.position.clone(); root.add(c); cones.push(c);
  }
  // the booth on the far sidewalk, lit by a tube, with its sign
  const booth = new THREE.Group(); booth.position.set(0.5, 0.2, -ROAD_HALF - 1.8); root.add(booth);
  booth.add(mesh(roundedBox(1.8, 2.2, 1.6, 0.05), std({ color: '#2d4a7a', roughness: 0.7 }), { y: 1.1 }));
  booth.add(mesh(roundedBox(2.2, 0.12, 2.0, 0.03), std({ color: '#e0def4', roughness: 0.6 }), { y: 2.26 }));
  booth.add(mesh(new THREE.PlaneGeometry(1.2, 0.8), std({ color: '#fff0c0', emissive: '#fff0c0', emissiveIntensity: 1.8, toneMapped: false }), { y: 1.35, z: 0.81, cast: false }));
  const sg = signTex([['CHECKPOINT', 14, '#ffffff'], ['BARANGAY · DAHAN-DAHAN LANG', 7, '#ffd23f', 800]], { w: 512, h: 128, bg: '#1a3a7a', border: '#ffd23f' });
  const sgT = T.toTex(sg);
  booth.add(mesh(new THREE.PlaneGeometry(2.4, 0.6), std({ map: sgT, emissive: '#ffffff', emissiveMap: sgT, emissiveIntensity: 0.7 }), { y: 2.75, z: 0.3, cast: false }));
  // the siren, red then blue
  const sirenM = std({ color: '#ff2040', emissive: '#ff2040', emissiveIntensity: 4, toneMapped: false });
  booth.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 14), sirenM, { y: 2.45, cast: false }));
  const sirenGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ff2040', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sirenGlow.position.set(0.5, 2.65, -ROAD_HALF - 1.8); sirenGlow.scale.setScalar(3.5); root.add(sirenGlow);
  // an A-frame sign on the road edge
  const af = signTex([['BAGAL', 16, '#c0102e'], ['CHECKPOINT', 9, '#1a1a1a']], { w: 256, h: 160, bg: '#ffd23f', border: '#1a1a1a' });
  root.add(mesh(new THREE.PlaneGeometry(0.9, 0.6), std({ map: T.toTex(af), side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: T.toTex(af), emissiveIntensity: 0.25 }), { x: -3, y: 0.55, z: ROAD_HALF + 0.8, ry: 0.3, rx: -0.2 }));
  // the tanod, waving his flashlight
  const tanod = new THREE.Group(); tanod.position.set(-0.8, 0.2, -ROAD_HALF - 0.6); root.add(tanod);
  const vest = std({ color: '#1a2a4a', roughness: 0.8 }), refl = std({ color: '#d8ff40', emissive: '#b8e020', emissiveIntensity: 0.4 });
  tanod.add(mesh(new THREE.CapsuleGeometry(0.19, 0.5, 4, 10), vest, { y: 1.1 }));
  tanod.add(mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), refl, { y: 1.15 }));
  for (const lz of [0.1, -0.1]) tanod.add(mesh(new THREE.CapsuleGeometry(0.07, 0.6, 4, 8), std({ color: '#1a1a22' }), { y: 0.4, z: lz }));
  tanod.add(mesh(new THREE.SphereGeometry(0.12, 12, 10), skinM, { y: 1.6 }));
  tanod.add(mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.1, 12), std({ color: '#1a2a4a' }), { y: 1.7 }));
  const arm = new THREE.Group(); arm.position.set(0, 1.4, 0.2); tanod.add(arm);
  arm.add(mesh(new THREE.CapsuleGeometry(0.05, 0.5, 4, 8), vest, { y: -0.28 }));
  const beamT = (() => { const c = T.canvas(32, 128), x = c.getContext('2d'), g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(255,248,220,0.9)'); g.addColorStop(1, 'rgba(255,248,220,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 128); return T.toTex(c); })();
  const beam = new THREE.ConeGeometry(0.6, 5, 16, 1, true); beam.translate(0, -2.5, 0); beam.rotateX(Math.PI);
  const fl = mesh(beam, new THREE.MeshBasicMaterial({ map: beamT, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }), { y: -0.56, cast: false, receive: false });
  arm.add(fl);
  return { root, cones, sirenM, sirenGlow, arm };
}

// ---------- flood water ----------
let WATER_N = null;
function waterNormal() {
  if (WATER_N) return WATER_N;
  const n = T.fbm(256, 256, 24, 3, T.rng(61));
  WATER_N = T.normalMap(n, 256, 256, 6, { repeat: [3, 1] });
  WATER_N.wrapS = WATER_N.wrapT = THREE.RepeatWrapping;
  return WATER_N;
}
function floodModel(len, width) {
  const c = T.canvas(128, 64), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 32, 4, 64, 32, 64); g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#e0e0e0'); g.addColorStop(1, '#000000');
  x.fillStyle = '#000'; x.fillRect(0, 0, 128, 64); x.save(); x.scale(1, 0.5); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 64, 0, TAU); x.fill(); x.restore();
  const alpha = T.toTex(c, { color: false });
  const nm = waterNormal().clone(); nm.repeat.set(len / 3, width / 3); nm.needsUpdate = true;
  const m = new THREE.MeshPhysicalMaterial({ color: '#16242e', roughness: 0.04, metalness: 0.1, normalMap: nm, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.92, alphaMap: alpha, clearcoat: 1, envMapIntensity: 2.2 });
  const w = mesh(new THREE.PlaneGeometry(len + 1.4, width + 0.6, 1, 1), m, { rx: -Math.PI / 2, y: 0.03, cast: false });
  return { root: w, mat: m, normal: nm };
}

// ---------- barya ----------
function coinGeo() {
  const g = new THREE.CylinderGeometry(0.2, 0.2, 0.045, 28); g.rotateX(Math.PI / 2);
  return g;
}

// ---------- a stop: the sign, the zone on the road, the sakto line, the one waiting ----------
const STOP_SIGN = new Map();
function stopSignTex(kind) {
  if (STOP_SIGN.has(kind)) return STOP_SIGN.get(kind);
  const c = signTex([[kind === 'pickup' ? 'PARA' : 'BABA', 17, '#1b1a2b'], [kind === 'pickup' ? 'SAKAYAN' : 'BABAAN', 7, '#1b1a2b', 800]], { w: 256, h: 160, bg: '#ffd23f', border: '#1b1a2b' });
  const t = T.toTex(c); STOP_SIGN.set(kind, t); return t;
}
function zoneTex() {
  const c = T.canvas(512, 128), x = c.getContext('2d');
  x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.setLineDash([26, 16]); x.strokeRect(6, 6, 500, 116);
  x.setLineDash([]); x.globalAlpha = 0.5;
  for (let k = 0; k < 7; k++) { x.beginPath(); x.moveTo(40 + k * 56, 30); x.lineTo(64 + k * 56, 64); x.lineTo(40 + k * 56, 98); x.lineWidth = 8; x.stroke(); }
  x.globalAlpha = 0.3; x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 128);
  return T.toTex(c);
}
let ZONE = null;

function stopModel(st) {
  const g = GHOSTS[st.ghost], root = new THREE.Group();
  const x0 = X(st.x), len = X(STOP_LEN), sx = X(st.x + STOP_LEN / 2);
  root.position.set(0, 0, 0);
  // the sign on its post, lit
  const post = new THREE.Group(); post.position.set(sx, 0.2, WALK_NEAR[0] + 0.6); root.add(post);
  post.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 10), std({ color: '#5a5e66', metalness: 0.6, roughness: 0.4 }), { y: 1.3 }));
  const tex = stopSignTex(st.kind);
  const signM = std({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.6, roughness: 0.5 });
  post.add(mesh(new THREE.PlaneGeometry(0.9, 0.56), signM, { y: 2.35, z: 0.03, cast: false }));
  post.add(mesh(new THREE.BoxGeometry(0.94, 0.6, 0.03), std({ color: '#2a2a30' }), { y: 2.35, z: -0.001 }));
  // a pillar of the ghost's light, seen from far down the road
  const pillarM = new THREE.MeshBasicMaterial({ map: streakTex(), color: g.color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const pillar = mesh(new THREE.PlaneGeometry(1.2, 9), pillarM, { y: 4.6, cast: false, receive: false }); post.add(pillar);
  // the zone on the curb lane where your front bumper must stop, and the sakto line in the middle
  const zoneM = new THREE.MeshBasicMaterial({ map: ZONE || (ZONE = zoneTex()), color: g.color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6 });
  const zone = mesh(new THREE.PlaneGeometry(len, LANE_W * 0.92), zoneM, { rx: -Math.PI / 2, x: x0 + len / 2, y: 0.02, z: laneZ(0), cast: false, receive: false });
  root.add(zone);
  const saktoM = new THREE.MeshBasicMaterial({ color: '#7dffb0', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -7 });
  const sakto = mesh(new THREE.PlaneGeometry(X(SAKTO_WINDOW * 2), LANE_W * 0.9), saktoM, { rx: -Math.PI / 2, x: sx, y: 0.025, z: laneZ(0), cast: false, receive: false });
  root.add(sakto);
  const lineM = new THREE.MeshBasicMaterial({ color: '#f4fff8', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -8 });
  const line = mesh(new THREE.PlaneGeometry(0.1, LANE_W * 0.95), lineM, { rx: -Math.PI / 2, x: sx, y: 0.03, z: laneZ(0), cast: false, receive: false });
  root.add(line);
  // a light wall rising from the sakto line, so it reads from the camera
  const wallM = new THREE.MeshBasicMaterial({ map: streakTex(), color: '#8dffc0', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const wall = mesh(new THREE.PlaneGeometry(LANE_W * 0.9, 2.4), wallM, { x: sx, y: 1.0, z: laneZ(0), ry: Math.PI / 2, cast: false, receive: false });
  root.add(wall);
  let who = null, dog = null, dest = null;
  if (st.kind === 'pickup') { who = ghostFigure(st.ghost); who.root.position.set(sx + 1.1, 0.2, SIDE_Z); root.add(who.root); }
  else {
    // where they're going: a porch light by the sidewalk, in their colour
    dest = new THREE.Group(); dest.position.set(sx + 1.4, 0.2, WALK_NEAR[1] - 0.4); root.add(dest);
    dest.add(mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), std({ color: '#3a3a40' }), { y: 1.1 }));
    const bulb = mesh(new THREE.SphereGeometry(0.1, 12, 10), std({ color: g.color, emissive: g.color, emissiveIntensity: 3, toneMapped: false }), { y: 2.25, cast: false }); dest.add(bulb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: g.color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); halo.position.y = 2.25; halo.scale.setScalar(2.2); dest.add(halo);
  }
  if (st.bantay) { dog = dogModel({ bantay: true }); dog.root.position.set(sx + 1.8, 0.2, SIDE_Z + 0.3); dog.root.rotation.y = -Math.PI / 2 + 0.4; root.add(dog.root); }
  return { root, st, who, dog, dest, zoneM, saktoM, lineM, wallM, pillarM, signM, sx, leaving: null, fade: 1 };
}

// ---------- the terminal: an arch over the road, lit, at the end of the line ----------
function terminalModel() {
  const root = new THREE.Group();
  const steel = std({ color: '#2a5a3a', metalness: 0.6, roughness: 0.45 });
  for (const z of [ROAD_HALF + 0.8, -ROAD_HALF - 0.8]) root.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 7, 14), steel, { y: 3.5, z }));
  root.add(mesh(new THREE.BoxGeometry(0.5, 0.5, ROAD_HALF * 2 + 2.4), steel, { y: 7 }));
  const sg = signTex([['TERMINAL', 16, '#ffffff'], ['HULING BYAHE · SALAMAT SA PAGSAKAY', 7, '#ffd23f', 800]], { w: 1024, h: 160, bg: '#1e6b3e', border: '#ffd23f' });
  const t = T.toTex(sg);
  const board = mesh(new THREE.PlaneGeometry(8, 1.3), std({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.9 }), { y: 6.1, x: -0.28, ry: -Math.PI / 2, cast: false });
  root.add(board);
  root.add(mesh(new THREE.PlaneGeometry(8, 1.3), std({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.9 }), { y: 6.1, x: 0.28, ry: Math.PI / 2, cast: false }));
  const tube = std({ color: '#ffffff', emissive: '#e8fff4', emissiveIntensity: 3, toneMapped: false });
  for (const z of [-3, 0, 3]) root.add(mesh(new THREE.BoxGeometry(0.1, 0.06, 1.4), tube, { y: 6.7, x: 0.2, z, cast: false }));
  const lt = new THREE.PointLight('#e8fff0', 30, 22, 1.6); lt.position.set(1, 6, 0); root.add(lt);
  // bunting from the arch
  const flagG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.16), new THREE.Vector3(0, 0, 0.16), new THREE.Vector3(0, -0.36, 0)]); flagG.computeVertexNormals();
  const cols = ['#e8384f', '#ffd23f', '#2f6fd6', '#3fae5a', '#ffffff'].map((c) => std({ color: c, side: THREE.DoubleSide, roughness: 0.7 }));
  for (let k = 0; k < 30; k++) { const z = -ROAD_HALF + (k / 29) * ROAD_HALF * 2, sag = Math.sin((k / 29) * Math.PI) * 0.8; root.add(mesh(flagG, cols[k % 5], { y: 6.75 - sag, z, x: 0.3, cast: false })); }
  return { root };
}

// ---------- the whole cast, synced to the run each frame ----------
export function createCast(scene, { low = false } = {}) {
  const group = new THREE.Group(); group.name = 'cast'; scene.add(group);
  const trikes = Array.from({ length: 7 }, (_, k) => tricycleModel(k));
  const holes = Array.from({ length: 6 }, () => manholeModel());
  const dogs = Array.from({ length: 4 }, (_, k) => dogModel({ color: ['#8b5a2b', '#3a2a20', '#c8a070', '#6a5040'][k] }));
  for (const o of [...trikes, ...holes, ...dogs]) { o.root.visible = false; group.add(o.root); }
  const coinM = std({ color: '#f2c24a', metalness: 1, roughness: 0.22, emissive: '#b07a10', emissiveIntensity: 0.9 });
  const MAXC = 70;
  const coins = new THREE.InstancedMesh(coinGeo(), coinM, MAXC); coins.castShadow = true; coins.count = 0; coins.frustumCulled = false; group.add(coins);
  const coinGlowG = new THREE.BufferGeometry(); coinGlowG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXC * 3), 3));
  const coinGlow = new THREE.Points(coinGlowG, new THREE.PointsMaterial({ map: glowTex(), color: '#ffc840', size: 1.5, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true }));
  coinGlow.frustumCulled = false; group.add(coinGlow);
  const term = terminalModel(); group.add(term.root);
  let route = null, stops = [], floods = [], checks = [];
  const assigned = new Map(); // hazard → model
  const dummy = new THREE.Object3D();
  const lightPool = { siren: new THREE.PointLight('#ff2040', 0, 16, 1.8), stop: new THREE.PointLight('#ffffff', 0, 10, 1.8) };
  group.add(lightPool.siren, lightPool.stop);

  function setRoute(r) {
    route = r;
    for (const o of [...stops, ...floods, ...checks]) group.remove(o.root);
    for (const o of assigned.values()) o.root.visible = false;
    assigned.clear();
    stops = r.stops.map((st) => { const m = stopModel(st); group.add(m.root); return m; });
    floods = r.hazards.filter((h) => h.type === 'flood').map((h) => {
      const lanes = h.lanes, zc = (laneZ(lanes[0]) + laneZ(lanes[lanes.length - 1])) / 2;
      const f = floodModel(X(h.len), LANE_W * lanes.length);
      f.root.position.set(X(h.x) + X(h.len) / 2, 0.03, zc); group.add(f.root); f.h = h; return f;
    });
    checks = r.hazards.filter((h) => h.type === 'checkpoint').map((h) => { const c = checkpointModel(); c.root.position.set(X(h.x), 0, 0); group.add(c.root); c.h = h; c.knock = 0; return c; });
    term.root.position.set(X(r.length), 0, 0);
  }

  // hazards near the camera get a model from the pool; the rest are hidden
  const want = (type) => (type === 'tricycle' ? trikes : type === 'manhole' ? holes : type === 'dog' ? dogs : null);
  function sync(s, t, dt, o) {
    if (s.route !== route) setRoute(s.route);
    const cx = o.camX, lo = cx - 40, hi = cx + 110;
    const busy = new Set(assigned.values());
    for (const [h, m] of assigned) {
      const hx = X(h.x);
      if (hx < lo || hx > hi || (h.type === 'dog' && h.gone && m.root.userData.goneT > 1.2)) { m.root.visible = false; assigned.delete(h); busy.delete(m); }
    }
    for (const h of s.route.hazards) {
      const pool = want(h.type);
      if (!pool || assigned.has(h)) continue;
      const hx = X(h.x);
      if (hx < lo || hx > hi || (h.type === 'dog' && h.gone)) continue;
      const m = pool.find((p) => !busy.has(p));
      if (!m) continue;
      busy.add(m); assigned.set(h, m); m.root.visible = true; m.root.userData.goneT = 0;
      m.root.userData.z = h.type === 'dog' ? laneZ(h.laneF) : laneZ(h.lane);
      m.root.userData.hitT = 0;
    }
    const speedMS = s.speed / PXM;
    for (const [h, m] of assigned) {
      const hx = X(h.x), ud = m.root.userData;
      if (h.type === 'tricycle') {
        // the sim moves a pulled-over tricycle to its new lane at once: steer it there smoothly
        ud.z = damp(ud.z, laneZ(h.lane), 3.5, dt);
        m.root.position.set(hx, 0, ud.z);
        m.root.rotation.y = clamp((laneZ(h.lane) - ud.z) * -0.25, -0.35, 0.35);
        const v = X(0.45 * s.speed) + 1;
        for (const w of m.wheels) w.rotation.z -= (v / 0.3) * dt;
        m.body.position.y = Math.sin(t * 22 + hx) * 0.012;
        m.blinkM.emissiveIntensity = h.pulled && Math.sin(t * 12) > 0 ? 4 : 0;
        if (h.spent && !ud.hitT) ud.hitT = 1;
      } else if (h.type === 'manhole') {
        m.root.position.set(hx, 0, laneZ(h.lane));
        const on = o.calm || Math.sin(t * 7 + hx) > 0;
        m.blinkM.emissiveIntensity = on ? 4 : 0.2; m.glow.material.opacity = on ? 0.9 : 0.1;
      } else if (h.type === 'dog') {
        const tz = laneZ(h.laneF), moving = Math.abs(tz - ud.z) / Math.max(dt, 1e-3);
        ud.z = tz;
        m.root.position.set(hx + 0.7, 0, tz);
        m.root.rotation.y = h.dir > 0 ? Math.PI / 2 : -Math.PI / 2; // crossing: facing the far side, or the near
        if (h.gone) ud.goneT += dt;
        m.update(t, dt, { speed: moving * 0.4, scared: !!h.scared });
      }
    }
    // floods ripple; checkpoints flash and, when you blow through too fast, the cones fly
    for (const f of floods) { f.normal.offset.x = t * 0.05; f.normal.offset.y = t * 0.03; }
    let nearCheck = null;
    for (const c of checks) {
      const on = Math.sin(t * 10) > 0;
      c.sirenM.emissive.set(on ? '#ff2040' : '#2060ff'); c.sirenGlow.material.color.set(on ? '#ff2040' : '#2060ff');
      c.arm.rotation.x = Math.sin(t * 5) * 0.8 - 0.4;
      const d = X(c.h.x) - X(s.x);
      if (d > -20 && d < 60 && (!nearCheck || Math.abs(d) < Math.abs(nearCheck.d))) nearCheck = { c, d, on };
      if (c.knock > 0) {
        c.knock += dt;
        for (const cone of c.cones) { const v = cone.userData.v; if (!v) continue; cone.position.addScaledVector(v, dt); v.y -= 9.8 * dt; if (cone.position.y < 0) { cone.position.y = 0; v.set(v.x * 0.5, -v.y * 0.3, v.z * 0.5); } cone.rotation.x += v.z * dt; cone.rotation.z -= v.x * dt; }
      }
    }
    if (nearCheck) { lightPool.siren.position.set(X(nearCheck.c.h.x) + 0.5, 3, -ROAD_HALF - 1.5); lightPool.siren.color.set(nearCheck.on ? '#ff2040' : '#2060ff'); lightPool.siren.intensity = 22; } else lightPool.siren.intensity = 0;
    // barya
    let n = 0;
    const pos = coinGlowG.attributes.position.array;
    for (const c of s.route.coins) {
      if (c.taken) continue;
      const cx2 = X(c.x);
      if (cx2 < lo || cx2 > hi) continue;
      if (n >= MAXC) break;
      const bob = o.calm ? 0 : Math.sin(t * 4 + c.x * 0.05) * 0.08;
      dummy.position.set(cx2, 0.75 + bob, laneZ(c.lane)); dummy.rotation.set(0, t * 3 + c.x * 0.01, 0); dummy.updateMatrix();
      coins.setMatrixAt(n, dummy.matrix);
      pos[n * 3] = cx2; pos[n * 3 + 1] = 0.75 + bob; pos[n * 3 + 2] = laneZ(c.lane);
      n++;
    }
    coins.count = n; coins.instanceMatrix.needsUpdate = true;
    coinGlowG.setDrawRange(0, n); coinGlowG.attributes.position.needsUpdate = true;
    // stops
    let lit = null;
    for (const m of stops) {
      const st = m.st, active = st.state === 'pending' && (st.kind === 'pickup' || s.aboard.includes(st.ghost));
      const d = m.sx - X(s.x);
      const k = active ? 1 : 0;
      m.fade = damp(m.fade, k, 3, dt);
      const pulse = o.calm ? 0.8 : 0.7 + 0.3 * Math.sin(t * 4);
      m.zoneM.opacity = 0.55 * m.fade * pulse; m.saktoM.opacity = 0.6 * m.fade; m.lineM.opacity = 0.95 * m.fade; m.wallM.opacity = 0.3 * m.fade * pulse;
      m.pillarM.opacity = 0.35 * m.fade * (d > 8 ? 1 : 0.5);
      m.signM.emissiveIntensity = 0.15 + 0.7 * m.fade;
      if (m.who && !m.leaving) m.who.update(t, { wave: st.state === 'pending' && d < 45 && d > -4 ? 1 : 0.1, look: -0.6 });
      if (m.dog) m.dog.update(t, dt, { sit: true });
      if (m.dest) m.dest.visible = m.fade > 0.02;
      if (m.leaving) {
        // walking from the sidewalk into the back of the jeepney, or out of it to the porch light
        const L = m.leaving; L.t += dt;
        const k2 = clamp(L.t / L.dur, 0, 1), e = k2 * k2 * (3 - 2 * k2);
        L.fig.root.position.lerpVectors(L.from, L.to, e);
        L.fig.root.position.y = L.from.y + Math.sin(k2 * Math.PI) * 0.35;
        L.fig.setAlpha(L.boarding ? 1 - Math.max(0, k2 - 0.7) / 0.3 : Math.min(1, k2 * 3) * (1 - Math.max(0, k2 - 0.75) / 0.25));
        L.fig.update(t, { wave: L.boarding ? 0 : 0.6 });
        if (k2 >= 1) { L.fig.root.visible = false; m.leaving = null; }
      }
      if (active && d > -6 && d < 40 && (!lit || d < lit.d)) lit = { m, d };
    }
    if (lit) { lightPool.stop.position.set(lit.m.sx, 2.2, WALK_NEAR[0] + 0.4); lightPool.stop.color.set(GHOSTS[lit.m.st.ghost].color); lightPool.stop.intensity = 10 * lit.m.fade; } else lightPool.stop.intensity = 0;
  }

  // a ghost boards (from the sign into the back of the jeepney) or gets off (and walks to their light)
  function board(e, s, jeepBackX) {
    const m = stops.find((x) => x.st.ghost === e.ghost && x.st.state === 'done' && !x.used && x.st.kind === (e.type === 'pickup' ? 'pickup' : 'dropoff'));
    if (!m) return;
    m.used = true;
    const back = new THREE.Vector3(jeepBackX - 0.4, 0.5, laneZ(s.laneY) + 0.2);
    if (e.type === 'pickup' && m.who) m.leaving = { fig: m.who, from: m.who.root.position.clone(), to: back, t: 0, dur: 1.1, boarding: true };
    else {
      const fig = ghostFigure(e.ghost); group.add(fig.root);
      const to = m.dest ? m.dest.position.clone().add(new THREE.Vector3(-0.6, 0, -0.3)) : new THREE.Vector3(m.sx + 1, 0.2, SIDE_Z);
      if (e.bantay && m.dog) to.copy(m.dog.root.position).add(new THREE.Vector3(-0.5, 0, 0));
      m.leaving = { fig, from: back, to, t: 0, dur: 1.6, boarding: false };
    }
  }
  function knockCones(s) {
    const c = checks.find((x) => x.h.spent && !x.knock);
    if (!c) return;
    c.knock = 0.001;
    for (const cone of c.cones) { const dz = cone.position.z - laneZ(s.laneY); if (Math.abs(dz) < 2.4) cone.userData.v = new THREE.Vector3(3 + Math.random() * 4, 2 + Math.random() * 3, Math.sign(dz || 1) * (1 + Math.random() * 2)); }
  }
  return { group, sync, board, knockCones, get stops() { return stops; }, lightPool, holes };
}
