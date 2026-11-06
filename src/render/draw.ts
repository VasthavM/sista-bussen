/** Frame context and camera helpers. All units are CSS pixels unless named world. */
import type { SimState } from '../sim/types';
import type { ViewState } from './index';

export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Draw {
  ctx: CanvasRenderingContext2D;
  state: SimState;
  view: ViewState;
  /** Device pixel ratio baked into canvas.width/height. */
  dpr: number;
  canvasW: number;
  canvasH: number;
  vp: Viewport;
  /** Safe-area insets in CSS px, measured once from the host element. */
  safeTop: number;
  safeBottom: number;
  /** Canvas offset in the viewport, so pointer coordinates can be converted. */
  rectX: number;
  rectY: number;
  zoom: number;
  inv: number;
  camX: number;
  camY: number;
  shakeX: number;
  shakeY: number;
  halfW: number;
  halfH: number;
  frame: number;
  /** Run seconds for time-driven visuals. */
  t: number;
  paused: boolean;
  dimmed: boolean;
  flash: number;
  flashColour: string;
  aberr: number;
  hurt: number;
  boss: number;
  evolve: number;
}

export function computeViewport(canvasW: number, canvasH: number): Viewport {
  const target = 9 / 16;
  let w = canvasW;
  let h = canvasH;
  if (canvasW / canvasH > target) {
    // Wider than portrait 9:16 — letterbox to a portrait surface.
    w = canvasH * target;
    h = canvasH;
  }
  return { x: (canvasW - w) / 2, y: (canvasH - h) / 2, w, h };
}

export function computeZoom(vp: { w: number; h: number }): number {
  // Keep roughly 480 world units across and 740 down: spawn ring (380-470)
  // sits just off screen, which is the pacing the sim was tuned for.
  const zx = vp.w / 480;
  const zy = vp.h / 740;
  return Math.max(0.35, Math.min(zx, zy));
}

export function beginWorld(d: Draw): void {
  const ctx = d.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(d.vp.x, d.vp.y, d.vp.w, d.vp.h);
  ctx.clip();
  ctx.translate(d.vp.x + d.vp.w / 2 + d.shakeX, d.vp.y + d.vp.h / 2 + d.shakeY);
  ctx.scale(d.zoom, d.zoom);
  ctx.translate(-d.camX, -d.camY);
}

export function endWorld(d: Draw): void {
  d.ctx.restore();
}

export function resetToScreen(d: Draw): void {
  d.ctx.setTransform(d.dpr, 0, 0, d.dpr, 0, 0);
}

export function screenX(d: Draw, wx: number): number {
  return d.vp.x + d.vp.w / 2 + d.shakeX + (wx - d.camX) * d.zoom;
}

export function screenY(d: Draw, wy: number): number {
  return d.vp.y + d.vp.h / 2 + d.shakeY + (wy - d.camY) * d.zoom;
}

/** True when a world-space point is inside the viewport plus `pad` world units. */
export function visible(d: Draw, x: number, y: number, pad: number): boolean {
  return (
    Math.abs(x - d.camX) <= d.halfW + pad &&
    Math.abs(y - d.camY) <= d.halfH + pad
  );
}