/**
 * Presentation root. Owns the canvas, the camera transform and the layered draw
 * order. Reads only: no caller state is mutated except the sim event buffer,
 * which is cleared only once it is saturated (the sim stops pushing at that
 * point, so somebody has to).
 */
import { clockLabel } from '../sim/curve';
import { ENEMIES, WEAPONS } from '../sim/content';
import { EVENT_POOL, WORLD, clearEvents } from '../sim/state';
import type { SimEvent, SimState } from '../sim/types';
import { beginWorld, computeViewport, computeZoom, endWorld, resetToScreen } from './draw';
import type { Draw, Viewport } from './draw';
import { drawEnemies, drawPlayer, drawShadows } from './entities';
import { drawGroundBloom, groundLayer, invalidateGroundLayer } from './ground';
import { PAL, ENEMY_LOOK, WEAPON_LOOK } from './palette';
import { DamageNumbers, ParticleField } from './particles';
import { PostFx, drawHurtVeil, drawPauseVeil, resetPost } from './post';
import { drawGlow, glowSprite } from './sprites';
import { drawStick } from './stick';
import { clamp, rgba } from './util';
import { EffectTrails, WeaponFx, drawAreaEffects, drawEnemyShots, drawOrbs, drawProjectiles, drawWeaponSystems } from './weapons';

export interface StickVisual {
  active: boolean;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
}

export interface ViewState {
  cameraX: number;
  cameraY: number;
  shakeX: number;
  shakeY: number;
  stick: StickVisual | null;
  paused: boolean;
  dimmed: boolean;
  dt: number;
  elapsed: number;
}

export interface Renderer {
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  drawFrame(state: SimState, view: ViewState): void;
  /** Half extents of the play surface in world units, for visibility checks. */
  viewBounds(): { halfW: number; halfH: number };
  invalidateGround(): void;
  destroy(): void;
}

interface Fx {
  flash: number;
  flashColour: string;
  aberr: number;
  hurt: number;
  boss: number;
  evolve: number;
  win: number;
}

function measureSafeArea(canvas: HTMLCanvasElement): { top: number; bottom: number } {
  const host = canvas.parentElement;
  if (!host || typeof getComputedStyle !== 'function') return { top: 0, bottom: 0 };
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
  host.appendChild(probe);
  let top = 0;
  let bottom = 0;
  try {
    const cs = getComputedStyle(probe);
    top = Number.parseFloat(cs.paddingTop) || 0;
    bottom = Number.parseFloat(cs.paddingBottom) || 0;
  } catch {
    top = 0;
    bottom = 0;
  }
  if (probe.parentNode === host) host.removeChild(probe);
  return { top: Math.min(top, 80), bottom: Math.min(bottom, 80) };
}

class RendererImpl implements Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly particles = new ParticleField();
  private readonly numbers = new DamageNumbers();
  private readonly trails = new EffectTrails();
  private readonly weaponFx = new WeaponFx();
  private readonly post = new PostFx();
  private readonly fx: Fx = { flash: 0, flashColour: '#ffffff', aberr: 0, hurt: 0, boss: 0, evolve: 0, win: 0 };

  private dpr = 1;
  private canvasW = 0;
  private canvasH = 0;
  private vp: Viewport = { x: 0, y: 0, w: 1, h: 1 };
  private zoom = 1;
  private safeTop = 0;
  private safeBottom = 0;
  private rectX = 0;
  private rectY = 0;
  private frame = 0;

  // Event consumption bookkeeping. Nothing here is written back into the sim.
  private seen = 0;
  private sawEmpty = true;
  private lastType = '';
  private lastX = 0;
  private lastY = 0;
  private lastX2 = 0;
  private lastY2 = 0;
  private lastValue = 0;
  private lastText = '';
  private budget = 0;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Sista bussen: 2D canvas context unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.resize(canvas.clientWidth || 360, canvas.clientHeight || 640, window.devicePixelRatio || 1);
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    if (this.destroyed) return;
    const w = Math.max(1, Math.floor(cssWidth));
    const h = Math.max(1, Math.floor(cssHeight));
    const ratio = clamp(dpr || 1, 1, 2.5);
    this.dpr = ratio;
    this.canvasW = w;
    this.canvasH = h;
    this.canvas.width = Math.floor(w * ratio);
    this.canvas.height = Math.floor(h * ratio);
    this.vp = computeViewport(w, h);
    this.zoom = computeZoom(this.vp);
    const safe = measureSafeArea(this.canvas);
    this.safeTop = safe.top;
    this.safeBottom = safe.bottom;
    try {
      const rect = this.canvas.getBoundingClientRect();
      this.rectX = rect.left;
      this.rectY = rect.top;
    } catch {
      this.rectX = 0;
      this.rectY = 0;
    }
    resetPost();
  }

  invalidateGround(): void {
    invalidateGroundLayer();
  }

  viewBounds(): { halfW: number; halfH: number } {
    return { halfW: this.vp.w / (2 * this.zoom), halfH: this.vp.h / (2 * this.zoom) };
  }

  destroy(): void {
    this.destroyed = true;
    this.particles.clear();
    this.numbers.clear();
    this.trails.clear();
    this.fx.flash = 0;
    this.fx.evolve = 0;
    resetPost();
    // Release the backing store so a discarded canvas does not hold memory.
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  drawFrame(state: SimState, view: ViewState): void {
    if (this.destroyed) return;
    const ctx = this.ctx;
    const dt = view.paused ? 0 : clamp(view.dt, 0, 0.05);
    this.frame++;
    this.budget = 260;

    const d: Draw = {
      ctx,
      state,
      view,
      dpr: this.dpr,
      canvasW: this.canvasW,
      canvasH: this.canvasH,
      vp: this.vp,
      zoom: this.zoom,
      inv: 1 / this.zoom,
      camX: view.cameraX,
      camY: view.cameraY,
      shakeX: view.shakeX,
      shakeY: view.shakeY,
      halfW: this.vp.w / (2 * this.zoom),
      halfH: this.vp.h / (2 * this.zoom),
      safeTop: this.safeTop,
      safeBottom: this.safeBottom,
      rectX: this.rectX,
      rectY: this.rectY,
      frame: this.frame,
      t: state.time,
      paused: view.paused,
      dimmed: view.dimmed,
      flash: this.fx.flash,
      flashColour: this.fx.flashColour,
      aberr: this.fx.aberr,
      hurt: this.fx.hurt,
      boss: this.fx.boss,
      evolve: this.fx.evolve,
    };

    this.consumeEvents(d);
    this.decayFx(dt);
    d.flash = this.fx.flash;
    d.flashColour = this.fx.flashColour;
    d.aberr = this.fx.aberr;
    d.hurt = this.fx.hurt;
    d.boss = this.fx.boss;
    d.evolve = this.fx.evolve;

    this.particles.update(dt);
    this.numbers.update(dt);
    this.trails.update(dt);
    if (!view.paused) this.weaponFx.update(d, this.trails, this.particles);

    resetToScreen(d);

    // Letterbox.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#03050a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    resetToScreen(d);

    this.drawWorld(d);
    this.post.draw(d);
    drawHurtVeil(d);
    drawStick(d);
    if (this.fx.boss > 0.01) this.drawBossPulse(d);
    if (state.status !== 'running' && !view.dimmed) this.drawStatusBand(d);
    if (this.fx.evolve > 0.01) this.drawEvolutionBanner(d);
    drawPauseVeil(d);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawWorld(d: Draw): void {
    const ctx = d.ctx;
    beginWorld(d);

    // Static ground: crop the visible window out of the world layer.
    const ground = groundLayer();
    const pad = 24;
    const sx = clamp(Math.floor(d.camX - d.halfW - pad), 0, WORLD.w);
    const sy = clamp(Math.floor(d.camY - d.halfH - pad), 0, WORLD.h);
    const sw = clamp(Math.ceil(d.halfW * 2 + pad * 2), 1, WORLD.w - sx);
    const sh = clamp(Math.ceil(d.halfH * 2 + pad * 2), 1, WORLD.h - sy);
    ctx.globalAlpha = 1;
    ctx.drawImage(ground, sx, sy, sw, sh, sx, sy, sw, sh);

    drawGroundBloom(ctx, d.camX, d.camY, d.halfW, d.halfH, d.t);
    drawShadows(d);
    this.particles.draw(d, 0);
    drawAreaEffects(d);
    drawOrbs(d);
    drawEnemies(d);
    drawPlayer(d);
    drawWeaponSystems(d);
    this.trails.draw(d);
    this.particles.draw(d, 1);
    this.numbers.draw(d);

    if (d.evolve > 0.01) this.drawEvolutionBurst(d);

    // Player-local lift so the character never disappears into the asphalt.
    drawGlow(ctx, glowSprite(PAL.fluoro), d.state.player.x, d.state.player.y, 120, 0.05);

    endWorld(d);
    ctx.globalAlpha = 1;
  }

  /* --- events --------------------------------------------------------- */

  private spawnAllowed(n: number): boolean {
    if (this.budget < n) return false;
    this.budget -= n;
    return true;
  }

  private consumeEvents(d: Draw): void {
    const st = d.state;
    const total = st.eventCount | 0;
    if (total <= 0) {
      this.seen = 0;
      this.sawEmpty = true;
      return;
    }

    // The application layer may clear the pool after each frame (game.ts does),
    // in which case the buffer we saw last frame is gone. Replaying a few
    // already-drawn transients is harmless; dropping the frame's feedback is not,
    // so any sign of a rewrite restarts consumption at zero.
    let start = this.seen;
    if (this.sawEmpty || start > total) {
      start = 0;
    } else if (start > 0) {
      const prev = st.events[start - 1];
      if (
        prev.type !== this.lastType ||
        prev.x !== this.lastX ||
        prev.y !== this.lastY ||
        prev.x2 !== this.lastX2 ||
        prev.y2 !== this.lastY2 ||
        prev.value !== this.lastValue ||
        prev.text !== this.lastText
      ) {
        start = 0;
      }
    }

    const intensity = !d.paused && !d.dimmed;

    for (let i = start; i < total; i++) {
      this.handleEvent(d, st.events[i], intensity);
    }

    const tail = st.events[total - 1];
    this.lastType = tail.type;
    this.lastX = tail.x;
    this.lastY = tail.y;
    this.lastX2 = tail.x2;
    this.lastY2 = tail.y2;
    this.lastValue = tail.value;
    this.lastText = tail.text;
    this.seen = total;
    this.sawEmpty = false;

    // Saturation guard: the sim stops pushing events at the pool limit, so once
    // everything is consumed the buffer must be recycled.
    if (total >= EVENT_POOL && this.seen >= EVENT_POOL) {
      clearEvents(st);
      this.seen = 0;
      this.sawEmpty = true;
    }

    // Keep effect density honest when a whole burst lands in one frame.
    if (this.budget < 60) this.budget = 60;
  }

  private handleEvent(d: Draw, e: SimEvent, intensity: boolean): void {
    const st = d.state;
    const px = st.player.x;
    const py = st.player.y;

    switch (e.type) {
      case 'hit': {
        const crit = e.text === 'crit';
        if (intensity && this.spawnAllowed(4)) {
          const dx = e.x - px;
          const dy = e.y - py;
          this.particles.hit(e.x, e.y, dx, dy, crit ? PAL.amberWarm : PAL.ink, crit ? 1.6 : 1);
        }
        this.numbers.spawn(e.x, e.y, e.value, crit, crit ? PAL.amberWarm : '#e6eef7', crit ? 17 : 12);
        break;
      }
      case 'kill': {
        const look = ENEMY_LOOK[e.text as keyof typeof ENEMY_LOOK];
        const def = ENEMIES[e.text as keyof typeof ENEMIES];
        const big = !!def && (e.text === 'nattvakt' || e.text === 'chauffor');
        if (intensity && this.spawnAllowed(big ? 40 : 16)) {
          this.particles.kill(e.x, e.y, look ? look.fill : PAL.ink, big);
        }
        break;
      }
      case 'hurt': {
        this.fx.hurt = Math.min(1, this.fx.hurt + 0.55);
        this.fx.flash = Math.max(this.fx.flash, 0.16);
        this.fx.flashColour = PAL.danger;
        if (intensity && this.spawnAllowed(8)) this.particles.hit(e.x, e.y, 0, -1, PAL.danger, 1.4);
        break;
      }
      case 'levelup': {
        this.fx.flash = Math.max(this.fx.flash, 0.44);
        this.fx.flashColour = PAL.fluoro;
        this.fx.aberr = 1;
        if (intensity && this.spawnAllowed(6)) {
          this.particles.ring(e.x, e.y, 26, PAL.fluoro, 0.55, 0.9);
          this.particles.ring(e.x, e.y, 52, PAL.green, 0.7, 0.55);
        }
        break;
      }
      case 'evolve': {
        this.fx.flash = Math.max(this.fx.flash, 0.72);
        this.fx.flashColour = PAL.amber;
        this.fx.aberr = 1;
        this.fx.evolve = 1.6;
        if (intensity && this.spawnAllowed(14)) {
          this.particles.ring(e.x, e.y, 40, PAL.amber, 0.9, 1);
          this.particles.ring(e.x, e.y, 90, PAL.amberWarm, 1.1, 0.7);
        }
        break;
      }
      case 'pickup': {
        const change = e.text === 'change';
        if (intensity && this.spawnAllowed(5)) {
          this.particles.pickup(e.x, e.y, change ? PAL.amberWarm : PAL.green, e.value);
        }
        break;
      }
      case 'chain': {
        const w = st.weapons.find((it) => it.id === 'telefon');
        this.trails.addChain(e.x, e.y, e.x2, e.y2, !!w && w.evolved);
        break;
      }
      case 'beam': {
        const w = st.weapons.find((it) => it.id === 'ficklampa');
        this.trails.addBeam(e.x, e.y, e.x2, e.y2, e.value > 0 ? e.value : 34, !!w && w.evolved);
        break;
      }
      case 'burst': {
        const evolved = e.text === 'evo';
        if (intensity && this.spawnAllowed(12)) {
          this.particles.ring(e.x, e.y, e.value, evolved ? PAL.amberWarm : WEAPON_LOOK.korv.hot, 0.36, 0.9);
          this.particles.splash(e.x, e.y, e.value * 0.6, evolved ? PAL.amber : PAL.amberDeep);
        }
        if (evolved) {
          this.fx.flash = Math.max(this.fx.flash, 0.3);
          this.fx.flashColour = PAL.amberWarm;
        }
        break;
      }
      case 'shoot': {
        const isPlayer = e.text in WEAPONS;
        if (intensity && this.spawnAllowed(4)) {
          this.particles.splash(e.x, e.y, isPlayer ? 12 : 18, isPlayer ? PAL.ink : PAL.danger);
        }
        break;
      }
      case 'boss': {
        this.fx.flash = Math.max(this.fx.flash, 0.3);
        this.fx.flashColour = PAL.danger;
        this.fx.boss = 1.4;
        break;
      }
      case 'win': {
        this.fx.flash = Math.max(this.fx.flash, 0.6);
        this.fx.flashColour = PAL.amberWarm;
        this.fx.win = 2.2;
        if (this.spawnAllowed(20)) {
          this.particles.ring(e.x, e.y, 40, PAL.amberWarm, 1.4, 1);
          this.particles.ring(e.x, e.y, 120, PAL.green, 1.7, 0.6);
        }
        break;
      }
      case 'revive': {
        this.fx.flash = Math.max(this.fx.flash, 0.5);
        this.fx.flashColour = PAL.green;
        this.fx.aberr = 0.8;
        if (this.spawnAllowed(12)) {
          this.particles.ring(e.x, e.y, 30, PAL.green, 0.8, 1);
          this.particles.ring(e.x, e.y, 80, PAL.fluoro, 1.0, 0.6);
        }
        break;
      }
      default:
        break;
    }
  }

  private decayFx(dt: number): void {
    if (dt <= 0) return;
    this.fx.flash = Math.max(0, this.fx.flash - dt * 2.4);
    this.fx.aberr = Math.max(0, this.fx.aberr - dt * 2.6);
    this.fx.hurt = Math.max(0, this.fx.hurt - dt * 2.2);
    this.fx.boss = Math.max(0, this.fx.boss - dt * 1.1);
    this.fx.evolve = Math.max(0, this.fx.evolve - dt);
    this.fx.win = Math.max(0, this.fx.win - dt);
  }

  /* --- one-off set pieces --------------------------------------------- */

  private drawEvolutionBurst(d: Draw): void {
    const ctx = d.ctx;
    const p = d.state.player;
    const k = d.evolve / 1.6; // 1 -> 0
    const grow = 1 - k;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const kk = clamp(grow * 1.6 - i * 0.22, 0, 1);
      if (kk <= 0) continue;
      ctx.globalAlpha = (1 - kk) * 0.85;
      ctx.strokeStyle = i === 1 ? PAL.amberWarm : PAL.amber;
      ctx.lineWidth = 6 * (1 - kk) + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 24 + kk * 230, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Radial spikes: the "power spike" read.
    const rays = 14;
    ctx.globalAlpha = k * 0.8;
    ctx.strokeStyle = PAL.amberWarm;
    ctx.lineWidth = 3;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + grow * 0.9;
      const inner = 20 + grow * 30;
      const outer = inner + 60 * k + 22;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * inner, p.y + Math.sin(a) * inner);
      ctx.lineTo(p.x + Math.cos(a) * outer, p.y + Math.sin(a) * outer);
      ctx.stroke();
    }
    ctx.restore();
    drawGlow(ctx, glowSprite(PAL.amber), p.x, p.y, 190 * k + 40, 0.5 * k);
  }

  private drawEvolutionBanner(d: Draw): void {
    const ctx = d.ctx;
    const vp = d.vp;
    const k = clamp(d.evolve / 1.6, 0, 1);
    const a = Math.min(1, k * 2.2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.round(clamp(vp.w * 0.1, 20, 46));
    ctx.font = `700 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const y = vp.y + vp.h * 0.3;
    ctx.fillStyle = 'rgba(4,6,10,0.85)';
    ctx.fillText('UTVECKLAD', vp.x + vp.w / 2 + 2, y + 2);
    ctx.fillStyle = PAL.amberWarm;
    ctx.fillText('UTVECKLAD', vp.x + vp.w / 2, y);
    ctx.restore();
  }

  private drawStatusBand(d: Draw): void {
    const st = d.state;
    const ctx = d.ctx;
    const vp = d.vp;
    const won = st.status === 'won';
    const y = vp.y + vp.h * 0.42;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.round(clamp(vp.w * 0.085, 20, 40));
    ctx.font = `700 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillStyle = won ? rgba(PAL.green, 0.95) : rgba(PAL.danger, 0.95);
    ctx.fillText(won ? 'BUSSEN GÅR' : 'DU MISSADE BUSSEN', vp.x + vp.w / 2, y);
    ctx.restore();
  }

  private drawBossPulse(d: Draw): void {
    const ctx = d.ctx;
    const vp = d.vp;
    const a = d.boss / 1.4;
    ctx.save();
    ctx.globalAlpha = a * 0.5;
    ctx.strokeStyle = PAL.danger;
    ctx.lineWidth = 4;
    ctx.strokeRect(vp.x + 3, vp.y + 3, vp.w - 6, vp.h - 6);
    ctx.globalAlpha = a * 0.22;
    ctx.fillStyle = PAL.danger;
    ctx.fillRect(vp.x, vp.y, vp.w, 4);
    ctx.fillRect(vp.x, vp.y + vp.h - 4, vp.w, 4);
    ctx.restore();
  }
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  return new RendererImpl(canvas);
}

/** Exported for callers that want the same clock string the HUD draws. */
export { clockLabel };