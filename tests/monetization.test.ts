import { describe, expect, it } from 'vitest';
import {
  AD_PLACEMENTS,
  IAP_CATALOG,
  IAP_ORDER,
  INTERSTITIAL_RULES,
  type AdPlacement,
} from '../src/monetize/catalog';
import { shouldShowInterstitial, type InterstitialContext } from '../src/monetize/ads';

function ctx(overrides: Partial<InterstitialContext> = {}): InterstitialContext {
  return {
    completedRuns: 5,
    runsSinceInterstitial: 3,
    lastInterstitialAt: null,
    inRun: false,
    ...overrides,
  };
}

const NOW = 1_800_000_000_000;

describe('interstitial frequency guard', () => {
  it('allows one after three completed runs', () => {
    expect(shouldShowInterstitial(ctx(), NOW)).toBe(true);
  });

  it('blocks before three runs have passed since the last one', () => {
    expect(shouldShowInterstitial(ctx({ runsSinceInterstitial: 2 }), NOW)).toBe(false);
    expect(shouldShowInterstitial(ctx({ runsSinceInterstitial: 0 }), NOW)).toBe(false);
  });

  it('never interrupts a live run', () => {
    expect(shouldShowInterstitial(ctx({ inRun: true }), NOW)).toBe(false);
  });

  it('never fires during the first-run onboarding', () => {
    expect(
      shouldShowInterstitial(ctx({ completedRuns: 1, runsSinceInterstitial: 3 }), NOW),
    ).toBe(false);
    expect(
      shouldShowInterstitial(ctx({ completedRuns: 2, runsSinceInterstitial: 3 }), NOW),
    ).toBe(true);
  });

  it('enforces a 90 second gap', () => {
    expect(
      shouldShowInterstitial(ctx({ lastInterstitialAt: NOW - 89_999 }), NOW),
    ).toBe(false);
    expect(
      shouldShowInterstitial(ctx({ lastInterstitialAt: NOW - 90_000 }), NOW),
    ).toBe(true);
  });

  it('is fully removed by the remove_ads purchase', () => {
    expect(shouldShowInterstitial(ctx({ removeAds: true }), NOW)).toBe(false);
  });

  it('exposes the guard thresholds in one place', () => {
    expect(INTERSTITIAL_RULES.minCompletedRunsBetween).toBe(3);
    expect(INTERSTITIAL_RULES.minGapMs).toBe(90_000);
  });
});

describe('placement and product catalog', () => {
  it('contains all five rewarded placements with caps', () => {
    const placements: AdPlacement[] = [
      'revive',
      'double_fares',
      'reroll',
      'free_crate',
      'contract_skip',
    ];
    for (const placement of placements) {
      const def = AD_PLACEMENTS[placement];
      expect(def).toBeDefined();
      expect(def.cap).toBeGreaterThan(0);
      expect(def.title.length).toBeGreaterThan(0);
    }
    expect(AD_PLACEMENTS.revive.cap).toBe(2);
    expect(AD_PLACEMENTS.double_fares.cap).toBe(1);
    expect(AD_PLACEMENTS.reroll.cap).toBe(3);
    expect(AD_PLACEMENTS.free_crate.cap).toBe(3);
    expect(AD_PLACEMENTS.contract_skip.cap).toBe(1);
  });

  it('defines every IAP price in the catalog only', () => {
    expect(IAP_ORDER).toHaveLength(5);
    for (const sku of IAP_ORDER) {
      const product = IAP_CATALOG[sku];
      expect(product.sku).toBe(sku);
      expect(product.priceSek).toBeGreaterThan(0);
      expect(product.description.length).toBeGreaterThan(0);
    }
    expect(IAP_CATALOG.remove_ads.priceSek).toBe(39);
    expect(IAP_CATALOG.starter_pack.tickets).toBe(1500);
    expect(IAP_CATALOG.starter_pack.weaponTokens).toBe(1);
    expect(IAP_CATALOG.vip_pass.priceSek).toBe(79);
    expect(IAP_CATALOG.tickets_small.tickets).toBe(800);
    expect(IAP_CATALOG.tickets_large.tickets).toBe(4000);
  });
});