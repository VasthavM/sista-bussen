/**
 * Post processing: vignette, film grain, rain, emissive edge aberration and the
 * pause veil. No `ctx.filter`, no blur pass — everything is a pre-rendered
 * sprite or a flat fill.
 */
import type { Draw } from './draw';
import { PAL } from './palette';
import { GRAIN, buildVignette, getGrainTiles } from './sprites';
import { rgba } from './util';

const RAIN_COUNT = 96;

interface Drop {
  u: number;
  v: number;
  speed: number;
  len: number;
  wob: number;
}

let vignette: HTMLCanvasElement | null = null;
let vignetteW = 0;
let vignetteH = 0;

function edgeRing(colour: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 12, 32, 32, 32);
    grad.addColorStop(0, rgba(colour, 0));
    grad.addColorStop(0.72, rgba(colour, 0.16));
    grad.addColorStop(0.94, rgba(colour, 0.6));
    grad.addColorStop(1, rgba(colour, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return c;
}

let chromaRed: HTMLCanvasElement | null = null;
let chromaCyan: HTMLCanvasElement | null = null;

export class PostFx {
  private readonly drops: Drop[] = [];
  private grainIndex = 0;
  private grainTimer = 0;

  constructor() {
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.drops.push({
        u: Math.random(),
        v: Math.random(),
        speed: 0.55 + Math.random() * 0.7,
        len: 0.02 + Math.random() * 0.05,
        wob: Math.random() * Math.PI * 2,
      });
    }
  }

  private updateRain(dt: number, t: number): void {
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      d.v += d.speed * dt;
      d.u += 0.035 * dt;
      if (d.v > 1.08) {
        d.v -= 1.16;
        d.u = Math.random();
      }
      if (d.u > 1.06) d.u -= 1.12;
      d.wob += dt * 2;
    }
    this.grainTimer -= dt;
    if (this.grainTimer <= 0) {
      this.grainTimer = 0.055;
      this.grainIndex = (this.grainIndex + 1) % 4;
    }
    return;
  }

  draw(d: Draw): void {
    const ctx = d.ctx;
    const vp = d.vp;
    this.updateRain(d.view.dt, d.t);

    // --- light rain, in screen space, under the HUD ----------------------
    ctx.save();
    ctx.beginPath();
    ctx.rect(vp.x, vp.y, vp.w, vp.h);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(PAL.fluoro, 0.09);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < this.drops.length; i++) {
      const dr = this.drops[i];
      const x = vp.x + dr.u * vp.w;
      const y = vp.y + dr.v * vp.h;
      const len = dr.len * vp.h;
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * 0.16 + Math.sin(dr.wob) * 1.5, y - len);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // --- chromatic aberration on level-up / evolution --------------------
    if (d.aberr > 0.02) {
      if (!chromaRed) chromaRed = edgeRing(PAL.danger);
      if (!chromaCyan) chromaCyan = edgeRing(PAL.fluoro);
      const off = d.aberr * 9;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, d.aberr) * 0.8;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(chromaRed, vp.x - off, vp.y - off * 0.6, vp.w + off * 2, vp.h + off * 1.2);
      ctx.drawImage(chromaCyan, vp.x + off, vp.y + off * 0.6, vp.w - off * 2, vp.h - off * 1.2);
      ctx.restore();
    }

    // --- full-screen flash (level-up, evolution, revive, bus arrival) ----
    if (d.flash > 0.004) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.85, d.flash);
      ctx.fillStyle = d.flashColour;
      ctx.fillRect(vp.x, vp.y, vp.w, vp.h);
      ctx.restore();
    }

    // --- vignette --------------------------------------------------------
    if (vignetteW !== vp.w || vignetteH !== vp.h || !vignette) {
      vignette = buildVignette(vp.w, vp.h);
      vignetteW = vp.w;
      vignetteH = vp.h;
    }
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(vignette, vp.x, vp.y, vp.w, vp.h);
    ctx.restore();

    // --- film grain at ~4% ----------------------------------------------
    const tiles = getGrainTiles();
    const tile = tiles[this.grainIndex % tiles.length];
    ctx.save();
    ctx.beginPath();
    ctx.rect(vp.x, vp.y, vp.w, vp.h);
    ctx.clip();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.4;
    const ox = vp.x - (this.grainIndex * 17) % GRAIN.tile;
    const oy = vp.y - (this.grainIndex * 11) % GRAIN.tile;
    for (let y = oy; y < vp.y + vp.h; y += GRAIN.tile) {
      for (let x = ox; x < vp.x + vp.w; x += GRAIN.tile) {
        ctx.drawImage(tile, x, y);
      }
    }
    ctx.restore();
  }
}

export function drawHurtVeil(d: Draw): void {
  if (d.hurt <= 0.003) return;
  const ctx = d.ctx;
  const vp = d.vp;
  ctx.save();
  const grad = ctx.createRadialGradient(
    vp.x + vp.w / 2,
    vp.y + vp.h / 2,
    vp.w * 0.2,
    vp.x + vp.w / 2,
    vp.y + vp.h / 2,
    Math.hypot(vp.w, vp.h) * 0.55,
  );
  grad.addColorStop(0, rgba(PAL.danger, 0));
  grad.addColorStop(0.65, rgba(PAL.danger, 0.1 * d.hurt));
  grad.addColorStop(1, rgba(PAL.danger, 0.55 * d.hurt));
  ctx.fillStyle = grad;
  ctx.fillRect(vp.x, vp.y, vp.w, vp.h);
  ctx.restore();
}

export function drawPauseVeil(d: Draw): void {
  if (!d.paused) return;
  const ctx = d.ctx;
  const vp = d.vp;
  ctx.save();
  ctx.fillStyle = 'rgba(4,7,10,0.62)';
  ctx.fillRect(vp.x, vp.y, vp.w, vp.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.round(Math.max(18, Math.min(34, vp.w * 0.08)));
  ctx.font = `700 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = rgba(PAL.ink, 0.9);
  ctx.fillText('PAUSED', vp.x + vp.w / 2, vp.y + vp.h * 0.5);
  ctx.restore();
}

export function resetPost(): void {
  vignette = null;
  vignetteW = 0;
  vignetteH = 0;
}