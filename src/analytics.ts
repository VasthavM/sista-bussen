/**
 * Typed analytics adapter. Console sink in dev, no-op everywhere else.
 * Deliberately no network access: the game must run offline.
 */

import type { AdPlacement } from './monetize/catalog';
import type { CharacterId, WeaponId } from './sim/types';

export interface AnalyticsEvents {
  run_start: {
    night: number;
    character: CharacterId;
    weapon: WeaponId;
    seed: number;
    tickets: number;
  };
  run_end: {
    night: number;
    won: boolean;
    time: number;
    kills: number;
    level: number;
    change: number;
    revives: number;
    doubleFares: boolean;
  };
  revive_offered: { night: number; time: number; remaining: number };
  revive_taken: { night: number; time: number; remaining: number };
  ad_impression: { placement: AdPlacement };
  ad_reward: { placement: AdPlacement };
  level_up: { level: number; choice: string; kind: string; rerolled: boolean };
  evolution: { weapon: WeaponId; level: number; night: number };
  purchase: { sku: string; priceSek: number; tickets: number; removeAds: boolean };
  crate_claim: { streak: number; tickets: number; weaponTokens: number; viaAd: boolean };
  contract_claim: { id: string; reward: number; byAd: boolean };
}

export type AnalyticsEventName = keyof AnalyticsEvents;
type Props = Record<string, unknown>;

let sink: (name: string, props: Props) => void = defaultSink();

function isDev(): boolean {
  try {
    return Boolean(import.meta.env && import.meta.env.DEV);
  } catch {
    return false;
  }
}

function defaultSink(): (name: string, props: Props) => void {
  if (!isDev()) return () => {};
  return (name, props) => {
    const logger = typeof console !== 'undefined' ? console.debug : undefined;
    if (!logger) return;
    logger.call(console, `[analytics] ${name}`, props);
  };
}

/** Replace the sink (tests, or a future provider bridge). */
export function setAnalyticsSink(next: ((name: string, props: Props) => void) | null): void {
  sink = next ?? defaultSink();
}

/** Record one of the events that actually matter. Unknown names are a type error. */
export function track<K extends AnalyticsEventName>(name: K, props: AnalyticsEvents[K]): void {
  try {
    sink(name, props as Props);
  } catch {
    // Analytics must never break a run.
  }
}