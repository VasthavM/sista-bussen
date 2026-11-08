import { describe, expect, it } from 'vitest';
import { WEAPON_ORDER } from '../src/sim/content';
import { RUN_DURATION } from '../src/sim/curve';
import { createRun } from '../src/sim/state';
import { stepRun } from '../src/sim/step';
import { applyChoice, rollChoices } from '../src/sim/upgrades';
import { EMPTY_MODS } from '../src/sim/types';
import { kiteInput, makePolicy, runConfigSync, simulateNight, type BalanceConfig } from '../tools/balance-lib';

const CFG: BalanceConfig = {
  night: 2,
  character: 'nattvandraren',
  weapon: 'korv',
  policy: 'rush',
  mods: {},
  n: 5,
  baseSeed: 77,
};

describe('balance harness', () => {
  it('reports the agreed shape and is deterministic for N=5', () => {
    const a = runConfigSync(CFG);
    const b = runConfigSync(CFG);
    expect(b).toEqual(a);

    expect(a.runs).toBe(5);
    expect(a.config.policy).toBe('rush:korv');
    expect(a.winRate).toBeGreaterThanOrEqual(0);
    expect(a.winRate).toBeLessThanOrEqual(1);
    expect(a.endTime.p10).toBeLessThanOrEqual(a.endTime.median);
    expect(a.endTime.median).toBeLessThanOrEqual(a.endTime.p90);
    expect(a.endTime.p90).toBeLessThanOrEqual(RUN_DURATION);
    expect(a.peakEnemies.max).toBeLessThanOrEqual(180);
    expect(a.levelAt0300).toHaveProperty('median');
    expect(Object.keys(a.weapons).sort()).toEqual([...WEAPON_ORDER].sort());
    let share = 0;
    for (const w of Object.values(a.weapons)) {
      expect(w).toHaveProperty('evolutionRate');
      share += w.damageShare;
    }
    expect(share).toBeCloseTo(1, 2);
  });

  it('different seeds differ, different nights differ', () => {
    const base = simulateNight(CFG, 1);
    expect(simulateNight(CFG, 1)).toEqual(base);
    expect(simulateNight(CFG, 2)).not.toEqual(base);
    expect(simulateNight({ ...CFG, night: 5 }, 1)).not.toEqual(base);
  });

  it('damage attribution does not perturb the sim and never books damage to a weapon the run did not own', () => {
    for (const seed of [3, 4, 5]) {
      const r = simulateNight({ ...CFG, policy: 'greedy' }, seed);

      // Same night, plain loop with no instrumentation.
      const state = createRun({ seed, night: CFG.night, character: CFG.character, weapon: CFG.weapon, mods: { ...EMPTY_MODS } });
      const policy = makePolicy('greedy', CFG.weapon, seed);
      while (state.status === 'running') {
        stepRun(state, 1 / 60, kiteInput(state));
        while (state.pendingLevelUps > 0) applyChoice(state, policy(state, rollChoices(state, 3)));
      }
      expect(r.kills).toBe(state.kills);
      expect(r.finalLevel).toBe(state.level);
      expect(r.damageDealt).toBeCloseTo(state.damageDealt, 6);

      const booked = Object.values(r.damage).reduce((a, b) => a + b, 0);
      expect(booked).toBeCloseTo(r.damageDealt, 6);
      for (const id of Object.keys(r.damage)) expect(r.owned).toContain(id);
    }
  });
});
