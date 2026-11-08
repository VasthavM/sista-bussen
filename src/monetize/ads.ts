import {
  AD_COUNTDOWN_MS,
  IAP_CATALOG,
  INTERSTITIAL_RULES,
  INTERSTITIALS_ENABLED,
  REWARDED_ONBOARDING_FREE_MINUTES,
  type AdPlacement,
  type IapProduct,
  type IapSku,
} from './catalog';

/** True once the player is past the onboarding window; before it no rewarded offer is rendered. */
export function adsOfferable(profile: { playtimeSeconds: number }): boolean {
  return profile.playtimeSeconds >= REWARDED_ONBOARDING_FREE_MINUTES * 60;
}

export interface AdOutcome {
  completed: boolean;
  placement: AdPlacement;
}

export interface AdPresenter {
  show(placement: AdPlacement, durationMs: number): void;
  hide(): void;
}

export interface AdProvider {
  showRewarded(placement: AdPlacement): Promise<AdOutcome>;
}

/**
 * Mock rewarded-ad provider: plays a 1.2s "ad" with the presenter and always
 * completes. Swap this class for a real SDK adapter without touching the game.
 */
export class MockAdProvider implements AdProvider {
  private presenter: AdPresenter | null;
  private busy = false;

  constructor(presenter: AdPresenter | null = null) {
    this.presenter = presenter;
  }

  async showRewarded(placement: AdPlacement): Promise<AdOutcome> {
    if (this.busy) return { completed: false, placement };
    this.busy = true;
    this.presenter?.show(placement, AD_COUNTDOWN_MS);
    await new Promise<void>((resolve) => setTimeout(resolve, AD_COUNTDOWN_MS));
    this.presenter?.hide();
    this.busy = false;
    return { completed: true, placement };
  }
}

export interface InterstitialContext {
  completedRuns: number;
  runsSinceInterstitial: number;
  lastInterstitialAt: number | null;
  inRun: boolean;
  removeAds?: boolean;
}

/**
 * Interstitial frequency guard.
 * - never during a run
 * - never before the player has finished their first run (onboarding)
 * - at most one per 3 completed runs
 * - at least 90s between interstitials
 * - off entirely while INTERSTITIALS_ENABLED is false (launch)
 * - removed entirely by the remove_ads purchase
 */
export function shouldShowInterstitial(
  ctx: InterstitialContext,
  nowMs: number,
  enabled: boolean = INTERSTITIALS_ENABLED,
): boolean {
  if (!enabled) return false;
  if (ctx.removeAds) return false;
  if (ctx.inRun) return false;
  if (ctx.completedRuns < INTERSTITIAL_RULES.minCompletedRunsBeforeFirst) return false;
  if (ctx.runsSinceInterstitial < INTERSTITIAL_RULES.minCompletedRunsBetween) return false;
  if (ctx.lastInterstitialAt !== null && nowMs - ctx.lastInterstitialAt < INTERSTITIAL_RULES.minGapMs) {
    return false;
  }
  return true;
}

export function nextInterstitialContextAfterShow(
  ctx: InterstitialContext,
  nowMs: number,
): InterstitialContext {
  return { ...ctx, runsSinceInterstitial: 0, lastInterstitialAt: nowMs };
}

export interface PurchaseResult {
  ok: boolean;
  sku: IapSku;
  product?: IapProduct;
  error?: string;
}

export interface IapProvider {
  purchase(sku: IapSku): Promise<PurchaseResult>;
}

/**
 * Mock IAP provider: resolves immediately. `onGrant` is where the caller writes
 * tickets / unlock tokens / entitlement flags, exactly like a store callback would.
 */
export class MockIapProvider implements IapProvider {
  private owned = new Set<IapSku>();
  private onGrant: (product: IapProduct) => void;

  constructor(onGrant: (product: IapProduct) => void) {
    this.onGrant = onGrant;
  }

  async purchase(sku: IapSku): Promise<PurchaseResult> {
    const product = IAP_CATALOG[sku];
    if (!product) return { ok: false, sku, error: 'unknown_sku' };
    if (product.removesAds) {
      if (this.owned.has(sku)) return { ok: true, sku, product };
      this.owned.add(sku);
    }
    this.onGrant(product);
    return { ok: true, sku, product };
  }

  owns(sku: IapSku): boolean {
    return this.owned.has(sku);
  }
}