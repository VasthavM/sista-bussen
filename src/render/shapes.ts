/**
 * Drawing primitives shared by the player, the zombies and the pickups: sealed
 * outlines, tapered limbs, plates, discs and the head-at-the-leading-edge mass.
 */
import type { SpritePaint } from './palette';

export const TAU = Math.PI * 2;
export const DASH = [9, 7];
export const NO_DASH: number[] = [];

/* --- drawing primitives -------------------------------------------------- */

/**
 * Seal an already-built path: wide dark stroke first, fill on top. The visible
 * result is a clean outer edge of `ol` px around the union of the sub-paths,
 * with no seams where the parts of one silhouette meet.
 */
export function seal(
  ctx: CanvasRenderingContext2D,
  fill: string,
  outline: string,
  ol: number,
): void {
  ctx.strokeStyle = outline;
  ctx.lineWidth = ol * 2;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

/**
 * Tapered limb: a four-point wedge from a wide root to a narrow end. Outlined
 * like every other mass. A round-capped tube of the same width reads as a
 * sausage; a wedge reads as an arm.
 */
export function taper(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  fill: string,
  outline: string,
  ol: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
  ctx.closePath();
  seal(ctx, fill, outline, ol);
}

/** Flat plate: straps, cap peaks, hazard bands, deck plates. */
export function plate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: string,
  outline: string,
  ol: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  seal(ctx, fill, outline, ol);
}

export function disc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  fill: string,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, TAU);
  ctx.fill();
}

export function discSolid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  fill: string,
  outline: string,
  ol: number,
): void {
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, TAU);
  seal(ctx, fill, outline, ol);
}

/**
 * Head at the leading edge: lit face, crown (hair, hood, cap) over the rear,
 * dark eye, bright rim on the front arc. A bare bright disc reads as a ball;
 * this reads as a head with a direction.
 */
export function headMass(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  p: SpritePaint,
  crown: string,
  band: string | null,
  inv: number,
): void {
  discSolid(ctx, x, y, rad, p.head, p.outline, 1.1 * inv);
  // Crown over the rear of the head only: the lit face has to survive.
  ctx.beginPath();
  ctx.arc(x - rad * 0.14, y, rad * 0.98, Math.PI * 0.6, Math.PI * 1.4);
  ctx.closePath();
  ctx.fillStyle = crown;
  ctx.fill();
  // Cap band along the crown edge: reads as a cap without covering the face.
  if (band !== null) {
    ctx.beginPath();
    ctx.arc(x - rad * 0.14, y, rad * 0.99, Math.PI * 0.6, Math.PI * 1.4);
    ctx.strokeStyle = band;
    ctx.lineWidth = 1.6 * inv;
    ctx.stroke();
  }
  disc(ctx, x + rad * 0.42, y - rad * 0.1, rad * 0.15, p.outline);
  // Rim inside the head, front arc only: no bright hook outside the silhouette.
  ctx.beginPath();
  ctx.arc(x, y, rad * 0.86, -0.62, 0.62);
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.3 * inv;
  ctx.stroke();
}
