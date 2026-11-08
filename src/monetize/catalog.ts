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
    title: 'BUSSEN ÄR FÖRSENAD',
    reward: 'Fortsätt rundan med 60% HP',
    cap: 2,
    period: 'run',
  },
  double_fares: {
    id: 'double_fares',
    title: 'DUBBLA VÄXLET',
    reward: '2× växel från rundan',
    cap: 1,
    period: 'run',
  },
  reroll: {
    id: 'reroll',
    title: 'NYA KORT',
    reward: 'Slå om uppgraderingskorten',
    cap: 3,
    period: 'run',
  },
  free_crate: {
    id: 'free_crate',
    title: 'EXTRA DRAG',
    reward: 'En extra daglåda',
    cap: 3,
    period: 'day',
  },
  contract_skip: {
    id: 'contract_skip',
    title: 'KONTRAKT KLART',
    reward: 'Slutför ett kontrakt direkt',
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
    title: 'Ta bort mellanannonser',
    priceSek: 39,
    description: 'Inga mellanannonser. Belönade annonser finns kvar, de är en fördel.',
    tickets: 0,
    weaponTokens: 0,
    removesAds: true,
    vipHours: 0,
  },
  starter_pack: {
    sku: 'starter_pack',
    title: 'Startpaket',
    priceSek: 59,
    description: '1 500 Biljetter och en vapennyckel.',
    tickets: 1500,
    weaponTokens: 1,
    removesAds: false,
    vipHours: 0,
  },
  vip_pass: {
    sku: 'vip_pass',
    title: 'Nattkort (VIP)',
    priceSek: 79,
    description: '+25% växel, uppgraderad daglåda och en färgvariant. Gäller ett nattvarv.',
    tickets: 200,
    weaponTokens: 0,
    removesAds: false,
    vipHours: 24,
  },
  tickets_small: {
    sku: 'tickets_small',
    title: '800 Biljetter',
    priceSek: 25,
    description: 'Litet paket med Biljetter till Kuren.',
    tickets: 800,
    weaponTokens: 0,
    removesAds: false,
    vipHours: 0,
  },
  tickets_large: {
    sku: 'tickets_large',
    title: '4 000 Biljetter',
    priceSek: 99,
    description: 'Stort paket med Biljetter till Kuren.',
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

export const INTERSTITIAL_RULES = {
  minCompletedRunsBetween: 3,
  minGapMs: 90_000,
  minCompletedRunsBeforeFirst: 2,
} as const;