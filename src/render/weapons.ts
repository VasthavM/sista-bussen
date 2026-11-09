/**
 * Weapon visuals. Every behaviour in `src/sim/content.ts` gets its own
 * recognisable effect, and the evolved variant is visibly larger and brighter:
 * the evolution has to read as a power spike, not a colour swap.
 *
 * Effects are derived from the sim's own arrays wherever the sim keeps the
 * state (orbit radius, projectiles, area effects, orbs). Transient geometry that
 * only exists for one frame (beam direction, chain links) comes from
 * `state.events`, with a cooldown-jump fallback so a beam still renders if an
 * overlay consumed the events first.
 */
import { WEAPONS } from '../sim/content';
import type { AreaEffect, EnemyShot, Projectile, WeaponId, WeaponInstance } from '../sim/types';
import type { Draw } from './draw';
import { visible } from './draw';
import { PAL, WEAPON_LOOK } from './palette';
import { ICON_COLOUR, drawPickupIcon } from './pickups';
import type { ParticleField } from './particles';
import { P_EMBER, P_MOTE, P_SPARK } from './particles';
import { drawGlow, glowSprite, poolSprite } from './sprites';
import { rgba } from './util';

const CHAIN_CAP = 48;
const BEAM_CAP = 24;

interface Trail {
  active: boolean;
  kind: number; // 0 chain, 1 beam
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  life: number;
  maxLife: number;
  colour: string;
}

export class EffectTrails {
  private readonly chains: Trail[] = [];
  private readonly beams: Trail[] = [];

  constructor() {
    for (let i = 0; i < CHAIN_CAP; i++) this.chains.push(blank());
    for (let i = 0; i < BEAM_CAP; i++) this.beams.push(blank());
  }

  addChain(x1: number, y1: number, x2: number, y2: number, evolved: boolean): void {
    const slot = take(this.chains);
    slot.active = true;
    slot.kind = 0;
    slot.x1 = x1;
    slot.y1 = y1;
    slot.x2 = x2;
    slot.y2 = y2;
    slot.width = evolved ? 7 : 4;
    slot.life = evolved ? 0.34 : 0.24;
    slot.maxLife = slot.life;
    slot.colour = evolved ? PAL.fluoro : '#c9f0ff';
  }

  addBeam(x1: number, y1: number, x2: number, y2: number, width: number, evolved: boolean): void {
    const slot = take(this.beams);
    slot.active = true;
    slot.kind = 1;
    slot.x1 = x1;
    slot.y1 = y1;
    slot.x2 = x2;
    slot.y2 = y2;
    slot.width = width;
    slot.life = 0.16;
    slot.maxLife = slot.life;
    slot.colour = evolved ? '#fff4cf' : '#ffe9a8';
  }

  update(dt: number): void {
    if (dt <= 0) return;
    step(this.chains, dt);
    step(this.beams, dt);
  }

  draw(d: Draw): void {
    const ctx = d.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // Beams first: they are the brightest thing on screen and sit under their own glow.
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      if (!b.active) continue;
      if (!visible(d, b.x1, b.y1, 700) && !visible(d, b.x2, b.y2, 700)) continue;
      const k = b.life / b.maxLife;
      const a = Math.min(1, k * 1.5);
      const ang = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
      const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);

      ctx.save();
      ctx.translate(b.x1, b.y1);
      ctx.rotate(ang);
      // Wide wash cone.
      ctx.globalAlpha = a * 0.16;
      ctx.fillStyle = b.colour;
      ctx.beginPath();
      ctx.moveTo(0, -b.width * 0.18);
      ctx.lineTo(len, -b.width * 0.5);
      ctx.lineTo(len, b.width * 0.5);
      ctx.lineTo(0, b.width * 0.18);
      ctx.closePath();
      ctx.fill();
      // Hot core.
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = b.colour;
      ctx.lineWidth = Math.max(1.5, b.width * 0.1 * a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      // Flare at the impact end.
      ctx.globalAlpha = a * 0.5;
      ctx.lineWidth = b.width * 0.28 * a;
      ctx.beginPath();
      ctx.moveTo(len * 0.86, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.restore();

      drawGlow(ctx, glowSprite(b.colour), b.x1, b.y1, b.width * 0.9, a * 0.5);
      drawGlow(ctx, glowSprite(b.colour), b.x2, b.y2, b.width * 0.7, a * 0.6);
    }

    for (let i = 0; i < this.chains.length; i++) {
      const c = this.chains[i];
      if (!c.active) continue;
      if (!visible(d, c.x1, c.y1, 480) && !visible(d, c.x2, c.y2, 480)) continue;
      const k = c.life / c.maxLife;
      const a = Math.min(1, k * 1.6);
      const dx = c.x2 - c.x1;
      const dy = c.y2 - c.y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const segs = 6;
      const jitter = c.width * 1.7;

      // Two passes: a wide dim halo and a bright thin core.
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalAlpha = pass === 0 ? a * 0.32 : a;
        ctx.strokeStyle = c.colour;
        ctx.lineWidth = (pass === 0 ? c.width : c.width * 0.4) * (0.6 + a * 0.4);
        ctx.beginPath();
        ctx.moveTo(c.x1, c.y1);
        for (let s = 1; s < segs; s++) {
          const t = s / segs;
          const off = Math.sin(t * Math.PI * 3 + d.t * 42 + i) * jitter * (1 - Math.abs(t - 0.5) * 0.6);
          ctx.lineTo(c.x1 + dx * t + nx * off, c.y1 + dy * t + ny * off);
        }
        ctx.lineTo(c.x2, c.y2);
        ctx.stroke();
      }
      drawGlow(ctx, glowSprite(c.colour), c.x2, c.y2, 22, a * 0.7);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  clear(): void {
    for (const c of this.chains) c.active = false;
    for (const b of this.beams) b.active = false;
  }
}

function blank(): Trail {
  return { active: false, kind: 0, x1: 0, y1: 0, x2: 0, y2: 0, width: 0, life: 0, maxLife: 1, colour: '#ffffff' };
}

function take(pool: Trail[]): Trail {
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].active) return pool[i];
  }
  return pool[0];
}

function step(pool: Trail[], dt: number): void {
  for (let i = 0; i < pool.length; i++) {
    const t = pool[i];
    if (!t.active) continue;
    t.life -= dt;
    if (t.life <= 0) t.active = false;
  }
}

/* --- orbiting weapon (Chain Wrench) ------------------------------------------- */

/** Chain Wrench: an open-end jaw on the swinging end, a fat handle with a hang hole. */
function drawWrench(ctx: CanvasRenderingContext2D, s: number, colour: string, ring: string): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.48, 0, Math.PI * 2);
  ctx.fill();
  // Open jaw cut into the head, facing away from the handle.
  ctx.fillStyle = '#05080c';
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, -s * 0.2);
  ctx.lineTo(-s * 0.72, -s * 0.2);
  ctx.lineTo(-s * 0.72, s * 0.2);
  ctx.lineTo(-s * 0.1, s * 0.2);
  ctx.closePath();
  ctx.fill();
  // Handle.
  ctx.fillStyle = colour;
  ctx.fillRect(s * 0.3, -s * 0.2, s * 1.05, s * 0.4);
  ctx.fillStyle = '#05080c';
  ctx.beginPath();
  ctx.arc(s * 1.2, 0, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ring;
  ctx.fillRect(s * 0.5, -s * 0.16, s * 0.12, s * 0.32);
}

function drawOrbit(d: Draw, w: WeaponInstance): void {
  const ctx = d.ctx;
  const p = d.state.player;
  const look = WEAPON_LOOK.nyckel;
  const base = (74 + w.level * 5) * p.area;
  const radius = w.evolved ? base + 44 : base;
  const colour = w.evolved ? look.evo : look.core;
  const glowColour = w.evolved ? look.evoHot : look.hot;
  const count = w.evolved ? 7 : 3 + Math.min(3, Math.floor(w.level / 2));
  const spin = d.t * (w.evolved ? 3.4 : 2.6);
  const keySize = w.evolved ? 15 : 10 + w.level * 0.6;

  ctx.save();
  // Orbit track.
  ctx.strokeStyle = rgba(colour, w.evolved ? 0.24 : 0.13);
  ctx.lineWidth = w.evolved ? 5 : 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (w.evolved) {
    // Stun field read: a second, hotter ring.
    ctx.strokeStyle = rgba(glowColour, 0.3 + 0.12 * Math.sin(d.t * 6));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    drawGlow(ctx, poolSprite(PAL.amber), p.x, p.y, radius * 1.35, 0.14);
  }

  for (let i = 0; i < count; i++) {
    const a = spin + (i / count) * Math.PI * 2;
    const x = p.x + Math.cos(a) * radius;
    const y = p.y + Math.sin(a) * radius;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI * 0.5);
    // Chain strand to the player's hand.
    ctx.strokeStyle = rgba(PAL.steel, 0.35);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-Math.cos(0) * keySize * 0.4, 0);
    ctx.lineTo(-Math.cos(0) * keySize * 1.4, 0);
    ctx.stroke();
    drawWrench(ctx, keySize, colour, glowColour);
    ctx.restore();
    drawGlow(ctx, glowSprite(glowColour), x, y, keySize * (w.evolved ? 2.6 : 1.9), w.evolved ? 0.5 : 0.28);
  }
  ctx.restore();
}

/* --- projectiles: nail gun (piercing) and shopping cart (ricochet) -------------- */

function drawNail(d: Draw, p: Projectile): void {
  const ctx = d.ctx;
  const look = WEAPON_LOOK.korv;
  const ang = Math.atan2(p.vy, p.vx);
  const evolved = p.explodeRadius > 0;
  const colour = evolved ? look.evo : look.core;
  const len = p.radius * (evolved ? 3.2 : 2.6);

  // Trail.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(colour, 0.28);
  ctx.lineWidth = p.radius * 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - p.vx * 0.055, p.y - p.vy * 0.055);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ang);
  // Shaft, then a flat head at the back and a point out front.
  ctx.fillStyle = PAL.steel;
  ctx.beginPath();
  ctx.moveTo(len * 0.55, 0);
  ctx.lineTo(-len * 0.4, -p.radius * 0.28);
  ctx.lineTo(-len * 0.4, p.radius * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.fillRect(-len * 0.52, -p.radius * 0.7, len * 0.16, p.radius * 1.4);
  ctx.strokeStyle = rgba(PAL.amberWarm, 0.8);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-len * 0.3, -p.radius * 0.12);
  ctx.lineTo(len * 0.4, -p.radius * 0.02);
  ctx.stroke();
  ctx.restore();

  drawGlow(ctx, glowSprite(evolved ? PAL.amberWarm : look.hot), p.x, p.y, p.radius * (evolved ? 3.4 : 2.2), evolved ? 0.6 : 0.3);
}

function drawCart(d: Draw, p: Projectile): void {
  const ctx = d.ctx;
  const look = WEAPON_LOOK.vagn;
  const ang = Math.atan2(p.vy, p.vx);
  const evolved = p.pierce > 1 || p.bounces > 1;
  const colour = evolved ? '#f2f8ff' : look.core;
  const s = p.radius;

  // Ricochet trail: a taper behind the cart.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(colour, 0.16);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - s * 0.7);
  ctx.lineTo(p.x - p.vx * 0.075, p.y - p.vy * 0.075 - s * 0.14);
  ctx.lineTo(p.x - p.vx * 0.075, p.y - p.vy * 0.075 + s * 0.14);
  ctx.lineTo(p.x, p.y + s * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ang);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.fillStyle = rgba(colour, 0.18);
  ctx.beginPath();
  ctx.roundRect(-s, -s * 0.66, s * 2, s * 1.32, 2);
  ctx.fill();
  ctx.stroke();
  // Basket wireframe.
  ctx.strokeStyle = rgba(colour, 0.5);
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-s + (s * 2 * i) / 3, -s * 0.66);
    ctx.lineTo(-s + (s * 2 * i) / 3, s * 0.66);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.lineTo(s, 0);
  ctx.stroke();
  // Wheels.
  ctx.fillStyle = '#0b0f14';
  ctx.beginPath();
  ctx.arc(-s * 0.55, -s * 0.78, s * 0.22, 0, Math.PI * 2);
  ctx.arc(-s * 0.55, s * 0.78, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (evolved) drawGlow(ctx, glowSprite(PAL.ink), p.x, p.y, s * 3, 0.4);
}

/* --- area effects: spray cone, fire pool -------------------------------- */

function coneEdge(ctx: CanvasRenderingContext2D, a: AreaEffect, r: number): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.arc(a.x, a.y, r, a.angle - a.spread * 0.5, a.angle + a.spread * 0.5);
  ctx.closePath();
}

export function drawAreaEffects(d: Draw): void {
  const ctx = d.ctx;
  const list = d.state.areaEffects;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.active) continue;
    if (!visible(d, a.x, a.y, a.radius + 260)) continue;
    const k = Math.max(0, a.life / Math.max(0.001, a.maxLife));

    if (a.kind === 'cone') {
      const spray = WEAPON_LOOK.spray;
      const colour = PAL.green;
      const grow = 1 - k * 0.25;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k * 0.2;
      ctx.fillStyle = colour;
      coneEdge(ctx, a, a.radius * grow);
      ctx.fill();
      ctx.globalAlpha = k * 0.14;
      ctx.fillStyle = spray.hot;
      coneEdge(ctx, a, a.radius * grow * 0.62);
      ctx.fill();
      // DoT tint edge: the rim is where the damage-over-time bites.
      ctx.globalAlpha = k * 0.55;
      ctx.strokeStyle = rgba(colour, 0.9);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius * grow * 0.92, a.angle - a.spread * 0.5, a.angle + a.spread * 0.5);
      ctx.stroke();
      ctx.restore();
      drawGlow(ctx, glowSprite(colour), a.x + Math.cos(a.angle) * a.radius * 0.5, a.y + Math.sin(a.angle) * a.radius * 0.5, a.radius * 0.55, k * 0.22);
    } else if (a.kind === 'fire') {
      // Molotov / evolved beam burn pool.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flick = 0.85 + 0.15 * Math.sin(d.t * 12 + a.x * 0.1);
      const r = a.radius * (0.72 + 0.28 * k) * flick;
      ctx.globalAlpha = 0.22 * Math.min(1, k * 2);
      ctx.fillStyle = PAL.amberDeep;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5 * Math.min(1, k * 2);
      ctx.strokeStyle = PAL.amberWarm;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawGlow(ctx, glowSprite(PAL.amber), a.x, a.y, r * 2.1, 0.3 * Math.min(1, k * 2));
      // Flame tongues.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let f = 0; f < 5; f++) {
        const fa = (f / 5) * Math.PI * 2 + d.t * 1.4;
        const fx = a.x + Math.cos(fa) * r * 0.55;
        const fy = a.y + Math.sin(fa) * r * 0.55;
        const h = r * (0.45 + 0.25 * Math.sin(d.t * 9 + f * 2));
        ctx.globalAlpha = 0.4 * Math.min(1, k * 2);
        ctx.fillStyle = f % 2 === 0 ? PAL.amber : PAL.amberWarm;
        ctx.beginPath();
        ctx.moveTo(fx - 3, fy + 4);
        ctx.lineTo(fx + 3, fy + 4);
        ctx.lineTo(fx + Math.cos(fa) * 2, fy - h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else {
      // Radial burst warning ring.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k * 0.5;
      ctx.strokeStyle = PAL.danger;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius * (1.15 - k * 0.2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/* --- orbs, enemy shots -------------------------------------------------- */

export function drawOrbs(d: Draw): void {
  const ctx = d.ctx;
  const orbs = d.state.orbs;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < orbs.length; i++) {
    const o = orbs[i];
    if (!o.active) continue;
    if (!visible(d, o.x, o.y, 40)) continue;
    const magnet = o.magnet;
    const icon = o.kind === 'change' ? 'scrap' : o.kind === 'fuel' ? 'fuel' : null;
    const colour = icon ? ICON_COLOUR[icon] : PAL.green;
    const size = icon ? 4.6 : 3.4 + Math.min(2, o.value * 0.01);
    const pulse = 0.7 + 0.3 * Math.sin(d.t * 8 + o.x * 0.3);
    drawGlow(ctx, glowSprite(colour), o.x, o.y, size * (4 + magnet * 3), 0.35 * pulse);
    if (icon) {
      // Scrap and fuel keep their own icon (nut, can) so they read as loot, not XP.
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      drawPickupIcon(ctx, icon, o.x, o.y, icon === 'fuel' ? 8 : 6.4, icon === 'fuel' ? 0 : d.t * 2.4 + o.x * 0.1);
      ctx.globalCompositeOperation = 'lighter';
      continue;
    }
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = colour;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(Math.PI * 0.25 + d.t * 1.2);
    ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

export function drawEnemyShots(d: Draw): void {
  const ctx = d.ctx;
  const shots = d.state.enemyShots;
  ctx.save();
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (!s.active) continue;
    if (!visible(d, s.x, s.y, 40)) continue;
    const ang = Math.atan2(s.vy, s.vx);
    const colour = s.kind === 'burst' ? PAL.danger : '#c46bff';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = colour;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(s.radius * 1.5, 0);
    ctx.lineTo(-s.radius, -s.radius * 0.9);
    ctx.lineTo(-s.radius * 0.4, 0);
    ctx.lineTo(-s.radius, s.radius * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawGlow(ctx, glowSprite(colour), s.x, s.y, s.radius * 3.4, 0.34);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/* --- driver ------------------------------------------------------------- */

/**
 * Watches weapon cooldowns so a beam still renders if an overlay cleared the
 * event buffer before the frame was drawn. Never writes to the sim.
 */
export class WeaponFx {
  private readonly prev = new Map<WeaponId, number>();

  update(d: Draw, trails: EffectTrails, field: ParticleField): void {
    const st = d.state;
    for (let i = 0; i < st.weapons.length; i++) {
      const w = st.weapons[i];
      const last = this.prev.get(w.id);
      this.prev.set(w.id, w.cooldown);
      if (last === undefined) continue;
      if (w.cooldown <= last + 1e-4) continue;
      this.onFire(d, w, trails, field);
    }
    if (d.paused) return;
  }

  private onFire(d: Draw, w: WeaponInstance, trails: EffectTrails, field: ParticleField): void {
    const st = d.state;
    const p = st.player;
    const def = WEAPONS[w.id];
    const look = WEAPON_LOOK[w.id];

    switch (def.behaviour) {
      case 'beam': {
        const length = (w.evolved ? 560 : 430) * (1 + (p.area - 1) * 0.4);
        const width = w.evolved ? 92 : 34;
        trails.addBeam(
          p.x,
          p.y,
          p.x + Math.cos(p.facing) * length,
          p.y + Math.sin(p.facing) * length,
          width,
          w.evolved,
        );
        field.emit(P_SPARK, p.x + Math.cos(p.facing) * 16, p.y + Math.sin(p.facing) * 16, Math.cos(p.facing) * 120, Math.sin(p.facing) * 120, 0.12, 2, PAL.amberWarm, 4);
        break;
      }
      case 'chain': {
        field.emit(P_SPARK, p.x, p.y, 0, 0, 0.16, 3, PAL.fluoro, 1, 0.9);
        break;
      }
      case 'cone': {
        for (let i = 0; i < 5; i++) {
          const a = p.facing + (Math.random() - 0.5) * 0.8;
          const s = 90 + Math.random() * 140;
          field.emit(P_MOTE, p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12, Math.cos(a) * s, Math.sin(a) * s, 0.22, 2.2, PAL.green, 5, 0.5);
        }
        break;
      }
      case 'throw': {
        field.emit(P_SPARK, p.x + Math.cos(p.facing) * 16, p.y + Math.sin(p.facing) * 16, Math.cos(p.facing) * 90, Math.sin(p.facing) * 90, 0.1, 2, look.hot, 6);
        break;
      }
      case 'bounce': {
        field.emit(P_SPARK, p.x + Math.cos(p.facing) * 16, p.y + Math.sin(p.facing) * 16, Math.cos(p.facing) * 70, Math.sin(p.facing) * 70, 0.1, 1.6, PAL.ink, 6);
        break;
      }
      default:
        break;
    }
  }
}

export function drawProjectiles(d: Draw): void {
  const list = d.state.projectiles;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!p.active) continue;
    if (!visible(d, p.x, p.y, 90)) continue;
    if (p.kind === 'korv') drawNail(d, p);
    else drawCart(d, p);
  }
}

/** Orbit arcs, projectiles and hostile shots: everything that draws above actors. */
export function drawWeaponSystems(d: Draw): void {
  const st = d.state;
  for (let i = 0; i < st.weapons.length; i++) {
    const w = st.weapons[i];
    if (WEAPONS[w.id].behaviour === 'orbit') drawOrbit(d, w);
  }
  drawProjectiles(d);
  drawEnemyShots(d);
}

/** Small vector glyph used by the HUD weapon rack. */
export function drawWeaponGlyph(
  ctx: CanvasRenderingContext2D,
  id: WeaponId,
  x: number,
  y: number,
  size: number,
  colour: string,
  evolved: boolean,
): void {
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = Math.max(1.4, s * 0.11);
  ctx.lineCap = 'round';
  switch (id) {
    case 'nyckel':
      ctx.beginPath();
      ctx.arc(-s * 0.24, 0, s * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.02, 0);
      ctx.lineTo(s * 0.4, 0);
      ctx.moveTo(s * 0.26, 0);
      ctx.lineTo(s * 0.26, s * 0.2);
      ctx.moveTo(s * 0.4, 0);
      ctx.lineTo(s * 0.4, s * 0.16);
      ctx.stroke();
      break;
    case 'korv':
      ctx.beginPath();
      ctx.roundRect(-s * 0.42, -s * 0.16, s * 0.84, s * 0.32, s * 0.16);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.18, -s * 0.16);
      ctx.lineTo(-s * 0.18, s * 0.16);
      ctx.moveTo(s * 0.18, -s * 0.16);
      ctx.lineTo(s * 0.18, s * 0.16);
      ctx.stroke();
      break;
    case 'telefon':
      ctx.beginPath();
      ctx.roundRect(-s * 0.22, -s * 0.38, s * 0.44, s * 0.76, s * 0.08);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.3, -s * 0.3);
      ctx.lineTo(s * 0.42, 0);
      ctx.lineTo(s * 0.3, s * 0.3);
      ctx.stroke();
      break;
    case 'spray':
      ctx.beginPath();
      ctx.roundRect(-s * 0.26, -s * 0.2, s * 0.4, s * 0.56, s * 0.06);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.14, -s * 0.1);
      ctx.lineTo(s * 0.4, -s * 0.26);
      ctx.moveTo(s * 0.16, -s * 0.02);
      ctx.lineTo(s * 0.44, -s * 0.02);
      ctx.moveTo(s * 0.34, -s * 0.3);
      ctx.lineTo(s * 0.4, -s * 0.44);
      ctx.stroke();
      break;
    case 'vagn':
      ctx.beginPath();
      ctx.roundRect(-s * 0.36, -s * 0.22, s * 0.72, s * 0.4, s * 0.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.36, s * 0.18);
      ctx.lineTo(-s * 0.36, s * 0.34);
      ctx.moveTo(s * 0.36, s * 0.18);
      ctx.lineTo(s * 0.36, s * 0.34);
      ctx.stroke();
      break;
    case 'ficklampa':
      ctx.beginPath();
      ctx.roundRect(-s * 0.34, -s * 0.14, s * 0.44, s * 0.28, s * 0.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.26);
      ctx.lineTo(s * 0.3, -s * 0.4);
      ctx.moveTo(s * 0.1, 0);
      ctx.lineTo(s * 0.36, 0);
      ctx.moveTo(s * 0.1, s * 0.26);
      ctx.lineTo(s * 0.3, s * 0.4);
      ctx.stroke();
      break;
    default:
      break;
  }
  if (evolved) {
    ctx.strokeStyle = rgba(colour, 0.55);
    ctx.lineWidth = 1;
    ctx.strokeRect(-s * 0.5, -s * 0.5, s, s);
  }
  ctx.restore();
}

export function fireEmber(field: ParticleField, x: number, y: number, colour: string): void {
  field.emit(P_EMBER, x, y, (Math.random() - 0.5) * 40, -20 - Math.random() * 40, 0.4, 2, colour, 2, 0.8);
}