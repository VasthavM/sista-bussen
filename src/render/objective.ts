/**
 * v2 map objective visuals: fuel canisters, the bus and a screen-edge arrow toward the next goal.
 * Placeholder silhouettes in the existing style (ink outline, rim light, additive glow).
 */
import { BUS_RADIUS } from '../sim/objective';
import { PLAYER_RADIUS } from '../sim/state';
import type { Draw } from './draw';
import { screenX, screenY, visible } from './draw';
import { PAL, SPRITE_INK } from './palette';
import { drawGlow, glowSprite } from './sprites';
import { rgba } from './util';

const BUS_W = 120;
const BUS_H = 54;

function drawCanister(d: Draw, x: number, y: number): void {
  const ctx = d.ctx;
  const pulse = 0.7 + 0.3 * Math.sin(d.t * 4 + x * 0.05);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, glowSprite(PAL.amber), x, y, 46, 0.32 * pulse);
  ctx.restore();
  ctx.fillStyle = SPRITE_INK;
  ctx.fillRect(x - 8, y - 10, 16, 20);
  ctx.fillStyle = PAL.amberDeep;
  ctx.fillRect(x - 6, y - 8, 12, 16);
  ctx.fillStyle = PAL.amber;
  ctx.fillRect(x - 6, y - 8, 12, 4);
  ctx.fillStyle = SPRITE_INK;
  ctx.fillRect(x - 3, y - 14, 6, 5);
}

function drawBus(d: Draw): void {
  const ctx = d.ctx;
  const { x, y } = d.state.bus;
  const ready = d.state.quotaMet;
  const pulse = 0.5 + 0.5 * Math.sin(d.t * 5);
  if (ready) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, glowSprite(PAL.green), x, y, (BUS_RADIUS + PLAYER_RADIUS) * 3.2, 0.3 + 0.2 * pulse);
    ctx.strokeStyle = rgba(PAL.green, 0.5 + 0.3 * pulse);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, BUS_RADIUS + PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = SPRITE_INK;
  ctx.fillRect(x - BUS_W / 2 - 3, y - BUS_H / 2 - 3, BUS_W + 6, BUS_H + 6);
  ctx.fillStyle = ready ? PAL.amber : PAL.amberDeep;
  ctx.fillRect(x - BUS_W / 2, y - BUS_H / 2, BUS_W, BUS_H);
  ctx.fillStyle = PAL.slab;
  for (let i = 0; i < 6; i++) ctx.fillRect(x - BUS_W / 2 + 8 + i * 17, y - BUS_H / 2 + 8, 12, 14);
  ctx.fillStyle = PAL.fluoro;
  ctx.fillRect(x + BUS_W / 2 - 6, y - BUS_H / 2 + 6, 6, 8);
  ctx.fillRect(x + BUS_W / 2 - 6, y + BUS_H / 2 - 14, 6, 8);
}

/** World pass: canisters and the bus. Call between beginWorld and endWorld. */
export function drawObjective(d: Draw): void {
  const st = d.state;
  for (const c of st.canisters) {
    if (c.active && d.t >= c.at && visible(d, c.x, c.y, 30)) drawCanister(d, c.x, c.y);
  }
  if (visible(d, st.bus.x, st.bus.y, BUS_W)) drawBus(d);
}

/** Screen pass: an arrow at the viewport edge toward the bus (quota met) or the nearest canister. */
export function drawGoalArrow(d: Draw): void {
  const st = d.state;
  if (st.status !== 'running') return;
  let tx = st.bus.x;
  let ty = st.bus.y;
  if (!st.quotaMet) {
    let best = Number.POSITIVE_INFINITY;
    let found = false;
    for (const c of st.canisters) {
      if (!c.active || d.t < c.at) continue;
      const dist = Math.hypot(c.x - st.player.x, c.y - st.player.y);
      if (dist < best) {
        best = dist;
        tx = c.x;
        ty = c.y;
        found = true;
      }
    }
    if (!found) return;
  }
  if (visible(d, tx, ty, -20)) return;
  const ctx = d.ctx;
  const cx = d.vp.x + d.vp.w / 2;
  const cy = d.vp.y + d.vp.h / 2;
  const ang = Math.atan2(screenY(d, ty) - cy, screenX(d, tx) - cx);
  const rx = d.vp.w / 2 - 26;
  const ry = d.vp.h / 2 - 90;
  const k = 1 / Math.hypot(Math.cos(ang) / rx, Math.sin(ang) / ry);
  ctx.save();
  ctx.translate(cx + Math.cos(ang) * k, cy + Math.sin(ang) * k);
  ctx.rotate(ang);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = st.quotaMet ? PAL.green : PAL.amber;
  ctx.strokeStyle = SPRITE_INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}
