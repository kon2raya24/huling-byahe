// Synthesized sound with Web Audio: engine hum, rain, splashes, horn, hits, coins, ghost chimes and a
// quiet late-night loop. Nothing plays until start() is called from a user gesture.
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
// Am · F · C · G, one bar each (MIDI roots and chord tones)
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const ARP = [0, 1, 2, 1, 3, 2, 1, 2];
const STEP = 60 / 84 / 2; // eighth notes at 84 bpm

export function createAudio() {
  let ctx = null, master = null, engine = null, engineGain = null, filter = null, rain = null, water = null, music = null, noise = null;
  let muted = false, playing = false, gassing = false, step = 0, nextAt = 0;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
    engine = ctx.createOscillator(); engine.type = 'sawtooth'; engine.frequency.value = 42;
    filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 380;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engine.connect(filter).connect(engineGain).connect(master); engine.start();
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (type, freq) => {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gain = ctx.createGain();
      src.buffer = noise; src.loop = true; f.type = type; f.frequency.value = freq; gain.gain.value = 0;
      src.connect(f).connect(gain).connect(master); src.start();
      return { gain };
    };
    rain = loop('highpass', 1800);
    water = loop('lowpass', 900);
    music = ctx.createGain(); music.gain.value = 0.55; music.connect(master);
    nextAt = ctx.currentTime + 0.1;
    setInterval(schedule, 90);
  }

  function tone(freq, dur, type = 'sine', gain = 0.12, when = 0, bend = 0, out = master) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }

  function burst(dur, freq, gain, when = ctx.currentTime, type = 'bandpass', out = master) {
    if (!ctx || muted) return;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(out); src.start(when, Math.random()); src.stop(when + dur + 0.05);
    return f;
  }

  // the music loop: pad and bass per bar, a plucked arpeggio, and a shaker while you drive
  function schedule() {
    if (!ctx || muted) { if (ctx) nextAt = ctx.currentTime + 0.1; return; }
    while (nextAt < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % CHORDS.length, beat = step % 8, chord = CHORDS[bar];
      const rel = Math.max(0, nextAt - ctx.currentTime);
      if (beat === 0) {
        for (const n of chord) tone(NOTE(n - 12), STEP * 8, 'triangle', 0.022, rel, 0, music);
        tone(NOTE(chord[0] - 24), STEP * 3, 'sine', 0.07, rel, 0, music);
      }
      if (beat === 4) tone(NOTE(chord[0] - 24), STEP * 3, 'sine', 0.05, rel, 0, music);
      const a = ARP[beat], n = a === 3 ? chord[0] + 12 : chord[a];
      tone(NOTE(n + 12), 0.5, 'sine', beat % 2 ? 0.018 : 0.028, rel, 0, music);
      if (playing) burst(0.05, 7000, beat % 2 ? (gassing ? 0.05 : 0.025) : 0.012, nextAt, 'highpass', music);
      if (playing && gassing && beat % 4 === 0) burst(0.12, 120, 0.12, nextAt, 'lowpass', music);
      nextAt += STEP; step++;
    }
  }

  return {
    start,
    get muted() { return muted; },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; },
    update(state, isPlaying) {
      playing = isPlaying; gassing = isPlaying && state.gassing;
      if (!ctx) return;
      const speed = isPlaying ? state.speed : 0;
      engine.frequency.setTargetAtTime(38 + speed * 0.13, ctx.currentTime, 0.1);
      filter.frequency.setTargetAtTime(300 + speed * (gassing ? 2.2 : 1.4), ctx.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(isPlaying ? (gassing ? 0.085 : 0.06) : 0, ctx.currentTime, 0.2);
      rain.gain.gain.setTargetAtTime(isPlaying && state.route.rain ? 0.05 : 0, ctx.currentTime, 0.5);
      water.gain.gain.setTargetAtTime(isPlaying && state.inFlood && speed > 20 ? 0.18 : 0, ctx.currentTime, 0.08);
    },
    horn() { tone(415, 0.32, 'square', 0.07); tone(523, 0.32, 'square', 0.06); tone(415, 0.2, 'square', 0.06, 0.38); tone(523, 0.2, 'square', 0.05, 0.38); },
    hit() { tone(90, 0.35, 'triangle', 0.25, 0, 0.5); tone(160, 0.12, 'square', 0.08); if (ctx) burst(0.3, 400, 0.4); },
    coin() { [880, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, i * 0.07)); },
    barya(value) { tone(1320 + value * 90, 0.09, 'square', 0.035); tone(1980 + value * 120, 0.12, 'sine', 0.04, 0.04); },
    nearmiss(combo) {
      if (!ctx) return;
      const f = burst(0.35, 600, 0.22);
      if (f) f.frequency.exponentialRampToValueAtTime(3500, ctx.currentTime + 0.3);
      tone(NOTE(69 + Math.min(12, combo * 2)), 0.25, 'triangle', 0.06, 0.05);
    },
    sakto() { [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.3, 'triangle', 0.07, i * 0.06)); },
    ghost() { tone(660, 1.2, 'sine', 0.07, 0, 0.98); tone(990, 1.0, 'sine', 0.04, 0.15, 1.01); },
    miss() { tone(330, 0.5, 'sine', 0.08, 0, 0.7); },
    checkpoint(ok) { tone(ok ? 740 : 220, 0.25, 'square', 0.05); },
    ending() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 1.6, 'sine', 0.06, i * 0.35)); },
  };
}
