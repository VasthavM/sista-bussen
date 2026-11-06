/**
 * Palette and per-entity look tables. Everything here is built once at module
 * load so the draw loops never build a colour string.
 */
import { CHARACTERS, ENEMIES, WEAPONS } from '../sim/content';
import type { CharacterId, EnemyType, WeaponId } from '../sim/types';
import { darken, lighten, mix } from './util';

export const PAL = {
  void: '#070a0d',
  asphalt: '#0b0e12',
  pitch: '#05070a',
  kerb: '#1b2129',
  slab: '#141a21',
  slabLine: '#0d1218',
  amber: '#f5a524',
  amberDeep: '#c97b12',
  amberWarm: '#ffd27a',
  green: '#3ddc97',
  greenDeep: '#1b8f5f',
  fluoro: '#7fd7ff',
  fluoroDeep: '#2b6f8c',
  danger: '#ff4d5e',
  dangerDeep: '#8c1b28',
  ink: '#e6eef7',
  inkDim: '#8d9aa8',
  steel: '#c9d4e0',
  blood: '#8c2f2f',
} as const;

export interface EnemyLook {
  /** Silhouette fill. */
  fill: string;
  /** Darker inner mass, used for depth. */
  deep: string;
  /** 2px rim light along the facing edge. */
  rim: string;
  /** Emissive accent (eyes, lamp, sign). */
  accent: string;
  glow: string;
}

function enemyLook(base: string, accent: string): EnemyLook {
  return {
    fill: base,
    deep: darken(base, 0.45),
    rim: lighten(base, 0.55),
    accent,
    glow: mix(accent, '#ffffff', 0.15),
  };
}

export const ENEMY_LOOK: Record<EnemyType, EnemyLook> = {
  fyllo: enemyLook(ENEMIES.fyllo.colour, PAL.amber),
  duva: enemyLook(ENEMIES.duva.colour, PAL.fluoro),
  skugga: enemyLook(ENEMIES.skugga.colour, PAL.fluoroDeep),
  vaktmastare: enemyLook(ENEMIES.vaktmastare.colour, PAL.green),
  sparkcykel: enemyLook(ENEMIES.sparkcykel.colour, PAL.green),
  nattvakt: enemyLook(ENEMIES.nattvakt.colour, PAL.danger),
  chauffor: enemyLook(ENEMIES.chauffor.colour, PAL.amber),
};

export interface WeaponLook {
  core: string;
  hot: string;
  /** Evolved: brighter and higher contrast, this is the power-spike read. */
  evo: string;
  evoHot: string;
}

function weaponLook(colour: string): WeaponLook {
  return {
    core: colour,
    hot: lighten(colour, 0.45),
    evo: lighten(colour, 0.25),
    evoHot: '#ffffff',
  };
}

export const WEAPON_LOOK: Record<WeaponId, WeaponLook> = {
  nyckel: weaponLook(WEAPONS.nyckel.colour),
  korv: weaponLook(WEAPONS.korv.colour),
  telefon: weaponLook(WEAPONS.telefon.colour),
  spray: weaponLook(WEAPONS.spray.colour),
  vagn: weaponLook(WEAPONS.vagn.colour),
  ficklampa: weaponLook(WEAPONS.ficklampa.colour),
};

export interface CharLook {
  coat: string;
  rim: string;
  accent: string;
  skin: string;
}

export const CHAR_LOOK: Record<CharacterId, CharLook> = {
  nattvandraren: {
    coat: '#233043',
    rim: lighten(CHARACTERS.nattvandraren.colour, 0.15),
    accent: CHARACTERS.nattvandraren.colour,
    skin: '#c9a68a',
  },
  pensionaren: {
    coat: '#3a3128',
    rim: lighten(CHARACTERS.pensionaren.colour, 0.1),
    accent: CHARACTERS.pensionaren.colour,
    skin: '#cbb094',
  },
  studenten: {
    coat: '#1f3a2e',
    rim: lighten(CHARACTERS.studenten.colour, 0.15),
    accent: CHARACTERS.studenten.colour,
    skin: '#d3b79b',
  },
};

/** Pre-built alpha variants used every frame. */
export const ALPHA = {
  rimSoft: 0.55,
  rimHard: 0.9,
  ground: 0.9,
} as const;