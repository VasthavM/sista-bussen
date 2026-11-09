import type { WeaponId } from '../sim/types';
import { addScrap, type Profile } from './save';
import {
  STARTER_WEAPONS,
  UPGRADE_NODES,
  WEAPON_UNLOCK_SCRAP,
  buy,
  buyBlock,
  costOf,
  levelOf,
  modsFromProfileV2,
  type UpgradeNode,
} from './upgrades-v2';

/**
 * The old shop's read path over the v4 upgrade trees. Crude on purpose: it lists the single-material level nodes
 * and shows each price as one number; the hub UI ticket replaces the screen and this file with it.
 */
export type UpgradeId = string;

export interface ShopUpgrade {
  id: UpgradeId;
  name: string;
  description: (level: number) => string;
  maxLevel: number;
}

const SINGLE_TREES: readonly UpgradeNode['tree'][] = ['character', 'weapons', 'bus'];
const LEVEL_NODES = UPGRADE_NODES.filter((n) => SINGLE_TREES.includes(n.tree) && n.effect.kind === 'stat');

function describe(n: UpgradeNode, level: number): string {
  const e = n.effect;
  if (e.kind !== 'stat') return n.name;
  const v = e.perLevel * level;
  const pct = e.perLevel < 1 && e.stat !== 'turret' && e.stat !== 'plow';
  return `${n.name} +${pct ? `${Math.round(v * 100)}%` : Math.round(v)}`;
}

export const SHOP_UPGRADES: Record<UpgradeId, ShopUpgrade> = Object.fromEntries(
  LEVEL_NODES.map((n) => [n.id, { id: n.id, name: n.name, description: (l: number) => describe(n, l), maxLevel: n.maxLevel }]),
);

export const UPGRADE_ORDER: UpgradeId[] = LEVEL_NODES.map((n) => n.id);

export function upgradeLevel(profile: Profile, id: UpgradeId): number {
  return levelOf(profile, id);
}

/** The one number the old row shows: the price in whichever material the node uses. */
export function upgradeCost(id: UpgradeId, level: number): number {
  const c = costOf(id, level);
  return c.scrap + c.parts + c.supplies;
}

/** True when the next level is buyable right now (not maxed, unlocked, paid for). */
export function canBuyUpgrade(profile: Profile, id: UpgradeId): boolean {
  return buyBlock(profile, id) === null;
}

/** Mutating wrapper for the old screen. */
export function buyUpgrade(profile: Profile, id: UpgradeId): boolean {
  const next = buy(profile, id);
  if (!next) return false;
  Object.assign(profile, next);
  return true;
}

export const modsFromProfile = modsFromProfileV2;

export const WEAPON_UNLOCK_COST = WEAPON_UNLOCK_SCRAP;

export function isWeaponUnlocked(profile: Profile, id: WeaponId): boolean {
  return profile.unlockedWeapons.includes(id);
}

export function unlockWeaponWithTickets(profile: Profile, id: WeaponId): boolean {
  return buyUpgrade(profile, `w_unlock_${id}`);
}

export function unlockWeaponWithToken(profile: Profile, id: WeaponId): boolean {
  if (isWeaponUnlocked(profile, id)) return false;
  if (profile.weaponTokens <= 0) return false;
  profile.weaponTokens -= 1;
  profile.unlockedWeapons.push(id);
  return true;
}

export function starterWeapons(): WeaponId[] {
  return [...STARTER_WEAPONS];
}

export interface ColourDef {
  id: string;
  name: string;
  tint: string;
  cost: number;
}

export const COLOURS: ColourDef[] = [
  { id: 'standard', name: 'Raincoat', tint: '#7fd7ff', cost: 0 },
  { id: 'amber', name: 'Sodium Yellow', tint: '#f5a524', cost: 300 },
  { id: 'green', name: 'Bus Green', tint: '#3ddc97', cost: 300 },
  { id: 'red', name: 'Brake Red', tint: '#ff4d5e', cost: 450 },
];

export function buyColour(profile: Profile, id: string): boolean {
  const colour = COLOURS.find((c) => c.id === id);
  if (!colour) return false;
  if (profile.colours.includes(id)) {
    profile.activeColour = id;
    return true;
  }
  if (profile.materials.scrap < colour.cost) return false;
  addScrap(profile, -colour.cost);
  profile.colours.push(id);
  profile.activeColour = id;
  return true;
}

export function activeColour(profile: Profile): string {
  const found = COLOURS.find((c) => c.id === profile.activeColour);
  return found ? found.tint : COLOURS[0].tint;
}