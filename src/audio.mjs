// Synthesized sound with Web Audio: engine hum, rain, horn, hits, coins and ghost chimes.
// Nothing plays until start() is called from a user gesture.
export function createAudio() {
  let ctx = null, master = null, engine = null, engineGain = null, filter = null, rain = null;
  let muted = false;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
    engine = ctx.createOscillator(); engine.type = 'sawtooth'; engine.frequency.value = 42;
    filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 380;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engine.connect(filter).connect(engineGain).connect(master); engine.start();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    rain = { src: ctx.createBufferSource(), gain: ctx.createGain(), hp: ctx.createBiquadFilter() };
    rain.src.buffer = buf; rain.src.loop = true; rain.hp.type = 'highpass'; rain.hp.frequency.value = 1800; rain.gain.gain.value = 0;
    rain.src.connect(rain.hp).connect(rain.gain).connect(master); rain.src.start();
  }

  function tone(freq, dur, type = 'sine', gain = 0.12, when = 0, bend = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  return {
    start,
    get muted() { return muted; },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; },
    update(state, playing) {
      if (!ctx) return;
      const speed = playing ? state.speed : 0;
      engine.frequency.setTargetAtTime(38 + speed * 0.13, ctx.currentTime, 0.1);
      filter.frequency.setTargetAtTime(300 + speed * 1.4, ctx.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(playing ? 0.06 : 0, ctx.currentTime, 0.2);
      rain.gain.gain.setTargetAtTime(playing && state.route.rain ? 0.05 : 0, ctx.currentTime, 0.5);
    },
    horn() { tone(415, 0.32, 'square', 0.07); tone(523, 0.32, 'square', 0.06); },
    hit() { tone(90, 0.35, 'triangle', 0.25, 0, 0.5); tone(160, 0.12, 'square', 0.08); },
    coin() { [880, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, i * 0.07)); },
    ghost() { tone(660, 1.2, 'sine', 0.07, 0, 0.98); tone(990, 1.0, 'sine', 0.04, 0.15, 1.01); },
    miss() { tone(330, 0.5, 'sine', 0.08, 0, 0.7); },
    checkpoint(ok) { tone(ok ? 740 : 220, 0.25, 'square', 0.05); },
    ending() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 1.6, 'sine', 0.06, i * 0.35)); },
  };
}
