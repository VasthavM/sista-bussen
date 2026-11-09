import { describe, expect, it } from 'vitest';
import { applyRunOutcome, type Payout } from '../src/meta/economy';
import { applyMapResult, createRoute } from '../src/meta/route';
import { createFreshProfile } from '../src/meta/save';
import gameSource from '../src/game.ts?raw';
import type { RunResult } from '../src/sim/types';
import type { MapResult } from '../src/sim/map';

// Mirrors what Game does at the end of a map: settleMap() banks the haul when the summary opens,
// finalizeRun() runs the counters with a zero payout when the summary closes.
const ZERO: Payout = { change: 0, doubledChange: 0, tickets: 0, nightBonus: 0, total: 0, multiplier: 1 };

const haul = { scrap: 37, parts: 5, supplies: 2 };
const extracted: MapResult = { outcome: 'extracted', time: 200, fuelCollected: 100, materials: haul, kills: 80 };
const runResult: RunResult = {
  won: true,
  night: 1,
  time: 200,
  level: 6,
  kills: 80,
  killsByType: {},
  change: 900, // old Växel: must not turn into Biljetter/Scrap any more
  damageDealt: 5000,
  weapons: ['nyckel'],
  revivesUsed: 0,
  character: 'nattvandraren',
};

describe('map haul is banked exactly once', () => {
  it('settle then finalize adds the haul once and no Växel/Biljetter payout on top', () => {
    const profile = createFreshProfile(1000);
    const start = { ...profile.materials };
    const update = applyMapResult(profile.route, profile.materials, profile.routeSeed, 0, extracted);
    profile.route = update.route;
    profile.materials = update.materials;
    applyRunOutcome(profile, runResult, ZERO);
    expect(profile.materials).toEqual({
      scrap: start.scrap + haul.scrap,
      parts: start.parts + haul.parts,
      supplies: start.supplies + haul.supplies,
    });
    expect(profile.totalRuns).toBe(1);
  });

  it('a failed map still finalizes without paying scrap', () => {
    const profile = createFreshProfile(1000);
    const start = { ...profile.materials };
    applyRunOutcome(profile, { ...runResult, won: false }, ZERO);
    expect(profile.materials).toEqual(start);
  });

  it('keeps createRoute untouched by the counters', () => {
    const profile = createFreshProfile(1000);
    const route = createRoute(profile.routeSeed);
    applyRunOutcome(profile, runResult, ZERO);
    expect(profile.route).toEqual(route);
  });

  it('game.ts has no other payout path: only applyRunOutcome with NO_PAYOUT, no computePayout', () => {
    const src = gameSource;
    expect(src).not.toContain('computePayout');
    expect(src).toContain('applyRunOutcome(this.deps.profile, result, NO_PAYOUT)');
    expect(src.match(/applyRunOutcome\(/g)).toHaveLength(1);
    expect(src).toMatch(/NO_PAYOUT: Payout = \{[^}]*total: 0/);
  });
});
