import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/sim/content';
import { dealDamage, spawnOrb, updateOrbs } from '../src/sim/combat';
import {
  BOSS_PARTS,
  BUS_RADIUS,
  CANISTER_SCRAP,
  CANISTER_SUPPLIES,
  ELITE_PARTS,
  FUEL_BOSS_VALUE,
  FUEL_DROP_CHANCE,
  FUEL_ELITE_VALUE,
  fuelQuotaFor,
  updateObjective,
} from '../src/sim/objective';
import { spawnEnemy } from '../src/sim/spawn';
import { CANISTER_FUEL, CANISTER_SHARE, WORLD, clearEvents, createRun, layoutMap } from '../src/sim/state';
import { stepRun } from '../src/sim/step';
import type { EnemyType, SimEventType, SimState } from '../src/sim/types';
import { runConfig } from './helpers';

const make = (seed = 5, depth = 1, over = {}) => createRun(runConfig(seed, depth, over));

function events(state: SimState, type: SimEventType): number {
  let n = 0;
  for (let i = 0; i < state.eventCount; i++) if (state.events[i].type === type) n++;
  return n;
}

function kill(state: SimState, type: EnemyType, elite = false): void {
  const e = spawnEnemy(state, type, 100, 100, elite);
  dealDamage(state, e, e.hp + 1, false);
}

describe('map layout', () => {
  it('is seeded: same seed and quota give the same canisters and bus, a new seed does not', () => {
    expect(layoutMap(7, 50)).toEqual(layoutMap(7, 50));
    expect(layoutMap(8, 50)).not.toEqual(layoutMap(7, 50));
  });

  it('keeps canisters a bonus: about CANISTER_SHARE of the quota, so kills carry the rest', () => {
    for (const depth of [1, 3, 5, 9]) {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const quota = fuelQuotaFor(depth);
        const { canisters } = layoutMap(seed, quota);
        const total = canisters.reduce((s, c) => s + c.fuel, 0);
        expect(total).toBeGreaterThanOrEqual(quota * CANISTER_SHARE);
        expect(total).toBeLessThanOrEqual(quota * CANISTER_SHARE + 2 * CANISTER_FUEL);
        expect(canisters.every((c) => c.fuel === CANISTER_FUEL)).toBe(true);
      }
    }
  });

  it('puts every other canister out on the border and away from the bus', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { bus, canisters } = layoutMap(seed, fuelQuotaFor(1));
      const risky = canisters.filter((c) => c.risky);
      expect(risky.length).toBe(Math.floor(canisters.length / 2));
      for (const c of risky) {
        const edge = Math.min(c.x, c.y, WORLD.w - c.x, WORLD.h - c.y);
        expect(edge).toBeLessThanOrEqual(150);
        expect(Math.hypot(c.x - bus.x, c.y - bus.y)).toBeGreaterThan(300);
      }
    }
  });

  it('keeps canisters and the bus inside the world, off the start and apart', () => {
    for (const seed of [11, 12, 13]) {
      const { bus, canisters } = layoutMap(seed, fuelQuotaFor(1));
      const cx = WORLD.w / 2;
      const cy = WORLD.h / 2;
      expect(Math.hypot(bus.x - cx, bus.y - cy)).toBeGreaterThan(300);
      for (const c of canisters) {
        expect(c.x).toBeGreaterThanOrEqual(60);
        expect(c.x).toBeLessThanOrEqual(WORLD.w - 60);
        expect(c.y).toBeGreaterThanOrEqual(60);
        expect(c.y).toBeLessThanOrEqual(WORLD.h - 60);
        expect(Math.hypot(c.x - cx, c.y - cy)).toBeGreaterThan(100);
      }
    }
  });

  it('keeps the bus fixed for the whole map', () => {
    const state = make(21);
    const { x, y } = state.bus;
    for (let i = 0; i < 600; i++) stepRun(state, 1 / 60, { x: 1, y: 0 });
    expect(state.bus).toEqual({ x, y });
  });
});

describe('fuel', () => {
  it('collects a canister inside the pickup radius and not outside it', () => {
    const state = make(5);
    const c = state.canisters[0];
    state.player.x = c.x + state.player.pickup + 20;
    state.player.y = c.y;
    updateObjective(state);
    expect(c.active).toBe(true);
    expect(state.fuel).toBe(0);
    state.player.x = c.x + state.player.pickup - 5;
    updateObjective(state);
    expect(c.active).toBe(false);
    expect(state.fuel).toBe(CANISTER_FUEL);
  });

  it('drops fuel from zombies at a per-type chance, tougher ones more often, and picking one up adds fuel', () => {
    const fresh = make(99);
    const n = 600;
    const dropsFor = (type: 'duva' | 'vaktmastare') => {
      const s = make(99);
      let got = 0;
      for (let i = 0; i < n; i++) {
        const before = s.orbs.filter((o) => o.kind === 'fuel' && o.active).length;
        kill(s, type);
        s.orbs = s.orbs.filter((o) => o.kind !== 'xp');
        got += s.orbs.filter((o) => o.kind === 'fuel' && o.active).length - before;
      }
      return got;
    };
    const weak = dropsFor('duva');
    const tough = dropsFor('vaktmastare');
    expect(weak).toBeGreaterThan(n * FUEL_DROP_CHANCE.duva * 0.5);
    expect(weak).toBeLessThan(n * FUEL_DROP_CHANCE.duva * 1.6);
    expect(tough).toBeGreaterThan(weak * 2);

    for (let i = 0; i < 100; i++) kill(fresh, 'duva');
    const orb = fresh.orbs.find((o) => o.kind === 'fuel')!;
    orb.x = fresh.player.x;
    orb.y = fresh.player.y;
    updateOrbs(fresh, 1 / 60);
    expect(orb.active).toBe(false);
    expect(fresh.fuel).toBe(orb.value);
  });

  it('always drops from elites (2) and bosses (10)', () => {
    const s = make(5);
    kill(s, 'fyllo', true);
    kill(s, 'nattvakt', true);
    const values = s.orbs.filter((o) => o.kind === 'fuel').map((o) => o.value);
    expect(values.sort((a, b) => a - b)).toEqual([FUEL_ELITE_VALUE, FUEL_BOSS_VALUE]);
  });

  it('rolls fuel drops on their own stream: the combat rng is unaffected by the roll', () => {
    const a = make(12);
    const b = make(12);
    kill(a, 'duva');
    kill(b, 'duva');
    expect(a.rng.state).toBe(b.rng.state);
    expect(a.dropRng.state).not.toBe(make(12).dropRng.state);
  });
});

describe('materials', () => {
  it('drops scrap from every kill, scaled by the multiplier', () => {
    const base = make(3);
    const rich = make(3, 1, { materialMultiplier: { scrap: 3, parts: 1, supplies: 1 } });
    kill(base, 'fyllo');
    kill(rich, 'fyllo');
    expect(base.materials.scrap).toBeCloseTo(ENEMIES.fyllo.change);
    expect(rich.materials.scrap).toBeCloseTo(ENEMIES.fyllo.change * 3);
    expect(base.materials.parts).toBe(0);
    expect(base.materials.supplies).toBe(0);
  });

  it('drops parts from elites and bosses, scaled by the multiplier', () => {
    const state = make(3, 1, { materialMultiplier: { scrap: 1, parts: 2, supplies: 1 } });
    kill(state, 'fyllo', true);
    expect(state.materials.parts).toBe(ELITE_PARTS * 2);
    kill(state, 'nattvakt', true);
    expect(state.materials.parts).toBe(ELITE_PARTS * 2 + BOSS_PARTS * 2);
  });

  it('gives scrap and supplies (and sometimes parts) per canister', () => {
    const state = make(8, 1, { materialMultiplier: { scrap: 1, parts: 1, supplies: 2 } });
    state.time = 500;
    for (const c of state.canisters) {
      state.player.x = c.x;
      state.player.y = c.y;
      updateObjective(state);
    }
    const n = state.canisters.length;
    expect(state.materials.scrap).toBe(CANISTER_SCRAP * n);
    expect(state.materials.supplies).toBe(CANISTER_SUPPLIES * 2 * n);
    expect(state.materials.parts).toBeGreaterThan(0);
    expect(state.materials.parts).toBeLessThan(n);
  });

  it('floors materials into the MapResult and counts kills', async () => {
    const { computeMapResult } = await import('../src/sim/state');
    const state = make(3);
    kill(state, 'fyllo');
    kill(state, 'duva');
    const r = computeMapResult(state);
    expect(r.materials).toEqual({ scrap: Math.floor(state.materials.scrap), parts: 0, supplies: 0 });
    expect(r.kills).toBe(2);
    expect(r.outcome).toBe('died');
  });
});

describe('extraction', () => {
  it('does nothing when the bus is touched before the quota is met', () => {
    const state = make(4);
    state.player.x = state.bus.x;
    state.player.y = state.bus.y;
    state.player.invuln = 99;
    stepRun(state, 1 / 60, { x: 0, y: 0 });
    expect(state.status).toBe('running');
    expect(state.quotaMet).toBe(false);
  });

  it('flips the quota flag and emits the horn once the fuel is in', () => {
    const state = make(4);
    state.fuel = state.config.map.fuelQuota - 1;
    clearEvents(state);
    updateObjective(state);
    expect(state.quotaMet).toBe(false);
    expect(events(state, 'horn')).toBe(0);
    state.fuel += 1;
    updateObjective(state);
    expect(state.quotaMet).toBe(true);
    expect(events(state, 'horn')).toBe(1);
    updateObjective(state);
    expect(events(state, 'horn')).toBe(1);
  });

  it('ends the map as extracted when the bus is touched after the quota', () => {
    const state = make(4);
    state.fuel = state.config.map.fuelQuota;
    state.player.invuln = 99;
    state.player.x = state.bus.x + BUS_RADIUS;
    state.player.y = state.bus.y;
    clearEvents(state);
    stepRun(state, 1 / 60, { x: 0, y: 0 });
    expect(state.quotaMet).toBe(true);
    expect(state.status).toBe('extracted');
    expect(events(state, 'win')).toBe(1);
  });

  it('does not extract from a bus that is still out of reach', () => {
    const state = make(4);
    state.fuel = state.config.map.fuelQuota;
    state.player.invuln = 99;
    state.player.x = state.bus.x + BUS_RADIUS + 200;
    state.player.y = state.bus.y;
    stepRun(state, 1 / 60, { x: 0, y: 0 });
    expect(state.quotaMet).toBe(true);
    expect(state.status).toBe('running');
  });

  it('spawnOrb on the drop stream leaves the combat stream alone', () => {
    const a = make(2);
    const b = make(2);
    spawnOrb(a, 1, 1, 1, 'fuel', a.dropRng);
    expect(a.rng.state).toBe(b.rng.state);
  });
});
