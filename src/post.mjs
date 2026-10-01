// The film look. The frame is rendered in HDR, then:
// - ambient occlusion grounds feet, props and corners
// - bloom makes lamps, sparks and supers glow
// - a filmic tone map
// - a grade per stage (contrast, saturation, a tint), with a vignette and fine grain
// - a colour split on the heaviest hits
// - SMAA for clean edges
// Three levels (2 all, 1 without occlusion, 0 plain). It steps down by itself when frames run slow, and
// tells the view (onLevel) so shadows and resolution can step down with it.
import * as THREE from './vendor/three.module.min.js';
import { EffectComposer, RenderPass, UnrealBloomPass, GTAOPass, OutputPass, SMAAPass, ShaderPass } from './vendor/three-fx.min.js';

// A grade for each night: [contrast, saturation, tint, vignette, bloom strength, bloom threshold]
export const GRADE = {
  n1: [1.1, 1.08, [1.0, 0.98, 1.06], 0.5, 0.55, 0.8], // first trip: clear, moonlit, warm lamps
  n2: [1.12, 0.98, [0.92, 1.0, 1.1], 0.55, 0.65, 0.75], // rain: cold and wet
  n3: [1.12, 1.18, [1.04, 0.96, 1.06], 0.48, 0.7, 0.75], // Cubao: neon
  n4: [1.06, 0.9, [0.94, 1.03, 1.0], 0.6, 0.6, 0.8], // the dog: fog, a green cast
  n5: [1.1, 1.1, [1.08, 1.0, 0.94], 0.5, 0.6, 0.78], // pasalubong: rain, golden
  n6: [1.08, 0.92, [0.94, 0.98, 1.08], 0.58, 0.6, 0.8], // Bantay: silver fog
  n7: [1.14, 1.0, [1.02, 0.97, 1.02], 0.6, 0.65, 0.78], // the last trip
  dawn: [1.08, 1.05, [1.1, 1.0, 0.9], 0.4, 0.45, 0.9],
};

const Grade = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, contrast: { value: 1 }, sat: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) }, vig: { value: 0.4 }, grain: { value: 0.035 }, split: { value: 0 }, flash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, contrast, sat, vig, grain, split, flash; uniform vec3 tint; varying vec2 vUv;
    float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (split > 0.001) { vec2 o = d * split * 0.02; c.r = texture2D(tDiffuse, vUv + o).r; c.b = texture2D(tDiffuse, vUv - o).b; }
      c = (c - 0.5) * contrast + 0.5;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, sat) * tint;
      c *= mix(1.0, smoothstep(0.95, 0.2, length(d * vec2(1.25, 1.0))), vig);
      c += (rnd(vUv * 731.0 + fract(time) * 17.0) - 0.5) * grain;
      c = mix(c, vec3(1.0), flash * 0.55);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera, { level = 2, auto: auto0 = true, onLevel = null } = {}) {
  let auto = auto0;
  let composer = null, gtao = null, bloom = null, grade = null, smaa = null, lvl = level;
  const size = new THREE.Vector2();
  function build() {
    if (composer) composer.dispose();
    composer = null; gtao = bloom = grade = smaa = null;
    if (lvl <= 0) return;
    renderer.getSize(size);
    const pr = renderer.getPixelRatio();
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(pr); composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(scene, camera));
    if (lvl >= 2) {
      gtao = new GTAOPass(scene, camera, size.x, size.y, undefined, { radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16, distanceFallOff: 1 }, { radius: 8, rings: 2, samples: 16 });
      gtao.blendIntensity = 0.9;
      composer.addPass(gtao);
    }
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.3, 0.55, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    grade = new ShaderPass(Grade);
    composer.addPass(grade);
    smaa = new SMAAPass();
    composer.addPass(smaa);
    setStage(stageId);
    if (onLevel) onLevel(lvl);
  }
  let stageId = 'n1';
  function setStage(id) {
    stageId = id; grace = Math.max(grace, 4);
    const G = GRADE[id] || GRADE.n1;
    if (grade) { const u = grade.uniforms; u.contrast.value = G[0]; u.sat.value = G[1]; u.tint.value.set(...G[2]); u.vig.value = G[3]; }
    if (bloom) { bloom.strength = G[4]; bloom.threshold = G[5]; }
  }
  // slow frames: step down once the average stays under ~40 fps for a few seconds
  let avg = 1 / 60, slowT = 0, last = 0, grace = 6; // loading and shader compiles hitch at first: give it a few seconds
  function render(dt, { split = 0, bloomBoost = 0, flash = 0, dawn = 0 } = {}) {
    // real time between frames (the game's dt is capped, so it can't tell how slow things are)
    const t = performance.now() / 1000, real = last ? Math.min(1, t - last) : 1 / 60; last = t;
    avg = avg * 0.9 + real * 0.1;
    if (grace > 0) grace -= real; else slowT = avg > 1 / 40 ? slowT + real : Math.max(0, slowT - real);
    if (auto && slowT > 4 && lvl > 0) { lvl--; slowT = 0; grace = 3; build(); }
    if (!composer) { renderer.render(scene, camera); return; }
    grade.uniforms.time.value = performance.now() / 1000;
    grade.uniforms.split.value = split; grade.uniforms.flash.value = flash;
    const G = GRADE[stageId] || GRADE.n1;
    bloom.strength = G[4] + bloomBoost;
    { const D = GRADE.dawn, u = grade.uniforms, k = Math.min(1, Math.max(0, dawn)); u.contrast.value = G[0] + (D[0] - G[0]) * k; u.sat.value = G[1] + (D[1] - G[1]) * k; u.tint.value.set(...G[2].map((v, i) => v + (D[2][i] - v) * k)); u.vig.value = G[3] + (D[3] - G[3]) * k; bloom.strength = G[4] + (D[4] - G[4]) * k + bloomBoost; bloom.threshold = G[5] + (D[5] - G[5]) * k; }
    composer.render(dt);
  }
  function setAuto(b) { auto = b; }
  function resize() { if (!composer) return; renderer.getSize(size); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(size.x, size.y); }
  build();
  return { render, resize, setStage, setAuto, get level() { return lvl; }, setLevel(n) { lvl = n; build(); } };
}
