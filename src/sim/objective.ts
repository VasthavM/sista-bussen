/**
 * v2 map objective: fuel quota, material drops and bus extraction. The combat sim never reads any
 * of this; it only feeds it (kills and pickups) and ends the run on extraction.
 */
import { ENEMIES } from './content';
import type { MapConfig } from './map';
import { nextFloat } from './rng';
import { PLAYER_RADIUS, pushEvent } from './state';
import type { Enemy, SimState } from './types';

/** Chance that a killed zombie leaves one fuel unit behind (rolled on the drop stream). */
export const FUEL_DROP_CHANCE = 0.025;
/** Fuel units in one zombie drop. */
export const FUEL_DROP_VALUE = 1;
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
 * the harness and the playable build use this one: 50 + 5 per depth. Together with FUEL_DROP_CHANCE and
 * CANISTER_SPAN it puts depth 1's extraction rate within 10 points of the old night 1 win rate for
 * every starting weapon (specs/balance/v2-baseline.md).
 */
export function fuelQuotaFor(depth: number): number {
  return Math.round(QUOTA_BASE + QUOTA_PER_DEPTH * (Math.max(1, depth) - 1));
}
const QUOTA_BASE = 50;
const QUOTA_PER_DEPTH = 5;

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

/** True when a zombie kill should leave a fuel orb. Consumes the drop stream. */
export function rollFuelDrop(state: SimState): boolean {
  return nextFloat(state.dropRng) < FUEL_DROP_CHANCE;
}

function collectCanisters(state: SimState): void {
  const p = state.player;
  for (const c of state.canisters) {
    if (!c.active || state.time < c.at || Math.hypot(p.x - c.x, p.y - c.y) >= p.pickup) continue;
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
