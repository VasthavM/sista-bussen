import type {
  CharacterId,
  EnemyType,
  PassiveId,
  WeaponId,
} from './types';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  evolvedName: string;
  passive: PassiveId;
  behaviour: 'orbit' | 'throw' | 'chain' | 'cone' | 'bounce' | 'beam';
  baseDamage: number;
  baseCooldown: number;
  colour: string;
  desc: string;
  evolvedDesc: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  nyckel: {
    id: 'nyckel',
    name: 'Chain Wrench',
    evolvedName: 'Wrecking Chain',
    passive: 'handskar',
    behaviour: 'orbit',
    baseDamage: 20,
    baseCooldown: 0.55,
    colour: '#f5a524',
    desc: 'A wrench swung on a chain, circling you. Smashes whatever gets close.',
    evolvedDesc: 'Wider orbit. Stuns everything it hits.',
  },
  korv: {
    id: 'korv',
    name: 'Nail Gun',
    evolvedName: 'Nail Bomb',
    passive: 'senap',
    behaviour: 'throw',
    baseDamage: 26,
    baseCooldown: 1.35,
    colour: '#e2703a',
    desc: 'Fires a nail that pierces through the dead.',
    evolvedDesc: 'Explodes when it runs out of bodies.',
  },
  telefon: {
    id: 'telefon',
    name: 'Taser',
    evolvedName: 'Overcharge',
    passive: 'laddare',
    behaviour: 'chain',
    baseDamage: 24,
    baseCooldown: 1.4,
    colour: '#7fd7ff',
    desc: 'Arcs between 3 targets. Zombies twitch.',
    evolvedDesc: 'Chains 8 targets and stuns.',
  },
  spray: {
    id: 'spray',
    name: 'Torch Spray',
    evolvedName: 'Napalm',
    passive: 'tandstickor',
    behaviour: 'cone',
    baseDamage: 17,
    baseCooldown: 1.5,
    colour: '#3ddc97',
    desc: 'A cone of burning spray. Damage over time.',
    evolvedDesc: 'Leaves a burning pool.',
  },
  vagn: {
    id: 'vagn',
    name: 'Shopping Cart',
    evolvedName: 'Armored Cart',
    passive: 'mynt',
    behaviour: 'bounce',
    baseDamage: 25,
    baseCooldown: 1.3,
    colour: '#c9d4e0',
    desc: 'Ricochets between targets and fences.',
    evolvedDesc: 'Three bounces, pierces everything.',
  },
  ficklampa: {
    id: 'ficklampa',
    name: 'Flashlight',
    evolvedName: 'Searchlight',
    passive: 'batteri',
    behaviour: 'beam',
    baseDamage: 11,
    baseCooldown: 1.25,
    colour: '#ffe9a8',
    desc: 'A straight beam that pierces everything in its path.',
    evolvedDesc: 'A wide beam that burns.',
  },
};

export const WEAPON_ORDER: WeaponId[] = ['nyckel', 'korv', 'telefon', 'spray', 'vagn', 'ficklampa'];

export interface PassiveDef {
  id: PassiveId;
  name: string;
  maxLevel: number;
  colour: string;
  description: (level: number) => string;
}

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  handskar: {
    id: 'handskar',
    name: 'Work Gloves',
    maxLevel: 5,
    colour: '#ff4d5e',
    description: (l) => `+${Math.round(l * 12)}% damage`,
  },
  kondis: {
    id: 'kondis',
    name: 'Running Shoes',
    maxLevel: 5,
    colour: '#3ddc97',
    description: (l) => `+${Math.round(l * 6)}% move speed`,
  },
  senap: {
    id: 'senap',
    name: 'Blast Caps',
    maxLevel: 5,
    colour: '#f5a524',
    description: (l) => `+${Math.round(l * 12)}% area`,
  },
  laddare: {
    id: 'laddare',
    name: 'Jump Starter',
    maxLevel: 5,
    colour: '#7fd7ff',
    description: (l) => `+${Math.round(l * 10)}% attack speed`,
  },
  tandstickor: {
    id: 'tandstickor',
    name: 'Matchbook',
    maxLevel: 5,
    colour: '#e2703a',
    description: (l) => `+${Math.round(l * 4)}% crit chance`,
  },
  mynt: {
    id: 'mynt',
    name: 'Scrap Magnet',
    maxLevel: 5,
    colour: '#f5c542',
    description: (l) => `+${Math.round(l * 14)} pickup radius and +${Math.round(l * 6)}% scrap`,
  },
  batteri: {
    id: 'batteri',
    name: 'Riot Vest',
    maxLevel: 5,
    colour: '#9c8cff',
    description: (l) => `+${l * 12} max HP and +${l} armor`,
  },
  termos: {
    id: 'termos',
    name: 'Canteen',
    maxLevel: 5,
    colour: '#a8b3bf',
    description: (l) => `+${(l * 0.5).toFixed(1)} HP/s regeneration`,
  },
};

export const PASSIVE_ORDER: PassiveId[] = [
  'handskar',
  'kondis',
  'senap',
  'laddare',
  'tandstickor',
  'mynt',
  'batteri',
  'termos',
];

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  desc: string;
  hp: number;
  speedPct: number;
  damagePct: number;
  pickup: number;
  crit: number;
  armor: number;
  attackSpeedPct: number;
  colour: string;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  nattvandraren: {
    id: 'nattvandraren',
    name: 'Drifter',
    title: 'Used to the dark',
    desc: '+8% speed, +6% damage. Travels light.',
    hp: 0,
    speedPct: 0.08,
    damagePct: 0.06,
    pickup: 0,
    crit: 0,
    armor: 0,
    attackSpeedPct: 0,
    colour: '#7fd7ff',
  },
  pensionaren: {
    id: 'pensionaren',
    name: 'Old Timer',
    title: 'Has seen worse',
    desc: '+30 max HP, +2 armor, -6% speed.',
    hp: 30,
    speedPct: -0.06,
    damagePct: 0,
    pickup: 0,
    crit: 0,
    armor: 2,
    attackSpeedPct: 0,
    colour: '#f5a524',
  },
  studenten: {
    id: 'studenten',
    name: 'Scrounger',
    title: 'Quick hands',
    desc: '+12% attack speed, +20 pickup radius.',
    hp: 0,
    speedPct: 0,
    damagePct: 0,
    pickup: 20,
    crit: 0.02,
    armor: 0,
    attackSpeedPct: 0.12,
    colour: '#3ddc97',
  },
};

export const CHARACTER_ORDER: CharacterId[] = ['nattvandraren', 'pensionaren', 'studenten'];

export interface EnemyDef {
  id: EnemyType;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  xp: number;
  change: number;
  colour: string;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  fyllo: {
    id: 'fyllo',
    name: 'Shambler',
    hp: 52,
    speed: 62,
    radius: 15,
    damage: 8,
    xp: 16,
    change: 2,
    colour: '#8b6f5c',
  },
  duva: {
    id: 'duva',
    name: 'Crawler',
    hp: 13,
    speed: 118,
    radius: 9,
    damage: 3,
    xp: 8,
    change: 1,
    colour: '#a8b3bf',
  },
  skugga: {
    id: 'skugga',
    name: 'Runner',
    hp: 26,
    speed: 138,
    radius: 12,
    damage: 6,
    xp: 20,
    change: 2,
    colour: '#5a6b8c',
  },
  vaktmastare: {
    id: 'vaktmastare',
    name: 'Spitter',
    hp: 46,
    speed: 66,
    radius: 15,
    damage: 7,
    xp: 22,
    change: 3,
    colour: '#7a5ce0',
  },
  sparkcykel: {
    id: 'sparkcykel',
    name: 'Charger',
    hp: 74,
    speed: 84,
    radius: 16,
    damage: 11,
    xp: 26,
    change: 3,
    colour: '#3ddc97',
  },
  nattvakt: {
    id: 'nattvakt',
    name: 'The Warden',
    hp: 760,
    speed: 58,
    radius: 30,
    damage: 16,
    xp: 160,
    change: 40,
    colour: '#ff4d5e',
  },
  chauffor: {
    id: 'chauffor',
    name: 'The Conductor',
    hp: 1250,
    speed: 46,
    radius: 38,
    damage: 20,
    xp: 260,
    change: 70,
    colour: '#f5a524',
  },
};

export const ENEMY_ORDER: EnemyType[] = [
  'fyllo',
  'duva',
  'skugga',
  'vaktmastare',
  'sparkcykel',
  'nattvakt',
  'chauffor',
];