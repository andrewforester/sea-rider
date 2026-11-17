// Above-water sound, synthesised live with Web Audio (no sample files):
// sea wash, surf on the shore, wind, jet ski engine, splashes, bumps, footsteps, gulls and the
// treasure chime. One fixed graph; update() is called every frame with the game state.

export function createAudio() {
  let ac = null, out, st = null;
  const rnd = Math.random;
  const rr = (a, b) => a + (b - a) * rnd();

  function build() {
    ac = new AudioContext({ latencyHint: 'interactive' });
    const sr = ac.sampleRate;
    const N = (C, o, ...to) => { const n = new C(ac, o); for (const d of to) n.connect(d); if (n.start) n.start(); return n; };
    const G = (gain, ...to) => N(GainNode, { gain }, ...to);
    const BQ = (type, frequency, Q, ...to) => N(BiquadFilterNode, { type, frequency, Q }, ...to);
    const lfo = (frequency, depth, to) => N(OscillatorNode, { frequency }, G(depth, to));
    const buf = (secs, f) => { const n = sr * secs | 0, b = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: sr }); f(b.getChannelData(0), n); f(b.getChannelData(1), n); return b; };
    // seamless brown + white noise loops
    const brown = buf(9, (d, n) => { for (let i = 0, b = 0; i < n + 4096; i++) { b = (b + 0.02 * (rnd() * 2 - 1)) / 1.02; if (i < n) d[i] = b * 3.5; else { const k = (i - n) / 4096; d[i - n] = d[i - n] * k + b * 3.5 * (1 - k); } } });
    const white = buf(3, (d, n) => { for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1; });
    const src = (b, rate, ...to) => N(AudioBufferSourceNode, { buffer: b, loop: true, playbackRate: rate }, ...to);

    const lim = N(DynamicsCompressorNode, { threshold: -8, knee: 6, ratio: 12, attack: 0.003, release: 0.25 }, ac.destination);
    out = G(0, lim);
    out.gain.setTargetAtTime(0.8, ac.currentTime, 0.8);
    const amb = G(1, out);

    // sea wash: slow swells of filtered noise
    const sea = G(0.35, amb), seaW = G(0.6, sea);
    src(brown, 0.8, BQ('lowpass', 900, 0.5, seaW)); lfo(0.11, 0.25, seaW.gain); lfo(0.07, 0.18, seaW.gain);
    // close water lapping (brighter, follows speed / swimming)
    const lap = G(0, amb), lapF = BQ('bandpass', 700, 0.7, lap);
    src(white, 1, BQ('lowpass', 2500, 0.5, lapF));
    // surf on the shore: a steady roar plus breaking waves (bursts)
    const surf = G(0, amb);
    src(brown, 1.3, BQ('bandpass', 600, 0.4, surf));
    const brk = G(0, amb), brkF = BQ('lowpass', 1200, 0.6, brk);
    src(white, 0.9, brkF);
    // wind: faint, stronger with speed
    const wind = G(0.02, amb), windF = BQ('bandpass', 900, 0.6, wind);
    src(white, 0.7, windF); lfo(0.13, 300, windF.frequency);

    // jet ski engine: two detuned saws + square sub through a lowpass, plus the jet's water hiss
    // soft engine hum: rounded waveforms through a gentle lowpass (no buzzing saw)
    const eng = G(0, amb), engF = BQ('lowpass', 400, 0.6, eng);
    const o1 = N(OscillatorNode, { type: 'triangle', frequency: 60 }, G(0.5, engF));
    const o2 = N(OscillatorNode, { type: 'triangle', frequency: 60.9 }, G(0.35, engF));
    const o3 = N(OscillatorNode, { type: 'sine', frequency: 30 }, G(0.3, engF));
    // light putter at the firing rate
    const wob = G(0.08, eng.gain); const wobO = N(OscillatorNode, { frequency: 18 }, wob);
    const jet = G(0, amb), jetF = BQ('bandpass', 700, 0.5, jet);
    src(white, 1.1, jetF);

    // one-shot voices
    const shot = (f) => { const t = ac.currentTime; f(t); };
    const noiseHit = (t, dur, f0, f1, vol, q = 0.7) => {
      const s = N(AudioBufferSourceNode, { buffer: white, playbackRate: rr(0.8, 1.2) }); const g = G(0); const f = BQ('lowpass', f0, q);
      s.disconnect(); s.connect(f); f.connect(g); g.connect(out);
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.setTargetAtTime(0, t + 0.02, dur / 4);
      s.stop(t + dur + 0.5);
    };
    const tone = (t, type, f0, f1, dur, vol, att = 0.005, pan = 0) => {
      const o = new OscillatorNode(ac, { type, frequency: f0 }); const g = G(0); const p = N(StereoPannerNode, { pan }, out);
      o.connect(g); g.connect(p);
      o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.setTargetAtTime(0, t + att, dur / 4);
      o.start(t); o.stop(t + dur + 1);
    };
    st = { amb, sea, lap, lapF, surf, brk, brkF, wind, windF, eng, engF, o1, o2, o3, wobO, jet, jetF, noiseHit, tone, shot,
      tBreak: 0, tGull: ac.currentTime + 6, tStep: 0 };
  }

  function start() {
    if (!ac) build();
    if (ac.state === 'suspended' && !document.hidden) ac.resume();
  }
  // the surface soundscape fades out underwater (one-shots like the chime still play)
  function ambient(on) { if (st) st.amb.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.15); }
  document.addEventListener('visibilitychange', () => { if (ac) document.hidden ? ac.suspend() : ac.resume(); });

  // s: { riding, throttle, speed, engDist, shore (0..1), moving (m/s of the listener), walking, swimming, inAir }
  function update(s) {
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime + 0.02, T = (p, v, k = 0.08) => p.setTargetAtTime(v, t, k);
    // engine: louder close, idle when parked, pitch with throttle and speed
    const near = 1 / (1 + s.engDist * s.engDist * 0.02);
    const run = s.engineOn ? 1 : 0;
    const f = 55 + s.speed * 3.2 + s.throttle * 25 + (s.inAir ? 25 : 0);
    T(st.o1.frequency, f); T(st.o2.frequency, f * 1.017); T(st.o3.frequency, f * 0.5); T(st.wobO.frequency, f * 0.5);
    T(st.engF.frequency, 300 + s.throttle * 350 + s.speed * 15);
    T(st.eng.gain, run * near * (0.025 + 0.05 * Math.max(s.throttle, 0) + Math.min(s.speed, 25) * 0.0012));
    T(st.jet.gain, run * near * (s.inAir ? 0.005 : Math.min(s.speed / 20, 1) * 0.05));
    T(st.jetF.frequency, 600 + s.speed * 25);
    // water around the listener
    T(st.lap.gain, s.walking ? 0 : 0.03 + Math.min(s.moving / 15, 1) * 0.12 + (s.swimming ? 0.05 : 0), 0.3);
    T(st.lapF.frequency, 500 + s.moving * 50, 0.3);
    T(st.sea.gain, s.walking ? 0.22 : 0.35, 0.5);
    T(st.surf.gain, s.shore * 0.25, 0.5);
    T(st.wind.gain, 0.015 + Math.min(s.moving / 20, 1) * 0.06 + (s.walking ? 0.02 : 0), 0.4);
    // breaking waves near the shore
    if (s.shore > 0.05 && t > st.tBreak) {
      const d = rr(1.6, 3.2);
      st.brkF.frequency.setValueAtTime(400, t); st.brkF.frequency.linearRampToValueAtTime(rr(1800, 3000), t + 0.4); st.brkF.frequency.setTargetAtTime(500, t + 0.5, d / 3);
      st.brk.gain.setValueAtTime(0.0001, t); st.brk.gain.linearRampToValueAtTime(0.22 * s.shore, t + 0.35); st.brk.gain.setTargetAtTime(0, t + 0.5, d / 3);
      st.tBreak = t + rr(4, 8);
    }
    // gulls when near the island
    if (t > st.tGull) {
      if (s.shore > 0.02 || s.walking) {
        let tt = t; const pan = rr(-0.8, 0.8);
        for (let n = 1 + (rnd() * 3 | 0); n--;) {
          const f0 = rr(1300, 1700);
          st.tone(tt, 'triangle', f0, f0 * 0.65, 0.35, 0.025, 0.02, pan);
          st.tone(tt, 'sine', f0 * 2.01, f0 * 1.3, 0.3, 0.008, 0.02, pan);
          tt += rr(0.25, 0.45);
        }
      }
      st.tGull = t + rr(5, 14);
    }
    // footsteps
    if (s.walking && s.moving > 0.5 && t > st.tStep) {
      st.noiseHit(t, 0.12, s.onSand ? 1800 : 3500, 300, s.onSand ? 0.09 : 0.06);
      st.tStep = t + 1.6 / Math.max(s.moving, 1.6) * 0.9;
    }
  }

  const ok = () => ac && ac.state === 'running';
  function splash(size = 1) {
    if (!ok()) return;
    const t = ac.currentTime;
    st.noiseHit(t, 0.5 + size * 0.4, 3500, 250, 0.25 * size);
    st.noiseHit(t + 0.06, 0.8, 1200, 150, 0.15 * size);
    for (let i = 0; i < 5; i++) { const f = rr(500, 1400); st.tone(t + rr(0.1, 0.6), 'sine', f, f * 1.8, 0.08, 0.03); }
  }
  function bump(k = 1) {
    if (!ok()) return;
    const t = ac.currentTime;
    st.tone(t, 'sine', 90, 45, 0.25, 0.4 * k);
    st.noiseHit(t, 0.2, 900, 150, 0.2 * k);
  }
  // the treasure chime: a bright rising arpeggio with a shimmering tail
  function chime(big = false) {
    if (!ok()) return;
    const t = ac.currentTime;
    const notes = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568] : [783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((f, i) => {
      const tt = t + i * 0.075;
      st.tone(tt, 'sine', f, f, 0.9, 0.12, 0.004, (i - 1.5) * 0.25);
      st.tone(tt, 'triangle', f * 2, f * 2, 0.35, 0.03, 0.004, (i - 1.5) * 0.25);
    });
    for (let i = 0; i < 10; i++) { const f = rr(2500, 5000); st.tone(t + 0.25 + i * 0.045, 'sine', f, f, 0.25, 0.018, 0.002, rr(-0.8, 0.8)); }
  }
  return { start, ambient, update, splash, bump, chime, get state() { return ac ? ac.state : 'none'; } };
}
