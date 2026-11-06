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
    name: 'Nyckel',
    evolvedName: 'Huvudnyckeln',
    passive: 'handskar',
    behaviour: 'orbit',
    baseDamage: 17,
    baseCooldown: 0.55,
    colour: '#f5a524',
    desc: 'Nyckelknippa i omloppsbana. Slår allt som kommer nära.',
    evolvedDesc: 'Större omloppsbana. Stunnar allt den träffar.',
  },
  korv: {
    id: 'korv',
    name: 'Grillkorv',
    evolvedName: 'Dubbelkorv',
    passive: 'senap',
    behaviour: 'throw',
    baseDamage: 23,
    baseCooldown: 1.35,
    colour: '#e2703a',
    desc: 'Kastad korv som piercar. Luktar starkt.',
    evolvedDesc: 'Exploderar när den piercat klart.',
  },
  telefon: {
    id: 'telefon',
    name: 'Laddad telefon',
    evolvedName: 'Roaming',
    passive: 'laddare',
    behaviour: 'chain',
    baseDamage: 21,
    baseCooldown: 2.1,
    colour: '#7fd7ff',
    desc: 'Blixtkedja mot 3 mål. Täcker hela hållplatsen.',
    evolvedDesc: 'Kedjar 8 mål och stunnar.',
  },
  spray: {
    id: 'spray',
    name: 'Sprayburk',
    evolvedName: 'Molotov',
    passive: 'tandstickor',
    behaviour: 'cone',
    baseDamage: 10,
    baseCooldown: 1.5,
    colour: '#3ddc97',
    desc: 'Kon av frätande sprej. Bränner över tid.',
    evolvedDesc: 'Lämnar en brinnande pöl.',
  },
  vagn: {
    id: 'vagn',
    name: 'Kundvagn',
    evolvedName: 'Stridsvagnen',
    passive: 'mynt',
    behaviour: 'bounce',
    baseDamage: 18,
    baseCooldown: 1.8,
    colour: '#c9d4e0',
    desc: 'Studsar mellan mål och staket.',
    evolvedDesc: 'Tre studs och genomborrar allt.',
  },
  ficklampa: {
    id: 'ficklampa',
    name: 'Ficklampa',
    evolvedName: 'Strålkastaren',
    passive: 'batteri',
    behaviour: 'beam',
    baseDamage: 14,
    baseCooldown: 1.25,
    colour: '#ffe9a8',
    desc: 'Rak stråle som piercar allt i sin väg.',
    evolvedDesc: 'Bred stråle som bränner.',
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
    name: 'Handskar',
    maxLevel: 5,
    colour: '#ff4d5e',
    description: (l) => `+${Math.round(l * 12)}% skada`,
  },
  kondis: {
    id: 'kondis',
    name: 'Kondis',
    maxLevel: 5,
    colour: '#3ddc97',
    description: (l) => `+${Math.round(l * 6)}% rörelsehastighet`,
  },
  senap: {
    id: 'senap',
    name: 'Senap',
    maxLevel: 5,
    colour: '#f5a524',
    description: (l) => `+${Math.round(l * 12)}% area`,
  },
  laddare: {
    id: 'laddare',
    name: 'Laddare',
    maxLevel: 5,
    colour: '#7fd7ff',
    description: (l) => `+${Math.round(l * 10)}% attackhastighet`,
  },
  tandstickor: {
    id: 'tandstickor',
    name: 'Tändstickor',
    maxLevel: 5,
    colour: '#e2703a',
    description: (l) => `+${Math.round(l * 4)}% kritisk chans`,
  },
  mynt: {
    id: 'mynt',
    name: 'Mynt',
    maxLevel: 5,
    colour: '#f5c542',
    description: (l) => `+${Math.round(l * 14)} plockradie och +${Math.round(l * 6)}% växel`,
  },
  batteri: {
    id: 'batteri',
    name: 'Batteri',
    maxLevel: 5,
    colour: '#9c8cff',
    description: (l) => `+${l * 12} max HP och +${l} rustning`,
  },
  termos: {
    id: 'termos',
    name: 'Termos',
    maxLevel: 5,
    colour: '#a8b3bf',
    description: (l) => `+${(l * 0.5).toFixed(1)} HP/s regenerering`,
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
    name: 'Nattvandraren',
    title: 'Van vid mörkret',
    desc: '+8% fart, +6% skada. Ingen förklaring behövs.',
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
    name: 'Pensionären',
    title: 'Har tid',
    desc: '+30 max HP, +2 rustning, -6% fart.',
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
    name: 'Studenten',
    title: 'Pluggar natten',
    desc: '+12% attackhastighet, +20 plockradie.',
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
    name: 'Fyllo',
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
    name: 'Duva',
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
    name: 'Skugga',
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
    name: 'Vaktmästare',
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
    name: 'Elsparkcykel',
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
    name: 'Nattvakten',
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
    name: 'Busschauffören',
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