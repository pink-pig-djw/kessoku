// 程序化音频：全部声音由 WebAudio 实时合成（乐队编制 BGM / 环境音 / 音效）。全部旋律为原创。
window.AudioSys = (() => {
  let ctx = null, master, bus = {}, reverbIn, comp;
  const vol = { bgm: 0.6, amb: 0.55, se: 0.7 };
  let curTheme = null, themeNode = null;
  const ambNodes = {};
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // 测试用：网址带 mute=1 时完全静音
  const MUTED = /[?&]mute=1/.test(location.search);

  function init() {
    if (ctx) { if (ctx.state === 'suspended' && !MUTED) ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.85;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    if (MUTED) { master.gain.value = 0; ctx.suspend(); }
    for (const k of ['bgm', 'amb', 'se']) { bus[k] = ctx.createGain(); bus[k].gain.value = vol[k]; bus[k].connect(master); }
    const reverb = ctx.createConvolver(); reverb.buffer = impulse(2.4, 2.8);
    reverbIn = ctx.createGain(); reverbIn.gain.value = 1;
    const rvOut = ctx.createGain(); rvOut.gain.value = 0.45;
    reverbIn.connect(reverb); reverb.connect(rvOut); rvOut.connect(bus.bgm);
    distCurve = makeDist(55); crunchCurve = makeDist(14);
  }
  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
  }
  let noiseBuf = null, brownBuf = null, distCurve, crunchCurve;
  // 循环用的噪声：做得长一点，并且把结尾和开头交叉淡化，循环处不会「噗」一下，也听不出重复的纹路
  function seamless(gen, sec, fadeSec) {
    const sr = ctx.sampleRate, len = Math.floor(sr * sec), F = Math.floor(sr * fadeSec);
    const raw = new Float32Array(len + F); gen(raw);
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = raw[i];
    for (let i = 0; i < F; i++) { const k = i / F; d[i] = raw[i] * Math.sqrt(k) + raw[len + i] * Math.sqrt(1 - k); }
    return buf;
  }
  function noise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = seamless(d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }, 9, 0.3);
    return noiseBuf;
  }
  function brown() {
    if (brownBuf) return brownBuf;
    brownBuf = seamless(d => { let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } }, 14, 1.5);
    return brownBuf;
  }
  function noiseSrc(buf) { const s = ctx.createBufferSource(); s.buffer = buf || noise(); s.loop = true; return s; }
  function makeDist(k) {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x)); }
    return c;
  }
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const send = (node, amt) => { if (amt > 0) { const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(reverbIn); } };

  // ================= 鼓 =================
  function kick(t, out, v = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.95 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.36);
    const c = ctx.createBufferSource(); c.buffer = noise(); const hp = filt('highpass', 2500), cg = ctx.createGain();
    cg.gain.setValueAtTime(0.18 * v, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    c.connect(hp); hp.connect(cg); cg.connect(out); c.start(t, Math.random() * 3, 0.03);
  }
  function snare(t, out, v = 1) {
    const s = ctx.createBufferSource(); s.buffer = noise(); const bp = filt('bandpass', 1900, 0.7), hp = filt('highpass', 700), g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    s.connect(bp); bp.connect(hp); hp.connect(g); g.connect(out); s.start(t, Math.random() * 3, 0.25);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    og.gain.setValueAtTime(0.35 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.12);
    send(g, 0.25 * v);
  }
  function hat(t, out, v = 1, open = false) {
    const s = ctx.createBufferSource(); s.buffer = noise(); const hp = filt('highpass', 7600), g = ctx.createGain();
    const d = open ? 0.28 : 0.045;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2 * v, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(hp); hp.connect(g); g.connect(out); s.start(t, Math.random() * 3, d + 0.05);
  }
  function crash(t, out, v = 1) {
    const s = ctx.createBufferSource(); s.buffer = noise(); const hp = filt('highpass', 4200), bp = filt('peaking', 6500, 1), g = ctx.createGain();
    bp.gain.value = 6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.28 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    s.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random() * 2, 1.9);
    send(g, 0.3);
  }
  function tom(t, out, f = 140, v = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.25);
    g.gain.setValueAtTime(0.6 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.32); send(g, 0.2);
  }
  // 16 步鼓型：K 底鼓 / S 军鼓 / H 踩镲（o = 开镲，g = 鬼音）
  const DRUMS = {
    rock8: { K: 'x.......x.x.....', S: '....x.......x...', H: 'x.x.x.x.x.x.x.x.' },
    pop: { K: 'x.....x...x.....', S: '....x.......x...', H: 'x.x.x.x.x.x.x.x.' },
    punk: { K: 'x...x...x...x...', S: '..x...x...x...x.', H: 'x.x.x.x.x.x.x.x.' },
    drive: { K: 'x.x.....x.x.x...', S: '....x.......x...', H: 'xxxxxxxxxxxxxxxx' },
    half: { K: 'x.........x.....', S: '........x.......', H: 'x.x.x.x.x.x.x.x.' },
    ballad: { K: 'x.......x.....x.', S: '....x.......x...', H: 'x...x...x...x...' },
    groove: { K: 'x..x..x...x..x..', S: '....x..g....x.g.', H: 'x.xxx.xxx.xxx.xo' },
    four: { K: 'x...x...x...x...', S: '....x.......x...', H: '..o...o...o...o.' },
    lofi: { K: 'x......x..x.....', S: '....x.......x..g', H: 'x.x.x.x.x.x.x.x.' },
    comic: { K: 'x..x....x.....x.', S: '....x..x...x....', H: 'x.x.x.xx.x.x.x.x' },
    soft: { K: 'x.......x.......', S: '....g.......g...', H: 'x...x...x...x...' }
  };
  function playDrums(name, t, spb, bar, out, vel, fill) {
    const p = DRUMS[name]; if (!p) return;
    const st = spb / 4;
    for (let i = 0; i < 16; i++) {
      const tt = t + i * st;
      if (fill && i >= 12) { snare(tt, out, 0.5 + (i - 12) * 0.12); if (i === 12) tom(tt, out, 180, 0.6); if (i === 14) tom(tt, out, 120, 0.6); continue; }
      if (p.K[i] === 'x') kick(tt, out, vel);
      if (p.S[i] === 'x') snare(tt, out, vel);
      else if (p.S[i] === 'g') snare(tt, out, vel * 0.25);
      if (p.H[i] === 'x') hat(tt, out, vel * (i % 4 === 0 ? 1 : 0.7));
      else if (p.H[i] === 'o') hat(tt, out, vel * 0.8, true);
    }
  }

  // ================= 贝斯 =================
  function bass(t, midi, dur, out, v = 1, tone = 'pick') {
    const f = mtof(midi), o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = filt('lowpass', 900, 1.2), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f;
    const og = ctx.createGain(); og.gain.value = 0.9;
    lp.frequency.setValueAtTime(tone === 'finger' ? 700 : 1400, t); lp.frequency.exponentialRampToValueAtTime(tone === 'finger' ? 260 : 420, t + 0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42 * v, t + 0.006);
    g.gain.setValueAtTime(0.32 * v, t + Math.max(0.02, dur * 0.7)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    o.connect(lp); o2.connect(og); og.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  // ================= 吉他 =================
  // 失真节奏吉他（强力和弦），左右各一把
  function power(t, root, dur, out, v = 1, mute = false, pan = 0) {
    const pre = ctx.createGain(); pre.gain.value = mute ? 3 : 5;
    const ws = ctx.createWaveShaper(); ws.curve = distCurve; ws.oversample = '2x';
    const hp = filt('highpass', 110), lp = filt('lowpass', mute ? 1300 : 3400, 0.8), pk = filt('peaking', 750, 1.2); pk.gain.value = -5;
    const g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = pan;
    [root, root + 7, root + 12].forEach((m, i) => [-7, 7].forEach(dt => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt;
      const og = ctx.createGain(); og.gain.value = i === 2 ? 0.1 : 0.16; o.connect(og); og.connect(pre); o.start(t); o.stop(t + dur + 0.12);
    }));
    pre.connect(ws); ws.connect(hp); hp.connect(pk); pk.connect(lp); lp.connect(g); g.connect(p); p.connect(out);
    const d = mute ? Math.min(dur, 0.12) : dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * v, t + 0.004);
    g.gain.setValueAtTime(0.13 * v, t + d * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08);
  }
  // Karplus-Strong 拨弦（清音吉他）
  const ksCache = {};
  function ksBuf(midi) {
    if (ksCache[midi]) return ksCache[midi];
    const sr = ctx.sampleRate, f = mtof(midi), N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * 2.2);
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; prev = prev * 0.5 + w * 0.5; d[i] = prev; }
    const damp = 0.4985 + Math.min(0.0012, f / 400000);
    for (let i = N; i < len; i++) d[i] = damp * (d[i - N] + d[i - N + 1]);
    return (ksCache[midi] = buf);
  }
  function pluck(t, midi, dur, out, v = 1, pan = 0, wet = 0.25) {
    const s = ctx.createBufferSource(); s.buffer = ksBuf(midi);
    const lp = filt('lowpass', 4200), g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = pan;
    g.gain.setValueAtTime(0.5 * v, t); g.gain.setValueAtTime(0.5 * v, t + Math.max(0.05, dur)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    s.connect(lp); lp.connect(g); g.connect(p); p.connect(out); s.start(t); s.stop(t + dur + 0.7);
    send(g, wet);
  }
  // 失真主音吉他（带揉弦）
  function lead(t, midi, dur, out, v = 1, wet = 0.35) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = mtof(midi); o2.frequency.value = mtof(midi); o2.detune.value = 5;
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.6;
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(dur > 0.4 ? 22 : 0, t + Math.min(dur, 0.35) + 0.15);
    vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
    const pre = ctx.createGain(); pre.gain.value = 3.5; const ws = ctx.createWaveShaper(); ws.curve = crunchCurve;
    const lp = filt('lowpass', 3800, 1), hp = filt('highpass', 220), g = ctx.createGain();
    const og2 = ctx.createGain(); og2.gain.value = 0.5;
    o.connect(pre); o2.connect(og2); og2.connect(pre); pre.connect(ws); ws.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1 * v, t + 0.012);
    g.gain.setValueAtTime(0.085 * v, t + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    [o, o2, vib].forEach(x => { x.start(t); x.stop(t + dur + 0.2); });
    send(g, wet);
  }
  // 明亮的合成拨奏（喜多）
  function synthPluck(t, midi, dur, out, v = 1, wet = 0.35) {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(midi);
    const lp = filt('lowpass', 5000, 3), g = ctx.createGain();
    lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.25, dur));
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.3); send(g, wet);
  }
  function piano(t, midi, dur, vel, out, wet = 0.4) {
    const f = mtof(midi), g = ctx.createGain(), lp = filt('lowpass', Math.min(9000, f * 6 + 800), 0.3);
    [[1, 1], [2, 0.42], [3, 0.16], [4, 0.08], [5.02, 0.035]].forEach(([m, a]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.value = f * m; o.detune.value = (Math.random() - 0.5) * 6;
      og.gain.value = a; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 2.2);
    });
    const peak = vel * 0.36;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.35);
    g.gain.exponentialRampToValueAtTime(peak * 0.12, t + Math.max(0.5, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 2.0);
    lp.connect(g); g.connect(out); send(g, wet);
  }
  function bell(t, midi, dur, vel, out, wet = 0.6) {
    const f = mtof(midi), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.5);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.2, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 2.4);
    g.connect(out); car.start(t); mod.start(t); car.stop(t + dur + 2.6); mod.stop(t + dur + 2.6);
    send(g, wet);
  }
  function pad(t, midis, dur, vel, out) {
    const g = ctx.createGain(), lp = filt('lowpass', 1500, 0.5);
    midis.forEach(m => [-8, 8].forEach(dt => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt;
      o.connect(lp); o.start(t); o.stop(t + dur + 2.5);
    }));
    const peak = vel * 0.026;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(1.4, dur * 0.4));
    g.gain.setValueAtTime(peak, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 2);
    lp.connect(g); g.connect(out); send(g, 0.8);
  }

  // ================= 乐曲（全部原创） =================
  // chords：每小节 [根音, 和弦音...]；mel：[拍, midi, 时值]
  const C = (...n) => n;
  const D_PROG_A = [C(38, 62, 66, 69), C(37, 61, 64, 69), C(35, 62, 66, 71), C(31, 62, 67, 71), C(38, 62, 66, 69), C(33, 61, 64, 69), C(31, 62, 67, 71), C(33, 61, 64, 69)];
  const D_PROG_B = [C(40, 64, 67, 71), C(31, 62, 67, 71), C(38, 62, 66, 69), C(33, 61, 64, 69), C(40, 64, 67, 71), C(31, 62, 67, 71), C(33, 61, 64, 69), C(33, 61, 64, 69)];
  const MAIN_MEL = [
    [0, 74, 1], [1, 73, .5], [1.5, 71, .5], [2, 69, 1.5], [3.5, 66, .5], [4, 69, .5], [4.5, 71, .5], [5, 73, 1], [6, 76, 2],
    [8, 74, 1], [9, 73, .5], [9.5, 71, .5], [10, 71, 1], [11, 69, 1], [12, 67, .5], [12.5, 69, .5], [13, 71, 1], [14, 69, 2],
    [16, 74, 1], [17, 76, .5], [17.5, 78, .5], [18, 78, 1.5], [19.5, 76, .5], [20, 76, 1], [21, 73, 1], [22, 69, 1], [23, 71, 1],
    [24, 71, 1], [25, 74, 1], [26, 79, 1.5], [27.5, 78, .5], [28, 76, 3], [31, 69, .5], [31.5, 71, .5],
    [32, 71, 1.5], [33.5, 74, .5], [34, 76, 1], [35, 74, 1], [36, 79, 1], [37, 78, .5], [37.5, 76, .5], [38, 74, 2],
    [40, 74, .5], [40.5, 76, .5], [41, 78, 1], [42, 81, 1.5], [43.5, 78, .5], [44, 76, 2], [46, 73, 1], [47, 76, 1],
    [48, 79, 1.5], [49.5, 78, .5], [50, 76, 1], [51, 74, 1], [52, 74, 1], [53, 76, 1], [54, 79, 1], [55, 81, 1],
    [56, 81, 2], [58, 78, 1], [59, 76, 1], [60, 78, 3.5]];
  const THEMES = {
    // 主题曲「第五条音轨」
    title: { bpm: 168, chords: [...D_PROG_A, ...D_PROG_B], drums: 'rock8', bassPat: 'eighth', gtr: 'power8', melInst: 'lead', mel: MAIN_MEL, intro: 2 },
    // 结局：主题曲的木吉他版
    ending: { bpm: 80, chords: [...D_PROG_A, ...D_PROG_B], drums: 'none', bassPat: 'whole', gtr: 'arp', keys: 'sparse', melInst: 'piano', mel: MAIN_MEL, pad: true },
    // STARRY 的日常
    starry: { bpm: 126, drums: 'pop', bassPat: 'pop', gtr: 'arp', melInst: 'bell', vel: 0.75,
      chords: [C(43, 67, 71, 74), C(42, 66, 69, 74), C(40, 64, 67, 71), C(36, 64, 67, 72), C(43, 67, 71, 74), C(38, 66, 69, 74), C(36, 64, 67, 72), C(38, 66, 69, 72)],
      mel: [[0, 79, .5], [.5, 81, .5], [1, 83, 1], [2, 81, .5], [2.5, 79, .5], [3, 78, 1], [4, 79, 1.5], [5.5, 76, .5], [6, 74, 2],
        [8, 76, .5], [8.5, 78, .5], [9, 79, 1], [10, 83, 1], [11, 81, 1], [12, 79, 1], [13, 76, 1], [14, 72, 2],
        [16, 74, .5], [16.5, 79, .5], [17, 83, 1.5], [18.5, 81, .5], [19, 79, 1], [20, 78, 1], [21, 81, 1], [22, 86, 2],
        [24, 84, 1], [25, 83, .5], [25.5, 81, .5], [26, 79, 1], [27, 76, 1], [28, 78, 3]] },
    // 学校
    school: { bpm: 108, drums: 'soft', bassPat: 'quarter', keys: 'bounce', melInst: 'bell', vel: 0.65,
      chords: [C(41, 65, 69, 72), C(38, 65, 69, 74), C(34, 65, 70, 74), C(36, 64, 67, 72), C(41, 65, 69, 72), C(45, 64, 69, 72), C(34, 62, 65, 70), C(36, 64, 67, 70)],
      mel: [[0, 77, .5], [.5, 79, .5], [1, 81, 1], [2, 84, 1], [3, 81, 1], [4, 79, 1.5], [5.5, 77, .5], [6, 74, 2],
        [8, 74, .5], [8.5, 77, .5], [9, 82, 1], [10, 81, .5], [10.5, 79, .5], [11, 77, 1], [12, 79, 3],
        [16, 77, .5], [16.5, 79, .5], [17, 81, 1], [18, 84, 1.5], [19.5, 86, .5], [20, 84, 1], [21, 81, 1], [22, 77, 2],
        [24, 74, 1], [25, 77, 1], [26, 81, .5], [26.5, 79, .5], [27, 77, 1], [28, 79, 3]] },
    // 一里的慌乱
    bocchi: { bpm: 138, drums: 'comic', bassPat: 'stab', keys: 'stab', melInst: 'pluck', vel: 0.7,
      chords: [C(40, 64, 67, 71), C(40, 64, 67, 70), C(41, 65, 68, 72), C(39, 63, 66, 70), C(40, 64, 67, 71), C(46, 64, 70, 73), C(45, 64, 69, 72), C(47, 63, 66, 71)],
      mel: [[0, 76, .25], [.5, 75, .25], [1, 76, .25], [1.5, 79, .5], [2.5, 78, .25], [3, 77, .25], [3.5, 76, .5],
        [4, 76, .25], [4.5, 75, .25], [5, 74, .25], [5.5, 73, .5], [6.5, 70, .25], [7, 71, .75],
        [8, 77, .25], [8.5, 80, .25], [9, 77, .25], [9.5, 72, .5], [10.5, 75, .25], [11, 78, .25], [11.5, 75, .5],
        [12, 76, .25], [12.5, 79, .25], [13, 83, .5], [14, 82, .25], [14.5, 81, .25], [15, 80, .25], [15.5, 79, .25],
        [16, 76, .25], [16.5, 75, .25], [17, 76, .25], [17.5, 79, .5], [18.5, 78, .25], [19, 77, .25], [19.5, 76, .5],
        [20, 82, .5], [21, 81, .5], [22, 79, .5], [23, 76, .5], [24, 76, .5], [25, 72, .5], [26, 69, 1],
        [28, 71, .25], [28.5, 75, .25], [29, 78, .25], [29.5, 83, 1.5]] },
    // 虹夏
    nijika: { bpm: 152, drums: 'punk', bassPat: 'eighth', gtr: 'power8', melInst: 'synth', vel: 0.85,
      chords: [C(45, 69, 73, 76), C(40, 68, 71, 76), C(42, 69, 73, 78), C(38, 69, 74, 78), C(45, 69, 73, 76), C(40, 68, 71, 76), C(38, 69, 74, 78), C(40, 68, 71, 76)],
      mel: [[0, 81, 1], [1, 80, .5], [1.5, 81, .5], [2, 85, 1], [3, 83, 1], [4, 81, .5], [4.5, 80, .5], [5, 76, 1], [6, 76, 2],
        [8, 78, .5], [8.5, 81, .5], [9, 85, 1], [10, 88, 1.5], [11.5, 86, .5], [12, 85, 1], [13, 83, 1], [14, 81, 2],
        [16, 81, 1], [17, 83, .5], [17.5, 85, .5], [18, 88, 1], [19, 85, 1], [20, 83, .5], [20.5, 81, .5], [21, 80, 1], [22, 76, 2],
        [24, 78, 1], [25, 81, 1], [26, 83, 1], [27, 85, 1], [28, 83, 2], [30, 80, 2]] },
    // 凉：贝斯主导的律动
    ryo: { bpm: 96, drums: 'groove', bassPat: 'riff', gtr: 'mute', keys: 'none', melInst: 'none', vel: 0.8,
      chords: [C(38, 65, 69, 72), C(38, 65, 69, 72), C(43, 65, 69, 71), C(43, 65, 69, 71), C(38, 65, 69, 72), C(38, 65, 69, 72), C(46, 65, 69, 74), C(45, 64, 67, 73)],
      riff: [[0, 38, .75], [.75, 38, .25], [1, 50, .5], [1.5, 48, .5], [2, 45, .5], [2.75, 48, .25], [3, 50, .5], [3.5, 41, .5]],
      riff2: [[0, 46, .75], [.75, 46, .25], [1, 58, .5], [1.5, 57, .5], [2, 45, .75], [2.75, 52, .25], [3, 55, .5], [3.5, 49, .5]],
      mel: [] },
    // 喜多：闪闪发光
    kita: { bpm: 122, drums: 'four', bassPat: 'octave', keys: 'synth', melInst: 'bell', vel: 0.75,
      chords: [C(36, 64, 67, 72), C(43, 62, 67, 71), C(45, 64, 69, 72), C(41, 65, 69, 72), C(36, 64, 67, 72), C(43, 62, 67, 71), C(41, 65, 69, 72), C(43, 65, 67, 71)],
      mel: [[0, 84, .5], [.5, 83, .5], [1, 84, .5], [1.5, 88, 1], [2.5, 86, .5], [3, 84, 1], [4, 83, 1.5], [5.5, 79, .5], [6, 79, 2],
        [8, 81, .5], [8.5, 83, .5], [9, 84, 1], [10, 88, 1], [11, 91, 1], [12, 89, 1.5], [13.5, 88, .5], [14, 84, 2],
        [16, 84, .5], [16.5, 83, .5], [17, 84, .5], [17.5, 88, 1], [18.5, 91, .5], [19, 88, 1], [20, 86, 1.5], [21.5, 83, .5], [22, 79, 2],
        [24, 81, 1], [25, 84, 1], [26, 89, 1], [27, 88, 1], [28, 86, 2], [30, 83, 2]] },
    // 夜
    night: { bpm: 74, drums: 'lofi', bassPat: 'whole', keys: 'maj7', melInst: 'piano', vel: 0.6, swing: 0.12,
      chords: [C(41, 64, 69, 72, 76), C(40, 62, 67, 71, 74), C(38, 60, 65, 69, 72), C(43, 62, 65, 69, 71), C(41, 64, 69, 72, 76), C(40, 62, 67, 71, 74), C(38, 60, 65, 69, 72), C(43, 62, 65, 67, 71)],
      mel: [[0, 76, 1.5], [2, 74, .5], [2.5, 72, 1.5], [4, 71, 2], [6.5, 72, .5], [7, 74, 1], [8, 72, 2.5], [11, 69, 1], [12, 67, 3],
        [16, 76, 1], [17, 79, 1.5], [18.5, 77, .5], [19, 76, 1], [20, 74, 3], [24, 72, 1], [25, 74, 1], [26, 76, 1.5], [28, 74, 3]] },
    // 悲伤
    sad: { bpm: 60, drums: 'none', bassPat: 'none', keys: 'sparse', melInst: 'piano', pad: true, vel: 0.8,
      chords: [C(45, 57, 60, 64), C(41, 57, 60, 65), C(36, 55, 60, 64), C(43, 55, 59, 62), C(45, 57, 60, 64), C(41, 57, 60, 65), C(40, 56, 59, 64), C(40, 56, 59, 64)],
      mel: [[0, 76, 2], [2, 72, 1], [3, 71, 1], [4, 69, 3.5], [8, 67, 1], [9, 69, 1], [10, 72, 2], [12, 71, 3.5],
        [16, 76, 2], [18, 81, 1], [19, 79, 1], [20, 77, 2], [22, 76, 1], [23, 74, 1], [24, 76, 1.5], [25.5, 74, .5], [26, 71, 2], [28, 68, 2], [30, 69, 2]] },
    // 不安
    tension: { bpm: 70, drums: 'none', bassPat: 'pulse', keys: 'none', melInst: 'piano', pad: true, vel: 0.7,
      chords: [C(38, 53, 57, 62), C(34, 53, 58, 62), C(43, 55, 58, 62), C(33, 52, 57, 61)],
      mel: [[2, 74, 2], [6, 77, 2], [10, 79, 1], [11, 77, 1], [14, 73, 2]] },
    // 温暖（后藤家 / 爸爸）
    home: { bpm: 70, drums: 'none', bassPat: 'whole', gtr: 'arp', keys: 'none', melInst: 'piano', vel: 0.72,
      chords: [C(41, 57, 60, 65), C(40, 55, 60, 64), C(38, 57, 62, 65), C(36, 55, 60, 64), C(46, 58, 62, 65), C(45, 57, 60, 65), C(43, 58, 62, 67), C(36, 55, 60, 64)],
      mel: [[0, 72, 1.5], [1.5, 77, .5], [2, 76, 2], [4, 74, 1], [5, 72, 1], [6, 67, 2], [8, 69, 1.5], [9.5, 74, .5], [10, 72, 2], [12, 72, 3],
        [16, 74, 1.5], [17.5, 77, .5], [18, 77, 2], [20, 76, 1], [21, 72, 1], [22, 69, 2], [24, 70, 1.5], [25.5, 69, .5], [26, 67, 2], [28, 72, 3.5]] },
    // 回忆（八音盒）
    memory: { bpm: 64, drums: 'none', bassPat: 'none', keys: 'box', melInst: 'bell', vel: 0.75,
      chords: [C(48, 60, 64, 67), C(52, 59, 64, 67), C(53, 60, 65, 69), C(53, 60, 65, 68)],
      mel: [[0, 79, 1], [1, 76, 1], [2, 84, 2], [4, 83, 1], [5, 79, 1], [6, 76, 2], [8, 81, 1], [9, 84, 1], [10, 77, 2], [12, 80, 1.5], [13.5, 79, .5], [14, 79, 2]] },
    // Live 用的乐曲（E 小调，快速）
    live: { bpm: 172, drums: 'drive', bassPat: 'eighth', gtr: 'power8', melInst: 'lead', vel: 0.9, intro: 1,
      chords: [C(40, 64, 67, 71), C(36, 64, 67, 72), C(43, 62, 67, 71), C(38, 62, 66, 69), C(40, 64, 67, 71), C(36, 64, 67, 72), C(45, 64, 69, 72), C(47, 63, 66, 71)],
      mel: [[0, 76, .5], [.5, 79, .5], [1, 83, 1], [2, 81, .5], [2.5, 79, .5], [3, 81, 1], [4, 79, 2], [6, 76, 1], [7, 74, 1],
        [8, 74, .5], [8.5, 76, .5], [9, 79, 1], [10, 83, 1.5], [11.5, 81, .5], [12, 78, 3], [15, 74, 1],
        [16, 76, .5], [16.5, 79, .5], [17, 83, 1], [18, 86, 1], [19, 84, 1], [20, 83, 2], [22, 79, 1], [23, 76, 1],
        [24, 81, 1], [25, 79, 1], [26, 76, 1], [27, 72, 1], [28, 75, 3], [31, 71, 1]] },
    // 新歌（终章的高潮）
    newsong: { bpm: 150, drums: 'rock8', bassPat: 'eighth', gtr: 'power8', melInst: 'lead', vel: 0.95, build: true,
      chords: [C(35, 63, 66, 71), C(40, 64, 68, 71), C(44, 63, 68, 71), C(40, 64, 68, 71), C(35, 63, 66, 71), C(42, 61, 66, 70), C(40, 64, 68, 71), C(42, 61, 66, 70),
        C(44, 63, 68, 71), C(40, 64, 68, 71), C(35, 63, 66, 71), C(42, 61, 66, 70), C(44, 63, 68, 71), C(40, 64, 68, 71), C(42, 61, 66, 70), C(42, 61, 66, 70)],
      mel: [[0, 75, 1.5], [1.5, 78, .5], [2, 78, 1], [3, 76, 1], [4, 75, 1], [5, 73, .5], [5.5, 71, .5], [6, 73, 2],
        [8, 71, 1], [9, 75, 1], [10, 80, 1.5], [11.5, 78, .5], [12, 76, 1], [13, 75, 1], [14, 73, 2],
        [16, 75, 1.5], [17.5, 78, .5], [18, 83, 1], [19, 82, 1], [20, 80, 1], [21, 78, .5], [21.5, 75, .5], [22, 78, 2],
        [24, 76, 1], [25, 75, 1], [26, 73, 1], [27, 71, 1], [28, 73, 3], [31, 78, .5], [31.5, 80, .5],
        [32, 83, 2], [34, 82, 1], [35, 80, 1], [36, 80, 1.5], [37.5, 78, .5], [38, 76, 2], [40, 75, 1], [41, 78, 1], [42, 83, 1], [43, 87, 1],
        [44, 85, 3], [47, 82, 1], [48, 83, 2], [50, 82, 1], [51, 80, 1], [52, 80, 1], [53, 82, 1], [54, 83, 1], [55, 85, 1],
        [56, 87, 2], [58, 85, 1], [59, 82, 1], [60, 83, 3.5]] }
  };
  THEMES.hitori = Object.assign({}, THEMES.home, { bpm: 66, gtr: 'arp', melInst: 'pluck' });
  THEMES.guitar_kodoku = THEMES.live; // 第一次 live 的曲子（mp3 读不到时用 live 代替）
  const TITLES = { title: '第五条音轨 —— 主题曲', starry: '地下一层的星空', school: '秀华高中，午休', bocchi: '后藤一里，正在宕机', hitori: '壁橱里的宇宙 —— 一里的主题', nijika: '鼓手座的天使', ryo: '低音的独白', kita: '闪闪发光的你', night: '下北泽，零点', home: '有人在等的家',
    memory: '磁带的A面', tension: '不安', sad: '没人看见的地方', live: 'LIVE —— 地下室的四个人', newsong: '新歌', guitar_kodoku: 'ギターと孤独と蒼い惑星（Off Vocal 耳コピ / satsukiongaku）', ending: '第五条音轨（acoustic）' };

  // ================= mp3 BGM（Suno 生成，assets/bgm/名字.mp3）；读不到时退回合成版 =================
  const BGM_FILES = ['title', 'starry', 'school', 'bocchi', 'hitori', 'nijika', 'ryo', 'kita', 'night', 'home', 'memory', 'tension', 'sad', 'live', 'newsong', 'ending', 'guitar_kodoku'];
  let curAudio = null, muffled = false;
  const BGM_GAIN = 0.85;
  function audioTarget() { return MUTED ? 0 : vol.bgm * BGM_GAIN * (muffled ? 0.35 : 1); }
  // 按真实时间推进（窗口在后台、计时器被降频时也会按时结束，不会拖成几十秒的交叠）
  function fadeAudio(a, to, sec, done) {
    clearInterval(a._fade);
    const from = a.volume, t0 = performance.now(), dur = Math.max(0.01, sec) * 1000;
    a._fadeEnd = t0 + dur;
    const step = () => { const k = Math.min(1, (performance.now() - t0) / dur); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k >= 1) { clearInterval(a._fade); a._fade = null; done && done(); } };
    a._fade = setInterval(step, 1000 / 30);
  }
  const dying = new Set(); // 正在淡出的旧曲
  function killAudio(a, sec) {
    dying.add(a);
    fadeAudio(a, 0, Math.max(0.05, sec), () => { dying.delete(a); a.pause(); a.removeAttribute('src'); a.load(); });
  }
  // 换曲：旧曲先快速淡出（最多 0.8 秒），新曲等旧曲基本听不见了再淡入，两首不会同时以可闻的音量叠在一起
  function playTheme(name, fade = 1.5) {
    init();
    if (curTheme === name) return;
    const out = Math.min(fade, 0.8);
    stopTheme(out);
    dying.forEach(d => { if (d._fadeEnd - performance.now() > out * 1000) killAudio(d, out); });
    if (!name || !THEMES[name]) { curTheme = null; return; }
    if (!BGM_FILES.includes(name) || MUTED) { playSynth(name, fade); return; }
    curTheme = name;
    const a = new Audio('assets/bgm/' + name + '.mp3');
    a.loop = true; a.volume = 0; a.preload = 'auto';
    curAudio = a;
    const fallback = () => { if (curAudio === a && curTheme === name) { curAudio = null; curTheme = null; playSynth(name, fade); } };
    a.onerror = fallback;
    const wait = dying.size ? out * 0.7 * 1000 : 0, t0 = performance.now();
    a.play().then(() => {
      setTimeout(() => { if (curAudio === a) fadeAudio(a, audioTarget(), Math.max(0.05, fade)); }, Math.max(0, wait - (performance.now() - t0)));
    }).catch(fallback);
  }
  function playSynth(name, fade = 1.5) {
    curTheme = name;
    const th = THEMES[name], out = ctx.createGain(), mix = ctx.createGain();
    mix.gain.value = 0.9;
    out.gain.setValueAtTime(0.0001, ctx.currentTime); out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + fade);
    out.connect(mix); mix.connect(bus.bgm);
    const node = { out, th, beat: 0, next: ctx.currentTime + 0.12, alive: true };
    themeNode = node;
    const spb = 60 / th.bpm, bpb = 4, bars = th.chords.length, total = bars * bpb, vel = th.vel || 0.85;
    const tick = () => {
      if (!node.alive) return;
      while (node.next < ctx.currentTime + 0.5) {
        const b = node.beat % total, bar = Math.floor(b / bpb), inBar = b % bpb, t = node.next;
        const loop = Math.floor(node.beat / total);
        const ch = th.chords[bar], root = ch[0], tones = ch.slice(1);
        // 编曲变化：intro 小节只有吉他；build 型第一轮只有清音
        const introBars = th.intro || 0, gbar = Math.floor(node.beat / bpb);
        const inIntro = gbar < introBars;
        const soft = th.build && loop === 0;
        const melOn = !inIntro && !(loop % 4 === 3 && th.melInst !== 'none' && !th.build);
        if (inBar === 0) {
          if (th.drums && th.drums !== 'none' && !inIntro && !soft) {
            const fill = (bar % 8 === 7);
            playDrums(th.drums, t, spb * 4 / 4 * 4 / 4, bar, out, vel * 0.9, fill && !inIntro);
            if (bar % 8 === 0) crash(t, out, vel);
          } else if (soft && th.drums !== 'none') { // build：只有踩镲
            for (let i = 0; i < 4; i++) hat(t + i * spb, out, 0.5);
            if (bar === bars - 1) for (let i = 8; i < 16; i++) snare(t + i * spb / 4, out, 0.3 + i * 0.04);
          }
          if (th.pad) pad(t, tones, spb * bpb, vel, out);
        }
        // 贝斯
        if (!inIntro) {
          const bp = th.bassPat;
          const bv = vel * (soft ? 0.6 : 1);
          if (bp === 'eighth') { for (let i = 0; i < 2; i++) bass(t + i * spb / 2, root, spb / 2 * 0.9, out, bv); }
          else if (bp === 'quarter') bass(t, root + (inBar === 2 ? 7 : 0), spb * 0.9, out, bv, 'finger');
          else if (bp === 'pop') { bass(t, root, spb * 0.45, out, bv); bass(t + spb / 2, inBar % 2 ? root + 12 : root, spb * 0.4, out, bv * 0.8); }
          else if (bp === 'octave') { bass(t, root, spb * 0.45, out, bv); bass(t + spb / 2, root + 12, spb * 0.4, out, bv * 0.85); }
          else if (bp === 'whole' && inBar === 0) bass(t, root, spb * 3.8, out, bv * 0.8, 'finger');
          else if (bp === 'stab' && (inBar === 0 || inBar === 2)) bass(t, root, spb * 0.3, out, bv);
          else if (bp === 'pulse') bass(t, root, spb * 0.5, out, bv * 0.7, 'finger');
          else if (bp === 'riff') {
            const r = (bar % 8 >= 6 ? th.riff2 : th.riff) || [];
            r.forEach(([p, m, d]) => { if (p >= inBar && p < inBar + 1) bass(t + (p - inBar) * spb, m, d * spb, out, bv * 1.15, 'finger'); });
          }
        }
        // 吉他
        const g = th.gtr;
        if (g === 'power8' && !soft) {
          for (let i = 0; i < 2; i++) {
            const tt = t + i * spb / 2;
            power(tt, root + 12 < 40 ? root + 24 : root + 12, spb / 2 * 0.95, out, vel, false, -0.45);
            power(tt, root + 12 < 40 ? root + 24 : root + 12, spb / 2 * 0.95, out, vel * 0.9, false, 0.45);
          }
        } else if (g === 'mute' && (inBar === 1 || inBar === 3)) {
          power(t + spb / 2, root + 24, spb * 0.4, out, vel * 0.6, true, 0.3);
        }
        if (g === 'arp' || soft) {
          const seq = [tones[0] - 12, tones[1] - 12, tones[2] - 12, tones[1], tones[0], tones[2] - 12, tones[1] - 12, tones[0]];
          for (let i = 0; i < 2; i++) pluck(t + i * spb / 2, seq[(inBar * 2 + i) % seq.length], spb * 1.4, out, vel * 0.8, (i ? 0.3 : -0.3));
        }
        // 键盘
        const k = th.keys;
        if (k === 'bounce') { piano(t + spb / 2, tones[1], spb * 0.35, 0.24 * vel, out, 0.2); piano(t + spb / 2, tones[2], spb * 0.35, 0.2 * vel, out, 0.2); if (inBar === 0) piano(t, root + 12, spb * 2, 0.4 * vel, out, 0.3); }
        else if (k === 'sparse' && (inBar === 0 || inBar === 2)) { piano(t, inBar ? tones[1] : root + 12, spb * 2, 0.3 * vel, out, 0.6); piano(t + spb / 2, tones[inBar ? 2 : 0], spb * 2, 0.22 * vel, out, 0.6); }
        else if (k === 'stab' && (inBar === 1 || inBar === 3)) tones.forEach(m => piano(t + spb / 2, m, spb * 0.2, 0.18 * vel, out, 0.1));
        else if (k === 'maj7' && (inBar === 0 || inBar === 2)) { const sw = th.swing || 0; tones.forEach((m, i) => piano(t + i * 0.02 + (inBar === 2 ? sw : 0), m - 12, spb * 1.8, 0.16 * vel, out, 0.45)); }
        else if (k === 'synth') { for (let i = 0; i < 2; i++) synthPluck(t + i * spb / 2 + spb / 4, tones[(inBar * 2 + i) % 3] + 12, spb * 0.3, out, vel * 0.7, 0.4); }
        else if (k === 'box') bell(t, tones[inBar % 3] + 12, spb, 0.32 * vel, out, 0.6);
        // 旋律
        if (melOn && th.mel) th.mel.forEach(([pos, m, d]) => {
          if (pos >= b && pos < b + 1) {
            const tt = t + (pos - b) * spb, dd = d * spb;
            const mi = soft ? 'pluck' : th.melInst;
            if (mi === 'lead') lead(tt, m, dd, out, vel);
            else if (mi === 'piano') piano(tt, m, dd, 0.6 * vel, out, 0.5);
            else if (mi === 'bell') bell(tt, m, dd, 0.75 * vel, out, 0.55);
            else if (mi === 'synth') synthPluck(tt, m, dd, out, vel * 1.2, 0.3);
            else if (mi === 'pluck') pluck(tt, m, dd, out, vel, 0, 0.35);
          }
        });
        node.beat++; node.next += spb;
      }
    };
    tick();
    node.timer = setInterval(tick, 100);
  }
  function stopTheme(fade = 1.5) {
    if (curAudio) { const a = curAudio; curAudio = null; killAudio(a, fade); }
    if (themeNode) {
      const n = themeNode; n.alive = false; clearInterval(n.timer);
      const now = ctx.currentTime;
      n.out.gain.cancelScheduledValues(now); n.out.gain.setValueAtTime(Math.max(0.0001, n.out.gain.value), now);
      n.out.gain.linearRampToValueAtTime(0, now + Math.max(0.05, fade));
      setTimeout(() => n.out.disconnect(), (fade + 3) * 1000);
    }
    themeNode = null; curTheme = null;
  }

  // ================= 环境音 =================
  function startAmb(name, fade = 2) {
    init();
    if (ambNodes[name]) return;
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.connect(bus.amb);
    const nodes = [], timers = [];
    const target = { rain: 0.5, heavyrain: 0.8, wind: 0.45, crowd: 0.5, hum: 0.5, street: 0.45, train: 0.55, tape: 0.2, cafe: 0.4, night: 0.35, cheer: 0.6, waves: 0.6 }[name] || 0.5;
    out.gain.exponentialRampToValueAtTime(target, ctx.currentTime + fade);
    const lfo = (rate, depth, param, base) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); param.value = base; o.start(); nodes.push(o); };
    const loopNoise = (buf, type, f, q, gain) => { const s = noiseSrc(buf), fl = filt(type, f, q), g = ctx.createGain(); g.gain.value = gain; s.connect(fl); fl.connect(g); g.connect(out); s.start(ctx.currentTime, Math.random() * s.buffer.duration); nodes.push(s); return { g, fl }; };
    if (name === 'rain' || name === 'heavyrain') {
      loopNoise(null, 'bandpass', name === 'rain' ? 3500 : 2500, 0.4, name === 'rain' ? 0.35 : 0.6);
      loopNoise(brown(), 'lowpass', 600, 0.7, name === 'rain' ? 0.3 : 0.6);
      const drop = () => {
        const t = ctx.currentTime, o = ctx.createBufferSource(); o.buffer = noise();
        const bp = filt('bandpass', 2000 + Math.random() * 5000, 8), g3 = ctx.createGain();
        g3.gain.setValueAtTime(0.25 + Math.random() * 0.3, t); g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.04);
        o.connect(bp); bp.connect(g3); g3.connect(out); o.start(t, Math.random() * 3, 0.1);
      };
      timers.push(setInterval(() => { for (let i = 0; i < (name === 'rain' ? 3 : 7); i++) setTimeout(drop, Math.random() * 100); }, 100));
    } else if (name === 'wind') {
      const w = loopNoise(null, 'bandpass', 500, 1.2, 0.5); lfo(0.07, 300, w.fl.frequency, 600); lfo(0.17, 0.3, w.g.gain, 0.5);
      loopNoise(brown(), 'lowpass', 400, 0.7, 0.5);
    } else if (name === 'crowd' || name === 'cafe') {
      // 嘈杂的人声（live house 开场前 / 咖啡馆）
      for (let i = 0; i < 5; i++) { const v = loopNoise(null, 'bandpass', 300 + i * 170, 3, name === 'cafe' ? 0.18 : 0.28); lfo(0.3 + i * 0.41, 0.15, v.g.gain, name === 'cafe' ? 0.18 : 0.28); }
      if (name === 'cafe') timers.push(setInterval(() => { if (Math.random() < 0.3) { const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 2400 + Math.random() * 1600; g.gain.setValueAtTime(0.02, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3); } }, 900));
    } else if (name === 'cheer') {
      for (let i = 0; i < 6; i++) { const v = loopNoise(null, 'bandpass', 600 + i * 260, 1.5, 0.3); lfo(0.5 + i * 0.3, 0.2, v.g.gain, 0.3); }
      loopNoise(null, 'highpass', 5000, 0.5, 0.12);
    } else if (name === 'hum') {
      // 关东 50Hz 的电源嗡嗡声：音箱开着、还没有人弹的时候
      [50, 100, 150, 250].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = [0.12, 0.08, 0.05, 0.02][i]; o.connect(g); g.connect(out); o.start(); nodes.push(o); });
      loopNoise(null, 'highpass', 6000, 0.5, 0.04);
    } else if (name === 'street') {
      loopNoise(brown(), 'lowpass', 350, 0.7, 0.6);
      loopNoise(null, 'bandpass', 900, 0.5, 0.06);
      timers.push(setInterval(() => { // 偶尔驶过的车
        if (Math.random() < 0.35) { const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = brown(); const lp = filt('lowpass', 500), g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8); s.connect(lp); lp.connect(g); g.connect(out); s.start(t, Math.random() * 3, 3); }
      }, 2200));
    } else if (name === 'train') {
      loopNoise(brown(), 'lowpass', 260, 0.7, 0.8);
      const sp = 0.21; let k = 0;
      timers.push(setInterval(() => { const t = ctx.currentTime; [0, sp].forEach(o => { const s = ctx.createBufferSource(); s.buffer = noise(); const lp = filt('lowpass', 900), g = ctx.createGain(); g.gain.setValueAtTime(0.4, t + o); g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.08); s.connect(lp); lp.connect(g); g.connect(out); s.start(t + o, Math.random() * 3, 0.1); }); k++; }, 1700));
    } else if (name === 'tape') {
      const h = loopNoise(null, 'highpass', 3500, 0.7, 0.4); lfo(0.5, 0.08, h.g.gain, 0.4);
    } else if (name === 'night') {
      const n = loopNoise(brown(), 'lowpass', 200, 0.7, 0.28); lfo(0.045, 0.1, n.g.gain, 0.28);
      timers.push(setInterval(() => { // 很远的地方，偶尔有车开过
        if (Math.random() < 0.22) { const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = brown(); const lp = filt('lowpass', 380), g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 1.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5); src.connect(lp); lp.connect(g); g.connect(out); src.start(t, Math.random() * 8, 5); }
      }, 3000));
    } else if (name === 'waves') {
      const w = loopNoise(brown(), 'lowpass', 500, 0.7, 0.55); lfo(0.11, 0.45, w.g.gain, 0.55); lfo(0.11, 350, w.fl.frequency, 650);
      const s = loopNoise(null, 'bandpass', 2500, 0.4, 0.07); lfo(0.11, 0.06, s.g.gain, 0.07);
    }
    ambNodes[name] = { out, nodes, timers };
  }
  function stopAmb(name, fade = 2) {
    if (!ctx) return;
    const names = name ? [name] : Object.keys(ambNodes);
    names.forEach(n => {
      const a = ambNodes[n]; if (!a) return; delete ambNodes[n];
      const now = ctx.currentTime; a.out.gain.cancelScheduledValues(now); a.out.gain.setValueAtTime(Math.max(0.0001, a.out.gain.value), now);
      a.out.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, fade));
      setTimeout(() => { a.timers.forEach(clearInterval); a.nodes.forEach(x => { try { x.stop(); } catch (e) { } }); a.out.disconnect(); }, fade * 1000 + 200);
    });
  }

  // ================= 音效 =================
  function se(name) {
    init();
    const t = ctx.currentTime, out = bus.se;
    const nb = (dur, type, f, q, peak, a = 0.005, offset = 0) => {
      const s = ctx.createBufferSource(); s.buffer = noise(); const b = filt(type, f, q || 0.7);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t + offset); g.gain.linearRampToValueAtTime(peak, t + offset + a); g.gain.exponentialRampToValueAtTime(0.0001, t + offset + dur);
      s.connect(b); b.connect(g); g.connect(out); s.start(t + offset, Math.random() * 2, dur + 0.1); return b;
    };
    const tone = (f, dur, type = 'sine', peak = 0.2, offset = 0) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + offset); g.gain.linearRampToValueAtTime(peak, t + offset + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + offset + dur);
      o.connect(g); g.connect(out); o.start(t + offset); o.stop(t + offset + dur + 0.1); return o;
    };
    switch (name) {
      // ---- 界面音效：拨片碰弦的声音（结束乐队的吉他） ----
      case 'click': // 普通按钮：拨片「嗒」一下 + 一个很短的高音弦
        nb(0.035, 'highpass', 3500, 0.7, 0.22, 0.002); pluck(t, 76, 0.35, out, 0.55, 0, 0.12); break;
      case 'select': // 确定 / 开始：两根弦往上（E→B）
        nb(0.03, 'highpass', 3500, 0.7, 0.2, 0.002); pluck(t, 64, 0.9, out, 0.75, 0, 0.25); pluck(t + 0.07, 71, 1.1, out, 0.75, 0, 0.25); break;
      case 'cancel': // 返回 / 关闭：两根弦往下，轻一点
        nb(0.03, 'highpass', 3500, 0.7, 0.14, 0.002); pluck(t, 71, 0.6, out, 0.5, 0, 0.2); pluck(t + 0.06, 64, 0.8, out, 0.45, 0, 0.2); break;
      case 'toggle': // 开关 / 自动 / 快进：消音弦「咔」
        nb(0.05, 'bandpass', 1800, 2, 0.28, 0.002); tone(330, 0.05, 'triangle', 0.08); break;
      case 'save': // 存档：三个音往上，像 REC 灯亮起
        [0, 0.07, 0.14].forEach((d, i) => pluck(t + d, [69, 73, 76][i], 1.1, out, 0.6, 0, 0.3)); tone(2637, 0.25, 'sine', 0.05, 0.16); break;
      case 'load': // 读档：磁带倒带的感觉
        { const o = tone(500, 0.22, 'triangle', 0.08); o.frequency.exponentialRampToValueAtTime(1400, t + 0.2); } pluck(t + 0.2, 76, 1.0, out, 0.6, 0, 0.3); break;
      case 'tick': // 拖动滑块
        tone(1200, 0.03, 'sine', 0.06); break;
      case 'chapter': [0, 7, 12].forEach(dv => { pluck(t, 40 + dv, 1.6, out, 0.9, 0, 0.4); }); break;
      case 'line_recv': tone(1568, 0.09, 'sine', 0.12); tone(2093, 0.14, 'sine', 0.1, 0.07); break;
      case 'line_send': { const o = tone(900, 0.12, 'sine', 0.06); o.frequency.exponentialRampToValueAtTime(1800, t + 0.1); break; }
      case 'vibe': for (let i = 0; i < 3; i++) tone(150, 0.22, 'sawtooth', 0.04, i * 0.36); break;
      case 'strum': [40, 47, 52, 56, 59, 64].forEach((m, i) => pluck(t + i * 0.018, m, 1.8, out, 0.7, 0, 0.3)); break;
      case 'chord': for (let i = 0; i < 2; i++) power(t, 40, 1.6, out, 1.3, false, i ? 0.4 : -0.4); break;
      case 'riff': [40, 40, 43, 45, 40, 47, 45, 43].forEach((m, i) => power(t + i * 0.16, m, 0.15, out, 1.1, i % 2 === 1, 0)); break;
      case 'feedback': { // 吉他的啸叫
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), pre = ctx.createGain(), ws = ctx.createWaveShaper(), lp = filt('lowpass', 3000);
        o.frequency.setValueAtTime(659, t); o.frequency.setValueAtTime(1318, t + 1.2); o2.frequency.value = 1318.5; pre.gain.value = 2; ws.curve = crunchCurve;
        const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5; vg.gain.value = 12; vib.connect(vg); vg.connect(o.detune);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.9); g.gain.setValueAtTime(0.12, t + 2.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
        o.connect(pre); o2.connect(pre); pre.connect(ws); ws.connect(lp); lp.connect(g); g.connect(out); send(g, 0.5);
        [o, o2, vib].forEach(x => { x.start(t); x.stop(t + 3.7); });
        break; }
      case 'howl': { const o = tone(2100, 1.1, 'sine', 0.05); o.frequency.linearRampToValueAtTime(2500, t + 0.9); break; } // PA 的啸叫（要被消掉的那种）
      case 'cable': nb(0.05, 'lowpass', 300, 1, 0.6); tone(55, 0.2, 'sine', 0.3); nb(0.3, 'highpass', 3000, 0.7, 0.05, 0.01, 0.05); break;
      case 'mic': tone(60, 0.25, 'sine', 0.3); nb(0.1, 'lowpass', 400, 1, 0.3); break;
      case 'rec': tone(1000, 0.12, 'sine', 0.1); tone(1000, 0.12, 'sine', 0.1, 0.2); break;
      case 'tape_play': nb(0.03, 'highpass', 2500, 1, 0.35); tone(140, 0.08, 'square', 0.05, 0.02); nb(1.0, 'highpass', 4000, 0.7, 0.05, 0.3, 0.05); break;
      case 'tape_stop': nb(0.05, 'highpass', 2000, 1, 0.4); tone(120, 0.1, 'square', 0.06); break;
      case 'click_track': for (let i = 0; i < 4; i++) tone(i ? 1500 : 2000, 0.04, 'square', 0.06, i * 0.45); break;
      case 'count': for (let i = 0; i < 4; i++) { nb(0.05, 'highpass', 6000, 1, 0.3, 0.001, i * 0.4); } break; // 鼓棒数拍
      case 'drumroll': for (let i = 0; i < 20; i++) snare(t + i * 0.05, out, 0.3 + i * 0.03); crash(t + 1.0, out, 1); kick(t + 1.0, out, 1); break;
      case 'cymbal': crash(t, out, 1); break;
      case 'applause': for (let i = 0; i < 200; i++) nb(0.03, 'bandpass', 1200 + Math.random() * 2500, 1.2, 0.08 * Math.random(), 0.002, Math.random() * 3); break;
      case 'cheer': { nb(2.8, 'bandpass', 900, 0.6, 0.4, 0.3); nb(2.6, 'bandpass', 1900, 0.8, 0.25, 0.25, 0.1); for (let i = 0; i < 120; i++) nb(0.03, 'bandpass', 1500 + Math.random() * 2500, 1.2, 0.07 * Math.random(), 0.002, Math.random() * 2.6); break; }
      case 'door': { const b = nb(0.7, 'bandpass', 300, 2, 0.35, 0.05); b.frequency.linearRampToValueAtTime(900, t + 0.6); nb(0.06, 'lowpass', 500, 1, 0.5, 0.003, 0.66); break; }
      case 'doorbell': tone(1318, 0.5, 'sine', 0.08); tone(1046, 0.8, 'sine', 0.08, 0.35); break;
      case 'footsteps': for (let i = 0; i < 6; i++) nb(0.09, 'lowpass', 700, 1, 0.35, 0.004, i * 0.36); break;
      case 'run': for (let i = 0; i < 10; i++) nb(0.07, 'lowpass', 900, 1, 0.35, 0.003, i * 0.19); break;
      case 'stairs': for (let i = 0; i < 8; i++) nb(0.1, 'lowpass', 600 + (i % 2) * 200, 1, 0.3, 0.004, i * 0.3); break;
      case 'heartbeat': [0, 0.28, 1.1, 1.38].forEach((o, i) => { const x = ctx.createOscillator(), g = ctx.createGain(); x.frequency.setValueAtTime(70, t + o); x.frequency.exponentialRampToValueAtTime(35, t + o + 0.15);
        g.gain.setValueAtTime(0, t + o); g.gain.linearRampToValueAtTime(i % 2 ? 0.35 : 0.5, t + o + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.22); x.connect(g); g.connect(out); x.start(t + o); x.stop(t + o + 0.3); }); break;
      case 'shutter': nb(0.04, 'highpass', 2500, 1, 0.4); nb(0.05, 'highpass', 2000, 1, 0.3, 0.002, 0.09); break;
      case 'can': tone(2600, 0.3, 'sine', 0.05); nb(0.12, 'highpass', 3000, 1, 0.25); break;
      case 'page': nb(0.25, 'bandpass', 3000, 0.8, 0.15, 0.05); break;
      case 'switch': nb(0.03, 'highpass', 2000, 1, 0.4); tone(300, 0.03, 'square', 0.05); break;
      case 'collapse': { const o = tone(900, 0.9, 'triangle', 0.12); o.frequency.exponentialRampToValueAtTime(110, t + 0.85); nb(0.2, 'lowpass', 300, 1, 0.5, 0.005, 0.85); break; } // 一里的崩坏
      case 'boing': { const o = tone(220, 0.4, 'sine', 0.2); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(660, t + 0.12); o.frequency.exponentialRampToValueAtTime(330, t + 0.35); break; }
      case 'kira': [2093, 2637, 3136, 4186].forEach((f, i) => tone(f, 0.5, 'sine', 0.06, i * 0.06)); break; // 喜多的光环
      case 'shock': tone(1200, 0.08, 'square', 0.08); tone(900, 0.2, 'square', 0.06, 0.08); break;
      case 'thud': tone(80, 0.3, 'sine', 0.5); nb(0.2, 'lowpass', 400, 1, 0.5); break;
      case 'chime': { [64, 60, 62, 55, 55, 62, 64, 60].forEach((m, i) => bell(t + i * 0.8 + (i >= 4 ? 0.5 : 0), m + 12, 0.8, 0.8, out, 0.6)); break; } // 学校的钟
      case 'train_door': [76, 72].forEach((m, i) => tone(mtof(m), 0.35, 'sine', 0.1, i * 0.32)); nb(0.6, 'lowpass', 900, 0.7, 0.3, 0.05, 0.7); break;
      case 'crossing': for (let i = 0; i < 8; i++) { tone(750, 0.18, 'square', 0.04, i * 0.5); tone(700, 0.18, 'square', 0.04, i * 0.5 + 0.25); } break;
      case 'bell': bell(t, 84, 0.6, 0.8, out, 0.6); break;
      case 'firework': nb(1.4, 'lowpass', 300, 0.7, 0.6, 0.01); break;
      case 'dog': [0, 0.3].forEach(o => { const x = tone(520, 0.12, 'sawtooth', 0.08, o); x.frequency.exponentialRampToValueAtTime(380, t + o + 0.1); }); break;
      case 'slurp': nb(0.4, 'bandpass', 1500, 3, 0.15, 0.02); break;
      case 'stomach': { const o = tone(90, 0.8, 'sawtooth', 0.06); o.frequency.linearRampToValueAtTime(60, t + 0.7); break; } // 凉的肚子
    }
  }

  function setVolume(k, v) { vol[k] = v; if (ctx && bus[k]) bus[k].gain.setTargetAtTime(v, ctx.currentTime, 0.05); if (k === 'bgm' && curAudio && !curAudio._fade) curAudio.volume = audioTarget(); }
  // 声音隔着墙 / 门（例如一里在储物间里弹琴）
  let muffle = null;
  function setMuffle(on, sec = 1.5) {
    init();
    if (!muffle) {
      muffle = filt('lowpass', 20000);
      master.disconnect(); master.connect(muffle); muffle.connect(comp);
    }
    muffle.frequency.cancelScheduledValues(ctx.currentTime);
    muffle.frequency.setTargetAtTime(on ? 480 : 20000, ctx.currentTime, sec / 3);
    muffled = on; if (curAudio) fadeAudio(curAudio, audioTarget(), sec);
  }
  // 手机切到后台时暂停全部声音，回来再继续
  function suspend(on) {
    if (!ctx) return;
    try { on ? ctx.suspend() : ctx.resume(); } catch (e) { }
    if (on) [curAudio, ...dying].forEach(a => a && a.pause());
    else if (curAudio && !MUTED) curAudio.play().catch(() => { });
  }
  // 测试用：静音状态下让时钟走起来（master 增益保持 0，不会出声）
  function silentRun() { init(); if (MUTED) { master.gain.value = 0; ctx.resume(); } }
  return { TITLES, silentRun, suspend, init, playTheme, stopTheme, startAmb, stopAmb, se, setVolume, setMuffle, get theme() { return curTheme; }, get ambs() { return Object.keys(ambNodes); }, THEMES };
})();
