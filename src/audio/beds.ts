/**
 * Continuous beds: a filtered rain loop and an intensifying sub-bass pulse.
 * Both are created only after a user gesture (see AudioEngine.unlock).
 */
function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 91357;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const white = (seed >>> 8) / 8388608 - 1;
    data[i] = white * 0.85;
  }
  return buf;
}

export class Beds {
  private readonly ctx: AudioContext;
  private readonly out: GainNode;
  private readonly rainGain: GainNode;
  private readonly rainFilter: BiquadFilterNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly nodes: AudioNode[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextPulse = 0;
  private intensity = 0;

  constructor(ctx: AudioContext, out: GainNode) {
    this.ctx = ctx;
    this.out = out;

    // --- rain bed -------------------------------------------------------
    const rain = ctx.createBufferSource();
    rain.buffer = noiseBuffer(ctx, 2.2);
    rain.loop = true;
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'bandpass';
    this.rainFilter.frequency.setValueAtTime(1050, ctx.currentTime);
    this.rainFilter.Q.setValueAtTime(0.55, ctx.currentTime);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(4200, ctx.currentTime);
    this.rainGain = ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    rain.connect(this.rainFilter);
    this.rainFilter.connect(lowpass);
    lowpass.connect(this.rainGain);
    this.rainGain.connect(out);

    // Slow movement so the loop does not sit still.
    const rainLfo = ctx.createOscillator();
    rainLfo.type = 'sine';
    rainLfo.frequency.setValueAtTime(0.07, ctx.currentTime);
    const rainLfoGain = ctx.createGain();
    rainLfoGain.gain.setValueAtTime(0.014, ctx.currentTime);
    rainLfo.connect(rainLfoGain);
    rainLfoGain.connect(this.rainGain.gain);

    const filterLfo = ctx.createOscillator();
    filterLfo.type = 'sine';
    filterLfo.frequency.setValueAtTime(0.043, ctx.currentTime);
    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.setValueAtTime(240, ctx.currentTime);
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(this.rainFilter.frequency);

    rain.start();
    rainLfo.start();
    filterLfo.start();
    this.sources.push(rain, rainLfo, filterLfo);
    this.nodes.push(this.rainFilter, lowpass, this.rainGain, rainLfoGain, filterLfoGain);

    this.rainGain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 1.6);
    this.nextPulse = ctx.currentTime + 0.4;
    this.timer = setInterval(() => this.schedule(), 90);
  }

  private pulseInterval(): number {
    const i = Math.max(0, Math.min(1, this.intensity));
    return 1.45 - i * 1.11;
  }

  private schedule(): void {
    const ctx = this.ctx;
    const horizon = ctx.currentTime + 0.3;
    const interval = this.pulseInterval();
    let guard = 0;
    while (this.nextPulse < horizon && guard < 8) {
      this.pulseAt(this.nextPulse, interval);
      this.nextPulse += interval;
      guard++;
    }
    if (this.nextPulse < ctx.currentTime) this.nextPulse = ctx.currentTime + 0.05;
  }

  private pulseAt(t: number, interval: number): void {
    const ctx = this.ctx;
    const strength = 0.5 + this.intensity * 0.5;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(52, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.26);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.15 * strength, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain);
    gain.connect(this.out);
    osc.start(t);
    osc.stop(t + 0.32);
    osc.onended = () => {
      try {
        gain.disconnect();
        osc.disconnect();
      } catch {
        // Already gone.
      }
    };

    // At high pressure a dry tick rides on the pulse, so it reads as a clock.
    if (this.intensity > 0.45) {
      const tick = ctx.createOscillator();
      const tickGain = ctx.createGain();
      tick.type = 'square';
      tick.frequency.setValueAtTime(340, t);
      tickGain.gain.setValueAtTime(0.0001, t);
      tickGain.gain.exponentialRampToValueAtTime(0.018 * this.intensity, t + 0.004);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      tick.connect(tickGain);
      tickGain.connect(this.out);
      tick.start(t);
      tick.stop(t + 0.08);
      tick.onended = () => {
        try {
          tickGain.disconnect();
          tick.disconnect();
        } catch {
          // Already gone.
        }
      };
    }
    void interval;
  }

  setIntensity(value: number): void {
    this.intensity = Math.max(0, Math.min(1, value));
    const ctx = this.ctx;
    const target = 0.045 + this.intensity * 0.05;
    try {
      this.rainGain.gain.cancelScheduledValues(ctx.currentTime);
      this.rainGain.gain.setTargetAtTime(target, ctx.currentTime, 0.6);
      this.rainFilter.frequency.setTargetAtTime(950 + this.intensity * 500, ctx.currentTime, 1.2);
    } catch {
      // Context may be closing.
    }
  }

  destroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (let i = 0; i < this.sources.length; i++) {
      try {
        this.sources[i].stop();
      } catch {
        // Already stopped.
      }
      try {
        this.sources[i].disconnect();
      } catch {
        // Already disconnected.
      }
    }
    this.sources.length = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      try {
        this.nodes[i].disconnect();
      } catch {
        // Already disconnected.
      }
    }
    this.nodes.length = 0;
  }
}