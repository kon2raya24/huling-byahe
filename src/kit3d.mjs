// Small shared pieces for the 3D view: meshes with shadows set, rounded boxes, materials, glow textures,
// the ghost shader, and merging static parts so each object costs a handful of draw calls.
import * as THREE from './vendor/three.module.min.js';
import { mergeGeometries } from './vendor/three-extra.min.js';
import * as T from './tex.mjs';

export const TAU = Math.PI * 2;
export const PXM = 28; // simulation pixels per metre: the 150 px jeepney is 5.4 m long
export const LANE_W = 3.2;
export const laneZ = (l) => LANE_W * (1 - l); // lane 0, the curb, is nearest the camera (+z)
export const ROAD_HALF = LANE_W * 1.5; // the road is 9.6 m wide
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

export function mesh(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

// A box with rounded edges, from an extruded rounded rectangle (the shape lies in x-y, extruded along z,
// so the two big x-y faces carry UVs in metres: good for painted sides).
const RB = new Map();
export function roundedBox(w, h, d, r = 0.04, seg = 3) {
  const key = [w, h, d, r, seg].map((v) => (+v).toFixed(3)).join();
  if (RB.has(key)) return RB.get(key);
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const s = new THREE.Shape(), x0 = -w / 2 + r, x1 = w / 2 - r, y0 = -h / 2 + r, y1 = h / 2 - r;
  s.moveTo(x0, -h / 2); s.lineTo(x1, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, y0); s.lineTo(w / 2, y1); s.quadraticCurveTo(w / 2, h / 2, x1, h / 2);
  s.lineTo(x0, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, y1); s.lineTo(-w / 2, y0); s.quadraticCurveTo(-w / 2, -h / 2, x0, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - r * 2, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: seg, curveSegments: 4 });
  g.translate(0, 0, -(d - r * 2) / 2);
  g.computeVertexNormals();
  RB.set(key, g);
  return g;
}

export const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
export const phys = (o = {}) => new THREE.MeshPhysicalMaterial({ roughness: 0.35, ...o });
export const basic = (o = {}) => new THREE.MeshBasicMaterial(o);
export const glowMat = (map, color, opacity = 1) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });

// A soft round glow, a streak for wet-road reflections, and a ring.
let GLOW = null, STREAK = null, RING = null, SPARK = null;
export function glowTex() {
  if (GLOW) return GLOW;
  const c = T.canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return (GLOW = T.toTex(c));
}
export function streakTex() {
  if (STREAK) return STREAK;
  const c = T.canvas(64, 256), x = c.getContext('2d');
  const v = x.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.12, 'rgba(255,255,255,0.9)'); v.addColorStop(0.45, 'rgba(255,255,255,0.35)'); v.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = v; x.fillRect(0, 0, 64, 256);
  x.globalCompositeOperation = 'destination-in';
  const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = h; x.fillRect(0, 0, 64, 256);
  // broken up, the way light breaks on wet asphalt
  x.globalCompositeOperation = 'destination-out';
  const r = T.rng(7);
  for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.5})`; x.fillRect(r() * 64, r() * 256, 2 + r() * 20, 1 + r() * 3); }
  return (STREAK = T.toTex(c));
}
export function ringTex() {
  if (RING) return RING;
  const c = T.canvas(128, 128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 40, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return (RING = T.toTex(c));
}
export function sparkTex() {
  if (SPARK) return SPARK;
  const c = T.canvas(64, 64), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillRect(31, 2, 2, 60); x.fillRect(2, 31, 60, 2);
  return (SPARK = T.toTex(c));
}

// Ghosts: translucent and glowing, brightest at their outline, fading out below the waist, with a slow
// shimmer running up through them.
export function ghostMaterial(color, { base = 0, fadeTo = 0.9, power = 1 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    uniforms: { color: { value: new THREE.Color(color) }, time: { value: 0 }, base: { value: base }, fadeTo: { value: fadeTo }, power: { value: power }, alpha: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 color; uniform float time, base, fadeTo, power, alpha; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(f, 2.2);
        float h = clamp((vW.y - base) / fadeTo, 0.0, 1.0);
        float shimmer = 0.75 + 0.25 * sin(vW.y * 9.0 - time * 3.0 + vW.x * 2.0);
        float a = (0.3 + rim * 0.9) * smoothstep(0.0, 1.0, h) * shimmer * alpha;
        gl_FragColor = vec4(color * power * (0.55 + rim * 1.8) * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Merge every static mesh under root that shares a material into one; userData.dynamic keeps a part apart.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const walk = (o) => {
    if (o.userData.dynamic) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material)) {
      const key = `${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(o);
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const parts = list.map((m) => {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.morphAttributes = {};
      return g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    });
    const geo = mergeGeometries(parts, false);
    if (!geo) continue;
    const merged = new THREE.Mesh(geo, list[0].material);
    merged.castShadow = list[0].castShadow; merged.receiveShadow = list[0].receiveShadow;
    for (const m of list) m.parent.remove(m);
    root.add(merged);
  }
  return root;
}

// Text painted on a canvas, for signs.
export function signTex(lines, { w = 512, h = 128, bg = '#1b1a2b', fg = '#ffffff', border = null, font = '"Barlow Condensed", "Baloo 2", system-ui, sans-serif', glow = null, italic = true } = {}) {
  const c = T.canvas(w, h), x = c.getContext('2d');
  if (bg) { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, T.shade(bg, 1.12)); g.addColorStop(1, T.shade(bg, 0.85)); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  if (border) { x.strokeStyle = border; x.lineWidth = h * 0.07; x.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12); }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach(([text, size, color = fg, weight = 900], k) => {
    x.font = `${italic ? 'italic ' : ''}${weight} ${size * (h / 32)}px ${font}`;
    const y = h * (lines.length === 1 ? 0.54 : 0.3 + k * (0.44 / Math.max(1, lines.length - 1)));
    if (glow) { x.shadowColor = glow; x.shadowBlur = h * 0.12; }
    x.fillStyle = color; x.fillText(text, w / 2, y, w * 0.92);
    x.shadowBlur = 0;
  });
  return c;
}

export const hexRGB = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
