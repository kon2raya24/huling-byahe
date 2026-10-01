// Real surroundings for the route: CC0 scans from Poly Haven (converted with the Bakbakan tools, kept in
// assets/env/). The road, the sidewalks and the roofs get scanned materials; the plaster fronts get their
// relief; a photographed night sky with the Milky Way goes behind; real props stand in the street: trees in
// the vacant lots, monobloc chairs and crates at the stores, bags of rubbish, the manhole covers.
// Without the files the painted street stays as it is.
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/three-mocap.min.js';

// what each tagged surface becomes: [Poly Haven material, metres a tile covers, roughness factor]
const SURF = { asphalt: ['asphalt_02', 4, null], pavement: ['concrete_pavement', 2, 1], roof: ['corrugated_iron_02', 2, 0.8], plaster: ['damaged_plaster', 2.2, 1] };
// props in front of each kind of frontage: [prop, x, z, turn, scale] (z out from the front)
const FRONT = {
  sari: [['plastic_monobloc_chair_01', 2.2, 0.9, -0.4, 1], ['plastic_monobloc_chair_01', 2.9, 1.2, 0.5, 1], ['plastic_crate_02', -2.6, 0.5, 0.2, 1]],
  house: [['potted_plant_02', 3.0, 0.4, 0.4, 1], ['trashbag', 2.3, 0.4, 1, 0.9]],
  shutter: [['trashbag', -2.9, 0.5, 0.3, 1], ['trashbag', -2.4, 0.6, 1.3, 0.8], ['utility_box_02', 3.0, 0.25, 0, 0.8]],
  karinderya: [['plastic_monobloc_chair_01', -1.2, 1.6, 0.6, 1], ['plastic_monobloc_chair_01', 2.0, 1.5, -0.8, 1]],
  apartment: [['potted_plant_01', 2.6, 0.4, 0, 1]],
  lot: [['island_tree_01', 0.6, -2.4, 0.6, 1.25], ['shrub_02~0', -2.4, -0.6, 0, 0.8]],
  vulcanizing: [['plastic_crate_02', -2.4, 0.6, 0.4, 1]],
};

export async function loadEnv(base = 'assets/env/') {
  const res = await fetch(base + 'env.json');
  if (!res.ok) throw new Error('no env');
  return { base, index: await res.json(), props: new Map(), tex: new Map() };
}
const gltf = new GLTFLoader(), texLoader = new THREE.TextureLoader();
const loadProp = (env, id) => {
  if (!env.index.props[id]) return Promise.resolve(null);
  if (!env.props.has(id)) env.props.set(id, gltf.loadAsync(env.base + 'props/' + id + '.glb').then((g) => g.scene).catch(() => null));
  return env.props.get(id);
};
const loadTex = (env, id) => {
  const t = env.index.tex[id];
  if (!t) return Promise.resolve(null);
  if (!env.tex.has(id)) env.tex.set(id, Promise.all(['diff', 'nor', 'arm'].map((k) => (t[k] ? texLoader.loadAsync(env.base + t[k]).catch(() => null) : null))).then(([diff, nor, arm]) => {
    if (diff) diff.colorSpace = THREE.SRGBColorSpace;
    for (const x of [diff, nor, arm]) if (x) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 8; }
    return { diff, nor, arm };
  }));
  return env.tex.get(id);
};

export async function dress(env, ctx, onProgress = null) {
  const jobs = [];
  let done = 0;
  const tick = (p) => p.finally(() => { done++; if (onProgress) onProgress(done / jobs.length); });
  // the sky behind
  const bg = env.index.backdrop && env.index.backdrop.qwantani_night_puresky;
  if (bg) jobs.push(tick(texLoader.loadAsync(env.base + bg).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; ctx.setBackdrop(t); }).catch(() => {})));
  // surfaces
  const mats = new Set();
  ctx.street.group.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.userData.surface) mats.add(m); });
  for (const m of mats) jobs.push(tick((async () => {
    const s = m.userData.surface, [id, tile, rough] = SURF[s.kind] || [];
    const t = id && (await loadTex(env, id));
    if (!t || !t.diff) return;
    const rep = [s.w / (s.tile || tile), s.h / (s.tile || tile)], use = (x) => { if (!x) return null; const c = x.clone(); c.repeat.set(...rep); c.needsUpdate = true; return c; };
    if (s.detail) { m.normalMap = use(t.nor); m.normalScale = new THREE.Vector2(0.7, 0.7); m.needsUpdate = true; return; }
    m.map = use(t.diff); m.normalMap = use(t.nor); m.normalScale = new THREE.Vector2(1, 1);
    if (s.keepRough) { const k = s.keepRough.clone(); m.roughnessMap = k; } else if (t.arm) m.roughnessMap = use(t.arm);
    if (t.arm) { m.aoMap = use(t.arm); m.aoMapIntensity = 0.7; }
    if (rough !== null) m.roughness = rough;
    m.color.set(s.tint || (s.kind === 'asphalt' ? '#8a8a90' : '#ffffff'));
    m.needsUpdate = true;
  })()));
  // props at the frontages
  for (const f of ctx.street.fronts) {
    const list = FRONT[f.userData.kind];
    if (!list) continue;
    for (const [pid, x, z, ry, sc] of list) jobs.push(tick(loadProp(env, pid).then((tpl) => {
      if (!tpl) return;
      const o = tpl.clone(); o.position.set(x, 0.2, z); o.rotation.y = ry; o.scale.setScalar(sc);
      o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      f.add(o);
      if (pid === 'island_tree_01' && f.userData.tree) f.userData.tree.visible = false;
    })));
  }
  // manhole covers
  jobs.push(tick(loadProp(env, 'water_manhole_cover').then((tpl) => {
    if (!tpl) return;
    for (const h of ctx.cast.holes || []) { const c = h.root.userData.cover; const o = tpl.clone(); o.position.copy(c.position); o.rotation.z = 0.12; o.scale.setScalar(1.2); h.root.add(o); c.visible = false; }
  })));
  await Promise.all(jobs);
  return true;
}
