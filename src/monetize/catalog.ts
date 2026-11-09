/**
 * Single source of truth for every price, ad placement cap and store product.
 * UI reads these values; nothing may hardcode a price anywhere else.
 */

export type AdPlacement = 'revive' | 'double_fares' | 'reroll' | 'free_crate' | 'contract_skip';

export interface AdPlacementDef {
  id: AdPlacement;
  title: string;
  reward: string;
  cap: number;
  period: 'run' | 'day';
}

export const AD_PLACEMENTS: Record<AdPlacement, AdPlacementDef> = {
  revive: {
    id: 'revive',
    title: 'NOT TODAY',
    reward: 'Back on your feet with 60% HP',
    cap: 2,
    period: 'run',
  },
  double_fares: {
    id: 'double_fares',
    title: 'DOUBLE MATERIALS',
    reward: '2× materials from this map',
    cap: 1,
    period: 'run',
  },
  reroll: {
    id: 'reroll',
    title: 'NEW CARDS',
    reward: 'Reroll the upgrade cards',
    cap: 3,
    period: 'run',
  },
  free_crate: {
    id: 'free_crate',
    title: 'EXTRA CRATE',
    reward: 'One more daily crate',
    cap: 3,
    period: 'day',
  },
  contract_skip: {
    id: 'contract_skip',
    title: 'CONTRACT DONE',
    reward: 'Finish a contract instantly',
    cap: 1,
    period: 'day',
  },
};

/** Lifetime playtime before any rewarded-ad offer is shown. The only definition; read it via `adsOfferable`. */
export const REWARDED_ONBOARDING_FREE_MINUTES = 12;

/** Mock ad length. Kept here so the overlay and the provider agree. */
export const AD_COUNTDOWN_MS = 1200;

export type IapSku = 'remove_ads' | 'starter_pack' | 'vip_pass' | 'tickets_small' | 'tickets_large';

export interface IapProduct {
  sku: IapSku;
  title: string;
  priceSek: number;
  description: string;
  tickets: number;
  weaponTokens: number;
  removesAds: boolean;
  vipHours: number;
}

export const IAP_CATALOG: Record<IapSku, IapProduct> = {
  remove_ads: {
    sku: 'remove_ads',
    title: 'Remove interstitials',
    priceSek: 39,
    description: 'No interstitial ads. Rewarded ads stay available, and they are always optional.',
    tickets: 0,
    weaponTokens: 0,
    removesAds: true,
    vipHours: 0,
  },
  starter_pack: {
    sku: 'starter_pack',
    title: 'Starter pack',
    priceSek: 59,
    description: '1,500 Scrap and a weapon key.',
    tickets: 1500,
    weaponTokens: 1,
    removesAds: false,
    vipHours: 0,
  },
  vip_pass: {
    sku: 'vip_pass',
    title: 'Night pass (VIP)',
    priceSek: 79,
    description: '+25% loot, an upgraded daily crate and a colour variant. Lasts 24 hours.',
    tickets: 200,
    weaponTokens: 0,
    removesAds: false,
    vipHours: 24,
  },
  tickets_small: {
    sku: 'tickets_small',
    title: '800 Scrap',
    priceSek: 25,
    description: 'A small pack of Scrap.',
    tickets: 800,
    weaponTokens: 0,
    removesAds: false,
    vipHours: 0,
  },
  tickets_large: {
    sku: 'tickets_large',
    title: '4,000 Scrap',
    priceSek: 99,
    description: 'A large pack of Scrap.',
    tickets: 4000,
    weaponTokens: 0,
    removesAds: false,
    vipHours: 0,
  },
};

export const IAP_ORDER: IapSku[] = [
  'starter_pack',
  'tickets_small',
  'tickets_large',
  'vip_pass',
  'remove_ads',
];

export function formatSek(price: number): string {
  return `${price} kr`;
}

/** Launch is rewarded-only (issue #2). Flip when interstitials return post-launch. */
export const INTERSTITIALS_ENABLED = false;

export const INTERSTITIAL_RULES = {
  minCompletedRunsBetween: 3,
  minGapMs: 90_000,
  minCompletedRunsBeforeFirst: 2,
} as const;