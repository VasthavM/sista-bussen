import type { Materials, MaterialId } from '../sim/map';
import type { MetaMods, WeaponId } from '../sim/types';
import type { Profile } from './save';

/**
 * v2 upgrade trees. Pure data plus pure functions: this table is the single source for costs and effects.
 * Three single-material trees (Character/Supplies, Weapons/Scrap, Bus/Parts) and three combination trees
 * that cost two materials and need a foothold in both parent trees.
 */

export type TreeId = 'character' | 'weapons' | 'bus' | 'evolution' | 'mods' | 'crew';

/** Numeric stats a node can add to, per level. */
type Stat =
  | 'damage' | 'attackSpeed' | 'hp' | 'speed' | 'pickup' | 'reviveHp' | 'armor'
  | 'quotaCut' | 'storage' | 'turret' | 'plow' | 'radio' | 'busArmor'
  | 'startShield' | 'fuelMagnet' | 'extraProjectiles' | 'pierce';

export type Effect =
  | { readonly kind: 'stat'; readonly stat: Stat; readonly perLevel: number }
  | { readonly kind: 'unlockWeapon'; readonly weapon: WeaponId }
  | { readonly kind: 'evolution'; readonly weapon: WeaponId };

export interface Requirement {
  readonly node: string;
  readonly level: number;
}

export interface UpgradeNode {
  readonly id: string;
  readonly tree: TreeId;
  readonly name: string;
  readonly maxLevel: number;
  /** Cost of level 1, per material. Level n costs `round(base * growth^(n-1))`. */
  readonly baseCost: Readonly<Partial<Record<MaterialId, number>>>;
  readonly growth: number;
  readonly requires: readonly Requirement[];
  readonly effect: Effect;
}

/** Scrap price of putting a weapon on the rack. Same for all three, buyable in any order. */
export const WEAPON_UNLOCK_SCRAP = 1200;
/** Weapons the player owns before buying anything: Nyckel, Grillkorv, Ficklampa. */
export const STARTER_WEAPONS: readonly WeaponId[] = ['nyckel', 'korv', 'ficklampa'];
const RACK_WEAPONS: readonly WeaponId[] = ['telefon', 'spray', 'vagn'];
const ALL_WEAPONS: readonly WeaponId[] = ['nyckel', 'korv', 'telefon', 'spray', 'vagn', 'ficklampa'];

/**
 * Cost calibration. Measured on the sim (street, depth 1, rush bot, 30 seeds per start weapon, extracted runs):
 * about 700 Scrap, 17 Parts and 13 Supplies per map. These are rounded down to stay conservative.
 * Every level-1 price must be reachable after 3 maps; the level-1 and level-2 price of the basic nodes after 2.
 */
export const EXPECTED_PER_DEPTH1_MAP: Materials = { scrap: 650, parts: 16, supplies: 12 };

const stat = (stat: Stat, perLevel: number): Effect => ({ kind: 'stat', stat, perLevel });
const need = (node: string, level = 1): Requirement => ({ node, level });

function node(
  id: string,
  tree: TreeId,
  name: string,
  maxLevel: number,
  baseCost: UpgradeNode['baseCost'],
  growth: number,
  effect: Effect,
  requires: readonly Requirement[] = [],
): UpgradeNode {
  return { id, tree, name, maxLevel, baseCost, growth, requires, effect };
}

const CHARACTER: UpgradeNode[] = [
  node('c_hp', 'character', 'Max HP', 5, { supplies: 8 }, 1.6, stat('hp', 12)),
  node('c_speed', 'character', 'Speed', 5, { supplies: 8 }, 1.6, stat('speed', 0.04)),
  node('c_pickup', 'character', 'Pickup radius', 5, { supplies: 6 }, 1.6, stat('pickup', 10)),
  node('c_revive', 'character', 'Revive HP', 5, { supplies: 10 }, 1.7, stat('reviveHp', 8)),
  node('c_armor', 'character', 'Armor', 5, { supplies: 12 }, 1.7, stat('armor', 1)),
];

const WEAPON_UNLOCKS: UpgradeNode[] = RACK_WEAPONS.map((w) =>
  node(`w_unlock_${w}`, 'weapons', `Unlock ${w}`, 1, { scrap: WEAPON_UNLOCK_SCRAP }, 1, { kind: 'unlockWeapon', weapon: w }),
);

const WEAPONS_TREE: UpgradeNode[] = [
  node('w_damage', 'weapons', 'Weapon damage', 5, { scrap: 400 }, 1.6, stat('damage', 0.08)),
  node('w_attack', 'weapons', 'Attack speed', 5, { scrap: 500 }, 1.6, stat('attackSpeed', 0.05)),
  ...WEAPON_UNLOCKS,
];

const BUS: UpgradeNode[] = [
  node('b_fuel', 'bus', 'Fuel tank', 5, { parts: 12 }, 1.7, stat('quotaCut', 0.04)),
  node('b_storage', 'bus', 'Storage', 5, { parts: 12 }, 1.7, stat('storage', 0.08)),
  node('b_turret', 'bus', 'Turret', 1, { parts: 40 }, 1, stat('turret', 1)),
  node('b_plow', 'bus', 'Plow', 1, { parts: 30 }, 1, stat('plow', 1)),
  node('b_radio', 'bus', 'Radio', 2, { parts: 15 }, 2, stat('radio', 1)),
  node('b_armor', 'bus', 'Bus armor', 5, { parts: 14 }, 1.7, stat('busArmor', 25)),
];

/** Scrap + Supplies. The weapon must be on the rack; the card then shows up in-map at a lower level. */
const EVOLUTIONS: UpgradeNode[] = ALL_WEAPONS.map((w) =>
  node(`evo_${w}`, 'evolution', `Evolution: ${w}`, 1, { scrap: 800, supplies: 20 }, 1, { kind: 'evolution', weapon: w }, [
    need('w_damage'),
    need('c_hp'),
  ]),
);

/** Scrap + Parts. Global and capped at two levels each. */
const MODS: UpgradeNode[] = [
  node('mod_projectile', 'mods', '+1 projectile', 2, { scrap: 600, parts: 20 }, 1.8, stat('extraProjectiles', 1), [
    need('w_damage', 2),
    need('b_storage'),
  ]),
  node('mod_pierce', 'mods', '+1 pierce', 2, { scrap: 600, parts: 20 }, 1.8, stat('pierce', 1), [
    need('w_attack', 2),
    need('b_fuel'),
  ]),
];

/** Parts + Supplies. */
const CREW: UpgradeNode[] = [
  node('crew_shield', 'crew', 'Starting shield', 3, { parts: 20, supplies: 12 }, 1.7, stat('startShield', 15), [
    need('b_armor'),
    need('c_armor'),
  ]),
  node('crew_magnet', 'crew', 'Fuel magnet', 3, { parts: 18, supplies: 12 }, 1.7, stat('fuelMagnet', 40), [
    need('b_fuel'),
    need('c_pickup'),
  ]),
];

export const UPGRADE_NODES: readonly UpgradeNode[] = [
  ...CHARACTER,
  ...WEAPONS_TREE,
  ...BUS,
  ...EVOLUTIONS,
  ...MODS,
  ...CREW,
];

const BY_ID = new Map(UPGRADE_NODES.map((n) => [n.id, n]));

export function getNode(id: string): UpgradeNode | undefined {
  return BY_ID.get(id);
}

/** Current level. Weapon unlocks are owned-or-not, read from the rack rather than stored twice. */
export function levelOf(profile: Profile, id: string): number {
  const n = BY_ID.get(id);
  if (!n) return 0;
  if (n.effect.kind === 'unlockWeapon') return profile.unlockedWeapons.includes(n.effect.weapon) ? 1 : 0;
  return profile.upgrades[id] ?? 0;
}

/** Price of buying level `level + 1` of a node. Throws on an unknown id. */
export function costOf(id: string, level: number): Materials {
  const n = BY_ID.get(id);
  if (!n) throw new Error(`unknown upgrade: ${id}`);
  const k = Math.pow(n.growth, level);
  const price = (m: MaterialId): number => Math.round((n.baseCost[m] ?? 0) * k);
  return { scrap: price('scrap'), parts: price('parts'), supplies: price('supplies') };
}

export type BuyBlock = 'unknown' | 'maxed' | 'locked' | 'poor';

/** Why a node cannot be bought right now, or null when it can. */
export function buyBlock(profile: Profile, id: string): BuyBlock | null {
  const n = BY_ID.get(id);
  if (!n) return 'unknown';
  const level = levelOf(profile, id);
  if (level >= n.maxLevel) return 'maxed';
  if (n.requires.some((r) => levelOf(profile, r.node) < r.level)) return 'locked';
  if (n.effect.kind === 'evolution' && !profile.unlockedWeapons.includes(n.effect.weapon)) return 'locked';
  const cost = costOf(id, level);
  const m = profile.materials;
  return m.scrap < cost.scrap || m.parts < cost.parts || m.supplies < cost.supplies ? 'poor' : null;
}

export function canBuy(profile: Profile, id: string): boolean {
  return buyBlock(profile, id) === null;
}

/** Returns a new profile with the node one level up and the materials spent, or null when it cannot be bought. */
export function buy(profile: Profile, id: string): Profile | null {
  if (!canBuy(profile, id)) return null;
  const n = BY_ID.get(id)!;
  const cost = costOf(id, levelOf(profile, id));
  const next: Profile = {
    ...profile,
    materials: {
      scrap: profile.materials.scrap - cost.scrap,
      parts: profile.materials.parts - cost.parts,
      supplies: profile.materials.supplies - cost.supplies,
    },
    upgrades: { ...profile.upgrades },
    unlockedWeapons: [...profile.unlockedWeapons],
  };
  if (n.effect.kind === 'unlockWeapon') next.unlockedWeapons.push(n.effect.weapon);
  else next.upgrades[id] = levelOf(profile, id) + 1;
  return next;
}

/** `MetaMods` as the sim reads it today, plus everything v2 adds. Meta-side only: src/sim is untouched. */
export interface V2Mods extends MetaMods {
  evolutionUnlocks: WeaponId[];
  /** Multiplier on the map's fuel quota (1 = none, 0.8 = fuel tank maxed). */
  quotaMultiplier: number;
  /** Multiplier on material drops (1 + storage). */
  materialGainMultiplier: number;
  /** HP of shield the run starts with. */
  startShield: number;
  /** Extra radius at which fuel is pulled in. */
  fuelMagnet: number;
  attackSpeed: number;
  reviveHp: number;
  extraProjectiles: number;
  pierce: number;
  /** Flags: the sim side of these is a later ticket. */
  turret: boolean;
  plow: boolean;
  radio: number;
  busArmor: number;
}

export function modsFromProfileV2(profile: Profile): V2Mods {
  const total: Record<Stat, number> = {
    damage: 0, attackSpeed: 0, hp: 0, speed: 0, pickup: 0, reviveHp: 0, armor: 0, quotaCut: 0, storage: 0,
    turret: 0, plow: 0, radio: 0, busArmor: 0, startShield: 0, fuelMagnet: 0, extraProjectiles: 0, pierce: 0,
  };
  const evolutionUnlocks: WeaponId[] = [];
  for (const n of UPGRADE_NODES) {
    const level = levelOf(profile, n.id);
    if (level <= 0) continue;
    const e = n.effect;
    if (e.kind === 'stat') total[e.stat] += e.perLevel * level;
    else if (e.kind === 'evolution') evolutionUnlocks.push(e.weapon);
  }
  return {
    damage: total.damage,
    hp: total.hp,
    speed: total.speed,
    pickup: total.pickup,
    crit: 0,
    armor: total.armor,
    // `fares` is the field the old payout reads; it carries the storage bonus.
    fares: total.storage,
    startWeaponLevel: 0,
    evolutionUnlocks,
    quotaMultiplier: 1 - total.quotaCut,
    materialGainMultiplier: 1 + total.storage,
    startShield: total.startShield,
    fuelMagnet: total.fuelMagnet,
    attackSpeed: total.attackSpeed,
    reviveHp: total.reviveHp,
    extraProjectiles: total.extraProjectiles,
    pierce: total.pierce,
    turret: total.turret > 0,
    plow: total.plow > 0,
    radio: total.radio,
    busArmor: total.busArmor,
  };
}
