/** Small allocation-free helpers shared by the renderer modules. */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/** Local deterministic RNG. Never reads or writes the sim RNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim();
  if (h.charCodeAt(0) === 35) h = h.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const rv = Math.round(clamp(r, 0, 255));
  const gv = Math.round(clamp(g, 0, 255));
  const bv = Math.round(clamp(b, 0, 255));
  return `#${((1 << 24) | (rv << 16) | (gv << 8) | bv).toString(16).slice(1)}`;
}

/** `rgba()` string for a hex colour. Call at module init only, never per frame. */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1).toFixed(3)})`;
}

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return toHex(lerp(ar, br, t), lerp(ag, bg, t), lerp(ab, bb, t));
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, '#ffffff', clamp(amount, 0, 1));
}

export function darken(hex: string, amount: number): string {
  return mix(hex, '#000000', clamp(amount, 0, 1));
}

/** Deterministic 2D value noise in 0..1. Used for static ground texture. */
export function hash01(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 1..999 as pre-built strings so damage numbers never allocate at draw time. */
export const NUM_TEXT: string[] = (() => {
  const out: string[] = new Array<string>(1000);
  for (let i = 0; i < 1000; i++) out[i] = String(i);
  return out;
})();

export function intText(value: number): string {
  const v = Math.round(value);
  if (v >= 0 && v < 1000) return NUM_TEXT[v];
  return String(v);
}