import { settings } from './settings.ts';

/**
 * All sound is synthesised with the Web Audio API: no samples, no third-party music.
 * Two buses (music, sfx) with their own volume. The context starts on the first tap.
 */

type Song = {
  bpm: number;
  /** Chord roots (MIDI) per bar, with chord quality offsets. */
  chords: { root: number; notes: number[] }[];
  kick: string;
  snare: string;
  hat: string;
  open: string;
  bass: string;
  stab: string;
  arp: boolean;
  lead: number[] | null;
};

// 16-step patterns: x = hit, . = rest.
const SONGS: Song[] = [
  // Layer 1: chill (92 BPM)
  {
    bpm: 92,
    chords: [
      { root: 50, notes: [0, 3, 7, 10] }, // Dm7
      { root: 46, notes: [0, 4, 7, 11] }, // Bbmaj7
      { root: 53, notes: [0, 4, 7, 9] }, // F6
      { root: 48, notes: [0, 4, 7, 10] }, // C7
    ],
    kick: 'x.....x...x.....',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    open: '................',
    bass: 'x.....x...x.....',
    stab: '......x.......x.',
    arp: false,
    lead: null,
  },
  // Layer 2: faster (112 BPM), sixteenth arpeggio
  {
    bpm: 112,
    chords: [
      { root: 48, notes: [0, 5, 7, 12] }, // Csus4
      { root: 45, notes: [0, 3, 7, 10] }, // Am7
      { root: 53, notes: [0, 4, 7, 11] }, // Fmaj7
      { root: 55, notes: [0, 4, 7, 10] }, // G7
    ],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    open: '..............x.',
    bass: 'x..x..x.x..x..x.',
    stab: '..x...x...x...x.',
    arp: true,
    lead: null,
  },
  // Layer 3: intense (128 BPM), four on the floor, rising lead
  {
    bpm: 128,
    chords: [
      { root: 52, notes: [0, 4, 7, 11] }, // Emaj7
      { root: 49, notes: [0, 3, 7, 10] }, // C#m7
      { root: 45, notes: [0, 4, 7, 9] }, // A6
      { root: 47, notes: [0, 4, 7, 10] }, // B7
    ],
    kick: 'x...x...x...x...',
    snare: '....x.......x..x',
    hat: 'xxxxxxxxxxxxxxxx',
    open: '..x...x...x...x.',
    bass: 'x.xx.xx.x.xx.xx.',
    stab: 'x..x..x...x..x..',
    arp: true,
    lead: [76, 79, 83, 81, 79, 76, 74, 76, 79, 83, 86, 83, 81, 79, 81, 83],
  },
];

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private song: Song | null = null;
  private nextSong: Song | null = null;
  private seqStep = 0;
  private nextTime = 0;
  private timer: number | null = null;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new window.AudioContext();
    } catch {
      return;
    }
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.connect(this.ctx.destination);
    this.music = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.music.connect(comp);
    this.sfx.connect(comp);
    this.applyVolumes();
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Volumes are perceptual (squared). */
  applyVolumes(): void {
    if (!this.ctx || !this.music || !this.sfx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(0.55 * settings.music * settings.music, t, 0.05);
    this.sfx.gain.setTargetAtTime(0.9 * settings.sfx * settings.sfx, t, 0.05);
  }

  /** Start or switch the soundtrack (0 = chill, 1 = faster, 2 = intense). Switches on the next bar. */
  playMusic(layer: number): void {
    if (!this.ctx) return;
    const song = SONGS[Math.max(0, Math.min(2, layer))] ?? null;
    if (!this.song) {
      this.song = song;
      this.seqStep = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 25);
    } else {
      this.nextSong = song;
    }
  }

  stopMusic(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.song = null;
    this.nextSong = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.song) return;
    while (this.nextTime < ctx.currentTime + 0.12) {
      if (this.seqStep % 64 === 0 && this.nextSong) {
        this.song = this.nextSong;
        this.nextSong = null;
      }
      this.playStep(this.song, this.seqStep, this.nextTime);
      this.nextTime += 60 / this.song.bpm / 4;
      this.seqStep = (this.seqStep + 1) % 64;
    }
  }

  private playStep(s: Song, step: number, t: number): void {
    const i = step % 16;
    const chord = s.chords[Math.floor(step / 16) % s.chords.length] ?? s.chords[0];
    if (!chord) return;
    const out = this.music;
    if (!out) return;
    if (s.kick[i] === 'x') this.kick(t, out);
    if (s.snare[i] === 'x') this.snare(t, out);
    if (s.hat[i] === 'x') this.hat(t, out, 0.035, i % 4 === 2 ? 0.09 : 0.05);
    if (s.open[i] === 'x') this.hat(t, out, 0.22, 0.06);
    if (s.bass[i] === 'x') this.bass(midi(chord.root - 12 + (i === 14 ? 12 : 0)), t, out, 60 / s.bpm / 2);
    if (s.stab[i] === 'x') chord.notes.slice(0, 3).forEach((n) => this.pluck(midi(chord.root + 12 + n), t, out, 'triangle', 0.045, 0.22));
    if (s.arp) {
      const n = chord.notes[i % chord.notes.length] ?? 0;
      this.pluck(midi(chord.root + 24 + n), t, out, 'square', 0.018, 0.09);
    }
    if (s.lead && i % 2 === 0) {
      const n = s.lead[(step / 2) % s.lead.length | 0];
      if (n !== undefined && step >= 32) this.pluck(midi(n), t, out, 'sawtooth', 0.03, 0.18);
    }
    // A soft pad under everything, once per bar.
    if (i === 0) chord.notes.forEach((n) => this.pad(midi(chord.root + n), t, out, (60 / s.bpm) * 4));
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private kick(t: number, out: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = ctx.createGain();
    this.env(g, t, 0.8, 0.004, 0.28);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.32);
  }

  private noiseHit(t: number, out: AudioNode, type: BiquadFilterType, freq: number, peak: number, decay: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    this.env(g, t, peak, 0.002, decay);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5, decay + 0.05);
  }

  private snare(t: number, out: AudioNode): void {
    this.noiseHit(t, out, 'bandpass', 1900, 0.35, 0.16);
    this.pluck(190, t, out, 'triangle', 0.12, 0.08);
  }

  private hat(t: number, out: AudioNode, decay: number, peak: number): void {
    this.noiseHit(t, out, 'highpass', 7500, peak, decay);
  }

  private bass(freq: number, t: number, out: AudioNode, len: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(220, t + len);
    const g = ctx.createGain();
    this.env(g, t, 0.28, 0.006, len);
    f.connect(g).connect(out);
    [-6, 6].forEach((d) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = d;
      o.connect(f);
      o.start(t);
      o.stop(t + len + 0.05);
    });
  }

  private pluck(freq: number, t: number, out: AudioNode, type: OscillatorType, peak: number, decay: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    const g = ctx.createGain();
    this.env(g, t, peak, 0.005, decay);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  private pad(freq: number, t: number, out: AudioNode, len: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq / 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + len * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  // ------------------------------------------------------------------ sound effects

  private sfxTone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', when = 0, slideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    this.env(g, t0, gain, 0.012, dur);
    o.connect(g).connect(this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private sfxNoise(freq: number, q: number, dur: number, gain: number, when = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.noise) return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t0, gain, 0.003, dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t0, Math.random() * 0.5, dur + 0.05);
  }

  step(): void {
    this.sfxNoise(900 + Math.random() * 500, 1.4, 0.08, 0.25);
  }
  bump(): void {
    this.sfxTone(110, 0.12, 0.3, 'sine', 0, 70);
  }
  click(): void {
    this.sfxNoise(2600, 2, 0.05, 0.2);
  }
  heartbeat(): void {
    this.sfxTone(62, 0.16, 0.6, 'sine', 0, 45);
    this.sfxTone(55, 0.18, 0.45, 'sine', 0.2, 40);
  }
  drop(): void {
    [880, 1318.5, 1760].forEach((f, i) => this.sfxTone(f, 0.9, 0.12, 'sine', i * 0.07));
    this.sfxTone(330, 1.4, 0.2, 'triangle', 0, 90);
  }
  ability(): void {
    this.sfxTone(660, 0.35, 0.16, 'triangle', 0, 990);
    this.sfxTone(990, 0.4, 0.08, 'sine', 0.05, 1320);
  }
  key(): void {
    [1046.5, 1318.5, 1568].forEach((f, i) => this.sfxTone(f, 0.5, 0.12, 'sine', i * 0.09));
  }
  caught(): void {
    this.sfxTone(220, 0.5, 0.25, 'sawtooth', 0, 90);
  }
  tide(): void {
    this.sfxNoise(400, 0.7, 0.7, 0.1);
  }
  bloom(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.sfxTone(f, 1.6, 0.1, 'sine', i * 0.12));
  }
  shatter(): void {
    for (let i = 0; i < 9; i++) this.sfxNoise(1800 + Math.random() * 3000, 4, 0.2, 0.16, i * 0.06);
    [1568, 2093, 2637].forEach((f, i) => this.sfxTone(f, 1.2, 0.05, 'sine', 0.1 + i * 0.1));
  }
}

export const audio = new AudioEngine();
