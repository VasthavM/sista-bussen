/**
 * Pre-rendered sprites. Nothing here uses ctx.filter or shadowBlur: both are
 * far too slow on a 2021 mid-range phone. Glows are pre-baked radial gradients
 * that get blitted with the `lighter` composite.
 */
import { rgba } from './util';

const glowCache = new Map<string, HTMLCanvasElement>();
const GLOW_SIZE = 96;

export function glowSprite(colour: string): HTMLCanvasElement {
  const cached = glowCache.get(colour);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = GLOW_SIZE;
  c.height = GLOW_SIZE;
  const g = c.getContext('2d');
  if (g) {
    const half = GLOW_SIZE / 2;
    const grad = g.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, rgba(colour, 0.95));
    grad.addColorStop(0.22, rgba(colour, 0.5));
    grad.addColorStop(0.55, rgba(colour, 0.14));
    grad.addColorStop(1, rgba(colour, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  }
  glowCache.set(colour, c);
  return c;
}

/** Soft, wide, low-alpha light pool (sodium lamp falloff). */
const poolCache = new Map<string, HTMLCanvasElement>();

export function poolSprite(colour: string): HTMLCanvasElement {
  const cached = poolCache.get(colour);
  if (cached) return cached;
  const size = 160;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (g) {
    const half = size / 2;
    const grad = g.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, rgba(colour, 0.42));
    grad.addColorStop(0.4, rgba(colour, 0.14));
    grad.addColorStop(0.75, rgba(colour, 0.03));
    grad.addColorStop(1, rgba(colour, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  poolCache.set(colour, c);
  return c;
}

/** Draw an additive glow. `radius` is the full visual radius in the current unit space. */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  if (alpha <= 0.002 || radius <= 0.2) return;
  const prev = ctx.globalAlpha;
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = prev;
}

const GRAIN_TILE = 128;
const GRAIN_ALPHA = 0.1;
let grainTiles: HTMLCanvasElement[] | null = null;

/**
 * Four grain tiles that get cycled. Visible at roughly 4%: the tile itself is
 * drawn at alpha ~0.4 over a texture authored at 10%.
 */
export function getGrainTiles(): HTMLCanvasElement[] {
  if (grainTiles) return grainTiles;
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < 4; t++) {
    const c = document.createElement('canvas');
    c.width = GRAIN_TILE;
    c.height = GRAIN_TILE;
    const g = c.getContext('2d');
    if (!g) {
      tiles.push(c);
      continue;
    }
    const img = g.createImageData(GRAIN_TILE, GRAIN_TILE);
    const data = img.data;
    let seed = (t + 1) * 9176;
    for (let i = 0; i < data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = ((seed >>> 16) & 255) / 255;
      // Mid grey is neutral in overlay-ish blends; keep both light and dark specks.
      const v = 90 + n * 130;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    tiles.push(c);
  }
  grainTiles = tiles;
  return tiles;
}

export const GRAIN = { tile: GRAIN_TILE, alpha: GRAIN_ALPHA };

/** Radial vignette sized to a surface. Rebuilt only on resize. */
export function buildVignette(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  const g = c.getContext('2d');
  if (!g) return c;
  const cx = c.width / 2;
  const cy = c.height / 2;
  const outer = Math.hypot(cx, cy);
  const grad = g.createRadialGradient(cx, cy, outer * 0.28, cx, cy, outer * 1.02);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.34)');
  grad.addColorStop(0.82, 'rgba(0,0,0,0.68)');
  grad.addColorStop(1, 'rgba(0,0,0,0.92)');
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  // Cold cast in the corners so the frame reads blue-black rather than grey.
  const cast = g.createRadialGradient(cx, cy, outer * 0.5, cx, cy, outer);
  cast.addColorStop(0, 'rgba(8,18,28,0)');
  cast.addColorStop(1, 'rgba(8,18,28,0.4)');
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = cast;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}