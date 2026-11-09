import { describe, expect, it } from 'vitest';
import { applyRunOutcome, computePayout, grantIap } from '../src/meta/economy';
import { createFreshProfile } from '../src/meta/save';
import { generateContracts } from '../src/meta/contracts';
import type { RunResult } from '../src/sim/types';

function runResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    won: false,
    night: 2,
    time: 140,
    level: 7,
    kills: 120,
    killsByType: { duva: 70, fyllo: 50 },
    change: 400,
    damageDealt: 9000,
    weapons: ['nyckel'],
    revivesUsed: 0,
    character: 'nattvandraren',
    ...overrides,
  };
}

describe('economy payout', () => {
  it('converts Växel to Biljetter at the documented rate', () => {
    const payout = computePayout({
      change: 400,
      night: 1,
      won: false,
      doubleFares: false,
      vip: false,
      metaFares: 0,
    });
    expect(payout.tickets).toBe(200);
    expect(payout.nightBonus).toBe(0);
    expect(payout.total).toBe(200);
  });

  it('doubles run currency for the double-fares rewarded ad', () => {
    const base = computePayout({
      change: 400,
      night: 1,
      won: false,
      doubleFares: false,
      vip: false,
      metaFares: 0,
    });
    const doubled = computePayout({
      change: 400,
      night: 1,
      won: false,
      doubleFares: true,
      vip: false,
      metaFares: 0,
    });
    expect(doubled.doubledChange).toBe(800);
    expect(doubled.tickets).toBe(base.tickets * 2);
  });

  it('pays a night-completion bonus only on a win', () => {
    const loss = computePayout({
      change: 100,
      night: 3,
      won: false,
      doubleFares: false,
      vip: false,
      metaFares: 0,
    });
    const win = computePayout({
      change: 100,
      night: 3,
      won: true,
      doubleFares: false,
      vip: false,
      metaFares: 0,
    });
    expect(loss.nightBonus).toBe(0);
    expect(win.nightBonus).toBe(120 + 60 * 3);
    expect(win.total).toBe(50 + 300);
  });

  it('applies the VIP pass (+25%) and Växling upgrade multipliers', () => {
    const plain = computePayout({
      change: 200,
      night: 1,
      won: false,
      doubleFares: false,
      vip: false,
      metaFares: 0,
    });
    const vip = computePayout({
      change: 200,
      night: 1,
      won: false,
      doubleFares: false,
      vip: true,
      metaFares: 0,
    });
    const upgraded = computePayout({
      change: 200,
      night: 1,
      won: false,
      doubleFares: false,
      vip: false,
      metaFares: 0.4,
    });
    expect(vip.tickets).toBe(Math.floor(plain.tickets * 1.25));
    expect(upgraded.tickets).toBe(Math.floor(plain.tickets * 1.4));
  });

  it('never pays negative tickets', () => {
    const payout = computePayout({
      change: -50,
      night: 1,
      won: false,
      doubleFares: true,
      vip: false,
      metaFares: 0,
    });
    expect(payout.tickets).toBe(0);
  });
});

describe('run outcome', () => {
  it('banks tickets, counts the run and unlocks the next night on a win', () => {
    const profile = createFreshProfile(0);
    const payout = computePayout({
      change: 300,
      night: 1,
      won: true,
      doubleFares: false,
      vip: false,
      metaFares: 0,
    });
    applyRunOutcome(profile, runResult({ won: true, night: 1 }), payout);
    expect(profile.materials.scrap).toBe(payout.total);
    expect(profile.totalRuns).toBe(1);
    expect(profile.runsSinceInterstitial).toBe(1);
    expect(profile.wins).toBe(1);
    expect(profile.nightUnlocked).toBe(2);
    expect(profile.bestNight).toBe(1);
    expect(profile.lastRun?.night).toBe(1);
  });

  it('does not unlock the next night on a loss', () => {
    const profile = createFreshProfile(0);
    const payout = computePayout({
      change: 100,
      night: 1,
      won: false,
      doubleFares: false,
      vip: false,
      metaFares: 0,
    });
    applyRunOutcome(profile, runResult({ won: false, night: 1 }), payout);
    expect(profile.nightUnlocked).toBe(1);
    expect(profile.wins).toBe(0);
  });

  it('advances the active contract with run stats', () => {
    const profile = createFreshProfile(0);
    profile.contracts = { day: '2026-11-06', items: generateContracts('2026-11-06', 1) };
    const before = profile.contracts.items.map((c) => c.progress);
    applyRunOutcome(profile, runResult({ kills: 120, killsByType: { duva: 70 } }), computePayout({
      change: 10,
      night: 1,
      won: false,
      doubleFares: false,
      vip: false,
      metaFares: 0,
    }));
    const after = profile.contracts.items.map((c) => c.progress);
    expect(after).not.toEqual(before);
    expect(after.some((v, i) => v > before[i])).toBe(true);
  });

  it('grants IAP content exactly once per purchase call and sets entitlements', () => {
    const profile = createFreshProfile(0);
    grantIap(
      profile,
      { sku: 'starter_pack', tickets: 1500, weaponTokens: 1, removesAds: false, vipHours: 0 },
      0,
    );
    expect(profile.materials.scrap).toBe(1500);
    expect(profile.weaponTokens).toBe(1);
    grantIap(
      profile,
      { sku: 'remove_ads', tickets: 0, weaponTokens: 0, removesAds: true, vipHours: 0 },
      0,
    );
    expect(profile.removeAds).toBe(true);
    expect(profile.ownedSkus).toContain('remove_ads');
  });
});