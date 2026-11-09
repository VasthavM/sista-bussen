/**
 * Palette and per-entity look tables. Everything here is built once at module
 * load so the draw loops never build a colour string.
 *
 * Two rules drive these values:
 *  - Every silhouette reads against `asphalt` (#0b0e12). Outer masses sit well
 *    clear of the road value; nothing that carries meaning is near-black.
 *  - A hit flash lightens the entity's *own* colours toward white instead of
 *    replacing them with white. A flashing player or enemy still has its
 *    silhouette, its dark outline and its accent colour.
 */
import { CHARACTERS, WEAPONS } from '../sim/content';
import type { CharacterId, EnemyType, WeaponId } from '../sim/types';
import { darken, lighten, mix, rgba } from './util';

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

/** Flash target. Deliberately not pure white: pure white erases the sprite. */
const FLASH_INK = '#f2f7ff';
/** Shared dark edge for every sprite. A drawn outline, not a shadow. */
export const SPRITE_INK = '#05080b';

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

/**
 * Zombie colours. Skin is a desaturated green-grey on every type; the clothes
 * carry the type (brown, pale, blue, purple, dark teal, red, amber) and the
 * eye glow carries the accent. These used to come from the sim's `colour`
 * field; the art owns its palette now, so a balance ticket never repaints it.
 */
const ZOMBIE = {
  shambler: '#7a6a55',
  crawler: '#9aa994',
  runner: '#46628a',
  spitter: '#6a4fb0',
  charger: '#2f5d55',
  warden: PAL.danger,
  conductor: PAL.amber,
  skin: '#8fa088',
  skinPale: '#b0bfa8',
  bile: '#b8e64a',
  sick: '#d7e04a',
} as const;

export const ENEMY_LOOK: Record<EnemyType, EnemyLook> = {
  fyllo: enemyLook(ZOMBIE.shambler, ZOMBIE.sick),
  duva: enemyLook(ZOMBIE.crawler, '#eaf3c4'),
  skugga: enemyLook(ZOMBIE.runner, PAL.fluoro),
  vaktmastare: enemyLook(ZOMBIE.spitter, ZOMBIE.bile),
  sparkcykel: enemyLook(ZOMBIE.charger, '#ff9a3c'),
  nattvakt: enemyLook(ZOMBIE.warden, PAL.danger),
  chauffor: enemyLook(ZOMBIE.conductor, PAL.amber),
};

/**
 * Per-type art recipe. Every string is built here, once, so the per-frame draw
 * loop never allocates a colour or an `rgba()` string for 150 entities.
 *
 * Threat tier is carried by colour, in the existing palette: the Shambler and
 * Crawler are dusted-down grey-brown fodder, the Runner and Spitter get cold
 * blue and toxic purple, the Charger is dark teal plate, and the two bosses
 * are saturated red/amber. Red is reserved for "this will hurt you": charge
 * lanes, spit wind-ups and burst rings.
 */
export interface EnemyArt {
  look: EnemyLook;
  /** Outer mass panels: a step darker than `body`, never near-black. */
  shell: string;
  /** Main silhouette fill. */
  body: string;
  /** Interior shadow mass and detail lines. */
  shade: string;
  /** Head/skin. Kept a step away from the body so a head reads as a head. */
  head: string;
  headShade: string;
  /** Garment/prop colour (cap, bottle, broom, lantern). */
  kit: string;
  kitShade: string;
  /** Pre-built strokes. */
  rimStroke: string;
  rimSoftStroke: string;
  detailStroke: string;
  /** Danger telegraph (never used for decoration). */
  telegraph: string;
  telegraphStroke: string;
  telegraphSoft: string;
  /** Hit-flash variants, same hue pushed toward white. Built once. */
  flashBody: string;
  flashShell: string;
  flashShade: string;
  flashHead: string;
  flashKit: string;
  /** Trash-tier enemies get a dusted silhouette: cheaper to read as "fodder". */
  dusty: boolean;
}

function enemyArt(
  type: EnemyType,
  opts: {
    body: string;
    head: string;
    kit: string;
    kitShade?: string;
    bodyDeepMix?: number;
    dusty?: boolean;
    telegraph?: string;
  },
): EnemyArt {
  const look = ENEMY_LOOK[type];
  const body = opts.body;
  const shell = mix(body, PAL.asphalt, opts.bodyDeepMix ?? 0.26);
  const shade = darken(body, 0.45);
  const head = opts.head;
  const kit = opts.kit;
  return {
    look,
    shell,
    body,
    shade,
    head,
    headShade: darken(head, 0.34),
    kit,
    kitShade: opts.kitShade ?? darken(kit, 0.42),
    rimStroke: lighten(body, 0.62),
    rimSoftStroke: rgba(lighten(body, 0.55), 0.4),
    detailStroke: rgba(darken(body, 0.6), 0.85),
    telegraph: opts.telegraph ?? PAL.danger,
    telegraphStroke: rgba(opts.telegraph ?? PAL.danger, 0.55),
    telegraphSoft: rgba(opts.telegraph ?? PAL.danger, 0.16),
    flashBody: mix(body, FLASH_INK, 0.66),
    flashShell: mix(shell, FLASH_INK, 0.52),
    flashShade: mix(shade, FLASH_INK, 0.4),
    flashHead: mix(head, '#ffffff', 0.48),
    flashKit: mix(kit, '#ffffff', 0.38),
    dusty: opts.dusty ?? false,
  };
}

export const ENEMY_ART: Record<EnemyType, EnemyArt> = {
  fyllo: enemyArt('fyllo', {
    body: mix(ZOMBIE.shambler, PAL.asphalt, 0.08),
    head: ZOMBIE.skin,
    kit: '#c9c3a0',
    kitShade: '#6a644a',
    dusty: true,
  }),
  duva: enemyArt('duva', {
    body: mix(ZOMBIE.crawler, PAL.asphalt, 0.1),
    head: ZOMBIE.skinPale,
    kit: '#e0e4cf',
    kitShade: '#7c8470',
    bodyDeepMix: 0.3,
    dusty: true,
  }),
  skugga: enemyArt('skugga', {
    body: mix(ZOMBIE.runner, PAL.fluoro, 0.12),
    head: '#8fa89c',
    kit: PAL.fluoro,
    kitShade: PAL.fluoroDeep,
  }),
  vaktmastare: enemyArt('vaktmastare', {
    body: mix(ZOMBIE.spitter, PAL.asphalt, 0.3),
    head: '#9ab08c',
    kit: ZOMBIE.bile,
    kitShade: '#566f12',
  }),
  sparkcykel: enemyArt('sparkcykel', {
    body: mix(ZOMBIE.charger, PAL.asphalt, 0.2),
    head: '#8aa088',
    kit: '#a9b4be',
    kitShade: '#3a444c',
  }),
  nattvakt: enemyArt('nattvakt', {
    body: mix(ZOMBIE.warden, PAL.asphalt, 0.28),
    head: '#9fae95',
    kit: PAL.amberWarm,
    kitShade: mix(ZOMBIE.warden, PAL.asphalt, 0.55),
  }),
  chauffor: enemyArt('chauffor', {
    body: mix(ZOMBIE.conductor, PAL.asphalt, 0.35),
    head: '#a8b498',
    kit: PAL.amber,
    kitShade: mix(ZOMBIE.conductor, PAL.asphalt, 0.62),
  }),
};

/**
 * Flat paint slots consumed by the sprite functions. One object per entity and
 * state, built at module load: the draw path only ever picks a reference.
 */
export interface SpritePaint {
  /** Dark outline. Stays dark during a hit flash. */
  outline: string;
  /** Rear/under mass, a step darker than `body`. */
  shell: string;
  body: string;
  /** Interior shadow mass. */
  shade: string;
  head: string;
  headDeep: string;
  /** Headwear: hood, cap or beanie. */
  hat: string;
  hatDeep: string;
  kit: string;
  kitDeep: string;
  /** Leading-edge rim light. */
  rim: string;
  detail: string;
}

export interface SpriteStates {
  normal: SpritePaint;
  flash: SpritePaint;
}

function enemyPaint(art: EnemyArt): SpriteStates {
  return {
    normal: {
      outline: SPRITE_INK,
      shell: art.shell,
      body: art.body,
      shade: art.shade,
      head: art.head,
      headDeep: art.headShade,
      hat: art.shell,
      hatDeep: art.shade,
      kit: art.kit,
      kitDeep: art.kitShade,
      rim: art.rimStroke,
      detail: lighten(art.body, 0.2),
    },
    flash: {
      outline: SPRITE_INK,
      shell: art.flashShell,
      body: art.flashBody,
      shade: art.flashShade,
      head: art.flashHead,
      headDeep: mix(art.head, SPRITE_INK, 0.3),
      hat: art.flashShell,
      hatDeep: art.flashShade,
      kit: art.flashKit,
      kitDeep: mix(art.kit, SPRITE_INK, 0.35),
      rim: '#ffffff',
      detail: lighten(art.flashBody, 0.12),
    },
  };
}

export const ENEMY_PAINT: Record<EnemyType, SpriteStates> = {
  fyllo: enemyPaint(ENEMY_ART.fyllo),
  duva: enemyPaint(ENEMY_ART.duva),
  skugga: enemyPaint(ENEMY_ART.skugga),
  vaktmastare: enemyPaint(ENEMY_ART.vaktmastare),
  sparkcykel: enemyPaint(ENEMY_ART.sparkcykel),
  nattvakt: enemyPaint(ENEMY_ART.nattvakt),
  chauffor: enemyPaint(ENEMY_ART.chauffor),
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
    coat: '#2f4257',
    rim: lighten(CHARACTERS.nattvandraren.colour, 0.15),
    accent: CHARACTERS.nattvandraren.colour,
    skin: '#c9a68a',
  },
  pensionaren: {
    coat: '#4a4034',
    rim: lighten(CHARACTERS.pensionaren.colour, 0.1),
    accent: CHARACTERS.pensionaren.colour,
    skin: '#cbb094',
  },
  studenten: {
    coat: '#2a4a3a',
    rim: lighten(CHARACTERS.studenten.colour, 0.15),
    accent: CHARACTERS.studenten.colour,
    skin: '#d3b79b',
  },
};

/**
 * Player art recipe, built once. The three characters are told apart by
 * silhouette, not by tint alone: long coat + sash, round coat + flat cap +
 * stick, slim hoodie + backpack + headphones. Every colour used at draw time
 * lives here so the per-frame path is allocation-free.
 */
export interface CharArt {
  coat: string;
  coatDeep: string;
  /** Headwear fill (hood, flat cap, beanie). */
  hat: string;
  hatDeep: string;
  /** Hat band / cap fold: the light accent garment detail. */
  hatBand: string;
  /** Reflective sash, scarf or strap: the character's own colour. */
  accent: string;
  accentDeep: string;
  skin: string;
  skinDeep: string;
  /** Wood/plastic for the character prop (stick, ear cups). */
  kit: string;
  kitDeep: string;
  rimStroke: string;
  rimSoftStroke: string;
  /** Face gap under a hood or cap. */
  faceVoid: string;
  /** Hit-flash variants, same hue pushed toward white. Built once. */
  flashBody: string;
  flashShell: string;
  flashHead: string;
  flashKit: string;
}

function charArt(
  id: CharacterId,
  opts: { coat: string; hat: string; kit: string; hatBandMix?: number },
): CharArt {
  const accent = CHARACTERS[id].colour;
  const coat = opts.coat;
  const hat = opts.hat;
  const coatDeep = darken(coat, 0.4);
  return {
    coat,
    coatDeep,
    hat,
    hatDeep: darken(hat, 0.35),
    hatBand: mix(accent, '#ffffff', opts.hatBandMix ?? 0.2),
    accent,
    accentDeep: darken(accent, 0.45),
    skin: CHAR_LOOK[id].skin,
    skinDeep: darken(CHAR_LOOK[id].skin, 0.42),
    kit: opts.kit,
    kitDeep: darken(opts.kit, 0.45),
    rimStroke: lighten(accent, 0.25),
    rimSoftStroke: rgba(lighten(accent, 0.1), 0.42),
    faceVoid: '#080b11',
    flashBody: mix(coat, FLASH_INK, 0.6),
    flashShell: mix(coatDeep, FLASH_INK, 0.46),
    flashHead: mix(CHAR_LOOK[id].skin, '#ffffff', 0.45),
    flashKit: mix(opts.kit, '#ffffff', 0.35),
  };
}

export const CHAR_ART: Record<CharacterId, CharArt> = {
  nattvandraren: charArt('nattvandraren', { coat: '#35495f', hat: '#22344a', kit: '#101822' }),
  pensionaren: charArt('pensionaren', { coat: '#544739', hat: '#6f5738', kit: '#8a6438' }),
  studenten: charArt('studenten', { coat: '#2f5241', hat: '#1d3a2d', kit: '#9fb3c0' }),
};

function charPaint(art: CharArt): SpriteStates {
  return {
    normal: {
      outline: SPRITE_INK,
      shell: art.coatDeep,
      body: art.coat,
      shade: art.hatDeep,
      head: art.skin,
      headDeep: art.skinDeep,
      hat: art.hat,
      hatDeep: art.hatDeep,
      kit: art.kit,
      kitDeep: art.kitDeep,
      rim: art.rimStroke,
      detail: lighten(art.coat, 0.2),
    },
    flash: {
      outline: SPRITE_INK,
      shell: art.flashShell,
      body: art.flashBody,
      shade: mix(art.hatDeep, FLASH_INK, 0.4),
      head: art.flashHead,
      headDeep: mix(art.skinDeep, FLASH_INK, 0.4),
      hat: mix(art.hat, FLASH_INK, 0.5),
      hatDeep: mix(art.hatDeep, FLASH_INK, 0.45),
      kit: art.flashKit,
      kitDeep: mix(art.kitDeep, FLASH_INK, 0.3),
      rim: '#ffffff',
      detail: lighten(art.flashBody, 0.12),
    },
  };
}

export const CHAR_PAINT: Record<CharacterId, SpriteStates> = {
  nattvandraren: charPaint(CHAR_ART.nattvandraren),
  pensionaren: charPaint(CHAR_ART.pensionaren),
  studenten: charPaint(CHAR_ART.studenten),
};

/** Pre-built alpha variants used every frame. */
export const ALPHA = {
  rimSoft: 0.55,
  rimHard: 0.9,
  ground: 0.9,
} as const;