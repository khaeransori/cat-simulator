// All sound is synthesized with WebAudio, so the game needs no audio files
// and works fully offline.
import { ctx } from './ctx';

type Wave = OscillatorType;

class SoundSystem {
  ac: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  noiseBuf!: AudioBuffer;
  // music
  musicOn = false;
  track: 'menu' | 'day' | 'hurry' | 'none' = 'none';
  step = 0;
  nextTime = 0;
  timer: any = null;
  lastVoice = 0;

  unlock() {
    if (!this.ac) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      const ac = this.ac!;
      this.master = ac.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(ac.destination);
      this.musicBus = ac.createGain();
      this.sfxBus = ac.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      const len = ac.sampleRate * 1.5;
      this.noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      this.ensureTimer();
    }
    if (this.ac && this.ac.state === 'suspended') this.ac.resume().catch(() => {});
  }

  applyVolumes() {
    if (!this.ac) return;
    const s = ctx.save?.settings;
    this.musicBus.gain.value = (s ? s.music : 0.6) * 0.32;
    this.sfxBus.gain.value = s ? s.sfx : 0.9;
  }

  get now() {
    return this.ac ? this.ac.currentTime : 0;
  }

  // ---------- primitives ----------
  tone(f: number, dur: number, type: Wave = 'sine', vol = 0.25, when = 0, f2?: number, bus?: GainNode, attack = 0.005) {
    if (!this.ac) return;
    const ac = this.ac;
    const t = ac.currentTime + when;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur: number, vol = 0.3, ftype: BiquadFilterType = 'bandpass', freq = 1000, q = 1, when = 0, f2?: number, bus?: GainNode) {
    if (!this.ac) return;
    const ac = this.ac;
    const t = ac.currentTime + when;
    const s = ac.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = ftype;
    f.frequency.setValueAtTime(freq, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(bus || this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  // ---------- sound effects ----------
  meow(pitch = 1, vol = 0.35) {
    if (!this.ac) return;
    const ac = this.ac;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    const f0 = 460 * pitch;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * 1.45, t + 0.12);
    o.frequency.linearRampToValueAtTime(f0 * 1.3, t + 0.26);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + 0.45);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 4;
    bp.frequency.setValueAtTime(700 * pitch, t);
    bp.frequency.linearRampToValueAtTime(1500 * pitch, t + 0.14);
    bp.frequency.linearRampToValueAtTime(900 * pitch, t + 0.45);
    const bp2 = ac.createBiquadFilter();
    bp2.type = 'peaking';
    bp2.frequency.value = 2600 * pitch;
    bp2.gain.value = 8;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(bp);
    bp.connect(bp2);
    bp2.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.55);
  }
  purr() {
    if (!this.ac) return;
    for (let i = 0; i < 10; i++) this.noise(0.09, 0.08, 'lowpass', 180, 1, i * 0.12);
  }
  bark() {
    this.tone(220, 0.14, 'sawtooth', 0.3, 0, 140);
    this.noise(0.12, 0.25, 'bandpass', 700, 2);
    this.tone(240, 0.14, 'sawtooth', 0.3, 0.2, 150);
    this.noise(0.12, 0.25, 'bandpass', 750, 2, 0.2);
  }
  glass() {
    this.noise(0.25, 0.35, 'highpass', 3000, 0.7);
    for (let i = 0; i < 6; i++) this.tone(2200 + Math.random() * 3000, 0.25 + Math.random() * 0.3, 'sine', 0.12, Math.random() * 0.12);
  }
  potBreak() {
    this.tone(110, 0.25, 'sine', 0.45, 0, 55);
    this.noise(0.3, 0.4, 'lowpass', 900, 1);
    this.noise(0.18, 0.3, 'bandpass', 1800, 2, 0.03);
    this.noise(0.12, 0.2, 'bandpass', 2600, 3, 0.1);
  }
  thud(v = 0.3) {
    this.tone(140, 0.12, 'sine', v, 0, 70);
    this.noise(0.08, v * 0.6, 'lowpass', 500, 1);
  }
  splash(big = false) {
    this.noise(big ? 0.7 : 0.45, big ? 0.45 : 0.3, 'bandpass', 1400, 1, 0, 300);
    this.noise(0.25, 0.2, 'highpass', 3500, 1, 0.05);
  }
  plop() {
    this.tone(500, 0.12, 'sine', 0.25, 0, 150);
  }
  coin() {
    this.tone(988, 0.1, 'square', 0.08);
    this.tone(1319, 0.25, 'square', 0.08, 0.08);
  }
  jingle() {
    const n = [523, 659, 784, 1047];
    n.forEach((f, i) => this.tone(f, 0.18, 'square', 0.09, i * 0.08));
    this.tone(1319, 0.4, 'triangle', 0.15, 0.32);
  }
  fanfare() {
    const n = [523, 659, 784, 659, 784, 1047];
    n.forEach((f, i) => this.tone(f, 0.22, 'square', 0.08, i * 0.11));
    this.tone(1047, 0.6, 'triangle', 0.18, 0.66);
  }
  wahwah() {
    this.tone(392, 0.3, 'triangle', 0.2, 0, 370);
    this.tone(370, 0.3, 'triangle', 0.2, 0.3, 349);
    this.tone(349, 0.6, 'triangle', 0.2, 0.6, 300);
  }
  jump() {
    this.tone(320, 0.12, 'sine', 0.12, 0, 640);
  }
  land() {
    this.noise(0.05, 0.08, 'lowpass', 400, 1);
  }
  click() {
    this.tone(700, 0.05, 'sine', 0.15, 0, 900);
  }
  deny() {
    this.tone(180, 0.12, 'square', 0.1);
    this.tone(150, 0.16, 'square', 0.1, 0.1);
  }
  pop() {
    this.tone(400, 0.08, 'sine', 0.2, 0, 900);
  }
  alarm() {
    for (let i = 0; i < 10; i++) this.tone(i % 2 ? 1250 : 950, 0.13, 'square', 0.1, i * 0.14);
  }
  flap() {
    for (let i = 0; i < 8; i++) this.noise(0.05, 0.18, 'bandpass', 1300 + Math.random() * 600, 1.5, i * 0.06 + Math.random() * 0.03);
  }
  coo() {
    this.tone(330, 0.2, 'sine', 0.12, 0, 300);
    this.tone(300, 0.25, 'sine', 0.12, 0.22, 280);
  }
  shoo() {
    this.noise(0.45, 0.3, 'bandpass', 3200, 2);
    this.noise(0.4, 0.25, 'bandpass', 3000, 2, 0.5);
  }
  swish() {
    this.noise(0.18, 0.2, 'bandpass', 1200, 1, 0, 3500);
  }
  scratch() {
    for (let i = 0; i < 6; i++) this.noise(0.07, 0.22, 'bandpass', 2500 + Math.random() * 1500, 2, i * 0.09);
  }
  paper() {
    for (let i = 0; i < 5; i++) this.noise(0.1, 0.2, 'highpass', 2000, 1, i * 0.1);
  }
  dig() {
    for (let i = 0; i < 5; i++) this.noise(0.08, 0.25, 'lowpass', 500, 1, i * 0.1);
  }
  rollThuds() {
    for (let i = 0; i < 8; i++) this.tone(160 + Math.random() * 60, 0.08, 'sine', 0.15, i * 0.09 + Math.random() * 0.05, 90);
  }
  cloth() {
    for (let i = 0; i < 4; i++) this.noise(0.15, 0.12, 'bandpass', 900, 1, i * 0.12);
  }
  laugh() {
    for (let i = 0; i < 4; i++) this.tone(620 - i * 30, 0.1, 'triangle', 0.12, i * 0.13, 520 - i * 30);
  }
  sparkle() {
    for (let i = 0; i < 5; i++) this.tone(1500 + i * 250, 0.12, 'sine', 0.07, i * 0.05);
  }
  tick() {
    this.tone(1800, 0.03, 'square', 0.05);
  }
  reel() {
    for (let i = 0; i < 4; i++) this.tone(2400, 0.02, 'square', 0.05, i * 0.04);
  }
  bite() {
    this.tone(260, 0.15, 'sine', 0.3, 0, 90);
    this.noise(0.2, 0.25, 'bandpass', 1200, 1, 0.02, 400);
  }
  eat() {
    for (let i = 0; i < 4; i++) this.noise(0.06, 0.2, 'bandpass', 900, 2, i * 0.12);
  }
  door() {
    this.tone(200, 0.3, 'triangle', 0.15, 0, 160);
  }
  voice(base = 1, vol = 0.07) {
    // Animal-Crossing-style talking blips, language-neutral
    if (!this.ac) return;
    const t = this.ac.currentTime;
    if (t - this.lastVoice < 0.06) return;
    this.lastVoice = t;
    const f = 300 * base * (0.85 + Math.random() * 0.4);
    this.tone(f, 0.06, 'square', vol, 0, f * 1.1);
  }

  // ---------- music ----------
  setTrack(tr: 'menu' | 'day' | 'hurry' | 'none') {
    if (this.track === tr) return;
    this.track = tr;
    this.ensureTimer();
  }

  ensureTimer() {
    if (!this.ac || this.timer || this.track === 'none') return;
    this.nextTime = this.ac.currentTime + 0.1;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  schedule() {
    if (!this.ac || this.track === 'none') return;
    if (this.ac.state !== 'running') {
      this.nextTime = this.ac.currentTime + 0.05;
      return;
    }
    const bpm = this.track === 'menu' ? 92 : this.track === 'hurry' ? 150 : 112;
    const stepDur = 60 / bpm / 2; // eighth notes
    while (this.nextTime < this.ac.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.step = (this.step + 1) % 64;
      this.nextTime += stepDur;
    }
  }

  playStep(s: number, t: number, sd: number) {
    const ac = this.ac!;
    const when = t - ac.currentTime;
    const hurry = this.track === 'hurry';
    const menu = this.track === 'menu';
    // Two 32-step phrases: A (playful) and B (answer)
    const A = [72, 0, 76, 0, 79, 76, 74, 0, 72, 0, 74, 76, 74, 0, 67, 0, 69, 0, 72, 0, 76, 74, 72, 0, 74, 0, 76, 74, 72, 0, 0, 0];
    const B = [76, 0, 79, 0, 81, 79, 76, 0, 74, 0, 76, 79, 76, 0, 72, 0, 74, 0, 72, 69, 67, 0, 69, 72, 74, 0, 72, 0, 72, 0, 0, 0];
    const phrase = s < 32 ? A : B;
    const i = s % 32;
    const bar = Math.floor(i / 8);
    const roots = s < 32 ? [48, 43, 45, 41] : [45, 41, 43, 48];
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const up = hurry ? 2 : 0;
    const note = phrase[i];
    if (note) {
      const f = mtof(note + up);
      this.tone(f, sd * 1.6, menu ? 'sine' : 'triangle', menu ? 0.2 : 0.18, when, undefined, this.musicBus, 0.01);
      if (!menu) this.tone(f * 2, sd * 0.8, 'square', 0.025, when, undefined, this.musicBus);
    }
    const r = roots[bar] + up;
    const k = i % 8;
    if (k === 0 || k === 4) this.tone(mtof(r), sd * 1.8, 'triangle', 0.22, when, undefined, this.musicBus);
    if (k === 6) this.tone(mtof(r + 7), sd * 0.9, 'triangle', 0.16, when, undefined, this.musicBus);
    if (k === 2 && !menu) this.tone(mtof(r + 12), sd * 0.8, 'triangle', 0.1, when, undefined, this.musicBus);
    if (!menu) {
      if (k % 2 === 1) this.noise(0.03, 0.06, 'highpass', 7000, 1, when, undefined, this.musicBus);
      if (k === 0 || k === 4) this.tone(90, 0.12, 'sine', 0.3, when, 45, this.musicBus);
      if (hurry && k % 2 === 0) this.noise(0.02, 0.05, 'highpass', 8000, 1, when + sd / 2, undefined, this.musicBus);
    }
  }
}

export const sfx = new SoundSystem();
