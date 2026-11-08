import { describe, expect, it } from 'vitest';
import { stepRun } from '../src/sim/step';
import { applyChoice, rollChoices } from '../src/sim/upgrades';
import { createRun, computeMapResult } from '../src/sim/state';
import type { SimState } from '../src/sim/types';
import { botInput, makePolicy } from '../tools/balance-lib';
import { runConfig } from './helpers';

const DT = 1 / 60;

function makeRun(seed: number, weapon: 'nyckel' | 'ficklampa' = 'nyckel'): SimState {
  return createRun({ ...runConfig(seed), weapon });
}

/** A player taking the best card on offer for the starting weapon (the harness' rush policy). */
function autoPick(state: SimState, policy: ReturnType<typeof makePolicy>): void {
  while (state.pendingLevelUps > 0) {
    const choices = rollChoices(state, 3);
    if (choices.length === 0) {
      state.pendingLevelUps = 0;
      break;
    }
    applyChoice(state, policy(state, choices));
  }
}

function hashState(state: SimState): string {
  return [
    state.time.toFixed(3),
    state.status,
    state.player.x.toFixed(2),
    state.player.y.toFixed(2),
    state.player.hp.toFixed(2),
    state.level,
    state.kills,
    Math.round(state.change * 100),
    state.fuel,
    state.enemies.length,
    state.weapons.map((w) => `${w.id}:${w.level}:${w.evolved ? 1 : 0}`).join(','),
    Object.entries(state.passives)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(','),
  ].join('|');
}

/** Play a map with the objective bot until it ends or `limit` seconds pass. */
function play(state: SimState, limit: number): SimState {
  const policy = makePolicy('rush', state.weapons[0].id, state.runSeed);
  while (state.status === 'running' && state.time < limit) {
    stepRun(state, DT, botInput(state));
    autoPick(state, policy);
  }
  return state;
}

function stand(state: SimState, seconds: number): SimState {
  const steps = Math.ceil(seconds / DT);
  for (let i = 0; i < steps && state.status === 'running'; i++) stepRun(state, DT, { x: 0, y: 0 });
  return state;
}

describe('deterministic run', () => {
  it('produces an identical state for identical map config and inputs', () => {
    const a = play(makeRun(4242), 60);
    const b = play(makeRun(4242), 60);
    expect(hashState(a)).toBe(hashState(b));
    expect(a.kills).toBeGreaterThan(0);
    expect(a.time).toBeCloseTo(60, 1);
  });

  it('diverges when the map seed changes', () => {
    expect(hashState(play(makeRun(1), 60))).not.toBe(hashState(play(makeRun(2), 60)));
  });

  it('advances the sim and levels up during a real run', () => {
    const state = play(makeRun(777), 120);
    expect(state.time).toBeGreaterThan(118);
    expect(state.kills).toBeGreaterThan(30);
    expect(state.level).toBeGreaterThan(3);
    expect(state.enemies.length).toBeGreaterThan(0);
  });

  it('same MapConfig, same MapResult', () => {
    const a = computeMapResult(play(makeRun(31), 900));
    const b = computeMapResult(play(makeRun(31), 900));
    expect(a).toEqual(b);
    expect(['extracted', 'died']).toContain(a.outcome);
  });
});

describe('depth 1 street map', () => {
  // Seed picked once: Ficklampa is the strongest starter (50% night 1 win rate), so some seed in a
  // handful extracts; the sim is deterministic, so this stays true until the balance changes.
  const SEEDS = [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007];

  it('is extractable: the bot meets the quota and reaches the bus', () => {
    const extracted = SEEDS.map((seed) => play(makeRun(seed, 'ficklampa'), 900)).filter((s) => s.status === 'extracted');
    expect(extracted.length).toBeGreaterThan(0);
    const state = extracted[0];
    const result = computeMapResult(state);
    expect(result.outcome).toBe('extracted');
    expect(result.fuelCollected).toBeGreaterThanOrEqual(state.config.map.fuelQuota);
    expect(state.quotaMet).toBe(true);
    expect(result.kills).toBeGreaterThan(100);
    // Past the old 03:00 mark is allowed: there is no hard end any more.
    expect(result.time).toBeGreaterThan(60);
  });

  it('dies without input, with outcome died and no extraction', () => {
    const state = stand(makeRun(2024), 120);
    expect(state.status).toBe('dead');
    expect(state.player.hp).toBe(0);
    expect(computeMapResult(state).outcome).toBe('died');
  });

  it('never exceeds the live enemy cap and has no hard end', () => {
    const state = play(makeRun(31), 300);
    expect(state.enemies.length).toBeLessThanOrEqual(180);
    expect(state.spawn.totalSpawned).toBeGreaterThan(200);
    // 03:00 used to win the night. Now the run is still going or the player died.
    expect(state.status === 'running' || state.status === 'dead' || state.status === 'extracted').toBe(true);
  });

  it('resets card levels every map', () => {
    const first = makeRun(9);
    first.pendingLevelUps = 0;
    play(first, 60);
    expect(first.level).toBeGreaterThan(1);
    const second = makeRun(9);
    expect(second.level).toBe(1);
    expect(second.weapons).toHaveLength(1);
    expect(second.weapons[0].level).toBe(1);
    expect(second.passives).toEqual({});
  });
});
