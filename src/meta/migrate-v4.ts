import { getNode } from './upgrades-v2';

/**
 * Save v3 -> v4: the Biljetter shop becomes the v2 upgrade trees.
 * Each old level carries over as the same level in the nearest new node, capped at that node's max.
 * Per-level effects were kept equal (kraft 8%, liv 12 HP, fart 4%, plock 10, skinn 1, vaxling 8%), so a cap loses nothing
 * a purchase could not already have bought. `tur` (crit) has no home and is added to weapon damage.
 */
const LEGACY_TARGET: Readonly<Record<string, string>> = {
  kraft: 'w_damage',
  tur: 'w_damage',
  liv: 'c_hp',
  fart: 'c_speed',
  plock: 'c_pickup',
  skinn: 'c_armor',
  vaxling: 'b_storage',
};

/** The old Startnyckel price curve (base 900, x2.4 per level), refunded as Scrap because the upgrade no longer exists. */
const STARTNYCKEL_BASE = 900;
const STARTNYCKEL_GROWTH = 2.4;
const STARTNYCKEL_MAX = 2;

export function migrateShopLevels(old: Readonly<Record<string, number>>): {
  upgrades: Record<string, number>;
  refundScrap: number;
} {
  const upgrades: Record<string, number> = {};
  for (const [legacyId, target] of Object.entries(LEGACY_TARGET)) {
    const level = old[legacyId] ?? 0;
    if (level > 0) upgrades[target] = (upgrades[target] ?? 0) + level;
  }
  for (const [id, level] of Object.entries(upgrades)) upgrades[id] = Math.min(level, getNode(id)!.maxLevel);

  let refundScrap = 0;
  for (let l = 0; l < Math.min(old.startnyckel ?? 0, STARTNYCKEL_MAX); l++) {
    refundScrap += Math.round(STARTNYCKEL_BASE * Math.pow(STARTNYCKEL_GROWTH, l));
  }
  return { upgrades, refundScrap };
}
