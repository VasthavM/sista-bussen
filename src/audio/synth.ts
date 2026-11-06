/**
 * WebAudio synthesis for every sound in the game. No samples, no downloads.
 * Each voice is scheduled, then its node graph is disconnected from the
 * `ended` handler so repeated plays cannot leak nodes.
 */
import type { Sfx } from './index';

const THROTTLE = 0.03;
const MAX_VOICES = 18;

/** tanh-ish saturation curve, built once. */
const SAT_CURVE = (() => {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 2.6);
  }
  return curve;
})();

function attackEnv(
  gain: GainNode,
  t: number,
  peak: number,
  attack: number,
  hold: number,
  decay: number,
): void {
  const p = Math.max(0.0002, peak);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(p, t + attack);
  if (hold > 0) gain.gain.setValueAtTime(p, t + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
}

export class SoundBank {
  private readonly ctx: AudioContext;
  private readonly out: GainNode;
  private readonly noise: AudioBuffer;
  private readonly last = new Map<Sfx, number>();
  private readonly sat: WaveShaperNode;
  private voices = 0;

  constructor(ctx: AudioContext, out: GainNode) {
    this.ctx = ctx;
    this.out = out;
    const len = Math.floor(ctx.sampleRate * 1.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 22222;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = ((seed >>> 8) / 8388608 - 1) * 0.9;
    }
    this.noise = buf;
    this.sat = ctx.createWaveShaper();
    this.sat.curve = SAT_CURVE;
    this.sat.oversample = '2x';
    this.sat.connect(out);
  }

  private release(nodes: AudioNode[], sources: AudioScheduledSourceNode[]): void {
    const last = sources[sources.length - 1];
    if (!last) return;
    last.onended = () => {
      for (let i = 0; i < nodes.length; i++) {
        try {
          nodes[i].disconnect();
        } catch {
          // Already disconnected.
        }
      }
      for (let i = 0; i < sources.length; i++) {
        try {
          sources[i].disconnect();
        } catch {
          // Already disconnected.
        }
      }
    };
  }

  /** Simple oscillator voice with an amplitude envelope. */
  private tone(
    type: OscillatorType,
    freq: number,
    t: number,
    attack: number,
    hold: number,
    decay: number,
    peak: number,
    freqEnd?: number,
    dest?: AudioNode,
  ): GainNode {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(8, freq), t);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(8, freqEnd), t + attack + hold + decay);
    }
    attackEnv(gain, t, peak, attack, hold, decay);
    osc.connect(gain);
    gain.connect(dest ?? this.out);
    osc.start(t);
    osc.stop(t + attack + hold + decay + 0.05);
    this.release([gain], [osc]);
    return gain;
  }

  /** Filtered noise burst — impacts, hisses, whooshes. */
  private burst(
    t: number,
    attack: number,
    hold: number,
    decay: number,
    peak: number,
    filter: BiquadFilterType,
    f0: number,
    f1: number,
    q: number,
    dest?: AudioNode,
  ): GainNode {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.setValueAtTime(1, t);
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.setValueAtTime(Math.max(40, f0), t);
    if (f1 !== f0) biquad.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + attack + hold + decay);
    biquad.Q.setValueAtTime(q, t);
    const gain = ctx.createGain();
    attackEnv(gain, t, peak, attack, hold, decay);
    src.connect(biquad);
    biquad.connect(gain);
    gain.connect(dest ?? this.out);
    src.start(t);
    src.stop(t + attack + hold + decay + 0.05);
    this.release([biquad, gain], [src]);
    return gain;
  }

  /** Short feedback delay used to give level-up and evolution a tail. */
  private echo(amount: number, time: number): GainNode {
    const ctx = this.ctx;
    const input = ctx.createGain();
    const delay = ctx.createDelay(0.6);
    delay.delayTime.setValueAtTime(time, ctx.currentTime);
    const fb = ctx.createGain();
    fb.gain.setValueAtTime(amount, ctx.currentTime);
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.setValueAtTime(2600, ctx.currentTime);
    input.connect(this.out);
    input.connect(delay);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(this.out);
    return input;
  }

  get busy(): number {
    return this.voices;
  }

  play(id: Sfx): void {
    const now = this.ctx.currentTime;
    const prev = this.last.get(id);
    if (prev !== undefined && now - prev < THROTTLE) return;
    this.last.set(id, now);
    if (this.voices > MAX_VOICES) return;
    this.voices++;
    const t = now + 0.006;
    try {
      this.build(id, t);
    } catch {
      // Never let a synthesis hiccup break the loop.
    }
    // Decay the counter on a timer that is cheap and bounded.
    const hold = id === 'evolution' ? 900 : id === 'levelup' || id === 'win' ? 600 : 220;
    setTimeout(() => {
      this.voices = Math.max(0, this.voices - 1);
    }, hold);
  }

  private build(id: Sfx, t: number): void {
    switch (id) {
      case 'hit': {
        this.burst(t, 0.002, 0.004, 0.05, 0.1, 'bandpass', 2400, 1300, 1.4);
        this.tone('sine', 190, t, 0.002, 0.002, 0.04, 0.05, 120);
        break;
      }
      case 'kill': {
        // Weighty thump + a wet crunch, then a short pitched tail: reads as a kill.
        this.tone('sine', 190, t, 0.003, 0.02, 0.19, 0.3, 62);
        this.burst(t + 0.005, 0.003, 0.02, 0.16, 0.16, 'bandpass', 1100, 320, 0.9);
        this.tone('square', 320, t + 0.01, 0.004, 0.01, 0.13, 0.06, 90, this.sat);
        this.burst(t + 0.13, 0.004, 0.01, 0.14, 0.05, 'highpass', 3200, 5200, 0.7);
        break;
      }
      case 'pickup_xp': {
        const f = 1150 + Math.random() * 180;
        this.tone('triangle', f, t, 0.002, 0.006, 0.055, 0.09, f * 1.5);
        break;
      }
      case 'pickup_change': {
        this.tone('sine', 2450, t, 0.002, 0.004, 0.05, 0.07);
        this.tone('sine', 3680, t + 0.035, 0.002, 0.004, 0.07, 0.05);
        this.burst(t, 0.002, 0.002, 0.04, 0.04, 'highpass', 4200, 4200, 0.8);
        break;
      }
      case 'levelup': {
        // Rising arpeggio with an echo tail: the reward moment.
        const bus = this.echo(0.3, 0.11);
        const notes = [293.66, 369.99, 440.0, 587.33];
        for (let i = 0; i < notes.length; i++) {
          const nt = t + i * 0.075;
          this.tone('triangle', notes[i], nt, 0.004, 0.02, 0.24, 0.16, undefined, bus);
          this.tone('sine', notes[i] * 2, nt, 0.004, 0.01, 0.12, 0.06, undefined, bus);
        }
        this.burst(t + 0.28, 0.01, 0.02, 0.3, 0.05, 'highpass', 5000, 9000, 0.6);
        break;
      }
      case 'evolution': {
        // Power spike: sub drop, riser, then a bright sustained chord.
        this.tone('sine', 130, t, 0.005, 0.06, 0.85, 0.34, 32);
        this.burst(t, 0.02, 0.35, 0.35, 0.07, 'bandpass', 300, 4200, 1.1);
        const bus = this.echo(0.36, 0.13);
        const chord = [220, 277.18, 329.63, 440];
        for (let i = 0; i < chord.length; i++) {
          const nt = t + 0.4 + i * 0.012;
          this.tone('sawtooth', chord[i], nt, 0.02, 0.18, 0.9, 0.085, undefined, bus);
          this.tone('triangle', chord[i] * 2, nt, 0.02, 0.1, 0.6, 0.05, undefined, bus);
        }
        this.burst(t + 0.42, 0.01, 0.08, 0.5, 0.08, 'highpass', 6000, 9000, 0.7);
        break;
      }
      case 'hurt': {
        this.tone('square', 150, t, 0.003, 0.02, 0.16, 0.2, 72, this.sat);
        this.burst(t, 0.002, 0.01, 0.12, 0.12, 'lowpass', 1600, 400, 0.8);
        break;
      }
      case 'death': {
        this.tone('sawtooth', 300, t, 0.01, 0.05, 0.95, 0.22, 42, this.sat);
        this.tone('sine', 90, t, 0.01, 0.1, 1.1, 0.2, 30);
        this.burst(t + 0.05, 0.05, 0.2, 0.8, 0.08, 'lowpass', 2200, 260, 0.7);
        break;
      }
      case 'revive': {
        // The bus is delayed: a door hiss that opens up into a rising swell,
        // then a heavy thump as the run resumes.
        this.burst(t, 0.06, 0.1, 0.34, 0.1, 'highpass', 1400, 3600, 0.7);
        this.tone('sine', 55, t + 0.12, 0.01, 0.06, 0.5, 0.24, 110);
        this.tone('triangle', 220, t + 0.05, 0.08, 0.16, 0.5, 0.1, 440);
        this.tone('triangle', 330, t + 0.16, 0.06, 0.14, 0.5, 0.07, 660);
        break;
      }
      case 'win': {
        // Bus doors hiss, then the arrival chord.
        this.burst(t, 0.02, 0.18, 0.42, 0.12, 'highpass', 2400, 5200, 0.7);
        const bus = this.echo(0.28, 0.16);
        const chord = [261.63, 329.63, 392.0, 523.25];
        for (let i = 0; i < chord.length; i++) {
          this.tone('triangle', chord[i], t + 0.32 + i * 0.03, 0.02, 0.15, 1.1, 0.11, undefined, bus);
        }
        this.tone('sine', 65.4, t + 0.32, 0.02, 0.2, 1.0, 0.2, 48);
        break;
      }
      case 'ui_click': {
        this.tone('square', 1750, t, 0.001, 0.002, 0.02, 0.05, 1500);
        this.burst(t, 0.001, 0.002, 0.014, 0.05, 'highpass', 3000, 3000, 0.7);
        break;
      }
      case 'ui_buy': {
        this.burst(t, 0.002, 0.01, 0.07, 0.09, 'bandpass', 1800, 900, 0.9);
        this.tone('sine', 1550, t + 0.02, 0.002, 0.01, 0.1, 0.11, 2100);
        this.tone('sine', 2600, t + 0.055, 0.002, 0.01, 0.09, 0.07);
        this.tone('triangle', 420, t + 0.02, 0.004, 0.02, 0.12, 0.08, 260);
        break;
      }
      case 'ad_reward': {
        const notes = [880, 1108.7, 1318.5, 1760, 2217.5];
        for (let i = 0; i < notes.length; i++) {
          this.tone('sine', notes[i], t + i * 0.055, 0.003, 0.01, 0.14, 0.075);
        }
        this.burst(t + 0.22, 0.01, 0.04, 0.3, 0.045, 'highpass', 7000, 9000, 0.6);
        break;
      }
      case 'reroll': {
        this.burst(t, 0.02, 0.06, 0.22, 0.1, 'bandpass', 420, 3200, 1.3);
        this.tone('triangle', 620, t + 0.06, 0.01, 0.02, 0.18, 0.06, 1180);
        break;
      }
      default:
        break;
    }
  }
}