/**
 * v2 map objective visuals: fuel canisters, the bus and a screen-edge arrow toward the next goal.
 * Placeholder silhouettes in the existing style (ink outline, rim light, additive glow).
 */
import { BUS_RADIUS } from '../sim/objective';
import { PLAYER_RADIUS } from '../sim/state';
import type { Draw } from './draw';
import { screenX, screenY, visible } from './draw';
import { PAL, SPRITE_INK } from './palette';
import { drawPickupIcon } from './pickups';
import { drawGlow, glowSprite } from './sprites';
import { rgba } from './util';

const BUS_W = 120;
const BUS_H = 54;

export function drawCanister(d: Draw, x: number, y: number): void {
  const ctx = d.ctx;
  const pulse = 0.7 + 0.3 * Math.sin(d.t * 4 + x * 0.05);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, glowSprite(PAL.amber), x, y, 54, 0.34 * pulse);
  ctx.restore();
  // A jerry can sized to read from across the street: bigger than any orb.
  drawPickupIcon(ctx, 'fuel', x, y - 1, 15 + pulse * 0.8);
}

/**
 * The bus: a battered, overloaded wreck seen from above. Nose to +x, so the
 * headlights, windscreen and bumper plow are on the right. Roof rack with
 * spare cans and a tyre, dented panels, a cracked windscreen and a smear on the
 * bumper say "survived", the lit headlights say "still runs".
 */
export function drawBus(d: Draw): void {
  const ctx = d.ctx;
  const { x, y } = d.state.bus;
  const ready = d.state.quotaMet;
  const pulse = 0.5 + 0.5 * Math.sin(d.t * 5);
  const w = BUS_W;
  const h = BUS_H;
  const left = x - w / 2;
  const top = y - h / 2;

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

  // Headlight beams first, additive, so the body sits on top of the light.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beam = ready ? 0.34 : 0.2;
  ctx.fillStyle = rgba(PAL.amberWarm, beam);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(left + w - 4, y + side * h * 0.34);
    ctx.lineTo(left + w + 74, y + side * h * 0.34 + side * 22);
    ctx.lineTo(left + w + 74, y + side * h * 0.34 - side * 6);
    ctx.closePath();
    ctx.fill();
  }
  drawGlow(ctx, glowSprite(PAL.amberWarm), left + w + 4, y - h * 0.34, 34, ready ? 0.7 : 0.5);
  drawGlow(ctx, glowSprite(PAL.amberWarm), left + w + 4, y + h * 0.34, 34, ready ? 0.7 : 0.5);
  ctx.restore();

  // Wheels peeking out past the hull, then the hull.
  ctx.fillStyle = SPRITE_INK;
  for (const wx of [left + 22, left + w - 26]) {
    ctx.fillRect(wx - 9, top - 3, 18, 6);
    ctx.fillRect(wx - 9, top + h - 3, 18, 6);
  }
  ctx.beginPath();
  ctx.roundRect(left - 3, top - 3, w + 6, h + 6, 10);
  ctx.fill();

  // Body: battered ochre, lighter roof panel, darker lower flank.
  const body = ready ? PAL.amber : PAL.amberDeep;
  ctx.fillStyle = '#7d5110';
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 8);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(left + 2, top + 2, w - 4, h - 11, 6);
  ctx.fill();
  // Rim light along the top edge (the leading light edge).
  ctx.strokeStyle = rgba(PAL.amberWarm, 0.7);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left + 10, top + 2.5);
  ctx.lineTo(left + w - 16, top + 2.5);
  ctx.stroke();

  // Roof ribs and vent hatches.
  ctx.fillStyle = rgba('#3a2406', 0.45);
  for (let i = 0; i < 5; i++) ctx.fillRect(left + 14 + i * 17, top + 4, 2, h - 17);
  ctx.fillStyle = '#4a3008';
  ctx.fillRect(left + 28, top + 9, 14, 9);
  ctx.fillRect(left + 62, top + 9, 14, 9);

  // Roof rack: two jerry cans and a spare tyre strapped on.
  ctx.fillStyle = SPRITE_INK;
  ctx.fillRect(left + 22, top + 21, 58, 13);
  drawPickupIcon(ctx, 'fuel', left + 33, top + 27, 9);
  drawPickupIcon(ctx, 'fuel', left + 52, top + 27, 9);
  ctx.beginPath();
  ctx.arc(left + 70, top + 27, 8, 0, Math.PI * 2);
  ctx.fillStyle = SPRITE_INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(left + 70, top + 27, 3.4, 0, Math.PI * 2);
  ctx.fillStyle = '#5b6672';
  ctx.fill();

  // Windscreen at the nose, cracked and scratched.
  ctx.fillStyle = SPRITE_INK;
  ctx.beginPath();
  ctx.roundRect(left + w - 21, top + 5, 17, h - 16, 4);
  ctx.fill();
  ctx.fillStyle = '#27414b';
  ctx.beginPath();
  ctx.roundRect(left + w - 19, top + 7, 13, h - 20, 3);
  ctx.fill();
  ctx.strokeStyle = rgba('#b6d6df', 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left + w - 18, top + 9);
  ctx.lineTo(left + w - 11, top + 19);
  ctx.lineTo(left + w - 15, top + 24);
  ctx.moveTo(left + w - 11, top + 19);
  ctx.lineTo(left + w - 7, top + 28);
  ctx.stroke();

  // Dents and rust, a dark smear on the flank, a boarded rear window.
  ctx.fillStyle = rgba('#2a1704', 0.5);
  ctx.beginPath();
  ctx.ellipse(left + 90, top + 30, 9, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba('#7a2a16', 0.55);
  ctx.fillRect(left + 4, top + 12, 6, 16);
  ctx.fillStyle = rgba(PAL.blood, 0.6);
  ctx.fillRect(left + w - 26, top + h - 20, 10, 4);
  ctx.fillStyle = '#5a4a38';
  ctx.fillRect(left + 3, top + 8, 5, 3);
  ctx.fillRect(left + 3, top + 15, 5, 3);

  // Plow bumper at the nose, steel with a chevron.
  ctx.fillStyle = SPRITE_INK;
  ctx.fillRect(left + w - 4, top + 9, 8, h - 20);
  ctx.fillStyle = PAL.steel;
  ctx.fillRect(left + w - 3, top + 11, 5, h - 24);

  // Headlights (hot cores) and tail lights.
  ctx.fillStyle = PAL.fluoro;
  ctx.fillRect(left + w - 7, top + 3, 6, 7);
  ctx.fillRect(left + w - 7, top + h - 17, 6, 7);
  ctx.fillStyle = PAL.danger;
  ctx.fillRect(left + 1, top + 4, 3, 6);
  ctx.fillRect(left + 1, top + h - 17, 3, 6);
  // Lower flank shade strip.
  ctx.fillStyle = rgba('#000000', 0.28);
  ctx.fillRect(left + 3, top + h - 9, w - 6, 6);
}

/** World pass: canisters and the bus. Call between beginWorld and endWorld. */
export function drawObjective(d: Draw): void {
  const st = d.state;
  for (const c of st.canisters) {
    if (c.active && visible(d, c.x, c.y, 30)) drawCanister(d, c.x, c.y);
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
      if (!c.active) continue;
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
