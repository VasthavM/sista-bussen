import { makeRng, nextFloat, nextInt, pickWeighted, shuffle, type Rng } from '../sim/rng';
import type { MapConfig, MapResult, MaterialId, Materials, StopType } from '../sim/map';

/**
 * v2 route layer: seeded segment generator, MapConfig builder and route state.
 * Pure. No UI, no storage, no sim imports besides the contract types and the RNG.
 */

export const SEGMENT_LENGTH = 10;
/** Maps 1..9 of a segment offer a choice; map 10 is the single boss stop. */
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
const SAFE_CHANCE = 0.7;

export type Danger = 1 | 2 | 3;
export type RewardHint = MaterialId | 'fuel';

/** One selectable stop on the route map. */
export interface StopOption {
  readonly type: StopType;
  readonly danger: Danger;
  readonly rewardHint: RewardHint;
}

/** layers[i] holds the options offered for map i + 1 of the segment. layers[9] is the lone boss. */
export interface RouteSegment {
  readonly seed: number;
  readonly index: number;
  readonly layers: readonly (readonly StopOption[])[];
}

interface StopRow {
  /** Relative draw weight when the generator fills a layer. */
  readonly weight: number;
  readonly danger: readonly [Danger, Danger];
  /** Fixed hint, or 'any' for a roll between the three materials. */
  readonly reward: RewardHint | 'any';
  /** Multiplier on the base fuel quota. */
  readonly quota: number;
  /** Multiplier on enemy density before the danger step. */
  readonly density: number;
  readonly materials: Materials;
}

const x = (scrap: number, parts: number, supplies: number): Materials => ({ scrap, parts, supplies });

/**
 * Single source for stop behaviour: draw odds, risk, quota and multipliers per type.
 * Values are first-pass; the balance ticket (v2-8) re-tunes them.
 */
export const STOP_TABLE: Readonly<Record<StopType, StopRow>> = {
  street: { weight: 36, danger: [1, 2], reward: 'scrap', quota: 1, density: 1, materials: x(1, 1, 1) },
  gas_station: { weight: 15, danger: [2, 2], reward: 'fuel', quota: 0.7, density: 1.2, materials: x(1, 1, 1) },
  scrapyard: { weight: 15, danger: [1, 2], reward: 'scrap', quota: 1, density: 1, materials: x(2, 1, 1) },
  pharmacy: { weight: 15, danger: [1, 2], reward: 'supplies', quota: 1, density: 1, materials: x(1, 1, 2) },
  depot: { weight: 15, danger: [2, 3], reward: 'parts', quota: 1, density: 1.1, materials: x(1, 2, 1) },
  horde: { weight: 4, danger: [3, 3], reward: 'any', quota: 1.1, density: 1.6, materials: x(2, 2, 2) },
  safe: { weight: 0, danger: [1, 1], reward: 'supplies', quota: 0, density: 0, materials: x(0, 0, 0) },
  boss: { weight: 0, danger: [3, 3], reward: 'parts', quota: 1, density: 1.5, materials: x(2, 3, 1) },
};

/** Safe stops skip the sim and pay this fixed grant. */
export const SAFE_GRANT: Materials = x(3, 1, 3);

const MATERIAL_IDS: readonly MaterialId[] = ['scrap', 'parts', 'supplies'];
const DRAWABLE = (Object.keys(STOP_TABLE) as StopType[]).filter((t) => STOP_TABLE[t].weight > 0);

/** 32-bit mix of two ints; stable across platforms. */
function mix(a: number, b: number): number {
  let h = (a ^ Math.imul((b ^ 0x9e3779b9) >>> 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

export function deriveSegmentSeed(routeSeed: number, segmentIndex: number): number {
  return mix(mix(routeSeed >>> 0, 0x5e6), segmentIndex);
}

/** Seed for the sim's RNG on one map. Same route seed and depth give the same map. */
export function deriveMapSeed(routeSeed: number, depth: number): number {
  return mix(mix(routeSeed >>> 0, 0x3a9), depth);
}

function makeOption(type: StopType, rng: Rng): StopOption {
  const row = STOP_TABLE[type];
  const [lo, hi] = row.danger;
  const danger = (lo + nextInt(rng, hi - lo + 1)) as Danger;
  const rewardHint = row.reward === 'any' ? MATERIAL_IDS[nextInt(rng, MATERIAL_IDS.length)] : row.reward;
  return { type, danger, rewardHint };
}

/** Draw `count` distinct types, weighted by the stop table. */
function drawTypes(rng: Rng, count: number): StopType[] {
  const pool = DRAWABLE.map((value) => ({ value, weight: STOP_TABLE[value].weight }));
  const out: StopType[] = [];
  while (out.length < count && pool.length > 0) {
    const pick = pickWeighted(rng, pool);
    if (pick === null) break;
    out.push(pick);
    pool.splice(pool.findIndex((p) => p.value === pick), 1);
  }
  return out;
}

export function generateSegment(routeSeed: number, segmentIndex: number): RouteSegment {
  const seed = deriveSegmentSeed(routeSeed, segmentIndex);
  const rng = makeRng(seed);
  // Map numbers 2..9 only: never the first stop, never the boss.
  const safeMap = nextFloat(rng) < SAFE_CHANCE ? 2 + nextInt(rng, 8) : 0;
  const layers: StopOption[][] = [];
  for (let map = 1; map < SEGMENT_LENGTH; map++) {
    const count = MIN_OPTIONS + nextInt(rng, MAX_OPTIONS - MIN_OPTIONS + 1);
    const hasSafe = map === safeMap;
    const types: StopType[] = [...drawTypes(rng, hasSafe ? count - 1 : count), ...(hasSafe ? (['safe'] as const) : [])];
    layers.push(shuffle(rng, types).map((t) => makeOption(t, rng)));
  }
  layers.push([makeOption('boss', rng)]);
  return { seed, index: segmentIndex, layers };
}

/** Placeholder base quota; the sim ticket (#12) owns the real formula and swaps it in. */
export const defaultBaseQuota = (depth: number): number => 10 + 2 * (depth - 1);

export function buildMapConfig(
  option: StopOption,
  depth: number,
  routeSeed: number,
  baseQuota: (depth: number) => number = defaultBaseQuota,
): MapConfig {
  if (option.type === 'safe') throw new Error('safe stops have no map; use resolveSafeStop');
  const row = STOP_TABLE[option.type];
  return {
    seed: deriveMapSeed(routeSeed, depth),
    depth,
    stop: option.type,
    fuelQuota: Math.max(1, Math.round(baseQuota(depth) * row.quota)),
    materialMultiplier: row.materials,
    // Danger 1 is the table baseline; each pip adds 10%.
    densityMultiplier: row.density * (1 + 0.1 * (option.danger - 1)),
  };
}

export interface RouteState {
  /** 1-based index of the next map to play. */
  readonly depth: number;
  /** Depth of the last cleared boss: 0, 10, 20, ... Death returns to checkpoint + 1. */
  readonly checkpoint: number;
  readonly segmentSeed: number;
  /** Option index taken on each cleared map of the current segment. */
  readonly path: readonly number[];
  /** Deepest map ever cleared. */
  readonly bestDepth: number;
}

export function createRoute(routeSeed: number): RouteState {
  return { depth: 1, checkpoint: 0, segmentSeed: deriveSegmentSeed(routeSeed, 0), path: [], bestDepth: 0 };
}

export const segmentIndexOf = (depth: number): number => Math.floor((depth - 1) / SEGMENT_LENGTH);

/** Options on offer for the next map. */
export function currentOptions(route: RouteState, routeSeed: number): readonly StopOption[] {
  return generateSegment(routeSeed, segmentIndexOf(route.depth)).layers[(route.depth - 1) % SEGMENT_LENGTH];
}

export interface RouteUpdate {
  readonly route: RouteState;
  readonly materials: Materials;
}

const addMaterials = (a: Materials, b: Materials): Materials => ({
  scrap: a.scrap + b.scrap,
  parts: a.parts + b.parts,
  supplies: a.supplies + b.supplies,
});

function checkChoice(choice: number): void {
  if (!Number.isInteger(choice) || choice < 0 || choice >= MAX_OPTIONS) throw new RangeError(`bad stop choice ${choice}`);
}

/** Move one stop forward. Clearing a boss sets the checkpoint and opens the next segment. */
function advance(route: RouteState, routeSeed: number, choice: number): RouteState {
  const cleared = route.depth;
  const bossCleared = cleared % SEGMENT_LENGTH === 0;
  return {
    depth: cleared + 1,
    checkpoint: bossCleared ? cleared : route.checkpoint,
    segmentSeed: bossCleared ? deriveSegmentSeed(routeSeed, segmentIndexOf(cleared + 1)) : route.segmentSeed,
    path: bossCleared ? [] : [...route.path, choice],
    bestDepth: Math.max(route.bestDepth, cleared),
  };
}

/** Back to the start of the segment after the last checkpoint. */
function fallBack(route: RouteState, routeSeed: number): RouteState {
  const depth = route.checkpoint + 1;
  return { ...route, depth, segmentSeed: deriveSegmentSeed(routeSeed, segmentIndexOf(depth)), path: [] };
}

/**
 * Apply one finished map. `choice` is the option index that was played.
 * Extraction advances a stop and banks the haul. Death drops back to the last
 * checkpoint, keeps what was already banked and loses the failed map's haul.
 */
export function applyMapResult(
  route: RouteState,
  bank: Materials,
  routeSeed: number,
  choice: number,
  result: MapResult,
): RouteUpdate {
  checkChoice(choice);
  if (result.outcome === 'died') return { route: fallBack(route, routeSeed), materials: bank };
  return { route: advance(route, routeSeed, choice), materials: addMaterials(bank, result.materials) };
}

/** Safe stops resolve without the sim: a fixed grant and one stop forward. */
export function resolveSafeStop(route: RouteState, bank: Materials, routeSeed: number, choice: number): RouteUpdate {
  checkChoice(choice);
  if (currentOptions(route, routeSeed)[choice]?.type !== 'safe') throw new Error('that option is not a safe stop');
  return { route: advance(route, routeSeed, choice), materials: addMaterials(bank, SAFE_GRANT) };
}
