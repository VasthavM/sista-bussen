import { PASSIVES, PASSIVE_ORDER, WEAPONS, WEAPON_ORDER } from './content';
import { nextFloat, pickWeighted } from './rng';
import { pushEvent, recomputeStats } from './state';
import type { PassiveId, SimState, UpgradeChoice, WeaponId } from './types';

export const WEAPON_MAX_LEVEL = 8;
export const PASSIVE_MAX_LEVEL = 5;
export const EVOLUTION_PASSIVE_LEVEL = 3;
export const MAX_WEAPONS = 6;

const WEIGHTS = {
  evolution: 100,
  newWeapon: 30,
  weaponUpgrade: 45,
  passive: 25,
} as const;

function ownedWeapon(state: SimState, id: WeaponId) {
  return state.weapons.find((w) => w.id === id);
}

export function canEvolve(state: SimState, id: WeaponId): boolean {
  const weapon = ownedWeapon(state, id);
  if (!weapon || weapon.evolved) return false;
  if (weapon.level < WEAPON_MAX_LEVEL) return false;
  const def = WEAPONS[id];
  return (state.passives[def.passive] ?? 0) >= EVOLUTION_PASSIVE_LEVEL;
}

function toChoice(c: Candidate): UpgradeChoice {
  return {
    id: c.id,
    kind: c.kind,
    name: c.name,
    desc: c.desc,
    weaponId: c.weaponId,
    passiveId: c.passiveId,
    level: c.level,
    rarity: c.rarity,
  };
}

function passiveChoice(id: PassiveId, level: number): Candidate {
  const def = PASSIVES[id];
  return {
    id: `passive:${id}`,
    kind: 'passive',
    name: def.name,
    desc: def.description(level),
    passiveId: id,
    level,
    rarity: 'passive',
    weight: WEIGHTS.passive,
  };
}

export interface Candidate extends UpgradeChoice {
  weight: number;
}

/** Every legal choice for this state. Used by the roller and by tests. */
export function candidatePool(state: SimState): Candidate[] {
  const out: Candidate[] = [];
  const weaponCount = state.weapons.length;

  for (const id of WEAPON_ORDER) {
    const def = WEAPONS[id];
    const owned = ownedWeapon(state, id);

    if (owned) {
      if (!owned.evolved && owned.level < WEAPON_MAX_LEVEL) {
        const next = owned.level + 1;
        out.push({
          id: `weapon:${id}`,
          kind: 'weapon',
          name: def.name,
          desc: `Level ${next}: +${Math.round(28 * next)}% damage. ${def.desc}`,
          weaponId: id,
          level: next,
          rarity: 'weapon',
          weight: WEIGHTS.weaponUpgrade,
        });
      } else if (canEvolve(state, id)) {
        out.push({
          id: `evo:${id}`,
          kind: 'evolution',
          name: def.evolvedName,
          desc: def.evolvedDesc,
          weaponId: id,
          level: WEAPON_MAX_LEVEL,
          rarity: 'evolution',
          weight: WEIGHTS.evolution,
        });
      }
    } else if (weaponCount < MAX_WEAPONS) {
      out.push({
        id: `weapon:${id}`,
        kind: 'weapon',
        name: def.name,
        desc: def.desc,
        weaponId: id,
        level: 1,
        rarity: 'new',
        weight: WEIGHTS.newWeapon,
      });
    }
  }

  for (const id of PASSIVE_ORDER) {
    const lvl = state.passives[id] ?? 0;
    if (lvl >= PASSIVE_MAX_LEVEL) continue;
    out.push(passiveChoice(id, lvl + 1));
  }

  return out;
}

/** Draw `count` distinct legal cards, weighted evolution > new weapon > weapon upgrade > passive. */
export function rollChoices(state: SimState, count = 3): UpgradeChoice[] {
  const pool: Candidate[] = candidatePool(state);
  const picks: UpgradeChoice[] = [];

  // Build agency: most level-ups contain at least one upgrade for a weapon the
  // player already owns, so a focused build can actually reach its evolution.
  const focus = pool.filter((c) => c.rarity === 'evolution' || c.rarity === 'weapon');
  const deepest = state.weapons.reduce((max, w) => Math.max(max, w.level), 0);
  if (focus.length > 0 && count > 0 && deepest >= 4 && nextFloat(state.rng) < 0.7) {
    const forced = pickWeighted(
      state.rng,
      focus.map((c) => ({ value: c, weight: c.weight })),
    );
    if (forced) {
      picks.push(toChoice(forced));
      pool.splice(pool.findIndex((c) => c.id === forced.id), 1);
    }
  }

  for (let i = picks.length; i < count && pool.length > 0; i++) {
    const picked = pickWeighted(
      state.rng,
      pool.map((c) => ({ value: c, weight: c.weight })),
    );
    if (!picked) break;
    picks.push(toChoice(picked));
    const idx = pool.findIndex((c) => c.id === picked.id);
    if (idx >= 0) pool.splice(idx, 1);
  }
  return picks;
}

export function applyChoice(state: SimState, choice: UpgradeChoice): void {
  if (choice.kind === 'evolution' && choice.weaponId) {
    const weapon = ownedWeapon(state, choice.weaponId);
    if (weapon && canEvolve(state, choice.weaponId)) {
      weapon.evolved = true;
      weapon.level = WEAPON_MAX_LEVEL;
      weapon.cooldown = 0.15;
      pushEvent(state, 'evolve', state.player.x, state.player.y, 0, WEAPONS[choice.weaponId].evolvedName);
    }
  } else if (choice.kind === 'weapon' && choice.weaponId) {
    const existing = ownedWeapon(state, choice.weaponId);
    if (existing) {
      existing.level = Math.min(WEAPON_MAX_LEVEL, existing.level + 1);
    } else if (state.weapons.length < MAX_WEAPONS) {
      state.weapons.push({ id: choice.weaponId, level: 1, evolved: false, cooldown: 0.4 });
    }
  } else if (choice.kind === 'passive' && choice.passiveId) {
    const current = state.passives[choice.passiveId] ?? 0;
    state.passives[choice.passiveId] = Math.min(PASSIVE_MAX_LEVEL, current + 1);
  }

  recomputeStats(state, true);
  state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
}

export function applyChoiceById(state: SimState, id: string, choices: UpgradeChoice[]): boolean {
  const choice = choices.find((c) => c.id === id);
  if (!choice) return false;
  applyChoice(state, choice);
  return true;
}