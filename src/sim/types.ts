import type { Rng } from './rng';

export type WeaponId = 'nyckel' | 'korv' | 'telefon' | 'spray' | 'vagn' | 'ficklampa';
export type PassiveId =
  | 'handskar'
  | 'kondis'
  | 'senap'
  | 'laddare'
  | 'tandstickor'
  | 'mynt'
  | 'batteri'
  | 'termos';
export type EnemyType = 'fyllo' | 'duva' | 'skugga' | 'vaktmastare' | 'sparkcykel' | 'nattvakt' | 'chauffor';
export type CharacterId = 'nattvandraren' | 'pensionaren' | 'studenten';
export type RunStatus = 'running' | 'dead' | 'won';
export type UpgradeKind = 'weapon' | 'passive' | 'evolution';

export interface MetaMods {
  damage: number;
  hp: number;
  speed: number;
  pickup: number;
  crit: number;
  armor: number;
  fares: number;
  startWeaponLevel: number;
}

export const EMPTY_MODS: MetaMods = {
  damage: 0,
  hp: 0,
  speed: 0,
  pickup: 0,
  crit: 0,
  armor: 0,
  fares: 0,
  startWeaponLevel: 0,
};

export interface RunConfig {
  seed: number;
  night: number;
  character: CharacterId;
  weapon: WeaponId;
  mods: MetaMods;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackSpeed: number;
  area: number;
  crit: number;
  pickup: number;
  regen: number;
  armor: number;
  luck: number;
  facing: number;
  invuln: number;
  hurtCd: number;
  flash: number;
}

export interface WeaponInstance {
  id: WeaponId;
  level: number;
  evolved: boolean;
  cooldown: number;
}

export interface Enemy {
  uid: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  attackCd: number;
  flash: number;
  stun: number;
  phase: number;
  state: number;
  timer: number;
  elite: boolean;
  alpha: number;
}

export interface Projectile {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  pierce: number;
  bounces: number;
  life: number;
  crit: boolean;
  kind: 'korv' | 'vagn';
  explodeRadius: number;
  hits: number[];
  spin: number;
}

export interface EnemyShot {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  kind: 'cone' | 'burst';
}

export interface AreaEffect {
  active: boolean;
  kind: 'fire' | 'cone' | 'burst';
  x: number;
  y: number;
  radius: number;
  angle: number;
  spread: number;
  damage: number;
  life: number;
  maxLife: number;
  tick: number;
  interval: number;
  stun: number;
  owner: 'player';
}

export interface Orb {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  magnet: number;
  life: number;
  kind: 'xp' | 'change';
}

export type SimEventType =
  | 'hit'
  | 'kill'
  | 'hurt'
  | 'levelup'
  | 'evolve'
  | 'pickup'
  | 'chain'
  | 'beam'
  | 'burst'
  | 'shoot'
  | 'boss'
  | 'win'
  | 'revive';

export interface SimEvent {
  type: SimEventType;
  x: number;
  y: number;
  x2: number;
  y2: number;
  value: number;
  text: string;
}

export interface SpawnState {
  timer: number;
  elapsed: number;
  totalSpawned: number;
  nextBurst: number;
  burstIndex: number;
  nattvaktSpawned: boolean;
  chaufforSpawned: boolean;
}

export interface SimState {
  rng: Rng;
  config: RunConfig;
  time: number;
  status: RunStatus;
  player: PlayerState;
  weapons: WeaponInstance[];
  passives: Partial<Record<PassiveId, number>>;
  enemies: Enemy[];
  projectiles: Projectile[];
  enemyShots: EnemyShot[];
  areaEffects: AreaEffect[];
  orbs: Orb[];
  events: SimEvent[];
  eventCount: number;
  eventCursor: number;
  spawn: SpawnState;
  level: number;
  xp: number;
  xpToNext: number;
  pendingLevelUps: number;
  kills: number;
  killsByType: Record<string, number>;
  change: number;
  damageDealt: number;
  nextUid: number;
  shake: number;
  revivesUsed: number;
  runSeed: number;
}

export interface UpgradeChoice {
  id: string;
  kind: UpgradeKind;
  name: string;
  desc: string;
  weaponId?: WeaponId;
  passiveId?: PassiveId;
  level: number;
  rarity: 'evolution' | 'new' | 'weapon' | 'passive';
}

export interface RunResult {
  won: boolean;
  night: number;
  time: number;
  level: number;
  kills: number;
  killsByType: Record<string, number>;
  change: number;
  damageDealt: number;
  weapons: string[];
  revivesUsed: number;
  character: CharacterId;
}