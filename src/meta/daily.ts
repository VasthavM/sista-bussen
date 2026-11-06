import type { Profile } from './save';

export function dayKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map((v) => Number(v));
  if (!y || !m || !d) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function isYesterday(previous: string | null, today: string): boolean {
  if (!previous) return false;
  return dayNumber(today) - dayNumber(previous) === 1;
}

export function crateStreakAfterClaim(profile: Profile, today: string): number {
  if (profile.daily.lastClaimDay === today) return profile.daily.streak;
  if (isYesterday(profile.daily.lastClaimDay, today)) return profile.daily.streak + 1;
  return 1;
}

export interface CrateReward {
  ok: boolean;
  tickets: number;
  weaponTokens: number;
  streak: number;
  reason?: string;
}

/**
 * Daily crate. Once per calendar day, streak grows on consecutive days and every
 * seventh day guarantees a weapon unlock token.
 */
export function claimDailyCrate(profile: Profile, now = new Date()): CrateReward {
  const today = dayKey(now);
  if (profile.daily.lastClaimDay === today) {
    return { ok: false, tickets: 0, weaponTokens: 0, streak: profile.daily.streak, reason: 'already_claimed' };
  }
  const streak = crateStreakAfterClaim(profile, today);
  const base = Math.min(400, 60 + streak * 25);
  const tickets = Math.round(base * (profile.vipUntil > now.getTime() ? 1.5 : 1));
  const weaponTokens = streak % 7 === 0 ? 1 : 0;

  profile.tickets = Math.min(99_999_999, profile.tickets + tickets);
  profile.weaponTokens += weaponTokens;
  profile.daily.lastClaimDay = today;
  profile.daily.streak = streak;

  return { ok: true, tickets, weaponTokens, streak };
}

export function crateAvailable(profile: Profile, now = new Date()): boolean {
  return profile.daily.lastClaimDay !== dayKey(now);
}

export function extraPullsLeft(profile: Profile, now = new Date()): number {
  const today = dayKey(now);
  const used = profile.daily.adPullDay === today ? profile.daily.adPulls : 0;
  return Math.max(0, 3 - used);
}

/** Rewarded `free_crate` pull: small ticket bundle, capped at three per day. */
export function claimExtraCrate(profile: Profile, now = new Date()): { ok: boolean; tickets: number } {
  const today = dayKey(now);
  if (profile.daily.adPullDay !== today) {
    profile.daily.adPullDay = today;
    profile.daily.adPulls = 0;
  }
  if (profile.daily.adPulls >= 3) return { ok: false, tickets: 0 };
  profile.daily.adPulls += 1;
  const tickets = 90 + profile.daily.streak * 10;
  profile.tickets = Math.min(99_999_999, profile.tickets + tickets);
  return { ok: true, tickets };
}