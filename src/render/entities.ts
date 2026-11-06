/**
 * Flat vector silhouettes with a 2 CSS-pixel rim light. Each enemy type has a
 * deliberately different mass and prop so a threat is identifiable at a glance,
 * even at 30% screen brightness.
 */
import type { Enemy } from '../sim/types';
import type { Draw } from './draw';
import { visible } from './draw';
import { CHAR_LOOK, ENEMY_LOOK, PAL } from './palette';
import { drawGlow, glowSprite } from './sprites';
import { rgba } from './util';

const FLASH = '#ffffff';

function facingOf(e: Enemy): number {
  if (e.vx * e.vx + e.vy * e.vy > 4) return Math.atan2(e.vy, e.vx);
  return e.phase;
}

/** Grounding shadows, batched into a single path and single fill. */
export function drawShadows(d: Draw): void {
  const ctx = d.ctx;
  const st = d.state;
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  for (let i = 0; i < st.enemies.length; i++) {
    const e = st.enemies[i];
    if (e.hp <= 0 || !visible(d, e.x, e.y, 60)) continue;
    ctx.moveTo(e.x + e.radius * 1.05, e.y + e.radius * 0.5);
    ctx.ellipse(e.x + 3, e.y + e.radius * 0.55, e.radius * 1.05, e.radius * 0.5, 0, 0, Math.PI * 2);
  }
  const p = st.player;
  const pr = 15;
  ctx.moveTo(p.x + pr, p.y + pr * 0.55);
  ctx.ellipse(p.x + 3, p.y + pr * 0.55, pr * 1.1, pr * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
}

function eliteAura(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw): void {
  if (!e.elite) return;
  drawGlow(ctx, glowSprite(PAL.amber), e.x, e.y, e.radius * 2.4, 0.3);
  ctx.strokeStyle = rgba(PAL.amber, 0.5);
  ctx.lineWidth = 1.5 * d.inv;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.radius * 1.25, 0, Math.PI * 2);
  ctx.stroke();
}

function healthBar(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw): void {
  const boss = e.type === 'nattvakt' || e.type === 'chauffor';
  if (!e.elite && !boss) return;
  const w = e.radius * 1.9;
  const h = 3 * d.inv;
  const y = e.y - e.radius * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(e.x - w / 2, y, w, h);
  const frac = Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp)));
  ctx.fillStyle = boss ? PAL.danger : PAL.amber;
  ctx.fillRect(e.x - w / 2, y, w * frac, h);
}

/* --- per-type silhouettes. All are drawn in a local space facing +x. ----- */

function drawFyllo(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const look = ENEMY_LOOK.fyllo;
  const r = e.radius;
  const sway = Math.sin(d.t * 3.4 + e.phase) * 0.12;
  ctx.rotate(sway);
  ctx.fillStyle = flash ? FLASH : look.deep;
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, 0, r * 0.95, r * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flash ? FLASH : look.fill;
  ctx.beginPath();
  ctx.ellipse(r * 0.12, -r * 0.05, r * 0.82, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head, tipped forward and to the side: permanently about to fall over.
  ctx.beginPath();
  ctx.arc(r * 0.62, r * 0.16, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  // Bottle.
  if (!flash) {
    ctx.fillStyle = PAL.greenDeep;
    ctx.save();
    ctx.translate(r * 0.1, r * 0.92);
    ctx.rotate(-0.4);
    ctx.fillRect(-r * 0.11, -r * 0.1, r * 0.22, r * 0.44);
    ctx.fillRect(-r * 0.05, -r * 0.26, r * 0.1, r * 0.18);
    ctx.restore();
  }
  ctx.strokeStyle = rgba(flash ? FLASH : look.rim, 0.85);
  ctx.lineWidth = 2 * d.inv;
  ctx.beginPath();
  ctx.arc(r * 0.62, r * 0.16, r * 0.42, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  if (!flash) {
    ctx.fillStyle = look.accent;
    ctx.fillRect(r * 0.78, r * 0.06, r * 0.08, r * 0.08);
  }
}

function drawDuva(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const look = ENEMY_LOOK.duva;
  const r = e.radius;
  const flap = Math.sin(d.t * 17 + e.phase);
  ctx.fillStyle = flash ? FLASH : look.fill;
  // Wings.
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.2);
  ctx.lineTo(-r * 0.5, -r * (1.05 + flap * 0.42));
  ctx.lineTo(r * 0.55, -r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, r * 0.2);
  ctx.lineTo(-r * 0.5, r * (1.05 + flap * 0.42));
  ctx.lineTo(r * 0.55, r * 0.55);
  ctx.closePath();
  ctx.fill();
  // Body + tail.
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.05, r * 0.56, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, -r * 0.32);
  ctx.lineTo(-r * 1.5, 0);
  ctx.lineTo(-r * 0.9, r * 0.32);
  ctx.closePath();
  ctx.fill();
  // Head and beak.
  ctx.beginPath();
  ctx.arc(r * 0.92, 0, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  if (!flash) {
    ctx.fillStyle = PAL.amber;
    ctx.beginPath();
    ctx.moveTo(r * 1.24, 0);
    ctx.lineTo(r * 1.62, -r * 0.1);
    ctx.lineTo(r * 1.24, r * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.danger;
    ctx.fillRect(r * 1.0, -r * 0.12, r * 0.1, r * 0.1);
  }
  ctx.strokeStyle = rgba(flash ? FLASH : look.rim, 0.8);
  ctx.lineWidth = 2 * d.inv;
  ctx.beginPath();
  ctx.arc(r * 0.92, 0, r * 0.34, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

function drawSkugga(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const look = ENEMY_LOOK.skugga;
  const r = e.radius;
  const wob = Math.sin(d.t * 2.6 + e.phase) * r * 0.22;
  // Tattered trailing wisps.
  if (!flash) {
    ctx.strokeStyle = rgba(look.fill, 0.5);
    ctx.lineWidth = 2.4 * d.inv;
    for (let i = 0; i < 4; i++) {
      const off = (i - 1.5) * r * 0.3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, off);
      ctx.quadraticCurveTo(-r * 1.6, off + wob, -r * (2.1 + i * 0.25), off * 0.4);
      ctx.stroke();
    }
  }
  ctx.fillStyle = flash ? FLASH : look.deep;
  ctx.beginPath();
  ctx.moveTo(-r * 1.9, -r * 0.24);
  ctx.quadraticCurveTo(-r * 0.4, -r * 0.95, r * 0.85, -r * 0.5);
  ctx.quadraticCurveTo(r * 1.15, 0, r * 0.85, r * 0.5);
  ctx.quadraticCurveTo(-r * 0.4, r * 0.95, -r * 1.9, r * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = flash ? FLASH : look.fill;
  ctx.beginPath();
  ctx.moveTo(-r * 1.3, -r * 0.2);
  ctx.quadraticCurveTo(-r * 0.2, -r * 0.62, r * 0.8, -r * 0.34);
  ctx.quadraticCurveTo(r * 1.0, 0, r * 0.8, r * 0.34);
  ctx.quadraticCurveTo(-r * 0.2, r * 0.62, -r * 1.3, r * 0.2);
  ctx.closePath();
  ctx.fill();
  if (!flash) {
    // Two cold eyes are the whole read.
    ctx.fillStyle = PAL.fluoro;
    ctx.fillRect(r * 0.34, -r * 0.26, r * 0.2, r * 0.12);
    ctx.fillRect(r * 0.34, r * 0.14, r * 0.2, r * 0.12);
  }
  ctx.strokeStyle = rgba(flash ? FLASH : look.rim, 0.7);
  ctx.lineWidth = 2 * d.inv;
  ctx.beginPath();
  ctx.moveTo(-r * 1.3, -r * 0.2);
  ctx.quadraticCurveTo(-r * 0.2, -r * 0.62, r * 0.8, -r * 0.34);
  ctx.stroke();
}

function drawVaktmastare(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const look = ENEMY_LOOK.vaktmastare;
  const r = e.radius;
  // Shoulder mass.
  ctx.fillStyle = flash ? FLASH : look.deep;
  ctx.beginPath();
  ctx.ellipse(-r * 0.1, 0, r * 0.86, r * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flash ? FLASH : look.fill;
  ctx.beginPath();
  ctx.ellipse(r * 0.05, 0, r * 0.62, r * 0.74, 0, 0, Math.PI * 2);
  ctx.fill();
  // Peaked cap.
  ctx.beginPath();
  ctx.arc(r * 0.44, 0, r * 0.44, 0, Math.PI * 2);
  ctx.fill();
  if (!flash) {
    ctx.fillStyle = '#080b10';
    ctx.beginPath();
    ctx.ellipse(r * 0.86, 0, r * 0.2, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    // Broom held out from the shoulder.
    ctx.strokeStyle = '#3d2f1e';
    ctx.lineWidth = 2.6 * d.inv;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.55);
    ctx.lineTo(r * 1.25, r * 0.95);
    ctx.stroke();
    ctx.fillStyle = PAL.greenDeep;
    ctx.beginPath();
    ctx.moveTo(r * 1.25, r * 0.95);
    ctx.lineTo(r * 1.7, r * 0.7);
    ctx.lineTo(r * 1.62, r * 1.24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = rgba(flash ? FLASH : look.rim, 0.8);
  ctx.lineWidth = 2 * d.inv;
  ctx.beginPath();
  ctx.arc(r * 0.44, 0, r * 0.44, Math.PI * 1.1, Math.PI * 2.0);
  ctx.stroke();
}

function drawSparkcykel(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const look = ENEMY_LOOK.sparkcykel;
  const r = e.radius;
  const charging = e.state >= 1;
  if (!flash && charging) {
    // Telegraph: a hard green line where the scooter is about to go.
    ctx.strokeStyle = rgba(PAL.green, e.state === 2 ? 0.5 : 0.28);
    ctx.lineWidth = 3 * d.inv;
    const len = e.state === 2 ? 130 : 190;
    ctx.beginPath();
    ctx.moveTo(r * 0.9, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
  }
  ctx.fillStyle = flash ? FLASH : '#101820';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.05, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = flash ? FLASH : look.deep;
  ctx.beginPath();
  ctx.arc(-r * 0.78, 0, r * 0.26, 0, Math.PI * 2);
  ctx.arc(r * 0.8, 0, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
  // Stem + bars.
  ctx.strokeStyle = flash ? FLASH : look.fill;
  ctx.lineWidth = 2.6 * d.inv;
  ctx.beginPath();
  ctx.moveTo(r * 0.8, 0);
  ctx.lineTo(r * 0.5, -r * 0.5);
  ctx.moveTo(r * 0.2, -r * 0.5);
  ctx.lineTo(r * 0.85, -r * 0.5);
  ctx.stroke();
  // Rider.
  ctx.fillStyle = flash ? FLASH : look.fill;
  ctx.beginPath();
  ctx.ellipse(-r * 0.05, -r * 0.1, r * 0.42, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!flash) {
    ctx.fillStyle = look.accent;
    ctx.fillRect(r * 0.1, -r * 0.9, r * 0.3, r * 0.12);
  }
  ctx.strokeStyle = rgba(flash ? FLASH : look.rim, 0.8);
  ctx.lineWidth = 2 * d.inv;
  ctx.beginPath();
  ctx.ellipse(-r * 0.05, -r * 0.1, r * 0.42, r * 0.34, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

function drawNattvakt(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const look = ENEMY_LOOK.nattvakt;
  const r = e.radius;
  // Long coat.
  ctx.fillStyle = flash ? FLASH : look.deep;
  ctx.beginPath();
  ctx.moveTo(-r * 1.15, -r * 0.85);
  ctx.quadraticCurveTo(r * 0.2, -r * 1.0, r * 0.95, -r * 0.55);
  ctx.quadraticCurveTo(r * 1.25, 0, r * 0.95, r * 0.55);
  ctx.quadraticCurveTo(r * 0.2, r * 1.0, -r * 1.15, r * 0.85);
  ctx.quadraticCurveTo(-r * 0.7, 0, -r * 1.15, -r * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = flash ? FLASH : look.fill;
  ctx.beginPath();
  ctx.ellipse(r * 0.1, 0, r * 0.72, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wide peak cap.
  ctx.beginPath();
  ctx.arc(r * 0.6, 0, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  if (!flash) {
    ctx.fillStyle = '#070a0f';
    ctx.beginPath();
    ctx.ellipse(r * 0.98, 0, r * 0.16, r * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lantern in the free hand, the only warm light on the boss.
    const lx = -r * 0.1;
    const ly = r * 0.82;
    ctx.fillStyle = '#1b1207';
    ctx.fillRect(lx - r * 0.16, ly - r * 0.18, r * 0.32, r * 0.36);
    ctx.fillStyle = PAL.danger;
    ctx.fillRect(lx - r * 0.1, ly - r * 0.12, r * 0.2, r * 0.24);
  }
  ctx.strokeStyle = rgba(flash ? FLASH : look.rim, 0.85);
  ctx.lineWidth = 2 * d.inv;
  ctx.beginPath();
  ctx.arc(r * 0.6, 0, r * 0.42, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

function drawChauffor(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const look = ENEMY_LOOK.chauffor;
  const r = e.radius;
  ctx.fillStyle = flash ? FLASH : look.deep;
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, 0, r * 1.02, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flash ? FLASH : look.fill;
  ctx.beginPath();
  ctx.ellipse(r * 0.08, 0, r * 0.74, r * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cap with visor.
  ctx.beginPath();
  ctx.arc(r * 0.55, 0, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  if (!flash) {
    ctx.fillStyle = '#0a0d12';
    ctx.beginPath();
    ctx.ellipse(r * 0.9, 0, r * 0.14, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Steering wheel held in front of the chest.
    ctx.strokeStyle = '#101820';
    ctx.lineWidth = 3.4 * d.inv;
    ctx.beginPath();
    ctx.arc(r * 0.85, 0, r * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rgba(PAL.amber, 0.85);
    ctx.lineWidth = 2 * d.inv;
    ctx.beginPath();
    ctx.arc(r * 0.85, 0, r * 0.34, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(flash ? FLASH : look.rim, 0.9);
  ctx.lineWidth = 2 * d.inv;
  ctx.beginPath();
  ctx.arc(r * 0.55, 0, r * 0.4, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

function drawOneEnemy(d: Draw, e: Enemy): void {
  const ctx = d.ctx;
  const flash = e.flash > 0;
  const boss = e.type === 'nattvakt' || e.type === 'chauffor';
  const alpha = e.alpha < 1 ? e.alpha : 1;

  eliteAura(ctx, e, d);
  if (boss) {
    drawGlow(ctx, glowSprite(ENEMY_LOOK[e.type].accent), e.x, e.y, e.radius * 2.6, 0.16);
  }

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(facingOf(e));
  ctx.globalAlpha = alpha;
  if (!flash && e.stun > 0) {
    ctx.save();
    ctx.rotate(Math.sin(d.t * 18 + e.phase) * 0.14);
  }

  switch (e.type) {
    case 'fyllo':
      drawFyllo(ctx, e, d, flash);
      break;
    case 'duva':
      drawDuva(ctx, e, d, flash);
      break;
    case 'skugga':
      drawSkugga(ctx, e, d, flash);
      break;
    case 'vaktmastare':
      drawVaktmastare(ctx, e, d, flash);
      break;
    case 'sparkcykel':
      drawSparkcykel(ctx, e, d, flash);
      break;
    case 'nattvakt':
      drawNattvakt(ctx, e, d, flash);
      break;
    case 'chauffor':
      drawChauffor(ctx, e, d, flash);
      break;
    default:
      break;
  }

  if (!flash && e.stun > 0) ctx.restore();
  ctx.restore();

  healthBar(ctx, e, d);
}

export function drawEnemies(d: Draw): void {
  const st = d.state;
  for (let i = 0; i < st.enemies.length; i++) {
    const e = st.enemies[i];
    if (e.hp <= 0) continue;
    if (!visible(d, e.x, e.y, 110)) continue;
    drawOneEnemy(d, e);
  }
}

/* --- player ------------------------------------------------------------- */

export function drawPlayer(d: Draw): void {
  const st = d.state;
  const p = st.player;
  const ctx = d.ctx;
  const look = CHAR_LOOK[st.config.character];
  const r = 15;
  const flash = p.flash > 0;
  const invuln = p.invuln > 0;
  const moving = p.vx * p.vx + p.vy * p.vy > 100;
  const bob = moving ? Math.sin(d.t * 15) * 1.2 : Math.sin(d.t * 2.4) * 0.6;

  // Weapon accent: the active starting weapon's colour is the player's light.
  const primary = st.weapons.length > 0 ? st.weapons[0] : null;
  const accent = primary ? CHAR_LOOK[st.config.character].accent : PAL.ink;

  drawGlow(ctx, glowSprite(accent), p.x, p.y, 46, 0.16);

  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.rotate(p.facing);

  if (invuln) {
    ctx.strokeStyle = rgba(PAL.fluoro, 0.35 + 0.25 * Math.sin(d.t * 14));
    ctx.lineWidth = 2 * d.inv;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Backpack / coat bulk behind.
  ctx.fillStyle = flash ? FLASH : look.coat;
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, 0, r * 0.86, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = flash ? FLASH : look.coat;
  ctx.beginPath();
  ctx.ellipse(r * 0.05, 0, r * 0.7, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();

  // Character-specific props.
  if (!flash) {
    if (st.config.character === 'pensionaren') {
      // Flat cap and a walking stick planted forward.
      ctx.fillStyle = '#5b4a33';
      ctx.beginPath();
      ctx.arc(r * 0.42, 0, r * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2016';
      ctx.beginPath();
      ctx.ellipse(r * 0.74, 0, r * 0.16, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5a33';
      ctx.lineWidth = 2.2 * d.inv;
      ctx.beginPath();
      ctx.moveTo(r * 0.2, r * 0.7);
      ctx.lineTo(r * 1.25, r * 0.55);
      ctx.stroke();
    } else if (st.config.character === 'studenten') {
      // Beanie and headphones.
      ctx.fillStyle = PAL.greenDeep;
      ctx.beginPath();
      ctx.arc(r * 0.42, 0, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0d1418';
      ctx.lineWidth = 3 * d.inv;
      ctx.beginPath();
      ctx.arc(r * 0.34, 0, r * 0.5, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.stroke();
      ctx.fillStyle = PAL.fluoro;
      ctx.fillRect(r * 0.1, -r * 0.62, r * 0.16, r * 0.22);
    } else {
      // Hood.
      ctx.fillStyle = '#141c28';
      ctx.beginPath();
      ctx.arc(r * 0.4, 0, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.skin;
      ctx.fillRect(r * 0.66, -r * 0.1, r * 0.2, r * 0.16);
    }
  }

  // Rim light, exactly 2 CSS px.
  ctx.strokeStyle = rgba(flash ? FLASH : look.rim, 0.75);
  ctx.lineWidth = 2 * d.inv;
  ctx.beginPath();
  ctx.ellipse(r * 0.05, 0, r * 0.7, r * 0.62, 0, Math.PI * 1.02, Math.PI * 1.98);
  ctx.stroke();

  // Hands + weapon accent.
  ctx.fillStyle = flash ? FLASH : look.skin;
  ctx.beginPath();
  ctx.arc(r * 0.62, -r * 0.42, r * 0.16, 0, Math.PI * 2);
  ctx.arc(r * 0.62, r * 0.42, r * 0.14, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  drawGlow(ctx, glowSprite(accent), p.x + Math.cos(p.facing) * 10, p.y + Math.sin(p.facing) * 10 + bob, 24, 0.26);
}