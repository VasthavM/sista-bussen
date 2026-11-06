/** Audio engine: one lazily created context, a hard-limited master chain, no sound before unlock. */
import type { AudioEngine, Sfx } from './index';
import { Beds } from './beds';
import { SoundBank } from './synth';
import { loadMuted, saveMuted } from './store';

const MASTER_LEVEL = 0.8;

type AudioCtor = typeof AudioContext;

function audioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class AudioEngineImpl implements AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bank: SoundBank | null = null;
  private beds: Beds | null = null;
  private muted: boolean = loadMuted();
  private intensity = 0.25;
  private unlocked = false;
  private destroyed = false;

  unlock(): void {
    if (this.destroyed) return;
    if (!this.ctx) {
      const Ctor = audioCtor();
      if (!Ctor) return;
      let ctx: AudioContext;
      try {
        ctx = new Ctor({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.ctx = ctx;

      // master -> limiter -> destination. The limiter is the safety net that
      // keeps a burst of simultaneous kills from clipping.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.setValueAtTime(-10, ctx.currentTime);
      limiter.knee.setValueAtTime(6, ctx.currentTime);
      limiter.ratio.setValueAtTime(14, ctx.currentTime);
      limiter.attack.setValueAtTime(0.003, ctx.currentTime);
      limiter.release.setValueAtTime(0.22, ctx.currentTime);
      const master = ctx.createGain();
      master.gain.setValueAtTime(this.muted ? 0.0001 : MASTER_LEVEL, ctx.currentTime);
      master.connect(limiter);
      limiter.connect(ctx.destination);
      this.master = master;

      this.bank = new SoundBank(ctx, master);
      this.beds = new Beds(ctx, master);
      this.beds.setIntensity(this.intensity);
    }

    this.unlocked = true;
    const ctx = this.ctx;
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }
    this.applyMaster();
    this.beds?.setIntensity(this.intensity);
  }

  play(sfx: Sfx): void {
    if (!this.unlocked || this.muted || this.destroyed) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.bank?.play(sfx);
  }

  setIntensity(value: number): void {
    const v = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    this.intensity = Math.max(0, Math.min(1, v));
    if (this.unlocked) this.beds?.setIntensity(this.intensity);
  }

  setMuted(muted: boolean): void {
    this.muted = !!muted;
    saveMuted(this.muted);
    this.applyMaster();
  }

  isMuted(): boolean {
    return this.muted;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unlocked = false;
    this.beds?.destroy();
    this.beds = null;
    this.bank = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    if (ctx) {
      try {
        void ctx.close().catch(() => undefined);
      } catch {
        // Already closed.
      }
    }
  }

  private applyMaster(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    try {
      const target = this.muted ? 0.0001 : MASTER_LEVEL;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
    } catch {
      // Context closing.
    }
  }
}