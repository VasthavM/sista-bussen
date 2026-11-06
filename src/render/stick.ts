/**
 * In-canvas virtual stick. This is the only gameplay HUD element drawn on the
 * canvas: it has to follow the thumb, which lives in viewport coordinates, so it
 * cannot be a DOM node. Everything else (clock, night bar, HP, XP, weapon rack)
 * is the DOM HUD in `src/ui/hud.ts`.
 */
import type { Draw } from './draw';
import { PAL } from './palette';
import { drawGlow, glowSprite } from './sprites';
import { rgba } from './util';

export function drawStick(d: Draw): void {
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