import { WEAPON_ORDER, WEAPONS } from '../sim/content';
import type { MetaMods, WeaponId } from '../sim/types';
import type { Profile } from './save';

export type UpgradeId =
  | 'kraft'
  | 'liv'
  | 'fart'
  | 'plock'
  | 'tur'
  | 'skinn'
  | 'vaxling'
  | 'startnyckel';

export interface ShopUpgrade {
  id: UpgradeId;
  name: string;
  description: (level: number) => string;
  maxLevel: number;
  baseCost: number;
  growth: number;
}

export const SHOP_UPGRADES: Record<UpgradeId, ShopUpgrade> = {
  kraft: {
    id: 'kraft',
    name: 'Kraft',
    description: (l) => `+${Math.round(l * 8)}% skada på alla vapen`,
    maxLevel: 10,
    baseCost: 150,
    growth: 1.55,
  },
  liv: {
    id: 'liv',
    name: 'Liv',
    description: (l) => `+${l * 12} max HP`,
    maxLevel: 10,
    baseCost: 140,
    growth: 1.5,
  },
  fart: {
    id: 'fart',
    name: 'Fart',
    description: (l) => `+${Math.round(l * 4)}% rörelsehastighet`,
    maxLevel: 8,
    baseCost: 160,
    growth: 1.55,
  },
  plock: {
    id: 'plock',
    name: 'Plock',
    description: (l) => `+${l * 10} plockradie`,
    maxLevel: 8,
    baseCost: 120,
    growth: 1.5,
  },
  tur: {
    id: 'tur',
    name: 'Tur',
    description: (l) => `+${Math.round(l * 2)}% kritisk chans`,
    maxLevel: 8,
    baseCost: 180,
    growth: 1.6,
  },
  skinn: {
    id: 'skinn',
    name: 'Skinn',
    description: (l) => `+${l} rustning`,
    maxLevel: 6,
    baseCost: 200,
    growth: 1.65,
  },
  vaxling: {
    id: 'vaxling',
    name: 'Växling',
    description: (l) => `+${Math.round(l * 8)}% Biljetter från rundor`,
    maxLevel: 10,
    baseCost: 220,
    growth: 1.6,
  },
  startnyckel: {
    id: 'startnyckel',
    name: 'Startnyckel',
    description: (l) => `Startvapnet börjar på nivå ${1 + l}`,
    maxLevel: 2,
    baseCost: 900,
    growth: 2.4,
  },
};

export const UPGRADE_ORDER: UpgradeId[] = [
  'kraft',
  'liv',
  'fart',
  'plock',
  'tur',
  'skinn',
  'vaxling',
  'startnyckel',
];

export function upgradeLevel(profile: Profile, id: UpgradeId): number {
  return profile.upgrades[id] ?? 0;
}

export function upgradeCost(id: UpgradeId, level: number): number {
  const def = SHOP_UPGRADES[id];
  return Math.round(def.baseCost * Math.pow(def.growth, level));
}

export function canBuyUpgrade(profile: Profile, id: UpgradeId): boolean {
  return upgradeLevel(profile, id) < SHOP_UPGRADES[id].maxLevel;
}

export function buyUpgrade(profile: Profile, id: UpgradeId): boolean {
  const level = upgradeLevel(profile, id);
  if (level >= SHOP_UPGRADES[id].maxLevel) return false;
  const cost = upgradeCost(id, level);
  if (profile.tickets < cost) return false;
  profile.tickets -= cost;
  profile.upgrades[id] = level + 1;
  return true;
}

export function modsFromProfile(profile: Profile): MetaMods {
  return {
    damage: upgradeLevel(profile, 'kraft') * 0.08,
    hp: upgradeLevel(profile, 'liv') * 12,
    speed: upgradeLevel(profile, 'fart') * 0.04,
    pickup: upgradeLevel(profile, 'plock') * 10,
    crit: upgradeLevel(profile, 'tur') * 0.02,
    armor: upgradeLevel(profile, 'skinn'),
    fares: upgradeLevel(profile, 'vaxling') * 0.08,
    startWeaponLevel: upgradeLevel(profile, 'startnyckel'),
  };
}

export const WEAPON_UNLOCK_COST = 450;

export function isWeaponUnlocked(profile: Profile, id: WeaponId): boolean {
  return profile.unlockedWeapons.includes(id);
}

export function unlockWeaponWithTickets(profile: Profile, id: WeaponId): boolean {
  if (isWeaponUnlocked(profile, id)) return false;
  if (profile.tickets < WEAPON_UNLOCK_COST) return false;
  profile.tickets -= WEAPON_UNLOCK_COST;
  profile.unlockedWeapons.push(id);
  return true;
}

export function unlockWeaponWithToken(profile: Profile, id: WeaponId): boolean {
  if (isWeaponUnlocked(profile, id)) return false;
  if (profile.weaponTokens <= 0) return false;
  profile.weaponTokens -= 1;
  profile.unlockedWeapons.push(id);
  return true;
}

export function starterWeapons(): WeaponId[] {
  return ['nyckel', 'korv', 'spray', 'ficklampa'];
}

export interface ColourDef {
  id: string;
  name: string;
  tint: string;
  cost: number;
}

export const COLOURS: ColourDef[] = [
  { id: 'standard', name: 'Regnjacka', tint: '#7fd7ff', cost: 0 },
  { id: 'amber', name: 'Natriumgul', tint: '#f5a524', cost: 300 },
  { id: 'green', name: 'Bussgrön', tint: '#3ddc97', cost: 300 },
  { id: 'red', name: 'Bromsröd', tint: '#ff4d5e', cost: 450 },
];

export function buyColour(profile: Profile, id: string): boolean {
  const colour = COLOURS.find((c) => c.id === id);
  if (!colour) return false;
  if (profile.colours.includes(id)) {
    profile.activeColour = id;
    return true;
  }
  if (profile.tickets < colour.cost) return false;
  profile.tickets -= colour.cost;
  profile.colours.push(id);
  profile.activeColour = id;
  return true;
}

export function activeColour(profile: Profile): string {
  const found = COLOURS.find((c) => c.id === profile.activeColour);
  return found ? found.tint : COLOURS[0].tint;
}