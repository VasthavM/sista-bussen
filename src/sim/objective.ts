/**
 * v2 map objective: fuel quota, material drops and bus extraction. The combat sim never reads any
 * of this; it only feeds it (kills and pickups) and ends the run on extraction.
 */
import { ENEMIES } from './content';
import type { MapConfig } from './map';
import { nextFloat } from './rng';
import { PLAYER_RADIUS, pushEvent } from './state';
import type { Enemy, EnemyType, SimState } from './types';

const FUEL_DROP_BASE = 0.12;

/**
 * Chance that a killed zombie leaves fuel behind (rolled on the drop stream). Tougher zombies pay
 * better, so a build that kills the hard ones fills the gauge faster. Elites always drop 2, bosses 10.
 */
export const FUEL_DROP_CHANCE: Record<EnemyType, number> = {
  duva: FUEL_DROP_BASE * 0.5,
  fyllo: FUEL_DROP_BASE,
  skugga: FUEL_DROP_BASE,
  vaktmastare: FUEL_DROP_BASE * 2,
  sparkcykel: FUEL_DROP_BASE * 2,
  nattvakt: 1,
  chauffor: 1,
};
export const FUEL_ELITE_VALUE = 2;
export const FUEL_BOSS_VALUE = 10;
/** Bus hit circle, on top of the player radius. */
export const BUS_RADIUS = 44;
/** Per canister: scrap, supplies, and the chance of one part. */
export const CANISTER_SCRAP = 4;
export const CANISTER_SUPPLIES = 2;
export const CANISTER_PARTS_CHANCE = 0.3;
/** Parts per elite and per boss kill. Scrap per kill is the enemy's `change` value. */
export const ELITE_PARTS = 1;
export const BOSS_PARTS = 5;

/**
 * Fuel quota for a default (street) stop at `depth`. The route layer will own real quotas per stop;
 * the harness and the playable build use this one: 92 + 8 per depth. Together with FUEL_DROP_CHANCE and
 * CANISTER_SHARE it puts depth 1's extraction rate within 10 points of the old night 1 win rate for
 * every starting weapon (specs/balance/v2-baseline.md).
 */
export function fuelQuotaFor(depth: number): number {
  return Math.round(QUOTA_BASE + QUOTA_PER_DEPTH * (Math.max(1, depth) - 1));
}
const QUOTA_BASE = 92;
const QUOTA_PER_DEPTH = 8;

/** The street map the playable build and the harness use until the route layer supplies real ones. */
export function defaultMapConfig(seed: number, depth: number): MapConfig {
  return {
    seed,
    depth,
    stop: 'street',
    fuelQuota: fuelQuotaFor(depth),
    materialMultiplier: { scrap: 1, parts: 1, supplies: 1 },
    densityMultiplier: 1,
  };
}

export function addFuel(state: SimState, amount: number): void {
  state.fuel += amount;
}

function addMaterials(state: SimState, scrap: number, parts: number, supplies: number): void {
  const k = state.config.map.materialMultiplier;
  state.materials.scrap += scrap * k.scrap;
  state.materials.parts += parts * k.parts;
  state.materials.supplies += supplies * k.supplies;
}

/** Called once per kill. Scrap from every zombie, parts from elites and bosses. */
export function dropMaterials(state: SimState, enemy: Enemy): void {
  const def = ENEMIES[enemy.type];
  const boss = enemy.type === 'nattvakt' || enemy.type === 'chauffor';
  addMaterials(state, def.change * (enemy.elite ? 2.5 : 1), boss ? BOSS_PARTS : enemy.elite ? ELITE_PARTS : 0, 0);
}

/** Fuel units a kill leaves behind (0 for none). Consumes the drop stream once per kill. */
export function rollFuelDrop(state: SimState, enemy: Enemy): number {
  const hit = nextFloat(state.dropRng) < (enemy.elite ? 1 : FUEL_DROP_CHANCE[enemy.type]);
  if (!hit) return 0;
  if (enemy.type === 'nattvakt' || enemy.type === 'chauffor') return FUEL_BOSS_VALUE;
  return enemy.elite ? FUEL_ELITE_VALUE : 1;
}

function collectCanisters(state: SimState): void {
  const p = state.player;
  for (const c of state.canisters) {
    if (!c.active || Math.hypot(p.x - c.x, p.y - c.y) >= p.pickup) continue;
    c.active = false;
    addFuel(state, c.fuel);
    addMaterials(state, CANISTER_SCRAP, nextFloat(state.dropRng) < CANISTER_PARTS_CHANCE ? 1 : 0, CANISTER_SUPPLIES);
    pushEvent(state, 'pickup', c.x, c.y, c.fuel, 'fuel');
  }
}

/** Once per sim step, after pickups: canisters, the quota flag and bus contact. True when the map just ended in extraction. */
export function updateObjective(state: SimState): boolean {
  collectCanisters(state);
  if (!state.quotaMet && state.fuel >= state.config.map.fuelQuota) {
    state.quotaMet = true;
    pushEvent(state, 'horn', state.bus.x, state.bus.y, state.fuel, 'BUSSEN VÄNTAR');
  }
  const p = state.player;
  if (state.quotaMet && Math.hypot(p.x - state.bus.x, p.y - state.bus.y) < BUS_RADIUS + PLAYER_RADIUS) {
    state.status = 'extracted';
    pushEvent(state, 'win', p.x, p.y, 0, 'ALLA OMBORD');
    return true;
  }
  return false;
}
