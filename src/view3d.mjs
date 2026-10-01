// The 3D view of Huling Byahe, in three.js. It reads the run (world.mjs) and its events and never changes
// them: the jeepney drives the barangay at night, the camera watches from the curb side, a three-quarter
// view that looks down the road ahead. Each night has its own sky, fog, rain and grade; dawn comes up ahead
// in the last hour. Everything is built in code (jeepney3d, street3d, cast3d, fx3d); envpack.mjs swaps in
// real scans when they load. The frame goes through the film look (post.mjs).
import * as THREE from './vendor/three.module.min.js';
import { createPost } from './post.mjs';
import { buildJeepney, JEEP } from './jeepney3d.mjs';
import { createStreet } from './street3d.mjs';
import { createCast, ghostFigure } from './cast3d.mjs';
import { createFx } from './fx3d.mjs';
import { dress } from './envpack.mjs';
import { GHOSTS } from './story.mjs';
import { CLOCK_END, STOP_LEN, JEEP_LEN, GAS_FACTOR } from './config.mjs';
import { PXM, laneZ, clamp, lerp, damp, TAU, ROAD_HALF, glowTex } from './kit3d.mjs';

const X = (px) => px / PXM;
// Each night's air: sky, fog, lamps, the moon, rain and mist, what the street has more of
export const MOODS = {
  1: { top: '#03061a', mid: '#0d1236', low: '#3a2450', glow: '#ff8a50', fog: '#141630', fogD: 0.010, moon: 1, moonC: '#c8d4ff', hemi: 0.35, lamp: '#ffae50', env: 0.5, stars: 1, clouds: 0.25, rain: 0, mist: 0, wet: 0.35, grade: 'n1' },
  2: { top: '#050a14', mid: '#101a2a', low: '#2a3040', glow: '#ff9a60', fog: '#121a26', fogD: 0.020, moon: 0.25, moonC: '#9ab0d8', hemi: 0.3, lamp: '#ffb868', env: 0.5, stars: 0.1, clouds: 0.8, rain: 1, mist: 0.2, wet: 1, grade: 'n2' },
  3: { top: '#07041a', mid: '#1a0c38', low: '#2e1238', glow: '#c04a90', fog: '#1c1030', fogD: 0.012, moon: 0.8, moonC: '#e0c8ff', hemi: 0.35, lamp: '#ffa850', env: 0.6, stars: 0.6, clouds: 0.3, rain: 0, mist: 0, wet: 0.45, grade: 'n3', mix: { karinderya: 6, pisonet: 3, botika: 2, sari: 5, house: 4, lot: 1, kapilya: 0 } },
  4: { top: '#040a0c', mid: '#0e1a1c', low: '#24322e', glow: '#b8d080', fog: '#34443c', fogD: 0.03, moon: 0.5, moonC: '#d8f0d0', hemi: 0.35, lamp: '#ffc070', env: 0.45, stars: 0.3, clouds: 0.4, rain: 0, mist: 1, wet: 0.5, grade: 'n4', mix: { lot: 5, house: 8, sari: 4, shutter: 5, karinderya: 1, pisonet: 0 } },
  5: { top: '#0a0612', mid: '#1c1220', low: '#40282a', glow: '#ffb060', fog: '#1e1616', fogD: 0.017, moon: 0.2, moonC: '#ffe0c0', hemi: 0.3, lamp: '#ffc060', env: 0.55, stars: 0.1, clouds: 0.8, rain: 0.8, mist: 0.2, wet: 1, grade: 'n5', mix: { house: 9, kapilya: 3, sari: 5, karinderya: 3 } },
  6: { top: '#040814', mid: '#101830', low: '#2c3448', glow: '#c0d0ff', fog: '#323a4e', fogD: 0.026, moon: 1.2, moonC: '#e8f0ff', hemi: 0.4, lamp: '#ffb860', env: 0.5, stars: 0.8, clouds: 0.2, rain: 0, mist: 0.9, wet: 0.5, grade: 'n6', mix: { lot: 4, house: 8, sari: 4 } },
  7: { top: '#04061a', mid: '#12142e', low: '#34283e', glow: '#ff9a70', fog: '#262a3e', fogD: 0.02, moon: 0.4, moonC: '#d0d8ff', hemi: 0.3, lamp: '#ffae50', env: 0.5, stars: 0.4, clouds: 0.6, rain: 0.6, mist: 0.6, wet: 1, grade: 'n7' },
};
const DAWN = { top: '#1c2a58', mid: '#7a5270', low: '#d08058', glow: '#ffb080', fog: '#6a5060' };
const TMPC = new THREE.Color(), TMPC2 = new THREE.Color();
const mixHex = (a, b, k) => TMPC.set(a).lerp(TMPC2.set(b), k);

export function createView(canvas, { low = false, gfx = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no webgl');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#141630', 0.01);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.3, 700);
  scene.add(camera);
  let ready = false;
  const fixed = gfx !== null && gfx !== '' && !Number.isNaN(+gfx);
  let level = fixed ? clamp(+gfx, 0, 2) : low ? 1 : 2;
  const post = createPost(renderer, scene, camera, { level, auto: !fixed, onLevel: (l) => { if (ready) applyQuality(l); } });
  const pmrem = new THREE.PMREMGenerator(renderer);

  // ---------- light ----------
  const hemi = new THREE.HemisphereLight('#3a4a7a', '#140f0c', 0.35); scene.add(hemi);
  const moon = new THREE.DirectionalLight('#c8d4ff', 0.6);
  moon.castShadow = true;
  Object.assign(moon.shadow.camera, { left: -26, right: 26, top: 20, bottom: -20, near: 1, far: 120 });
  moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.04; moon.shadow.radius = 3;
  scene.add(moon, moon.target);
  const MOON_DIR = new THREE.Vector3(-0.35, 0.62, 0.7).normalize();
  // a soft key light that rides with the jeepney, so the hero reads against the night
  const key = new THREE.PointLight('#c8d0ff', 9, 13, 1.4); scene.add(key);
  const lamps = Array.from({ length: low ? 3 : 5 }, () => { const l = new THREE.PointLight('#ffae50', 0, 22, 1.5); scene.add(l); return l; });

  // ---------- the environment for reflections: the city at night, painted into a little scene ----------
  function cityEnv(m) {
    const es = new THREE.Scene();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, uniforms: { top: { value: new THREE.Color(m.top) }, mid: { value: new THREE.Color(m.mid) }, low: { value: new THREE.Color(m.low) }, glow: { value: new THREE.Color(m.glow) } },
      vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, mid, low, glow; varying vec3 v; void main(){ float h = v.y; vec3 c = mix(mid, top, smoothstep(0.0, 0.6, h)) * 1.6; c = mix(low * 0.6, c, smoothstep(-0.1, 0.1, h)); c += glow * exp(-abs(h) * 8.0) * 0.9; gl_FragColor = vec4(c, 1.0); }',
    }));
    es.add(dome);
    const r = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    const panel = (color, k, w, h, a, e, d = 40) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })); p.position.set(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d); p.lookAt(0, 0, 0); es.add(p); };
    for (let k = 0; k < 40; k++) panel(['#ffd8a0', '#ffb070', '#fff0d0', '#ff8ad0', '#8ad8ff'][k % 5], 3 + r() * 4, 1 + r() * 3, 0.6 + r() * 1.2, r() * TAU, 0.02 + r() * 0.12);
    for (let k = 0; k < 12; k++) panel(m.lamp, 14, 1.2, 0.5, r() * TAU, 0.25 + r() * 0.35, 30);
    panel(m.moonC, 8 * m.moon + 1, 3, 3, Math.atan2(MOON_DIR.z, MOON_DIR.x), Math.asin(MOON_DIR.y));
    const rt = pmrem.fromScene(es, 0.03);
    es.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return rt;
  }

  // ---------- the sky: a gradient with the city's glow, stars, the moon, clouds; a photographed sky later ----------
  const skyU = {
    top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, low: { value: new THREE.Color() }, glowC: { value: new THREE.Color() }, moonC: { value: new THREE.Color() },
    moonDir: { value: MOON_DIR.clone() }, moonK: { value: 1 }, stars: { value: 1 }, clouds: { value: 0.3 }, time: { value: 0 }, back: { value: null }, backK: { value: 0 }, dawn: { value: 0 }, sunDir: { value: new THREE.Vector3(1, 0.05, -0.2).normalize() },
  };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, low, glowC, moonC, moonDir, sunDir; uniform float moonK, stars, clouds, time, backK, dawn; uniform sampler2D back; varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += vn(p) * a; p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(mid, top, smoothstep(0.0, 0.6, h));
        c = mix(low, c, smoothstep(-0.03, 0.2, h));
        c += glowC * exp(-max(h, 0.0) * 10.0) * 0.35;
        vec2 uv = vec2(atan(d.z, d.x) / 6.28318 + 0.5, asin(clamp(h, -1.0, 1.0)) / 3.14159 + 0.5);
        if (backK > 0.0) { vec3 b = texture2D(back, uv).rgb; c += pow(b, vec3(3.2)) * backK * smoothstep(0.02, 0.35, h) * (1.0 - dawn); }
        // stars, twinkling
        vec2 sp = uv * vec2(900.0, 450.0); float st = h21(floor(sp)); float tw = 0.6 + 0.4 * sin(time * 2.0 + st * 40.0);
        c += vec3(0.9, 0.92, 1.0) * step(0.9975, st) * tw * stars * smoothstep(0.05, 0.4, h) * (1.0 - dawn) * 1.4;
        // clouds lit from below by the city
        float cl = fbm(vec2(uv.x * 14.0 + time * 0.004, uv.y * 30.0)) ;
        float cm = smoothstep(0.52, 0.8, cl) * clouds * smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.3, 0.7, h));
        c = mix(c, glowC * 0.22 + mid * 0.8 + vec3(0.02), cm * 0.8);
        // the moon, and its halo
        float m = max(dot(d, normalize(moonDir)), 0.0);
        c += moonC * (smoothstep(0.99955, 0.99975, m) * 2.4 + pow(m, 600.0) * 0.5 + pow(m, 30.0) * 0.08) * moonK * (1.0 - cm * 0.7);
        // the sun, coming up ahead
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += vec3(1.0, 0.65, 0.35) * dawn * (pow(s, 10.0) * 0.3 + pow(s, 500.0) * 1.6);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), skyMat); sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);

  // ---------- the world ----------
  const street = createStreet(scene, { low });
  const cast = createCast(scene, { low });
  const fx = createFx(scene, { low });
  const jeep = buildJeepney({ low });
  scene.add(jeep.root);
  // mist lying low over the road on foggy nights
  const mistTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mists = [];
  for (let k = 0; k < (low ? 6 : 12); k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(14 + Math.random() * 10, 3 + Math.random() * 2), new THREE.MeshBasicMaterial({ map: mistTex, color: '#8898b0', transparent: true, opacity: 0, depthWrite: false, fog: false })); m.userData = { ox: Math.random() * 120 - 40, z: -9 + Math.random() * 16, y: 0.6 + Math.random() * 1.2, drift: 0.3 + Math.random() * 0.6 }; scene.add(m); mists.push(m); }

  // ---------- quality ----------
  function applyQuality(l) {
    level = l;
    const pr = Math.min(window.devicePixelRatio || 1, l >= 2 ? 1.75 : l === 1 ? 1.25 : 1);
    renderer.setPixelRatio(pr);
    moon.castShadow = l >= 1;
    const ms = l >= 2 ? 2048 : 1024;
    if (moon.shadow.mapSize.x !== ms) { moon.shadow.mapSize.set(ms, ms); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; } }
    jeep.heads[0].castShadow = l >= 2; jeep.heads[0].shadow.mapSize.set(512, 512);
    renderer.shadowMap.needsUpdate = true;
    resize();
  }

  // ---------- the passengers in their seats ----------
  const seated = new Map(); // ghost id → { fig, seat, fade, target }
  function syncSeats(s, dt, t, o) {
    const want = new Set(s.aboard);
    for (const [id, p] of seated) if (!want.has(id)) p.target = 0;
    for (const id of s.aboard) {
      if (seated.has(id)) { seated.get(id).target = 1; continue; }
      const used = new Set([...seated.values()].map((p) => p.seat));
      const seat = id === 'tatay' ? 4 : [0, 1, 2, 3].find((k) => !used.has(k)) ?? 3;
      const fig = ghostFigure(id, { seated: true });
      jeep.seats[seat].add(fig.root); fig.setAlpha(0);
      seated.set(id, { fig, seat, fade: 0, target: 1, delay: o.fresh ? 0 : 1.0 });
    }
    for (const [id, p] of seated) {
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.fade = damp(p.fade, p.target, 4, dt);
      const tatay = id === 'tatay';
      const dim = tatay ? (s.night === 7 ? 0.6 + 0.4 * (o.speaking === 'tatay' ? 1 : 0.5) : 0.4 + (o.speaking === 'tatay' ? 0.4 : 0)) : 1;
      p.fig.setAlpha(p.fade * dim * (1 - o.dawn * 0.75));
      p.fig.update(t, { look: tatay ? 0.3 : Math.sin(t * 0.4 + p.seat) * 0.3 });
      if (p.target === 0 && p.fade < 0.02) { p.fig.root.parent.remove(p.fig.root); seated.delete(id); }
    }
  }
  function clearSeats() { for (const p of seated.values()) p.fig.root.parent && p.fig.root.parent.remove(p.fig.root); seated.clear(); }

  // ---------- the camera ----------
  const cam = { x: 0, lead: 6, dist: 19, yaw: 0.36, pitch: 0.33, fov: 36, shake: 0, kick: 0, punch: 0, swing: 0, t: 0, mode: 'play', blend: 1, pos: new THREE.Vector3(), look: new THREE.Vector3(), cinePos: new THREE.Vector3(), cineLook: new THREE.Vector3(), introT: 0 };
  let aspect = 16 / 9;
  function rigPlay(s, dt, o) {
    const jx = X(s.x), cruise = s.route.cruise, over = clamp((s.speed - cruise) / (cruise * (GAS_FACTOR - 1)), 0, 1);
    // look further ahead when you floor it; ease toward a stop you're lining up
    const stop = s.route.stops.find((st) => st.state === 'pending' && (st.kind === 'pickup' || s.aboard.includes(st.ghost)) && st.x + STOP_LEN > s.x);
    const dStop = stop ? X(stop.x + STOP_LEN / 2 - s.x) : 99;
    const near = dStop < 26 && dStop > -3 ? 1 - clamp((dStop - 6) / 20, 0, 1) : 0;
    const lead = 4.5 + over * 2.5 + (s.speed / PXM) * 0.15 - near * 1.5;
    cam.lead = damp(cam.lead, lead, 2, dt);
    cam.x = damp(cam.x, jx, 12, dt);
    const portrait = clamp((1.5 - aspect) / 0.9, 0, 1); // 0 on a wide screen, 1 on a tall phone
    // on a tall phone: higher and steeper, so the road fills the middle of the screen, the jeepney a third in
    const dist = lerp(27, 33, portrait) * (1 - cam.punch * 0.12) * (1 - near * 0.1);
    const yaw = lerp(0.3, 0.08, portrait) + cam.swing, pitch = lerp(0.31, 0.72, portrait) + near * 0.03;
    const fx0 = cam.x + lerp(cam.lead, 2 + (cam.lead - 4.5) * 0.4, portrait), fz = lerp(-0.9, -2.2, portrait);
    cam.look.set(fx0, 0.9, fz);
    cam.pos.set(fx0 - Math.sin(yaw) * Math.cos(pitch) * dist, 0.9 + Math.sin(pitch) * dist, fz + Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.fov = lerp(36, 68, portrait) + over * 3 - cam.punch * 3;
  }
  // establishing and showcase shots: around the jeepney, slow and low
  function rigCine(s, dt, o, kind) {
    const jx = X(s.x), jz = laneZ(s.laneY), t = cam.t;
    const J = new THREE.Vector3(jx - 2.7, 1.1, jz);
    if (kind === 'intro') {
      // a crane down from over the barangay, round the front of the jeepney, then out to where you'll play
      const k = clamp(cam.introT / 5.5, 0, 1), e = k * k * (3 - 2 * k);
      const a = lerp(0.6, 2.0, e), r = lerp(26, 9, e), y = lerp(24, 2.4, e);
      cam.cinePos.set(J.x + Math.cos(a) * r, y, J.z + Math.sin(a) * r * 0.9);
      cam.cineLook.set(J.x + lerp(8, 0.4, e), lerp(0, 1.2, e), J.z);
      cam.fov = lerp(40, 34, e);
    } else if (kind === 'title') {
      // the attract loop: three tracking shots in turn
      const shot = Math.floor(t / 9) % 3, u = (t % 9) / 9;
      if (shot === 0) { cam.cinePos.set(J.x + lerp(-9, 3, u), 6.4, J.z + 12); cam.cineLook.set(J.x + 2.5, 1.1, J.z); cam.fov = 34; }
      else if (shot === 1) { cam.cinePos.set(J.x + 11 - u * 2.5, 3.2, J.z + 5.6); cam.cineLook.set(J.x - 1, 1.2, J.z); cam.fov = 34; }
      else { cam.cinePos.set(J.x - 10 + u * 6, 9 - u * 2, J.z + 16); cam.cineLook.set(J.x + 6, 1, J.z - 1); cam.fov = 40; }
    } else if (kind === 'orbit' || kind === 'garage') {
      const a = t * (kind === 'garage' ? 0.25 : 0.15) + 1.1, r = kind === 'garage' ? 8 : 12;
      cam.cinePos.set(J.x + Math.cos(a) * r, kind === 'garage' ? 2.2 : 4.5, J.z + Math.sin(a) * r);
      cam.cineLook.copy(J); cam.fov = kind === 'garage' ? 42 : 38;
    } else if (kind === 'ending') {
      // wide, high, down the street toward the sunrise
      cam.cinePos.set(J.x - 10 + t * 0.25, 2.8 + Math.sin(t * 0.1) * 0.2, J.z + 4); cam.cineLook.set(J.x + 8, 2.2, J.z - 2.5); cam.fov = 42;
    }
    // stay on the sidewalk side of the low wall when the shot is down at street level
    if (cam.cinePos.y < 6) cam.cinePos.z = Math.min(cam.cinePos.z, 7.4);
  }

  // ---------- juice ----------
  let flash = 0, split = 0, bloomBoost = 0, hitStopView = 0, lastEventT = 0, calmNow = false, speaking = null;
  const pending = [];
  function event(e, s) {
    const jx = X(s.x), jz = laneZ(s.laneY), few = calmNow ? 0.4 : 1;
    switch (e.type) {
      case 'hit': {
        const hard = e.what !== 'dog';
        fx.spark(jx + 0.1, 0.9, jz, Math.round((hard ? 40 : 14) * few), { color: hard ? '#ffc860' : '#f0e0c0', vx: s.speed / PXM * 0.6 });
        fx.smoke(jx - 0.5, 1, jz, { n: 6, size: 0.5, alpha: 0.4, vx: 1 });
        if (!calmNow) { cam.shake = Math.min(1, cam.shake + 0.9); flash = 0.45; split = 0.4; }
        jeep.kick(hard ? 2.2 : 1);
        if (e.what === 'checkpoint') cast.knockCones(s);
        break;
      }
      case 'nearmiss': {
        const hx = X(e.x), hz = laneZ(e.lane);
        fx.spark(hx + 0.5, 1.0, hz, Math.round(18 * few), { color: '#fff0b0', speed: 3, vx: -6, life: 0.4, size: 0.14, g: 0 });
        fx.ring(jx - 2.7, 1.2, jz, { color: '#ffd24a', from: 1, to: 5, life: 0.35, flat: false, alpha: 0.7 });
        if (!calmNow) { cam.punch = Math.min(1, cam.punch + 0.6 + e.combo * 0.08); cam.shake = Math.min(1, cam.shake + 0.2); bloomBoost = 0.35; }
        break;
      }
      case 'barya': {
        const cx = X(e.x), cz = laneZ(e.lane);
        fx.glint(cx, 0.8, cz, Math.round((6 + e.value * 2) * few), { color: e.value > 1 ? '#ffe070' : '#ffd24a', vx: s.speed / PXM * 0.7 });
        fx.ring(cx, 0.8, cz, { color: '#ffd24a', from: 0.2, to: 1.3, life: 0.3, flat: false, alpha: 0.8, vx: s.speed / PXM * 0.7 });
        break;
      }
      case 'pickup': case 'dropoff': {
        const c = GHOSTS[e.ghost].color;
        fx.wisp(jx - JEEP.len + 0.2, 0.8, jz + 0.8, Math.round(26 * few), { color: c, spread: 1.2 });
        cast.board(e, s, jx - JEEP.len);
        if (e.sakto) { fx.ring(jx, 0.05, laneZ(0), { color: '#7dffb0', from: 0.5, to: 7, life: 0.7 }); fx.ring(jx, 0.05, laneZ(0), { color: '#ffffff', from: 0.3, to: 4, life: 0.45 }); if (!calmNow) { cam.punch = 1; bloomBoost = 0.5; } }
        if (!calmNow) cam.swingT = 1.6;
        break;
      }
      case 'horn':
        fx.ring(jx + 0.3, 1, jz, { color: '#ffe0a0', from: 0.5, to: 9, life: 0.55, flat: false, alpha: 0.6, vx: s.speed / PXM });
        fx.ring(jx + 0.3, 1, jz, { color: '#ffffff', from: 0.3, to: 5, life: 0.4, flat: false, alpha: 0.5, vx: s.speed / PXM });
        if (!calmNow) cam.shake = Math.min(1, cam.shake + 0.12);
        break;
      case 'checkpoint': if (e.ok) fx.ring(jx, 0.05, jz, { color: '#9ccfd8', from: 1, to: 6, life: 0.6 }); break;
      case 'line': speaking = e.ghost; setTimeout(() => { if (speaking === e.ghost) speaking = null; }, 3500); break;
      default: break;
    }
  }

  // ---------- each frame ----------
  let curNight = null, curRoute = null, envRT = null, backTex = null, lastT = 0, puffT = 0, splashT = 0, steamT = 0;
  const mood = { ...MOODS[1] };
  function setNight(n) {
    curNight = n;
    Object.assign(mood, MOODS[n] || MOODS[1]);
    post.setStage(mood.grade);
    if (envRT) envRT.dispose();
    envRT = cityEnv(mood); scene.environment = envRT.texture;
    fx.clear();
  }
  const proj = new THREE.Vector3();
  function frame(s, dt, o = {}) {
    const t = performance.now() / 1000;
    calmNow = !!o.calm;
    if (s.night !== curNight) setNight(s.night);
    if (s.route !== curRoute) { curRoute = s.route; clearSeats(); cam.x = X(s.x); cam.introT = 0; o.fresh = true; }
    const jx = X(s.x), jz = laneZ(s.laneY), speedMS = s.speed / PXM;
    const dawn = Math.max(o.dawn || 0, clamp((s.clock - (CLOCK_END - 45)) / 45, 0, 1) ** 1.2);
    const lampsOn = 1 - clamp((dawn - 0.55) / 0.35, 0, 1);
    // the jeepney
    jeep.root.position.set(jx, 0, jz);
    key.position.set(jx - 1.5, 4.2, jz + 4.5); key.intensity = 9 * (1 - dawn * 0.7);
    jeep.update(s, dt, t, { speedMS, braking: s.braking && s.speed > 1, gassing: s.gassing, lane: s.laneY, lampsOn: Math.max(0.35, lampsOn), calm: calmNow, flood: s.inFlood, idle: s.speed < 1 });
    syncSeats(s, dt, t, { ...o, dawn, speaking });
    // the street and the cast
    street.update(cam.x, t, { lampsOn, lampColor: mood.lamp, mood, cityK: clamp(1 - (mood.fogD - 0.01) * 38, 0.12, 1) * (1 - dawn * 0.6) });
    cast.sync(s, t, dt, { camX: cam.x, calm: calmNow });
    // the few real lamp lights go to the posts nearest the jeepney
    const spots = street.lampSpots(jx + 6, lamps.length);
    lamps.forEach((l, i) => { l.position.copy(spots[i]); l.color.set(mood.lamp); l.intensity = 38 * lampsOn; });
    // weather, air and light for the night and the hour
    const top = mixHex(mood.top, DAWN.top, dawn).clone(), mid = mixHex(mood.mid, DAWN.mid, dawn).clone(), lowC = mixHex(mood.low, DAWN.low, dawn).clone();
    skyU.top.value.copy(top); skyU.mid.value.copy(mid); skyU.low.value.copy(lowC);
    skyU.glowC.value.copy(mixHex(mood.glow, DAWN.glow, dawn)); skyU.moonC.value.set(mood.moonC); skyU.moonK.value = mood.moon * (1 - dawn);
    skyU.stars.value = mood.stars; skyU.clouds.value = mood.clouds; skyU.time.value = t; skyU.dawn.value = dawn;
    skyU.backK.value = backTex ? 0.55 * mood.stars + 0.08 : 0;
    scene.fog.color.copy(mixHex(mood.fog, DAWN.fog, dawn * 0.8)); scene.fog.density = mood.fogD * (1 - dawn * 0.5);
    hemi.intensity = mood.hemi + dawn * 0.9; hemi.color.copy(mixHex('#3a4a7a', '#ffd0b0', dawn)); hemi.groundColor.set('#140f0c');
    moon.color.copy(mixHex(mood.moonC, '#ffb070', dawn)); moon.intensity = 0.25 + mood.moon * 0.45 + dawn * 1.6;
    const ld = dawn > 0 ? new THREE.Vector3(0.8, lerp(0.62, 0.25, dawn), lerp(0.7, -0.2, dawn)).normalize() : MOON_DIR;
    moon.position.copy(cam.look).addScaledVector(ld, 50); moon.target.position.copy(cam.look);
    scene.environmentIntensity = mood.env + dawn * 0.6;
    for (const m of street.surfaces) if (m.userData.surface.kind === 'asphalt') m.roughness = lerp(2.2, 1.05, mood.wet);
    const rainK = mood.rain * (1 - dawn * 0.6);
    // exhaust, spray in the floods, steam from the manholes
    if (!o.paused) {
      puffT -= dt;
      if (puffT <= 0 && s.speed > 0.5) { puffT = s.gassing ? 0.05 : 0.12; fx.smoke(jx + jeep.exhaust.x, jeep.exhaust.y, jz + jeep.exhaust.z, { vx: -1 - speedMS * 0.1, color: s.gassing ? '#5a5668' : '#8a8698', size: s.gassing ? 0.3 : 0.22, alpha: s.gassing ? 0.4 : 0.25, life: 1.2 }); }
      else if (puffT <= 0 && s.speed <= 0.5) { puffT = 0.4; fx.smoke(jx + jeep.exhaust.x, jeep.exhaust.y, jz + jeep.exhaust.z, { vx: -0.3, size: 0.15, alpha: 0.18 }); }
      splashT -= dt;
      if (s.inFlood && speedMS > 0.8 && splashT <= 0) { splashT = 0.03; for (const wx of [JEEP.frontAxle, JEEP.rearAxle]) for (const sz of [0.95, -0.95]) fx.spray(jx + wx, 0.15, jz + sz, calmNow ? 1 : 3, { vx: speedMS }); }
      steamT -= dt;
      if (steamT <= 0 && !calmNow) { steamT = 0.12; for (const h of s.route.hazards) if (h.type === 'manhole' && Math.abs(X(h.x) - cam.x) < 30) fx.steam(X(h.x) + 0.7, 0.1, laneZ(h.lane)); }
    }
    // mist
    for (const m of mists) {
      const u = m.userData, w = 160, rel = ((u.ox - cam.x * 0.15 + t * u.drift) % w + w) % w - 40;
      m.position.set(cam.x + rel, u.y, u.z); m.quaternion.copy(camera.quaternion); m.material.opacity = mood.mist * 0.6 * (1 - dawn);
      m.material.color.copy(scene.fog.color).lerp(TMPC2.set('#c8d0e0'), 0.45);
    }
    // the camera
    cam.t += dt; cam.introT += dt;
    const kind = o.mode === 'play' || o.mode === 'pause' ? 'play' : o.mode === 'intro' ? 'intro' : o.mode === 'results' ? 'orbit' : o.mode === 'garage' ? 'garage' : o.mode === 'ending' ? 'ending' : 'title';
    if (kind !== cam.mode) { cam.prevPos = camera.position.clone(); cam.prevLook = cam.lookNow ? cam.lookNow.clone() : cam.look.clone(); cam.blend = 0; if (kind === 'intro') cam.introT = 0; cam.mode = kind; cam.t = 0; }
    cam.swingT = Math.max(0, (cam.swingT || 0) - dt);
    cam.swing = damp(cam.swing, cam.swingT > 0 && s.boarding > 0 ? -0.22 : 0, 2.5, dt);
    rigPlay(s, dt, o);
    let P = cam.pos, Lk = cam.look;
    if (kind !== 'play') { rigCine(s, dt, o, kind); P = cam.cinePos; Lk = cam.cineLook; if (kind !== 'intro') cam.x = damp(cam.x, jx, 6, dt); }
    cam.blend = Math.min(1, cam.blend + dt / (kind === 'play' ? 1.3 : 1.6));
    const b = cam.blend * cam.blend * (3 - 2 * cam.blend);
    const pos = cam.prevPos ? cam.prevPos.clone().lerp(P, b) : P.clone(), look = cam.prevLook ? cam.prevLook.clone().lerp(Lk, b) : Lk.clone();
    cam.lookNow = look;
    cam.shake = Math.max(0, cam.shake - dt * 2.2); cam.punch = damp(cam.punch, 0, 3.5, dt);
    if (cam.shake > 0 && !calmNow) { const k = cam.shake * cam.shake * 0.35; pos.x += (Math.random() - 0.5) * k; pos.y += (Math.random() - 0.5) * k; look.x += (Math.random() - 0.5) * k * 0.5; }
    camera.position.copy(pos); camera.lookAt(look);
    camera.fov = damp(camera.fov, cam.fov, 6, dt); camera.updateProjectionMatrix();
    sky.position.copy(camera.position);
    fx.update(o.paused ? 0 : dt, { focus: new THREE.Vector3(cam.look.x, 0, 0), speedMS, rainK: o.paused ? 0 : rainK, calm: calmNow });
    flash = Math.max(0, flash - dt * 3); split = Math.max(0, split - dt * 3); bloomBoost = Math.max(0, bloomBoost - dt * 1.5);
    post.render(dt, { split, flash: calmNow ? 0 : flash, bloomBoost, dawn });
    lastT = t;
    return { dawn };
  }

  // screen position (CSS px, from the canvas' corner) of a point in the world: x in sim pixels, a lane, a height
  function project(xpx, lane, y = 1) {
    proj.set(X(xpx), y, typeof lane === 'number' ? laneZ(lane) : 0).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: (proj.x * 0.5 + 0.5) * r.width, y: (-proj.y * 0.5 + 0.5) * r.height, on: proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1 };
  }
  function projectWorld(v) { proj.copy(v).project(camera); const r = canvas.getBoundingClientRect(); return { x: (proj.x * 0.5 + 0.5) * r.width, y: (-proj.y * 0.5 + 0.5) * r.height, on: proj.z < 1 }; }

  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    aspect = Math.max(0.3, r.width / Math.max(1, r.height));
    camera.aspect = aspect; camera.updateProjectionMatrix();
    fx.setScale(r.height * renderer.getPixelRatio());
    post.resize();
  }
  function setEnv(env, onProgress) {
    return dress(env, { street, cast, jeep, pmrem, setBackdrop(t) { backTex = t; skyU.back.value = t; } }, onProgress);
  }
  ready = true;
  applyQuality(level);
  setNight(1);
  return { frame, event, resize, project, projectWorld, post, setEnv, get level() { return level; }, renderer, scene, camera, jeep, jeepFront: () => new THREE.Vector3(jeep.root.position.x, 2.4, jeep.root.position.z) };
}
