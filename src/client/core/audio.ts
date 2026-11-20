import { settings } from './settings.ts';

/**
 * All sound is synthesised with the Web Audio API: no audio files, nothing copyrighted.
 * The context is created on the first user gesture (autoplay rules).
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padNodes: { stop: () => void } | null = null;
  private noise: AudioBuffer | null = null;

  /** Call from a pointer/key handler. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext;
      this.ctx = new Ctor();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = settings.muted ? 0 : 0.7;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(m: boolean): void {
    settings.setMuted(m);
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  /** Soft ambient pad. Chords per layer: minor, suspended, major. */
  pad(layer: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    this.padNodes?.stop();
    const chords: number[][] = [
      [146.83, 174.61, 220.0], // D minor
      [130.81, 174.61, 196.0], // C sus4
      [164.81, 207.65, 246.94], // E major
    ];
    const notes = chords[Math.max(0, Math.min(2, layer))] ?? chords[0] ?? [];
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(0.09, ctx.currentTime, 1.2);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(filter.frequency);
    filter.connect(out).connect(master);
    const oscs = notes.flatMap((f) =>
      [-4, 4].map((detune) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = detune;
        o.connect(filter);
        o.start();
        return o;
      })
    );
    lfo.start();
    this.padNodes = {
      stop: () => {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
        const end = ctx.currentTime + 3;
        oscs.forEach((o) => o.stop(end));
        lfo.stop(end);
      },
    };
  }

  private burst(freq: number, q: number, dur: number, gain: number, when = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + when;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t0, Math.random() * 0.3, dur + 0.05);
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', when = 0, slideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const o = ctx.createOscillator();
    o.type = type;
    const t0 = ctx.currentTime + when;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  step(): void {
    this.burst(900 + Math.random() * 500, 1.4, 0.09, 0.22);
  }
  bump(): void {
    this.tone(110, 0.12, 0.25, 'sine', 0, 70);
  }
  click(): void {
    this.burst(2600, 2, 0.05, 0.18);
  }
  heartbeat(): void {
    this.tone(62, 0.16, 0.55, 'sine', 0, 45);
    this.tone(55, 0.18, 0.4, 'sine', 0.2, 40);
  }
  drop(): void {
    [880, 1318.5, 1760].forEach((f, i) => this.tone(f, 0.9, 0.12, 'sine', i * 0.07));
    this.tone(330, 1.2, 0.18, 'triangle', 0, 110);
  }
  ability(): void {
    this.tone(660, 0.35, 0.16, 'triangle', 0, 990);
    this.tone(990, 0.4, 0.08, 'sine', 0.05, 1320);
  }
  key(): void {
    [1046.5, 1318.5, 1568].forEach((f, i) => this.tone(f, 0.5, 0.1, 'sine', i * 0.09));
  }
  caught(): void {
    this.tone(220, 0.5, 0.25, 'sawtooth', 0, 90);
  }
  tide(): void {
    this.burst(400, 0.7, 0.7, 0.08);
  }
  bloom(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, 1.6, 0.09, 'sine', i * 0.12));
  }
  shatter(): void {
    for (let i = 0; i < 7; i++) this.burst(1500 + Math.random() * 3000, 3, 0.18, 0.18, i * 0.05);
  }
}

export const audio = new AudioEngine();
