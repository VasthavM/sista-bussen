import { describe, expect, it } from 'vitest';
import {
  PASSIVE_MAX_LEVEL,
  UNLOCKED_EVOLUTION_PASSIVE_LEVEL,
  UNLOCKED_EVOLUTION_WEAPON_LEVEL,
  WEAPON_MAX_LEVEL,
  applyChoice,
  canEvolve,
  candidatePool,
  rollChoices,
} from '../src/sim/upgrades';
import { createRun } from '../src/sim/state';
import { WEAPONS } from '../src/sim/content';
import type { SimState, WeaponId } from '../src/sim/types';
import { runConfig } from './helpers';

function makeState(seed = 7): SimState {
  return createRun(runConfig(seed));
}

describe('upgrade pool legality', () => {
  it('starts with no evolution cards, only real upgrades', () => {
    const state = makeState();
    const pool = candidatePool(state);
    expect(pool.some((c) => c.kind === 'evolution')).toBe(false);
    expect(pool.find((c) => c.id === 'weapon:nyckel')?.rarity).toBe('weapon');
    expect(pool.find((c) => c.id === 'weapon:korv')?.rarity).toBe('new');
    expect(pool.some((c) => c.id === 'passive:handskar')).toBe(true);
  });

  it('never offers a weapon upgrade for a maxed weapon', () => {
    const state = makeState();
    state.weapons[0].level = WEAPON_MAX_LEVEL;
    const pool = candidatePool(state);
    expect(pool.some((c) => c.id === 'weapon:nyckel')).toBe(false);
    // No passive at 3 yet, so the evolution is also legal-free.
    expect(pool.some((c) => c.id === 'evo:nyckel')).toBe(false);
    expect(canEvolve(state, 'nyckel')).toBe(false);
  });

  it('offers the evolution exactly when base weapon is maxed and the named passive is 3+', () => {
    const state = makeState();
    state.weapons[0].level = WEAPON_MAX_LEVEL;
    state.passives[WEAPONS.nyckel.passive] = 2;
    expect(canEvolve(state, 'nyckel')).toBe(false);
    expect(candidatePool(state).some((c) => c.id === 'evo:nyckel')).toBe(false);

    state.passives[WEAPONS.nyckel.passive] = 3;
    expect(canEvolve(state, 'nyckel')).toBe(true);
    const evolution = candidatePool(state).find((c) => c.id === 'evo:nyckel');
    expect(evolution).toBeDefined();
    expect(evolution?.name).toBe('Wrecking Chain');
    expect(evolution?.rarity).toBe('evolution');
  });

  it('weights evolutions above new weapons, weapon upgrades and passives', () => {
    const state = makeState();
    state.weapons[0].level = WEAPON_MAX_LEVEL;
    state.weapons.push({ id: 'korv', level: 2, evolved: false, cooldown: 0 });
    state.passives.handskar = 3;
    const pool = candidatePool(state);
    const evo = pool.find((c) => c.kind === 'evolution')!;
    const newWeapon = pool.find((c) => c.rarity === 'new')!;
    const weaponUpgrade = pool.find((c) => c.rarity === 'weapon')!;
    const passive = pool.find((c) => c.rarity === 'passive')!;
    expect(evo.weight).toBeGreaterThan(newWeapon.weight);
    expect(newWeapon.weight).toBeLessThan(weaponUpgrade.weight);
    expect(passive.weight).toBeLessThan(weaponUpgrade.weight);
  });

  it('drops passives once they hit level 5', () => {
    const state = makeState();
    state.passives.handskar = PASSIVE_MAX_LEVEL;
    expect(candidatePool(state).some((c) => c.id === 'passive:handskar')).toBe(false);
  });

  it('rolls three distinct, legal cards', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = makeState(seed);
      const choices = rollChoices(state, 3);
      expect(choices).toHaveLength(3);
      expect(new Set(choices.map((c) => c.id)).size).toBe(3);
      for (const choice of choices) {
        expect(choice.name.length).toBeGreaterThan(0);
        expect(choice.desc.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('evolution rules', () => {
  it('applying an evolution marks the weapon evolved and keeps level 8', () => {
    const state = makeState();
    state.weapons[0].level = WEAPON_MAX_LEVEL;
    state.passives.handskar = 3;
    const evo = candidatePool(state).find((c) => c.id === 'evo:nyckel')!;
    state.pendingLevelUps = 1;
    applyChoice(state, evo);
    expect(state.weapons[0].evolved).toBe(true);
    expect(state.weapons[0].level).toBe(WEAPON_MAX_LEVEL);
    expect(state.pendingLevelUps).toBe(0);
    const pool = candidatePool(state);
    expect(pool.some((c) => c.id === 'evo:nyckel')).toBe(false);
    expect(pool.some((c) => c.id === 'weapon:nyckel')).toBe(false);
  });

  it('refuses an evolution whose passive requirement is missing', () => {
    const state = makeState();
    state.weapons[0].level = WEAPON_MAX_LEVEL;
    state.passives.handskar = 2;
    state.pendingLevelUps = 1;
    applyChoice(state, {
      id: 'evo:nyckel',
      kind: 'evolution',
      name: 'Huvudnyckeln',
      desc: 'Wider orbit.',
      weaponId: 'nyckel',
      level: WEAPON_MAX_LEVEL,
      rarity: 'evolution',
    });
    expect(state.weapons[0].evolved).toBe(false);
    expect(state.weapons[0].level).toBe(WEAPON_MAX_LEVEL);
    expect(state.pendingLevelUps).toBe(0);
  });

  it('adds a new weapon when chosen and upgrades it afterwards', () => {
    const state = makeState();
    const newWeapon = candidatePool(state).find((c) => c.id === 'weapon:korv')!;
    state.pendingLevelUps = 2;
    applyChoice(state, newWeapon);
    expect(state.weapons.find((w) => w.id === 'korv')?.level).toBe(1);
    const upgrade = candidatePool(state).find((c) => c.id === 'weapon:korv')!;
    applyChoice(state, upgrade);
    expect(state.weapons.find((w) => w.id === 'korv')?.level).toBe(2);
  });
});
describe('early evolution unlock', () => {
  function unlocked(weapons: WeaponId[]): SimState {
    const cfg = runConfig(7);
    cfg.mods = { ...cfg.mods, evolutionUnlocks: weapons };
    return createRun(cfg);
  }

  it('evolves at weapon level 5 and passive level 2 for an unlocked weapon', () => {
    const state = unlocked(['nyckel']);
    state.weapons[0].level = UNLOCKED_EVOLUTION_WEAPON_LEVEL;
    state.passives.handskar = UNLOCKED_EVOLUTION_PASSIVE_LEVEL;
    expect(canEvolve(state, 'nyckel')).toBe(true);
    const pool = candidatePool(state);
    expect(pool.some((c) => c.id === 'evo:nyckel')).toBe(true);
    // The next weapon level is still on offer beside the evolution.
    expect(pool.some((c) => c.id === 'weapon:nyckel')).toBe(true);
  });

  it('still needs both thresholds', () => {
    const state = unlocked(['nyckel']);
    state.weapons[0].level = UNLOCKED_EVOLUTION_WEAPON_LEVEL - 1;
    state.passives.handskar = UNLOCKED_EVOLUTION_PASSIVE_LEVEL;
    expect(canEvolve(state, 'nyckel')).toBe(false);
    state.weapons[0].level = UNLOCKED_EVOLUTION_WEAPON_LEVEL;
    state.passives.handskar = UNLOCKED_EVOLUTION_PASSIVE_LEVEL - 1;
    expect(canEvolve(state, 'nyckel')).toBe(false);
  });

  it('keeps the old rule for a weapon that is not unlocked', () => {
    const state = unlocked(['korv']);
    state.weapons[0].level = UNLOCKED_EVOLUTION_WEAPON_LEVEL;
    state.passives.handskar = UNLOCKED_EVOLUTION_PASSIVE_LEVEL;
    expect(canEvolve(state, 'nyckel')).toBe(false);
    state.weapons[0].level = WEAPON_MAX_LEVEL;
    state.passives.handskar = 3;
    expect(canEvolve(state, 'nyckel')).toBe(true);
  });

  it('applies an early evolution and removes its card', () => {
    const state = unlocked(['nyckel']);
    state.weapons[0].level = UNLOCKED_EVOLUTION_WEAPON_LEVEL;
    state.passives.handskar = UNLOCKED_EVOLUTION_PASSIVE_LEVEL;
    state.pendingLevelUps = 1;
    applyChoice(state, candidatePool(state).find((c) => c.id === 'evo:nyckel')!);
    expect(state.weapons[0].evolved).toBe(true);
    expect(candidatePool(state).some((c) => c.id === 'evo:nyckel')).toBe(false);
  });
});

describe('early evolution path in rolls', () => {
  const pathIds = ['weapon:nyckel', 'passive:handskar'];
  const share = (weapons: WeaponId[]) => {
    let hits = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const cfg = runConfig(seed);
      cfg.mods = { ...cfg.mods, evolutionUnlocks: weapons };
      const state = createRun(cfg);
      if (rollChoices(state, 3).some((c) => pathIds.includes(c.id))) hits++;
    }
    return hits / 300;
  };

  it('shows more path cards for an unlocked weapon than without the unlock', () => {
    expect(share(['nyckel'])).toBeGreaterThan(share([]) + 0.1);
  });

  it('never offers an illegal card for an unlocked weapon', () => {
    const cfg = runConfig(3);
    cfg.mods = { ...cfg.mods, evolutionUnlocks: ['nyckel'] };
    for (let i = 0; i < 50; i++) {
      const state = createRun(cfg);
      const legal = new Set(candidatePool(state).map((c) => c.id));
      for (const c of rollChoices(state, 3)) expect(legal.has(c.id)).toBe(true);
    }
  });
});
