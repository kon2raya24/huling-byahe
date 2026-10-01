// Particles and weather for the 3D view: exhaust, sparks, spray, glints, ghost wisps, steam, horn rings,
// rain falling round the camera and rings where it lands. Two point systems (one glowing, one soft) and a
// few instanced rings; each particle lives on the CPU and is written into buffers once a frame.
import * as THREE from './vendor/three.module.min.js';
import { glowTex, ringTex, sparkTex, clamp } from './kit3d.mjs';

function pointSystem(max, { additive, map }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 4), size = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false,
    uniforms: { map: { value: map }, scale: { value: 600 } },
    vertexShader: `attribute vec4 color; attribute float size; uniform float scale; varying vec4 vC;
      void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a) * vec4(t.rgb, 1.0); ${additive ? 'gl_FragColor.rgb *= gl_FragColor.a;' : ''}
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  return { pts, geo, pos, col, size, list: [], max };
}

export function createFx(scene, { low = false } = {}) {
  const glow = pointSystem(low ? 500 : 1200, { additive: true, map: sparkTex() });
  const soft = pointSystem(low ? 300 : 700, { additive: false, map: glowTex() });
  scene.add(glow.pts, soft.pts);
  const C = new THREE.Color();
  // p: position, velocity, gravity, drag, life, size (start → end), colour, alpha, spin-free
  function spawn(sys, o) {
    if (sys.list.length >= sys.max) sys.list.shift();
    C.set(o.color || '#ffffff');
    sys.list.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g || 0, drag: o.drag ?? 0.5, life: o.life, max: o.life, s0: o.size ?? 0.3, s1: o.end ?? o.size ?? 0.3, r: C.r, gg: C.g, b: C.b, a: o.alpha ?? 1, floor: o.floor ?? -1 });
  }
  const R = () => Math.random() * 2 - 1;
  const api = {
    spark(x, y, z, n, { color = '#ffd070', speed = 6, vx = 0, life = 0.5, size = 0.18, g = 12 } = {}) {
      for (let i = 0; i < n; i++) spawn(glow, { x, y, z, vx: vx + R() * speed, vy: Math.random() * speed * 0.9, vz: R() * speed, g, drag: 1.2, life: life * (0.5 + Math.random()), size, end: size * 0.3, color, floor: 0.02 });
    },
    glint(x, y, z, n, { color = '#ffd24a', vx = 0 } = {}) {
      for (let i = 0; i < n; i++) spawn(glow, { x, y, z, vx: vx + R() * 2.2, vy: 0.5 + Math.random() * 2.6, vz: R() * 2.2, g: 4, drag: 1.5, life: 0.5 + Math.random() * 0.4, size: 0.22, end: 0.02, color });
    },
    wisp(x, y, z, n, { color = '#ffffff', spread = 1 } = {}) {
      for (let i = 0; i < n; i++) spawn(glow, { x: x + R() * spread, y: y + Math.random() * 0.4, z: z + R() * spread * 0.5, vx: R() * 0.3, vy: 0.5 + Math.random() * 1.4, vz: R() * 0.3, g: -0.3, drag: 0.4, life: 1.2 + Math.random() * 1.2, size: 0.25 + Math.random() * 0.25, end: 0.05, color, alpha: 0.8 });
    },
    smoke(x, y, z, { vx = 0, color = '#8a8698', size = 0.35, life = 1.1, alpha = 0.35, n = 1 } = {}) {
      for (let i = 0; i < n; i++) spawn(soft, { x, y, z, vx: vx + R() * 0.3, vy: 0.3 + Math.random() * 0.4, vz: R() * 0.3, g: -0.2, drag: 1.2, life, size, end: size * 4, color, alpha });
    },
    steam(x, y, z) { spawn(soft, { x: x + R() * 0.2, y, z: z + R() * 0.2, vx: R() * 0.2, vy: 0.9 + Math.random() * 0.5, vz: R() * 0.2, g: -0.1, drag: 0.6, life: 1.8, size: 0.3, end: 1.6, color: '#c8ccd8', alpha: 0.18 }); },
    spray(x, y, z, n, { vx = 0, color = '#bfe6ff' } = {}) {
      for (let i = 0; i < n; i++) spawn(glow, { x: x + R() * 0.3, y, z: z + R() * 0.8, vx: vx * (0.3 + Math.random() * 0.4) + R(), vy: 1.5 + Math.random() * 2.8, vz: R() * 2.2, g: 9.8, drag: 0.3, life: 0.6 + Math.random() * 0.3, size: 0.12, end: 0.06, color, alpha: 0.7, floor: 0.02 });
      if (Math.random() < 0.4) spawn(soft, { x, y: y + 0.2, z, vx: vx * 0.5, vy: 0.8, vz: R(), g: 0, drag: 1.5, life: 0.6, size: 0.4, end: 1.4, color: '#dfefff', alpha: 0.22 });
    },
    dust(x, y, z, n = 4) { for (let i = 0; i < n; i++) spawn(soft, { x, y, z, vx: R() * 0.6, vy: 0.2 + Math.random() * 0.3, vz: R() * 0.6, drag: 1.6, life: 0.9, size: 0.2, end: 0.8, color: '#9a8a78', alpha: 0.3 }); },
  };

  // horn rings, sakto rings, splashes: flat rings that grow and fade (a small instanced pool)
  const ringGeo = new THREE.PlaneGeometry(1, 1);
  const ringMat = new THREE.MeshBasicMaterial({ map: ringTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide, vertexColors: false });
  const RMAX = low ? 60 : 140;
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, RMAX); rings.frustumCulled = false; rings.count = 0;
  rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RMAX * 3), 3);
  scene.add(rings);
  const ringList = [];
  const dummy = new THREE.Object3D();
  api.ring = (x, y, z, { color = '#ffffff', from = 0.3, to = 6, life = 0.6, flat = true, alpha = 1, vx = 0 } = {}) => {
    if (ringList.length >= RMAX) ringList.shift();
    ringList.push({ x, y, z, color: new THREE.Color(color), from, to, life, max: life, flat, alpha, vx });
  };

  // rain: streaks in a box that follows the camera's focus, slanted by the wind and your speed
  const RN = low ? 500 : 1400;
  const rainGeo = new THREE.BufferGeometry(), rainPos = new Float32Array(RN * 6), drops = [];
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: '#a8b8d8', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  for (let i = 0; i < RN; i++) drops.push({ x: R() * 30, y: Math.random() * 16, z: -12 + Math.random() * 30, v: 14 + Math.random() * 6 });

  function update(dt, { focus, speedMS = 0, rainK = 0, calm = false }) {
    for (const sys of [glow, soft]) {
      const L = sys.list;
      let n = 0;
      for (let i = 0; i < L.length; i++) {
        const p = L[i];
        p.life -= dt;
        if (p.life <= 0) continue;
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy = p.vy * d - p.g * dt; p.vz *= d;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.floor >= 0 && p.y < p.floor) { p.y = p.floor; p.vy = -p.vy * 0.3; p.vx *= 0.6; p.vz *= 0.6; }
        L[n++] = p;
        const k = p.life / p.max, j = n - 1;
        sys.pos[j * 3] = p.x; sys.pos[j * 3 + 1] = p.y; sys.pos[j * 3 + 2] = p.z;
        sys.col[j * 4] = p.r; sys.col[j * 4 + 1] = p.gg; sys.col[j * 4 + 2] = p.b; sys.col[j * 4 + 3] = p.a * Math.min(1, k * 2.5);
        sys.size[j] = p.s1 + (p.s0 - p.s1) * k;
      }
      L.length = n;
      sys.geo.setDrawRange(0, n);
      for (const a of ['position', 'color', 'size']) sys.geo.attributes[a].needsUpdate = true;
    }
    let rn = 0;
    for (let i = ringList.length - 1; i >= 0; i--) { const r = ringList[i]; r.life -= dt; if (r.life <= 0) ringList.splice(i, 1); }
    for (const r of ringList) {
      const k = 1 - r.life / r.max, s = r.from + (r.to - r.from) * (1 - (1 - k) * (1 - k));
      r.x += r.vx * dt;
      dummy.position.set(r.x, r.y, r.z); dummy.rotation.set(r.flat ? -Math.PI / 2 : 0, r.flat ? 0 : Math.PI / 2, 0); dummy.scale.set(s, s, s); dummy.updateMatrix();
      rings.setMatrixAt(rn, dummy.matrix);
      const a = r.alpha * (1 - k);
      rings.setColorAt(rn, C.copy(r.color).multiplyScalar(a));
      rn++;
    }
    rings.count = rn; rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    // rain
    rain.visible = rainK > 0.01;
    if (rain.visible) {
      rainMat.opacity = 0.2 * rainK;
      const slant = 0.08 + speedMS * 0.012;
      for (let i = 0; i < RN; i++) {
        const d = drops[i];
        d.y -= d.v * dt; d.x -= speedMS * 0.15 * dt;
        if (d.y < 0) {
          if (!calm && i % 6 === 0 && Math.random() < rainK) api.ring(focus.x + d.x, 0.03, d.z, { color: '#9ab0d8', from: 0.05, to: 0.5, life: 0.4, alpha: 0.5 });
          d.y += 16; d.x = R() * 30; d.z = -12 + Math.random() * 30;
        }
        const wx = focus.x + d.x, len = 0.5 + speedMS * 0.02;
        rainPos[i * 6] = wx; rainPos[i * 6 + 1] = d.y; rainPos[i * 6 + 2] = d.z;
        rainPos[i * 6 + 3] = wx + slant * len * 4; rainPos[i * 6 + 4] = d.y + len; rainPos[i * 6 + 5] = d.z;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
  }
  function setScale(h) { glow.pts.material.uniforms.scale.value = h * 0.9; soft.pts.material.uniforms.scale.value = h * 0.9; }
  function clear() { glow.list.length = 0; soft.list.length = 0; ringList.length = 0; }
  return { ...api, update, setScale, clear };
}
