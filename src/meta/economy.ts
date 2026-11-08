import type { RunResult } from '../sim/types';
import { updateContracts } from './contracts';
import { addScrap, type Profile } from './save';

export interface PayoutInput {
  change: number;
  night: number;
  won: boolean;
  doubleFares: boolean;
  vip: boolean;
  metaFares: number;
}

export interface Payout {
  change: number;
  doubledChange: number;
  tickets: number;
  nightBonus: number;
  total: number;
  multiplier: number;
}

export const CHANGE_TO_TICKETS = 0.5;

/**
 * Convert run Växel into persistent Biljetter.
 * The double-fares rewarded ad doubles the run currency before conversion;
 * the Växling meta upgrade and VIP pass add their own multipliers.
 */
export function computePayout(input: PayoutInput): Payout {
  const change = Math.max(0, Math.floor(input.change));
  const doubledChange = input.doubleFares ? change * 2 : change;
  const multiplier = (1 + Math.max(0, input.metaFares)) * (input.vip ? 1.25 : 1);
  const tickets = Math.floor(doubledChange * CHANGE_TO_TICKETS * multiplier);
  const nightBonus = input.won ? Math.round((120 + 60 * Math.max(1, input.night)) * (input.vip ? 1.25 : 1)) : 0;
  return {
    change,
    doubledChange,
    tickets,
    nightBonus,
    total: tickets + nightBonus,
    multiplier,
  };
}

/** Add a finished run to the profile: tickets, night unlock, counters, contracts. */
export function applyRunOutcome(profile: Profile, result: RunResult, payout: Payout): void {
  addScrap(profile, payout.total);
  profile.totalRuns += 1;
  profile.runsSinceInterstitial += 1;
  profile.lastRun = {
    night: result.night,
    time: result.time,
    kills: result.kills,
  };

  if (result.won) {
    profile.wins += 1;
    profile.bestNight = Math.max(profile.bestNight, result.night);
    profile.nightUnlocked = Math.max(profile.nightUnlocked, result.night + 1);
  }

  profile.contracts.items = updateContracts(profile.contracts.items, result);
}

export function vipActive(profile: Profile, now = Date.now()): boolean {
  return profile.vipUntil > now;
}

export function grantIap(
  profile: Profile,
  product: {
    sku: string;
    tickets: number;
    weaponTokens: number;
    removesAds: boolean;
    vipHours: number;
  },
  now = Date.now(),
): void {
  addScrap(profile, product.tickets);
  profile.weaponTokens += product.weaponTokens;
  if (product.removesAds) profile.removeAds = true;
  if (product.vipHours > 0) {
    profile.vipUntil = Math.max(profile.vipUntil, now) + product.vipHours * 3_600_000;
  }
  if (!profile.ownedSkus.includes(product.sku)) profile.ownedSkus.push(product.sku);
}