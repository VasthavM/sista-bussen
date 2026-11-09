import { describe, expect, it } from 'vitest';

import { currentOptions, createRoute, generateSegment, SEGMENT_LENGTH, STOP_TABLE } from '../src/meta/route';
import { fuelQuotaFor } from '../src/sim/objective';
import { addMaterials, elapsedLabel, mapConfigFor, stopInSegment } from '../src/flow';

const ROUTE_SEED = 20261110;

describe('mapConfigFor', () => {
  it('uses the sim quota formula scaled by the stop, not the route placeholder', () => {
    const route = createRoute(ROUTE_SEED);
    for (const option of currentOptions(route, ROUTE_SEED)) {
      const config = mapConfigFor(option, 1, ROUTE_SEED);
      expect(config.fuelQuota).toBe(Math.max(1, Math.round(fuelQuotaFor(1) * STOP_TABLE[option.type].quota)));
      expect(config.depth).toBe(1);
    }
    const street = { type: 'street', danger: 1, rewardHint: 'scrap' } as const;
    expect(mapConfigFor(street, 7, ROUTE_SEED).fuelQuota).toBe(fuelQuotaFor(7));
  });

  it('plays a boss stop as a horde stop until the boss ticket, keeping the boss row numbers', () => {
    const boss = generateSegment(ROUTE_SEED, 0).layers[SEGMENT_LENGTH - 1][0];
    expect(boss.type).toBe('boss');
    const config = mapConfigFor(boss, SEGMENT_LENGTH, ROUTE_SEED);
    expect(config.stop).toBe('horde');
    expect(config.materialMultiplier).toEqual(STOP_TABLE.boss.materials);
    expect(config.densityMultiplier).toBeGreaterThan(STOP_TABLE.horde.density);
  });

  it('never builds a safe stop', () => {
    expect(() => mapConfigFor({ type: 'safe', danger: 1, rewardHint: 'supplies' }, 3, ROUTE_SEED)).toThrow();
  });

  it('is deterministic: a retry after death replays the same map', () => {
    const option = currentOptions(createRoute(ROUTE_SEED), ROUTE_SEED)[0];
    expect(mapConfigFor(option, 1, ROUTE_SEED)).toEqual(mapConfigFor(option, 1, ROUTE_SEED));
  });
});

describe('stopInSegment', () => {
  it('counts 1..10 inside each segment', () => {
    expect([1, 4, 10, 11, 20, 21].map(stopInSegment)).toEqual([1, 4, 10, 1, 10, 1]);
  });
});

describe('addMaterials', () => {
  it('adds per material without touching the inputs', () => {
    const a = { scrap: 1, parts: 2, supplies: 3 };
    const b = { scrap: 10, parts: 0, supplies: 5 };
    expect(addMaterials(a, b)).toEqual({ scrap: 11, parts: 2, supplies: 8 });
    expect(a).toEqual({ scrap: 1, parts: 2, supplies: 3 });
  });
});

describe('elapsedLabel', () => {
  it('formats m:ss and floors', () => {
    expect([0, 9.9, 65, 600, -3].map(elapsedLabel)).toEqual(['0:00', '0:09', '1:05', '10:00', '0:00']);
  });
});
