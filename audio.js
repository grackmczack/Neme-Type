// Chiptune-Engine: WebAudio-Synth mit Step-Sequencer, Sektor-Songs, Boss-Track, Intro-Jingle und Effekten.
const N = null;

const TRACKS = {
  title: {
    bpm: 112, root: 57, lead: 'square', leadVol: 0.085,
    lead32: [0, N, N, 7, 12, N, 7, N, 10, N, 7, N, 3, N, 5, 7, 0, N, N, 7, 12, N, 15, N, 14, N, 12, N, 10, N, 7, N],
    bass16: [0, N, 0, N, 0, N, 0, N, -5, N, -5, N, -2, N, -2, N],
    drums: ['k...s...k...s.h.', 'k.h.s.h.k.h.s.hh'],
  },
  s0: {
    bpm: 136, root: 57, lead: 'square', leadVol: 0.075,
    lead32: [0, N, 7, N, 12, N, 7, N, 10, N, 7, N, 3, N, 7, N, 0, N, 7, N, 12, N, 15, N, 14, 12, 10, 7, 5, 7, 3, N],
    bass16: [0, 0, N, 0, 0, N, 0, 0, -2, -2, N, -2, 3, 3, N, 3],
    drums: ['k.h.s.h.k.h.s.h.', 'k.h.s.hhk.hks.h.'],
  },
  s1: {
    bpm: 122, root: 52, lead: 'triangle', leadVol: 0.12,
    lead32: [0, 3, 7, 10, 12, 10, 7, 3, 0, 3, 7, 10, 14, 12, 10, 7, -2, 1, 5, 8, 12, 8, 5, 1, -2, 1, 5, 8, 10, 8, 7, 3],
    bass16: [0, N, N, 0, N, N, 0, N, -2, N, N, -2, N, N, -5, N],
    drums: ['k..hs..hk..hs.h.', 'k.hhs..hk.hhs.hk'],
  },
  s2: {
    bpm: 142, root: 61, lead: 'sawtooth', leadVol: 0.05,
    lead32: [0, 0, 12, 0, 0, 0, 12, 0, 3, 3, 15, 3, 3, 3, 15, 3, 7, 7, 19, 7, 7, 7, 19, 7, 5, 5, 17, 5, 3, 3, 15, N],
    bass16: [0, 0, 0, 0, 3, 3, 3, 3, 5, 5, 5, 5, 3, 3, 7, 7],
    drums: ['k.h.s.h.k.h.s.h.', 'kkh.s.hhk.h.s.sh'],
  },
  s3: {
    bpm: 150, root: 50, lead: 'square', leadVol: 0.07,
    lead32: [0, N, 0, 3, 5, N, 3, N, 7, N, 7, 10, 12, N, 10, N, 0, N, 0, 3, 5, 7, 8, 7, 5, N, 3, N, 2, N, 0, N],
    bass16: [0, 0, 12, 0, 0, 0, 12, 0, -2, -2, 10, -2, -5, -5, 7, -5],
    drums: ['k.hhs.hhk.hhs.hh', 'kkhhs.hhkkhhsshh'],
  },
  boss: {
    bpm: 168, root: 45, lead: 'sawtooth', leadVol: 0.06,
    lead32: [0, 0, 12, N, 0, 0, 13, N, 0, 0, 12, N, 15, 14, 13, 12, 0, 0, 12, N, 0, 0, 17, N, 16, 15, 14, N, 12, 13, 14, 15],
    bass16: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, -1, -1, -1, -1],
    drums: ['kkhhskhhkkhhskhs', 'kkhskkhskkhskhss'],
  },
};

export class Chip {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = true;
    this.track = null;
    this.trackName = '';
    this.nextAt = 0;
    this.step = 0;
    this.noise = null;
    this.duck = 1;
  }

  init() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.14;
        this.master.connect(this.ctx.destination);
        const length = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      }
      this.ctx.resume().catch(() => {});
      return true;
    } catch { return false; }
  }

  get running() { return Boolean(this.ctx && this.ctx.state === 'running' && !this.muted); }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.14;
  }

  setTrack(name) {
    if (this.trackName === name) return;
    this.trackName = name;
    this.track = TRACKS[name] || null;
    this.step = 0;
    if (this.ctx) this.nextAt = this.ctx.currentTime + 0.05;
  }

  stopMusic() { this.trackName = ''; this.track = null; }

  close() { this.ctx?.close().catch(() => {}); this.ctx = null; }

  tone(freq, dur, type = 'square', vol = 0.15, slide = 0, delay = 0, dest = this.master) {
    if (!this.running) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(25, freq), t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(25, freq + slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.03);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  hiss(dur, vol = 0.12, freq = 4000, delay = 0, type = 'highpass', when = null) {
    if (!this.running) return;
    const t = (when ?? this.ctx.currentTime) + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
    src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  sfx(name) {
    if (!this.running) return;
    const table = {
      aqua: () => this.tone(820, 0.07, 'triangle', 0.08, -380),
      spread: () => { this.tone(520, 0.09, 'square', 0.06, -260); this.hiss(0.08, 0.05, 2400); },
      beam: () => this.tone(1100, 0.04, 'sawtooth', 0.035, -300),
      homing: () => this.tone(480, 0.12, 'sine', 0.09, 420),
      orbit: () => this.tone(700, 0.06, 'triangle', 0.07, -300),
      charge: () => { this.tone(180, 0.5, 'sawtooth', 0.14, 900); this.hiss(0.4, 0.06, 1800); },
      chargeshot: () => { this.tone(130, 0.45, 'sawtooth', 0.2, 500); this.tone(1200, 0.25, 'square', 0.08, -900); },
      enemy: () => this.tone(190, 0.08, 'triangle', 0.04, -60),
      explode: () => { this.hiss(0.22, 0.14, 900, 0, 'lowpass'); this.tone(120, 0.18, 'sawtooth', 0.1, -80); },
      big: () => { this.hiss(0.6, 0.22, 600, 0, 'lowpass'); this.tone(80, 0.6, 'sawtooth', 0.22, -50); },
      hit: () => { this.hiss(0.3, 0.2, 700, 0, 'lowpass'); this.tone(170, 0.4, 'sawtooth', 0.17, -120); },
      bomb: () => { this.hiss(0.9, 0.3, 500, 0, 'lowpass'); this.tone(90, 0.8, 'sawtooth', 0.26, -60); },
      pickup: () => { this.tone(660, 0.1, 'square', 0.1); this.tone(990, 0.16, 'square', 0.1, 0, 0.08); },
      weapon: () => { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.1, 0, i * 0.06)); },
      life: () => { [659, 784, 1319, 1175, 1319, 1568].forEach((f, i) => this.tone(f, 0.11, 'square', 0.1, 0, i * 0.07)); },
      block: () => this.tone(1500, 0.05, 'square', 0.06, -600),
      warn: () => { this.tone(440, 0.12, 'square', 0.1); this.tone(330, 0.16, 'square', 0.1, 0, 0.14); },
      beamfire: () => { this.tone(300, 0.35, 'sawtooth', 0.14, -200); this.hiss(0.3, 0.1, 1500); },
      portal: () => this.tone(180, 0.6, 'sine', 0.22, 700),
      start: () => { [262, 330, 392, 523].forEach((f, i) => this.tone(f, 0.16, 'square', 0.12, 0, i * 0.08)); },
      blip: () => this.tone(520 + Math.random() * 120, 0.035, 'square', 0.05),
      win: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'square', 0.12, 0, i * 0.12)); },
      lose: () => { [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.12, 0, i * 0.2)); },
      slam: () => { this.hiss(0.5, 0.25, 500, 0, 'lowpass'); this.tone(70, 0.5, 'square', 0.22, -30); },
      fatality: () => { this.tone(100, 1.1, 'sawtooth', 0.22, -60); this.hiss(1, 0.2, 800, 0, 'lowpass'); },
      konami: () => { [523, 784, 1047, 784, 1047, 1568].forEach((f, i) => this.tone(f, 0.1, 'square', 0.1, 0, i * 0.06)); },
    };
    table[name]?.();
  }

  /** 56k-Modem-Handshake für die Intro-Szene. */
  modem() {
    if (!this.running) return;
    [[2100, 0.35], [1200, 0.12], [2400, 0.2], [980, 0.16], [1800, 0.22], [1300, 0.12], [2250, 0.3]].reduce((t, [f, d]) => {
      this.tone(f, d, 'square', 0.05, 0, t);
      this.hiss(d, 0.04, 1500 + f, t, 'bandpass');
      return t + d;
    }, 0);
    this.hiss(1.6, 0.08, 3000, 1.5, 'bandpass');
  }

  /** Scheduler: pro Frame aufrufen, plant Noten kurz vorausschauend. */
  tick() {
    if (!this.running || !this.track) return;
    const tr = this.track;
    const now = this.ctx.currentTime;
    if (this.nextAt < now - 0.3) this.nextAt = now + 0.02;
    const stepDur = 60 / tr.bpm / 4;
    while (this.nextAt < now + 0.12) {
      const s = this.step++;
      const t = this.nextAt;
      const hz = (semi) => 440 * Math.pow(2, (tr.root + semi - 69) / 12);
      const lead = tr.lead32[s % 32];
      const bass = tr.bass16[s % 16];
      const bar = Math.floor(s / 16) % tr.drums.length;
      const drum = tr.drums[bar][s % 16];
      const volume = this.duck;
      const at = t - now;
      if (lead != null) this.tone(hz(lead + 12), stepDur * 1.7, tr.lead, tr.leadVol * volume, 0, at);
      if (bass != null) this.tone(hz(bass - 12), stepDur * 1.8, 'triangle', 0.17 * volume, 0, at);
      if (s % 2 === 1 && this.trackName !== 'title' && lead != null) this.tone(hz(lead + 24), stepDur * 0.7, 'square', 0.02 * volume, 0, at + stepDur * 0.5);
      if (drum === 'k') this.tone(130, 0.1, 'sine', 0.26 * volume, -90, at);
      else if (drum === 's') { this.hiss(0.1, 0.09 * volume, 1800, 0, 'highpass', t); this.tone(220, 0.07, 'triangle', 0.06 * volume, -100, at); }
      else if (drum === 'h') this.hiss(0.03, 0.035 * volume, 7000, 0, 'highpass', t);
      this.nextAt += stepDur;
    }
  }
}
