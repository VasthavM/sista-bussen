import { describe, expect, it } from 'vitest';
import { WEAPON_ORDER } from '../src/sim/content';
import { fuelQuotaFor } from '../src/sim/objective';
import { createRun } from '../src/sim/state';
import { stepRun } from '../src/sim/step';
import { applyChoice, rollChoices } from '../src/sim/upgrades';
import { botInput, makePolicy, runConfigSync, simulateMap, type BalanceConfig } from '../tools/balance-lib';
import { runConfig } from './helpers';

const CFG: BalanceConfig = {
  depth: 2,
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
    expect(a.extractRate).toBeGreaterThanOrEqual(0);
    expect(a.extractRate).toBeLessThanOrEqual(1);
    expect(a.quotaRate).toBeGreaterThanOrEqual(a.extractRate);
    expect(a.config.quota).toBe(fuelQuotaFor(2));
    expect(a.endTime.p10).toBeLessThanOrEqual(a.endTime.median);
    expect(a.endTime.median).toBeLessThanOrEqual(a.endTime.p90);
    expect(a.peakEnemies.max).toBeLessThanOrEqual(180);
    expect(a.timeToQuota).toHaveProperty('median');
    expect(a.timeToExtract).toHaveProperty('median');
    expect(a.levelAtExtract).toHaveProperty('median');
    expect(Object.keys(a.weapons).sort()).toEqual([...WEAPON_ORDER].sort());
    let share = 0;
    for (const w of Object.values(a.weapons)) {
      expect(w).toHaveProperty('evolutionRate');
      share += w.damageShare;
    }
    expect(share).toBeCloseTo(1, 2);
  });

  it('different seeds differ, different depths differ', () => {
    const base = simulateMap(CFG, 1);
    expect(simulateMap(CFG, 1)).toEqual(base);
    expect(simulateMap(CFG, 2)).not.toEqual(base);
    expect(simulateMap({ ...CFG, depth: 5 }, 1)).not.toEqual(base);
  });

  it('damage attribution does not perturb the sim and never books damage to a weapon the run did not own', () => {
    for (const seed of [3, 4, 5]) {
      const r = simulateMap({ ...CFG, policy: 'greedy' }, seed);

      // Same map, plain loop with no instrumentation.
      const state = createRun({ ...runConfig(seed, CFG.depth), weapon: CFG.weapon });
      const policy = makePolicy('greedy', CFG.weapon, seed);
      while (state.status === 'running' && state.time < 900) {
        stepRun(state, 1 / 60, botInput(state));
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
