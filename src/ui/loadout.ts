/** Menu-level preference: the last chosen character and starting weapon. Not part of the versioned save. */

import { CHARACTER_ORDER, WEAPON_ORDER } from '../sim/content';
import type { CharacterId, WeaponId } from '../sim/types';

export const LOADOUT_KEY = 'sista-bussen.loadout.v1';

export interface Loadout {
  character: CharacterId;
  weapon: WeaponId;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function firstUnlockedWeapon(isUnlocked: (id: WeaponId) => boolean): WeaponId {
  return WEAPON_ORDER.find(isUnlocked) ?? 'nyckel';
}

/** Stored ids are validated per field; anything unknown or locked falls back to the default. */
export function loadLoadout(storage: StorageLike | null, isUnlocked: (id: WeaponId) => boolean): Loadout {
  const fallback: Loadout = { character: CHARACTER_ORDER[0], weapon: firstUnlockedWeapon(isUnlocked) };
  try {
    const raw = storage?.getItem(LOADOUT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Record<keyof Loadout, unknown>> | null;
    const character = CHARACTER_ORDER.find((id) => id === parsed?.character);
    const weapon = WEAPON_ORDER.find((id) => id === parsed?.weapon && isUnlocked(id));
    return { character: character ?? fallback.character, weapon: weapon ?? fallback.weapon };
  } catch {
    return fallback;
  }
}

export function saveLoadout(storage: StorageLike | null, loadout: Loadout): void {
  try {
    storage?.setItem(LOADOUT_KEY, JSON.stringify(loadout));
  } catch {
    /* fine without storage */
  }
}
