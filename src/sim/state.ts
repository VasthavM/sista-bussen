import { CHARACTERS } from './content';
import { xpForLevel } from './curve';
import type { MapResult } from './map';
import { makeRng, nextFloat, nextInt, nextRange, type Rng } from './rng';
import type {
  Bus,
  Canister,
  MetaMods,
  RunConfig,
  RunResult,
  SimEvent,
  SimEventType,
  SimState,
  WeaponInstance,
} from './types';

export const WORLD = { w: 1400, h: 1400 };
export const PLAYER_RADIUS = 15;
export const EVENT_POOL = 512;

/** Fuel in one canister. */
export const CANISTER_FUEL = 5;
/** Canisters are a bonus: together they carry about this share of the quota. Kills carry the rest. */
export const CANISTER_SHARE = 0.3;
const CANISTER_MIN_GAP = 100;
/** Risky canisters sit this close to the map border... */
const EDGE_BAND = 150;
/** ...and at least this far from the bus. */
const RISKY_BUS_DISTANCE = 350;

/**
 * Seeded placement of the bus and the canisters. Uses its own RNG stream (derived from the map
 * seed) so the layout never consumes the combat stream. Same seed and quota give the same layout.
 * Every other canister is "risky": out on the border, far from the bus, so grabbing it is a choice.
 */
export function layoutMap(seed: number, fuelQuota: number): { bus: Bus; canisters: Canister[] } {
  const rng: Rng = makeRng((seed ^ 0xa5f00d) >>> 0);
  const cx = WORLD.w / 2;
  const cy = WORLD.h / 2;
  const angle = nextFloat(rng) * Math.PI * 2;
  const reach = nextRange(rng, 520, 600);
  const bus: Bus = {
    x: Math.min(WORLD.w - 120, Math.max(120, cx + Math.cos(angle) * reach)),
    y: Math.min(WORLD.h - 120, Math.max(120, cy + Math.sin(angle) * reach)),
  };
  const count = Math.ceil((fuelQuota * CANISTER_SHARE) / CANISTER_FUEL) + nextInt(rng, 2);
  const canisters: Canister[] = [];
  for (let i = 0; i < count; i++) {
    const risky = i % 2 === 1;
    let x = 0;
    let y = 0;
    // shortcut: 60 tries then accept the last candidate, only matters when the map is nearly full.
    for (let tries = 0; tries < 60; tries++) {
      x = nextRange(rng, 90, WORLD.w - 90);
      y = nextRange(rng, 90, WORLD.h - 90);
      if (risky) {
        // Pull one axis into the border band.
        const side = nextInt(rng, 4);
        if (side === 0) x = nextRange(rng, 60, EDGE_BAND);
        else if (side === 1) x = nextRange(rng, WORLD.w - EDGE_BAND, WORLD.w - 60);
        else if (side === 2) y = nextRange(rng, 60, EDGE_BAND);
        else y = nextRange(rng, WORLD.h - EDGE_BAND, WORLD.h - 60);
      }
      const clear =
        Math.hypot(x - cx, y - cy) > 150 &&
        Math.hypot(x - bus.x, y - bus.y) > (risky ? RISKY_BUS_DISTANCE : 130) &&
        canisters.every((c) => Math.hypot(x - c.x, y - c.y) > CANISTER_MIN_GAP);
      if (clear) break;
    }
    canisters.push({ active: true, risky, x, y, fuel: CANISTER_FUEL });
  }
  return { bus, canisters };
}

function createEventPool(): SimEvent[] {
  const pool: SimEvent[] = [];
  for (let i = 0; i < EVENT_POOL; i++) {
    pool.push({ type: 'hit', x: 0, y: 0, x2: 0, y2: 0, value: 0, text: '' });
  }
  return pool;
}

export function pushEvent(
  state: SimState,
  type: SimEventType,
  x: number,
  y: number,
  value = 0,
  text = '',
  x2 = 0,
  y2 = 0,
): void {
  if (state.eventCount >= EVENT_POOL) return;
  const e = state.events[state.eventCount];
  state.eventCount++;
  e.type = type;
  e.x = x;
  e.y = y;
  e.x2 = x2;
  e.y2 = y2;
  e.value = value;
  e.text = text;
}

export function clearEvents(state: SimState): void {
  state.eventCount = 0;
  state.eventCursor = 0;
}

export function createRun(config: RunConfig): SimState {
  const seed = config.map.seed >>> 0;
  const rng = makeRng(seed);
  const { bus, canisters } = layoutMap(seed, config.map.fuelQuota);
  const startLevel = Math.max(1, 1 + Math.min(3, Math.floor(config.mods.startWeaponLevel)));
  const weapon: WeaponInstance = {
    id: config.weapon,
    level: startLevel,
    evolved: false,
    cooldown: 0.3,
  };
  const state: SimState = {
    rng,
    dropRng: makeRng((seed ^ 0x5eed) >>> 0),
    config,
    time: 0,
    status: 'running',
    player: {
      x: WORLD.w / 2,
      y: WORLD.h / 2,
      vx: 0,
      vy: 0,
      hp: 100,
      maxHp: 100,
      speed: 132,
      damage: 1,
      attackSpeed: 1,
      area: 1,
      crit: 0.05,
      pickup: 48,
      regen: 0,
      armor: 0,
      luck: 0,
      facing: -Math.PI / 2,
      invuln: 1,
      hurtCd: 0,
      flash: 0,
    },
    weapons: [weapon],
    passives: {},
    enemies: [],
    projectiles: [],
    enemyShots: [],
    areaEffects: [],
    orbs: [],
    events: createEventPool(),
    eventCount: 0,
    eventCursor: 0,
    spawn: {
      timer: 0,
      elapsed: 0,
      totalSpawned: 0,
      nextBurst: 30,
      burstIndex: 0,
      nattvaktSpawned: false,
      chaufforSpawned: false,
    },
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    pendingLevelUps: 0,
    kills: 0,
    killsByType: {},
    change: 0,
    fuel: 0,
    quotaMet: false,
    materials: { scrap: 0, parts: 0, supplies: 0 },
    canisters,
    bus,
    damageDealt: 0,
    nextUid: 1,
    shake: 0,
    revivesUsed: 0,
    runSeed: seed,
  };
  recomputeStats(state, false);
  state.player.hp = state.player.maxHp;
  return state;
}

/** Recompute derived player stats from passives, character and permanent mods. */
export function recomputeStats(state: SimState, keepDamage = true): void {
  const p = state.passives;
  const char = CHARACTERS[state.config.character];
  const mods: MetaMods = state.config.mods;
  const before = state.player.maxHp;
  const hpBefore = state.player.hp;

  const maxHp = Math.round(
    100 + char.hp + (p.batteri ?? 0) * 12 + mods.hp,
  );
  const speed = 132 * (1 + (p.kondis ?? 0) * 0.06 + char.speedPct + mods.speed);
  const damage = 1 + (p.handskar ?? 0) * 0.12 + char.damagePct + mods.damage;
  const attackSpeed = 1 * (1 + (p.laddare ?? 0) * 0.1 + char.attackSpeedPct);
  const area = 1 + (p.senap ?? 0) * 0.12;
  const crit = Math.min(0.85, 0.05 + (p.tandstickor ?? 0) * 0.04 + char.crit + mods.crit);
  const pickup = 48 + (p.mynt ?? 0) * 14 + char.pickup + mods.pickup;
  const regen = (p.termos ?? 0) * 0.5;
  const armor = Math.round(char.armor + (p.batteri ?? 0) * 1 + mods.armor);
  const luck = 1 + (p.mynt ?? 0) * 0.06;

  state.player.maxHp = maxHp;
  state.player.speed = speed;
  state.player.damage = damage;
  state.player.attackSpeed = attackSpeed;
  state.player.area = area;
  state.player.crit = crit;
  state.player.pickup = pickup;
  state.player.regen = regen;
  state.player.armor = armor;
  state.player.luck = luck;

  if (!keepDamage) {
    state.player.hp = maxHp;
    return;
  }
  const lost = Math.max(0, before - hpBefore);
  state.player.hp = Math.max(1, Math.min(maxHp, maxHp - lost));
}

/** Add XP and queue level ups. Returns how many levels were gained. */
export function addXp(state: SimState, amount: number): number {
  if (amount <= 0) return 0;
  let gained = 0;
  state.xp += amount;
  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    state.level += 1;
    state.xpToNext = xpForLevel(state.level);
    state.pendingLevelUps += 1;
    gained += 1;
    // Levelling patches you up: the run is four minutes long and there is no
    // health pick-up, so each card is also the sustain.
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.maxHp * 0.3);
  }
  return gained;
}

export function revivePlayer(state: SimState): boolean {
  if (state.status !== 'dead') return false;
  state.status = 'running';
  state.revivesUsed += 1;
  state.player.hp = Math.round(state.player.maxHp * 0.6);
  state.player.invuln = 3;
  state.player.hurtCd = 0;
  state.enemies.length = 0;
  state.enemyShots.length = 0;
  state.projectiles.length = 0;
  state.shake = 8;
  pushEvent(state, 'revive', state.player.x, state.player.y, state.player.hp, 'BUSSEN ÄR FÖRSENAD');
  return true;
}

export function computeRunResult(state: SimState): RunResult {
  return {
    won: state.status === 'extracted',
    night: state.config.map.depth,
    time: state.time,
    level: state.level,
    kills: state.kills,
    killsByType: { ...state.killsByType },
    change: Math.floor(state.change),
    damageDealt: Math.floor(state.damageDealt),
    weapons: state.weapons.map((w) => (w.evolved ? `${w.id}_evo` : w.id)),
    revivesUsed: state.revivesUsed,
    character: state.config.character,
  };
}

/** What the route layer consumes once the map is over. Materials are floored to whole units. */
export function computeMapResult(state: SimState): MapResult {
  const m = state.materials;
  return {
    outcome: state.status === 'extracted' ? 'extracted' : 'died',
    time: state.time,
    fuelCollected: Math.floor(state.fuel),
    materials: { scrap: Math.floor(m.scrap), parts: Math.floor(m.parts), supplies: Math.floor(m.supplies) },
    kills: state.kills,
  };
}
