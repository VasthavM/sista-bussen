/**
 * Pooled particles and floating damage numbers. Fixed-size pools, no allocation
 * after construction, no `shadowBlur`.
 */
import type { Draw } from './draw';
import { visible } from './draw';
import { intText } from './util';

const PARTICLE_CAP = 900;

export const P_SPARK = 0;
export const P_EMBER = 1;
export const P_SMOKE = 2;
export const P_RING = 3;
export const P_SHARD = 4;
export const P_MOTE = 5;
export const P_SPLASH = 6;

export interface Particle {
  active: boolean;
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  drag: number;
  spin: number;
  spinRate: number;
  colour: string;
  alpha: number;
}

function makeParticle(): Particle {
  return {
    active: false,
    kind: P_SPARK,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 1,
    drag: 2,
    spin: 0,
    spinRate: 0,
    colour: '#ffffff',
    alpha: 1,
  };
}

export class ParticleField {
  private readonly pool: Particle[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < PARTICLE_CAP; i++) this.pool.push(makeParticle());
  }

  private next(): Particle {
    for (let i = 0; i < PARTICLE_CAP; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % PARTICLE_CAP;
      if (!p.active) return p;
    }
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % PARTICLE_CAP;
    return p;
  }

  emit(
    kind: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    colour: string,
    drag = 2.2,
    alpha = 1,
  ): void {
    const p = this.next();
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.drag = drag;
    p.colour = colour;
    p.alpha = alpha;
    p.spin = 0;
    p.spinRate = 0;
  }

  /** Impact: two or three sparks plus a tiny dust puff. */
  hit(x: number, y: number, dx: number, dy: number, colour: string, power: number): void {
    const n = power > 1 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.5;
      const s = 80 + Math.random() * 190 * power;
      this.emit(P_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.14 + Math.random() * 0.14, 1.6 + Math.random() * 1.8, colour, 5);
    }
    this.emit(P_SPLASH, x, y, 0, 0, 0.2, 5 + Math.random() * 4, colour, 0, 0.5);
  }

  kill(x: number, y: number, colour: string, big: boolean): void {
    const n = big ? 26 : 12;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * (big ? 320 : 200);
      this.emit(
        P_SHARD,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        0.3 + Math.random() * 0.45,
        (big ? 3.4 : 2.2) + Math.random() * 2,
        colour,
        3.4,
      );
    }
    for (let i = 0; i < (big ? 10 : 4); i++) {
      const a = Math.random() * Math.PI * 2;
      this.emit(P_SMOKE, x + Math.cos(a) * 6, y + Math.sin(a) * 6, Math.cos(a) * 22, Math.sin(a) * 22, 0.7, 8 + Math.random() * 12, '#2a3441', 1.6, 0.35);
    }
    this.emit(P_RING, x, y, 0, 0, big ? 0.38 : 0.22, big ? 34 : 16, colour, 0, 0.75);
  }

  ring(x: number, y: number, radius: number, colour: string, life: number, alpha: number): void {
    this.emit(P_RING, x, y, 0, 0, life, radius, colour, 0, alpha);
  }

  pickup(x: number, y: number, colour: string, amount: number): void {
    const n = amount > 20 ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 30 + Math.random() * 70;
      this.emit(P_MOTE, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.32 + Math.random() * 0.2, 2 + Math.random() * 2, colour, 4, 0.95);
    }
  }

  splash(x: number, y: number, radius: number, colour: string): void {
    this.emit(P_SPLASH, x, y, 0, 0, 0.4, radius, colour, 0, 0.4);
  }

  update(dt: number): void {
    if (dt <= 0) return;
    for (let i = 0; i < PARTICLE_CAP; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = 1 - Math.min(0.95, p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.spin += p.spinRate * dt;
    }
  }

  draw(d: Draw, layer: number): void {
    const ctx = d.ctx;
    ctx.save();
    for (let i = 0; i < PARTICLE_CAP; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      const under = p.kind === P_SPLASH || p.kind === P_SMOKE;
      if (layer === 0 ? !under : under) continue;
      if (!visible(d, p.x, p.y, 80)) continue;
      const t = p.life / p.maxLife;
      const a = Math.max(0, Math.min(1, t)) * p.alpha;
      if (a <= 0.01) continue;

      switch (p.kind) {
        case P_SPARK: {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.strokeStyle = p.colour;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.014, p.y - p.vy * 0.014);
          ctx.stroke();
          break;
        }
        case P_MOTE: {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.fillStyle = p.colour;
          ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
          break;
        }
        case P_EMBER: {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a * 0.8;
          ctx.fillStyle = p.colour;
          ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
          break;
        }
        case P_SMOKE: {
          ctx.globalCompositeOperation = 'source-over';
          const grow = 1 + (1 - t) * 1.8;
          ctx.globalAlpha = a * 0.5;
          ctx.fillStyle = p.colour;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * grow, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case P_RING: {
          const grow = 1 + (1 - t) * 1.1;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.strokeStyle = p.colour;
          ctx.lineWidth = 1.5 + t * 2.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * grow, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case P_SPLASH: {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a * 0.55;
          ctx.fillStyle = p.colour;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * (1 + (1 - t) * 0.9), p.size * 0.55 * (1 + (1 - t) * 0.9), 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        default: {
          // Shard: a small tumbling triangle.
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = a;
          ctx.fillStyle = p.colour;
          const s = p.size;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin + t * 4);
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.85, s * 0.7);
          ctx.lineTo(-s * 0.85, s * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  clear(): void {
    for (let i = 0; i < PARTICLE_CAP; i++) this.pool[i].active = false;
  }
}

const NUMBER_CAP = 96;

export interface FloatNumber {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  vx: number;
  life: number;
  maxLife: number;
  text: string;
  size: number;
  colour: string;
  crit: boolean;
}

function makeNumber(): FloatNumber {
  return {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    text: '0',
    size: 12,
    colour: '#ffffff',
    crit: false,
  };
}

/** Floating damage numbers. Pooled; text comes from a pre-built string table. */
export class DamageNumbers {
  private readonly pool: FloatNumber[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < NUMBER_CAP; i++) this.pool.push(makeNumber());
  }

  spawn(x: number, y: number, amount: number, crit: boolean, colour: string, size: number): void {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % NUMBER_CAP;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = (Math.random() - 0.5) * 26;
    p.vy = -46 - Math.random() * 26;
    p.life = crit ? 0.86 : 0.66;
    p.maxLife = p.life;
    p.text = intText(amount);
    p.size = size;
    p.colour = colour;
    p.crit = crit;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    for (let i = 0; i < NUMBER_CAP; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 62 * dt;
      p.vx *= 1 - Math.min(0.9, dt * 2);
    }
  }

  draw(d: Draw): void {
    const ctx = d.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < NUMBER_CAP; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      if (!visible(d, p.x, p.y, 60)) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 1.9);
      const size = p.size * d.inv;
      ctx.font = `bold ${size.toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.lineWidth = 2.4 * d.inv;
      ctx.strokeStyle = 'rgba(4,7,10,0.85)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.colour;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  clear(): void {
    for (let i = 0; i < NUMBER_CAP; i++) this.pool[i].active = false;
  }
}