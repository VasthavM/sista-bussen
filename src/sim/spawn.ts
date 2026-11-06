import { ENEMIES } from './content';
import {
  BOSS_CHAUFFOR_AT,
  BOSS_NATTVAKT_AT,
  MAX_ENEMIES,
  RUN_DURATION,
  nightDifficulty,
  spawnRateAt,
} from './curve';
import { nextFloat, nextRange, pickWeighted } from './rng';
import { WORLD, pushEvent } from './state';
import type { Enemy, EnemyType, SimState } from './types';

const SPAWN_RADIUS_MIN = 380;
const SPAWN_RADIUS_MAX = 470;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function enemyHpScale(state: SimState): number {
  const timeScale = 1 + (state.time / RUN_DURATION) * 0.25;
  return nightDifficulty(state.config.night) * timeScale;
}

export function spawnEnemy(
  state: SimState,
  type: EnemyType,
  x: number,
  y: number,
  elite = false,
): Enemy {
  const def = ENEMIES[type];
  if (state.enemies.length >= MAX_ENEMIES) state.enemies.shift();
  state.spawn.totalSpawned += 1;
  const isBoss = type === 'nattvakt' || type === 'chauffor';
  const hpScale = enemyHpScale(state) * (elite && !isBoss ? 2.4 : 1);
  const enemy: Enemy = {
    uid: state.nextUid++,
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: Math.round(def.hp * hpScale),
    maxHp: Math.round(def.hp * hpScale),
    speed: def.speed * (1 + (state.config.night - 1) * 0.02) * (elite ? 0.94 : 1),
    radius: def.radius * (elite ? 1.35 : 1),
    damage: Math.round(def.damage * (1 + (state.config.night - 1) * 0.08)),
    attackCd: 0,
    flash: 0,
    stun: 0,
    phase: nextFloat(state.rng) * Math.PI * 2,
    state: 0,
    timer: 0,
    elite,
    alpha: type === 'skugga' ? 0.15 : 1,
  };
  state.enemies.push(enemy);
  return enemy;
}

function ringPosition(state: SimState): { x: number; y: number } {
  const angle = nextFloat(state.rng) * Math.PI * 2;
  const dist = nextRange(state.rng, SPAWN_RADIUS_MIN, SPAWN_RADIUS_MAX);
  const x = clamp(state.player.x + Math.cos(angle) * dist, 30, WORLD.w - 30);
  const y = clamp(state.player.y + Math.sin(angle) * dist, 30, WORLD.h - 30);
  return { x, y };
}

export function spawnAtRing(state: SimState, type: EnemyType, elite = false): Enemy {
  const pos = ringPosition(state);
  return spawnEnemy(state, type, pos.x, pos.y, elite);
}

export function spawnDoveFlock(state: SimState, count: number): void {
  const angle = nextFloat(state.rng) * Math.PI * 2;
  const dist = nextRange(state.rng, 360, 440);
  const cx = clamp(state.player.x + Math.cos(angle) * dist, 26, WORLD.w - 26);
  const cy = clamp(state.player.y + Math.sin(angle) * dist, 26, WORLD.h - 26);
  for (let i = 0; i < count; i++) {
    if (state.enemies.length >= MAX_ENEMIES) state.enemies.shift();
    const spread = 46;
    const x = clamp(cx + nextRange(state.rng, -spread, spread), 20, WORLD.w - 20);
    const y = clamp(cy + nextRange(state.rng, -spread, spread), 20, WORLD.h - 20);
    spawnEnemy(state, 'duva', x, y);
  }
}

function spawnBoss(state: SimState, type: EnemyType): void {
  const angle = nextFloat(state.rng) * Math.PI * 2;
  const x = clamp(state.player.x + Math.cos(angle) * 300, 80, WORLD.w - 80);
  const y = clamp(state.player.y + Math.sin(angle) * 300, 80, WORLD.h - 80);
  spawnEnemy(state, type, x, y, true);
  pushEvent(state, 'boss', x, y, 0, type === 'nattvakt' ? 'NATTVAKTEN' : 'BUSSCHAUFFÖREN');
  state.shake = Math.max(state.shake, 10);
}

interface Burst {
  at: number;
  run: (state: SimState) => void;
}

const BURSTS: Burst[] = [
  { at: 28, run: (s) => spawnDoveFlock(s, 8) },
  {
    at: 52,
    run: (s) => {
      spawnAtRing(s, 'vaktmastare');
      spawnDoveFlock(s, 8);
    },
  },
  {
    at: 70,
    run: (s) => {
      for (let i = 0; i < 4; i++) spawnAtRing(s, 'sparkcykel');
    },
  },
  { at: 95, run: (s) => spawnDoveFlock(s, 14) },
  {
    at: 122,
    run: (s) => {
      for (let i = 0; i < 5; i++) spawnAtRing(s, 'fyllo');
    },
  },
  {
    at: 150,
    run: (s) => {
      for (let i = 0; i < 3; i++) spawnAtRing(s, 'vaktmastare');
      spawnDoveFlock(s, 10);
    },
  },
  {
    at: 178,
    run: (s) => {
      for (let i = 0; i < 6; i++) spawnAtRing(s, 'skugga');
    },
  },
  {
    at: 198,
    run: (s) => {
      for (let i = 0; i < 2; i++) spawnAtRing(s, 'sparkcykel', true);
    },
  },
];

function typeWeightsFor(t: number) {
  const weights: { value: EnemyType; weight: number }[] = [
    { value: 'duva', weight: 0.42 },
    { value: 'fyllo', weight: 0.3 },
  ];
  if (t > 35) weights.push({ value: 'skugga', weight: 0.16 });
  if (t > 65) weights.push({ value: 'vaktmastare', weight: 0.09 });
  if (t > 85) weights.push({ value: 'sparkcykel', weight: 0.08 });
  return weights;
}

/** Spawn director tick. Called once per fixed sim step. */
export function directorStep(state: SimState, dt: number): void {
  state.spawn.elapsed += dt;
  const rate = spawnRateAt(state.time, state.config.night);
  state.spawn.timer += rate * dt;

  while (state.spawn.timer >= 1) {
    state.spawn.timer -= 1;
    if (state.enemies.length >= MAX_ENEMIES) state.enemies.shift();
    const type = pickWeighted(state.rng, typeWeightsFor(state.time)) ?? 'fyllo';
    const elite = state.time > 100 && nextFloat(state.rng) < 0.07;
    spawnAtRing(state, type, elite);
  }

  while (state.spawn.burstIndex < BURSTS.length && state.time >= BURSTS[state.spawn.burstIndex].at) {
    BURSTS[state.spawn.burstIndex].run(state);
    state.spawn.burstIndex++;
  }

  if (!state.spawn.nattvaktSpawned && state.time >= BOSS_NATTVAKT_AT) {
    state.spawn.nattvaktSpawned = true;
    spawnBoss(state, 'nattvakt');
  }
  if (!state.spawn.chaufforSpawned && state.time >= BOSS_CHAUFFOR_AT) {
    state.spawn.chaufforSpawned = true;
    spawnBoss(state, 'chauffor');
  }
}