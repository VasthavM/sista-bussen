/** Progression, spawn and clock curves. Pure functions only. */

export const RUN_DURATION = 240; // reference length of a map (old night end): HUD clock, audio pressure, enemy HP time scale
export const XP_CURVE_BASE = 40;
export const XP_CURVE_EXPONENT = 1.35;
export const BOSS_NATTVAKT_AT = 210; // 02:30
export const BOSS_CHAUFFOR_AT = 225; // 02:45, final wall before the bus at 03:00
export const MAX_ENEMIES = 180;

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return Math.round(XP_CURVE_BASE * Math.pow(Math.max(1, level), XP_CURVE_EXPONENT));
}

/** Total XP needed to reach `level` from level 1. */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpForLevel(l);
  return sum;
}

/** Enemy HP / damage multiplier per map depth. Same shape as the old night curve: 1 + 0.18 * (depth - 1). */
export function depthDifficulty(depth: number): number {
  return 1 + 0.18 * (Math.max(1, depth) - 1);
}

/**
 * Base spawn intensity in enemies per second, per second of the run.
 * Scripted ramp: quiet opening, flock rush at 0:45, pressure doubles by 02:00. There is no hard end
 * any more: past RUN_DURATION the ramp keeps climbing, so dawdling stays the risk.
 */
export function spawnIntensityAt(t: number): number {
  const s = Math.max(0, t);
  if (s < 12) return 0.5 + s * 0.02;
  if (s < 45) return 0.74 + (s - 12) * 0.02;
  if (s < 90) return 1.35 + (s - 45) * 0.01;
  if (s < 150) return 1.8 + (s - 90) * 0.008;
  if (s < 210) return 2.28 + (s - 150) * 0.004;
  // Same tiny slope up to the old 03:00 mark, then three times steeper and uncapped.
  return 2.52 + (s - 210) * 0.0015 + Math.max(0, s - RUN_DURATION) * 0.003;
}

/** Final spawn rate including depth scaling and the stop's density multiplier. */
export function spawnRateAt(t: number, depth: number, density = 1): number {
  return spawnIntensityAt(t) * depthDifficulty(depth) * density;
}

/** Clock label for elapsed run seconds. 0 -> 23:00, 60 -> 00:00, 240 -> 03:00. */
export function clockLabel(elapsed: number): string {
  const totalMinutes = Math.floor(23 * 60 + Math.max(0, elapsed));
  const minutesInDay = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(minutesInDay / 60);
  const m = minutesInDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function clockHour(elapsed: number): number {
  return Math.floor(((23 * 60 + Math.max(0, elapsed)) % 1440) / 60);
}