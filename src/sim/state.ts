import { CHARACTERS } from './content';
import { xpForLevel } from './curve';
import { makeRng } from './rng';
import type {
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
  const rng = makeRng(config.seed >>> 0);
  const startLevel = Math.max(1, 1 + Math.min(3, Math.floor(config.mods.startWeaponLevel)));
  const weapon: WeaponInstance = {
    id: config.weapon,
    level: startLevel,
    evolved: false,
    cooldown: 0.3,
  };
  const state: SimState = {
    rng,
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
    damageDealt: 0,
    nextUid: 1,
    shake: 0,
    revivesUsed: 0,
    runSeed: config.seed >>> 0,
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
    won: state.status === 'won',
    night: state.config.night,
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