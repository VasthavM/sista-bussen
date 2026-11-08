import { describe, expect, it } from 'vitest';
import {
  PASSIVE_MAX_LEVEL,
  WEAPON_MAX_LEVEL,
  applyChoice,
  canEvolve,
  candidatePool,
  rollChoices,
} from '../src/sim/upgrades';
import { createRun } from '../src/sim/state';
import { WEAPONS } from '../src/sim/content';
import type { SimState } from '../src/sim/types';
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
    expect(evolution?.name).toBe('Huvudnyckeln');
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
      desc: 'Större omloppsbana.',
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