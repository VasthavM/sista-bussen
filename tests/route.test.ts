import { describe, expect, it } from 'vitest';
import type { MapResult, Materials, StopType } from '../src/sim/map';
import {
  SAFE_GRANT,
  SEGMENT_LENGTH,
  STOP_TABLE,
  applyMapResult,
  buildMapConfig,
  createRoute,
  currentOptions,
  generateSegment,
  resolveSafeStop,
  type StopOption,
} from '../src/meta/route';

const SEEDS = 1000;
const NONE: Materials = { scrap: 0, parts: 0, supplies: 0 };

function died(): MapResult {
  return { outcome: 'died', time: 90, fuelCollected: 3, materials: { scrap: 50, parts: 5, supplies: 5 }, kills: 40 };
}
function extracted(materials: Materials = { scrap: 10, parts: 2, supplies: 1 }): MapResult {
  return { outcome: 'extracted', time: 200, fuelCollected: 12, materials, kills: 90 };
}

describe('segment generator invariants (1000 seeds)', () => {
  it('has 10 layers, 2-4 options on every non-boss layer, boss alone on layer 10', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const seg = generateSegment(seed * 7919, seed % 4);
      expect(seg.layers).toHaveLength(SEGMENT_LENGTH);
      seg.layers.slice(0, 9).forEach((layer) => {
        expect(layer.length).toBeGreaterThanOrEqual(2);
        expect(layer.length).toBeLessThanOrEqual(4);
        expect(layer.some((o) => o.type === 'boss')).toBe(false);
        expect(layer.some((o) => o.type !== 'safe')).toBe(true);
        for (const o of layer) {
          expect([1, 2, 3]).toContain(o.danger);
          expect(['scrap', 'parts', 'supplies', 'fuel']).toContain(o.rewardHint);
        }
      });
      expect(seg.layers[9]).toHaveLength(1);
      expect(seg.layers[9][0].type).toBe('boss');
    }
  });

  it('puts at most one safe stop per segment, never on map 1 or 10', () => {
    let withSafe = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const seg = generateSegment(seed * 104729, seed % 3);
      const safeAt = seg.layers.flatMap((layer, i) => layer.filter((o) => o.type === 'safe').map(() => i + 1));
      expect(safeAt.length).toBeLessThanOrEqual(1);
      if (safeAt.length === 1) {
        withSafe++;
        expect(safeAt[0]).toBeGreaterThan(1);
        expect(safeAt[0]).toBeLessThan(10);
      }
    }
    expect(withSafe).toBeGreaterThan(0);
  });

  it('lists a stop type at most once per layer', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const layer of generateSegment(seed, 0).layers) {
        expect(new Set(layer.map((o) => o.type)).size).toBe(layer.length);
      }
    }
  });

  it('mixes types as designed: street > each resource stop > horde', () => {
    const counts = new Map<StopType, number>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const layer of generateSegment(seed * 31, 0).layers.slice(0, 9)) {
        for (const o of layer) counts.set(o.type, (counts.get(o.type) ?? 0) + 1);
      }
    }
    const n = (t: StopType) => counts.get(t) ?? 0;
    const resources: StopType[] = ['gas_station', 'scrapyard', 'pharmacy', 'depot'];
    for (const r of resources) {
      expect(n('street')).toBeGreaterThan(n(r));
      expect(n(r)).toBeGreaterThan(n('horde'));
    }
    expect(n('horde')).toBeGreaterThan(0);
  });

  it('is deterministic and differs across seeds and segments', () => {
    expect(generateSegment(1234, 2)).toEqual(generateSegment(1234, 2));
    expect(generateSegment(1234, 2)).not.toEqual(generateSegment(1234, 3));
    expect(generateSegment(1234, 2)).not.toEqual(generateSegment(4321, 2));
  });
});

describe('map config builder', () => {
  const street: StopOption = { type: 'street', danger: 1, rewardHint: 'scrap' };

  it('derives a stable seed from route seed and depth', () => {
    const a = buildMapConfig(street, 3, 99);
    expect(buildMapConfig(street, 3, 99).seed).toBe(a.seed);
    expect(buildMapConfig(street, 4, 99).seed).not.toBe(a.seed);
    expect(buildMapConfig(street, 3, 100).seed).not.toBe(a.seed);
    expect(a.depth).toBe(3);
    expect(a.stop).toBe('street');
  });

  it('takes quota and multipliers from the stop table and a swappable base quota', () => {
    const base = (depth: number) => 100 + depth;
    const gas = buildMapConfig({ type: 'gas_station', danger: 1, rewardHint: 'fuel' }, 5, 1, base);
    expect(gas.fuelQuota).toBe(Math.round(105 * STOP_TABLE.gas_station.quota));
    expect(gas.fuelQuota).toBeLessThan(buildMapConfig(street, 5, 1, base).fuelQuota);
    const yard = buildMapConfig({ type: 'scrapyard', danger: 1, rewardHint: 'scrap' }, 5, 1);
    expect(yard.materialMultiplier).toEqual(STOP_TABLE.scrapyard.materials);
    expect(yard.materialMultiplier.scrap).toBeGreaterThan(yard.materialMultiplier.parts);
    const horde = buildMapConfig({ type: 'horde', danger: 3, rewardHint: 'scrap' }, 5, 1);
    expect(horde.densityMultiplier).toBeGreaterThan(1);
  });

  it('refuses safe stops: they never reach the sim', () => {
    expect(() => buildMapConfig({ type: 'safe', danger: 1, rewardHint: 'supplies' }, 3, 1)).toThrow();
  });

  it('scales quota with depth', () => {
    expect(buildMapConfig(street, 30, 1).fuelQuota).toBeGreaterThan(buildMapConfig(street, 1, 1).fuelQuota);
  });
});

describe('route state transitions', () => {
  it('starts at depth 1 with checkpoint 0 and the segment-0 seed', () => {
    const r = createRoute(555);
    expect(r).toMatchObject({ depth: 1, checkpoint: 0, path: [], bestDepth: 0 });
    expect(r.segmentSeed).toBe(generateSegment(555, 0).seed);
    expect(currentOptions(r, 555)).toEqual(generateSegment(555, 0).layers[0]);
  });

  it('advances one stop on extraction, records the choice and banks materials', () => {
    const r0 = createRoute(7);
    const up = applyMapResult(r0, NONE, 7, 1, extracted());
    expect(up.route.depth).toBe(2);
    expect(up.route.path).toEqual([1]);
    expect(up.route.bestDepth).toBe(1);
    expect(up.materials).toEqual({ scrap: 10, parts: 2, supplies: 1 });
    expect(r0.depth).toBe(1); // input untouched
    expect(currentOptions(up.route, 7)).toEqual(generateSegment(7, 0).layers[1]);
  });

  it('on death resets to the last checkpoint, keeps banked and loses the failed map haul', () => {
    let up = { route: createRoute(7), materials: NONE };
    for (let i = 0; i < 4; i++) up = applyMapResult(up.route, up.materials, 7, 0, extracted({ scrap: 5, parts: 0, supplies: 0 }));
    expect(up.route.depth).toBe(5);
    const after = applyMapResult(up.route, up.materials, 7, 0, died());
    expect(after.route.depth).toBe(1);
    expect(after.route.checkpoint).toBe(0);
    expect(after.route.path).toEqual([]);
    expect(after.route.bestDepth).toBe(4);
    expect(after.materials).toEqual({ scrap: 20, parts: 0, supplies: 0 });
  });

  it('clearing the boss sets a new checkpoint and opens the next segment', () => {
    let up = { route: createRoute(7), materials: NONE };
    for (let i = 0; i < 10; i++) up = applyMapResult(up.route, up.materials, 7, 0, extracted());
    expect(up.route.depth).toBe(11);
    expect(up.route.checkpoint).toBe(10);
    expect(up.route.path).toEqual([]);
    expect(up.route.segmentSeed).toBe(generateSegment(7, 1).seed);
    expect(currentOptions(up.route, 7)).toEqual(generateSegment(7, 1).layers[0]);
    // dying in segment 2 returns to map 11, not map 1
    for (let i = 0; i < 3; i++) up = applyMapResult(up.route, up.materials, 7, 0, extracted());
    const dead = applyMapResult(up.route, up.materials, 7, 0, died());
    expect(dead.route.depth).toBe(11);
    expect(dead.route.checkpoint).toBe(10);
    expect(dead.route.bestDepth).toBe(13);
  });

  it('dying on the boss keeps the previous checkpoint', () => {
    let up = { route: createRoute(7), materials: NONE };
    for (let i = 0; i < 9; i++) up = applyMapResult(up.route, up.materials, 7, 0, extracted());
    expect(up.route.depth).toBe(10);
    const dead = applyMapResult(up.route, up.materials, 7, 0, died());
    expect(dead.route.depth).toBe(1);
    expect(dead.route.checkpoint).toBe(0);
  });

  it('rejects an out-of-range choice', () => {
    expect(() => applyMapResult(createRoute(7), NONE, 7, 4, extracted())).toThrow();
    expect(() => applyMapResult(createRoute(7), NONE, 7, -1, extracted())).toThrow();
  });

  it('resolves a safe stop without the sim: fixed grant, one stop forward', () => {
    let seed = 1;
    let layer = -1;
    let idx = -1;
    for (; seed < 500 && idx < 0; seed++) {
      const seg = generateSegment(seed, 0);
      layer = seg.layers.findIndex((l) => l.some((o) => o.type === 'safe'));
      if (layer >= 0) idx = seg.layers[layer].findIndex((o) => o.type === 'safe');
    }
    seed -= 1;
    let up = { route: createRoute(seed), materials: NONE };
    for (let i = 0; i < layer; i++) up = applyMapResult(up.route, up.materials, seed, 0, extracted(NONE));
    const safe = resolveSafeStop(up.route, up.materials, seed, idx);
    expect(safe.route.depth).toBe(layer + 2);
    expect(safe.route.path).toEqual([...up.route.path, idx]);
    expect(safe.materials).toEqual(SAFE_GRANT);
    const notSafe = idx === 0 ? 1 : 0;
    expect(() => resolveSafeStop(up.route, up.materials, seed, notSafe)).toThrow();
  });
});
