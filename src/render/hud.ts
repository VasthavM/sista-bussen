/**
 * Canvas HUD. The clock and the night-progress bar are the loudest things on
 * screen: they are the entire goal of the run, so they get the top slot, the
 * biggest type and a colour shift to amber at 02:00.
 */
import { RUN_DURATION, BOSS_CHAUFFOR_AT, BOSS_NATTVAKT_AT, clockLabel } from '../sim/curve';
import { WEAPONS } from '../sim/content';
import type { WeaponId } from '../sim/types';
import type { Draw } from './draw';
import { PAL } from './palette';
import { drawGlow, glowSprite } from './sprites';
import { drawWeaponGlyph } from './weapons';
import { clamp, rgba } from './util';

const HUD_TRACK = 'rgba(8,12,17,0.72)';
const HUD_EDGE = 'rgba(255,255,255,0.14)';
const XP_GREEN = rgba(PAL.green, 0.95);
const XP_GREEN_SOFT = rgba(PAL.green, 0.35);
const HP_RED = rgba(PAL.danger, 0.95);
const HP_RED_SOFT = rgba(PAL.danger, 0.3);
const AMBER = PAL.amber;
const FLUORO = PAL.fluoro;

function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.fillStyle = HUD_TRACK;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = HUD_EDGE;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  fill: string,
  soft: string,
): void {
  panel(ctx, x, y, w, h, h / 2);
  const fw = Math.max(0, Math.min(1, frac)) * (w - 2);
  if (fw > 0.5) {
    ctx.fillStyle = soft;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, fw, h - 2, (h - 2) / 2);
    ctx.fill();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, fw, (h - 2) * 0.55, (h - 2) / 2);
    ctx.fill();
  }
}

function clockAndNight(d: Draw): void {
  const ctx = d.ctx;
  const vp = d.vp;
  const st = d.state;
  const pad = 14;
  const left = vp.x + pad;
  const top = vp.y + d.safeTop + 8;
  const t = st.time;
  const late = t >= 180;
  const danger = t >= BOSS_CHAUFFOR_AT;
  const pulse = 0.72 + 0.28 * Math.sin(d.t * (late ? 5.2 : 2));

  // Night label.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const labelSize = Math.max(10, Math.round(vp.w * 0.028));
  ctx.font = `600 ${labelSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = rgba(PAL.inkDim, 0.95);
  ctx.fillText(`NATT ${st.config.night}`, left, top);

  // Clock. Biggest, brightest element on the canvas.
  const clock = clockLabel(t);
  const clockSize = Math.round(clamp(vp.w * 0.115, 26, 54));
  ctx.font = `700 ${clockSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const colour = late ? AMBER : FLUORO;
  const clockY = top + labelSize + 2;

  drawGlow(ctx, glowSprite(colour), left + clockSize * 1.15, clockY + clockSize * 0.55, clockSize * (late ? 2.1 : 1.6), late ? 0.34 * pulse : 0.2);

  ctx.fillStyle = 'rgba(3,6,9,0.7)';
  ctx.fillText(clock, left + 1.5, clockY + 1.5);
  ctx.fillStyle = late ? rgba(AMBER, 0.7 + 0.3 * pulse) : rgba(FLUORO, 0.95);
  ctx.fillText(clock, left, clockY);

  // Night progress: the win condition, spelled out.
  const barY = clockY + clockSize + 8;
  const barW = vp.w - pad * 2;
  const barH = 8;
  const prog = clamp(t / RUN_DURATION, 0, 1);
  panel(ctx, left, barY, barW, barH, barH / 2);
  if (prog > 0.002) {
    const fillColour = prog > 0.75 ? AMBER : PAL.green;
    const grad = ctx.createLinearGradient(left, 0, left + barW, 0);
    grad.addColorStop(0, rgba(PAL.green, 0.85));
    grad.addColorStop(1, rgba(fillColour, 0.95));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(left + 1, barY + 1, (barW - 2) * prog, barH - 2, (barH - 2) / 2);
    ctx.fill();
  }

  // Boss markers and the bus at the end.
  const marker = (at: number, colour: string): void => {
    const x = left + barW * clamp(at / RUN_DURATION, 0, 1);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, barY - 2);
    ctx.lineTo(x, barY + barH + 2);
    ctx.stroke();
  };
  marker(BOSS_NATTVAKT_AT, rgba(PAL.danger, 0.8));
  marker(BOSS_CHAUFFOR_AT, rgba(PAL.amber, 0.8));

  // Playhead.
  const headX = left + 1 + (barW - 2) * prog;
  ctx.fillStyle = rgba(PAL.ink, 0.95);
  ctx.beginPath();
  ctx.arc(headX, barY + barH / 2, 3.4, 0, Math.PI * 2);
  ctx.fill();

  // End label.
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.font = `600 ${Math.max(9, Math.round(vp.w * 0.026))}px ui-monospace, monospace`;
  ctx.fillStyle = rgba(late ? PAL.amberWarm : PAL.inkDim, 0.95);
  ctx.fillText('BUSS 03:00', left + barW, barY - 3);

  // Kill counter, top right.
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const killsSize = Math.round(clamp(vp.w * 0.06, 15, 26));
  ctx.font = `700 ${killsSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = rgba(PAL.ink, 0.92);
  const killsText = String(st.kills);
  ctx.fillText(killsText, vp.x + vp.w - pad, top + labelSize + 2);
  const kw = ctx.measureText(killsText).width;
  // Small kill mark.
  const kx = vp.x + vp.w - pad - kw - 12;
  const ky = top + labelSize + 2 + killsSize * 0.5;
  ctx.fillStyle = rgba(PAL.danger, 0.85);
  ctx.beginPath();
  ctx.arc(kx, ky - 1.5, killsSize * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(kx - killsSize * 0.14, ky + 2, killsSize * 0.28, killsSize * 0.12);

  // Night pressure readout: what is left.
  const remain = Math.max(0, RUN_DURATION - t);
  const mm = Math.floor(remain / 60);
  const ss = Math.floor(remain % 60);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = `600 ${Math.max(9, Math.round(vp.w * 0.026))}px ui-monospace, monospace`;
  ctx.fillStyle = rgba(PAL.inkDim, 0.9);
  ctx.fillText(`${mm}:${String(ss).padStart(2, '0')} KVAR`, vp.x + vp.w - pad, top + labelSize + 2 + killsSize + 3);

  if (danger || (late && st.status === 'running')) {
    // Late-night warning band under the progress bar.
    const a = 0.1 + 0.08 * pulse;
    ctx.fillStyle = rgba(PAL.amber, a * 0.5);
    ctx.fillRect(vp.x, vp.y, vp.w, 2);
    ctx.fillStyle = rgba(PAL.danger, a * 0.4);
    ctx.fillRect(vp.x, vp.y + vp.h - 2, vp.w, 2);
  }
}

function bottomHud(d: Draw): void {
  const ctx = d.ctx;
  const vp = d.vp;
  const st = d.state;
  const p = st.player;
  const pad = 14;
  const bottom = vp.y + vp.h - d.safeBottom - 10;

  // XP: full-width, at the very bottom edge of the play surface.
  const xpY = bottom - 6;
  const xpW = vp.w - pad * 2;
  ctx.fillStyle = 'rgba(6,10,14,0.85)';
  ctx.fillRect(vp.x + pad, xpY, xpW, 6);
  const xpFrac = clamp(st.xp / Math.max(1, st.xpToNext), 0, 1);
  ctx.fillStyle = XP_GREEN_SOFT;
  ctx.fillRect(vp.x + pad, xpY, xpW * xpFrac, 6);
  ctx.fillStyle = XP_GREEN;
  ctx.fillRect(vp.x + pad, xpY, xpW * xpFrac, 2.5);
  drawGlow(ctx, glowSprite(PAL.green), vp.x + pad + xpW * xpFrac, xpY + 3, 22, 0.4);

  // Level.
  const levelSize = Math.max(10, Math.round(vp.w * 0.03));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.font = `700 ${levelSize}px ui-monospace, monospace`;
  ctx.fillStyle = rgba(PAL.green, 0.95);
  ctx.fillText(`NIVÅ ${st.level}`, vp.x + pad, xpY - 6);

  // HP.
  const hpY = xpY - 8 - 14;
  const hpW = vp.w * 0.56;
  const hpFrac = clamp(p.hp / Math.max(1, p.maxHp), 0, 1);
  bar(ctx, vp.x + pad, hpY, hpW, 14, hpFrac, HP_RED, HP_RED_SOFT);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.max(9, Math.round(vp.w * 0.024))}px ui-monospace, monospace`;
  ctx.fillStyle = 'rgba(8,10,14,0.9)';
  ctx.fillText(`${Math.ceil(p.hp)}`, vp.x + pad + 8, hpY + 7 + 1);
  ctx.fillStyle = rgba(PAL.ink, 0.95);
  ctx.fillText(`${Math.ceil(p.hp)}/${Math.round(p.maxHp)}`, vp.x + pad + 8, hpY + 7);

  // Change counter next to HP.
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.max(10, Math.round(vp.w * 0.03))}px ui-monospace, monospace`;
  ctx.fillStyle = rgba(PAL.amberWarm, 0.95);
  ctx.fillText(`${Math.floor(st.change)} kr`, vp.x + vp.w - pad, hpY + 7);

  // Weapon rack.
  if (st.weapons.length > 0) {
    const iconSize = Math.round(clamp(vp.w * 0.055, 16, 26));
    const step = iconSize + 12;
    let x = vp.x + pad + iconSize * 0.5;
    const y = hpY - iconSize * 0.9;
    for (let i = 0; i < st.weapons.length; i++) {
      const w = st.weapons[i];
      const id: WeaponId = w.id;
      const evolved = w.evolved;
      const colour = evolved ? PAL.amberWarm : PAL.steel;
      ctx.fillStyle = evolved ? 'rgba(64,40,6,0.85)' : 'rgba(10,14,19,0.72)';
      ctx.beginPath();
      ctx.roundRect(x - iconSize * 0.72, y - iconSize * 0.72, iconSize * 1.44, iconSize * 1.44, 4);
      ctx.fill();
      ctx.strokeStyle = evolved ? rgba(PAL.amber, 0.9) : HUD_EDGE;
      ctx.lineWidth = evolved ? 1.6 : 1;
      ctx.stroke();
      drawWeaponGlyph(ctx, id, x, y - 1, iconSize, colour, evolved);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.max(8, Math.round(iconSize * 0.44))}px ui-monospace, monospace`;
      ctx.fillStyle = evolved ? PAL.amberWarm : rgba(PAL.inkDim, 0.95);
      ctx.fillText(evolved ? '∞' : String(w.level), x + iconSize * 0.5, y + iconSize * 0.52);
      if (evolved) drawGlow(ctx, glowSprite(PAL.amber), x, y, iconSize * 2.1, 0.24);
      x += step;
      if (i === 5) break;
    }
    // Passive hint: total passive levels, so the rack does not overflow.
    let passives = 0;
    for (const key of Object.keys(st.passives)) {
      const v = st.passives[key as keyof typeof st.passives];
      if (typeof v === 'number') passives += v;
    }
    if (passives > 0) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.max(9, Math.round(vp.w * 0.024))}px ui-monospace, monospace`;
      ctx.fillStyle = rgba(PAL.inkDim, 0.85);
      ctx.fillText(`+${passives} passiv`, x + 4, y);
    }
  }
}

function stick(d: Draw): void {
  const s = d.view.stick;
  if (!s || !s.active) return;
  const ctx = d.ctx;
  // The input layer reports viewport coordinates; the canvas may be letterboxed
  // inside the viewport, so convert to canvas-local before drawing.
  const originX = s.originX - d.rectX;
  const originY = s.originY - d.rectY;
  const knobXIn = s.knobX - d.rectX;
  const knobYIn = s.knobY - d.rectY;
  const ringR = 54;
  const knobR = 25;
  const dx = knobXIn - originX;
  const dy = knobYIn - originY;
  const len = Math.hypot(dx, dy) || 1;
  const max = ringR - knobR * 0.55;
  const kx = originX + (dx / len) * Math.min(len, max);
  const ky = originY + (dy / len) * Math.min(len, max);

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = 'rgba(10,16,22,0.35)';
  ctx.beginPath();
  ctx.arc(originX, originY, ringR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.fluoro, 0.3);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Direction hint.
  ctx.strokeStyle = rgba(PAL.fluoro, 0.22);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(kx, ky);
  ctx.stroke();

  drawGlow(ctx, glowSprite(PAL.fluoro), kx, ky, knobR * 2.4, 0.28);
  ctx.fillStyle = 'rgba(16,26,36,0.85)';
  ctx.beginPath();
  ctx.arc(kx, ky, knobR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.fluoro, 0.75);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function drawHud(d: Draw): void {
  const ctx = d.ctx;
  ctx.save();
  if (d.dimmed) ctx.globalAlpha = 0.34;
  clockAndNight(d);
  bottomHud(d);
  ctx.restore();
  stick(d);
}

/** Death / win readout drawn in canvas so the frame is never a frozen snapshot alone. */
export function drawStatusBand(d: Draw): void {
  const st = d.state;
  if (st.status === 'running') return;
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