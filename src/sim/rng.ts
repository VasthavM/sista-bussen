/**
 * Deterministic RNG. The simulation must never touch Math.random or Date.now.
 * mulberry32 is small, fast and good enough for gameplay rolls.
 */
export interface Rng {
  state: number;
}

export function makeRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextRange(rng: Rng, min: number, max: number): number {
  return min + nextFloat(rng) * (max - min);
}

export function nextInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(nextFloat(rng) * maxExclusive);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[nextInt(rng, items.length)];
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

export function pickWeighted<T>(rng: Rng, items: readonly Weighted<T>[]): T | null {
  let total = 0;
  for (const item of items) total += Math.max(0, item.weight);
  if (total <= 0) return null;
  let roll = nextFloat(rng) * total;
  for (const item of items) {
    roll -= Math.max(0, item.weight);
    if (roll <= 0) return item.value;
  }
  return items[items.length - 1]?.value ?? null;
}

export function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}