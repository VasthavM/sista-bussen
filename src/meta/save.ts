import { WEAPON_ORDER } from '../sim/content';
import type { WeaponId } from '../sim/types';
import { generateContracts, type Contract } from './contracts';

export const SAVE_KEY = 'sista-bussen.save.v1';
export const SAVE_VERSION = 1;

export interface DailyState {
  lastClaimDay: string | null;
  streak: number;
  adPulls: number;
  adPullDay: string | null;
}

export interface Profile {
  version: number;
  createdAt: number;
  tickets: number;
  nightUnlocked: number;
  bestNight: number;
  totalRuns: number;
  wins: number;
  runsSinceInterstitial: number;
  lastInterstitialAt: number | null;
  unlockedWeapons: WeaponId[];
  weaponTokens: number;
  upgrades: Record<string, number>;
  ownedSkus: string[];
  vipUntil: number;
  removeAds: boolean;
  settings: { muted: boolean; haptics: boolean };
  daily: DailyState;
  contracts: { day: string; items: Contract[] };
  colours: string[];
  activeColour: string;
  lastRun: { night: number; time: number; kills: number } | null;
}

export function createFreshProfile(now = Date.now()): Profile {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    tickets: 0,
    nightUnlocked: 1,
    bestNight: 0,
    totalRuns: 0,
    wins: 0,
    runsSinceInterstitial: 0,
    lastInterstitialAt: null,
    unlockedWeapons: ['nyckel', 'korv', 'spray', 'ficklampa'],
    weaponTokens: 0,
    upgrades: {},
    ownedSkus: [],
    vipUntil: 0,
    removeAds: false,
    settings: { muted: false, haptics: true },
    daily: { lastClaimDay: null, streak: 0, adPulls: 0, adPullDay: null },
    contracts: { day: '', items: [] },
    colours: ['standard'],
    activeColour: 'standard',
    lastRun: null,
  };
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function asInt(value: unknown, fallback: number, min: number, max: number): number {
  return Math.floor(asNumber(value, fallback, min, max));
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asWeaponList(value: unknown, fallback: WeaponId[]): WeaponId[] {
  if (!Array.isArray(value)) return [...fallback];
  const list = value.filter((v): v is WeaponId => typeof v === 'string' && (WEAPON_ORDER as string[]).includes(v));
  const unique = Array.from(new Set(list));
  return unique.length > 0 ? unique : [...fallback];
}

function asContractList(value: unknown): Contract[] | null {
  if (!Array.isArray(value)) return null;
  const out: Contract[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const c = raw as Record<string, unknown>;
    const target = asNumber(c.target, 0, 0, 1_000_000);
    if (target <= 0) continue;
    out.push({
      id: asString(c.id, `c${out.length + 1}`),
      kind: (['kill_type', 'kills_total', 'survive', 'night_clear', 'weapon_only'] as const).includes(
        c.kind as never,
      )
        ? (c.kind as Contract['kind'])
        : 'kills_total',
      targetType: typeof c.targetType === 'string' ? (c.targetType as Contract['targetType']) : undefined,
      weaponId: typeof c.weaponId === 'string' ? (c.weaponId as Contract['weaponId']) : undefined,
      target,
      progress: asNumber(c.progress, 0, 0, target),
      reward: asNumber(c.reward, 100, 0, 100_000),
      claimed: asBool(c.claimed, false),
      text: asString(c.text, 'Kontrakt'),
    });
  }
  return out.length > 0 ? out : null;
}

/**
 * Turn any parsed JSON (or a future/legacy shape) into a valid Profile.
 * Never throws; every field is clamped or replaced with a default.
 */
export function normalizeSave(raw: unknown, now = Date.now()): Profile {
  const base = createFreshProfile(now);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const data = raw as Record<string, unknown>;

  // Legacy v0 profiles stored a bare { tickets, night } pair.
  const legacy = (data.version === undefined || data.version === 0) && !('nightUnlocked' in data);
  const legacyNight = asInt(data.night, 1, 1, 999);

  const profile: Profile = {
    ...base,
    version: SAVE_VERSION,
    createdAt: asNumber(data.createdAt, now, 0, Number.MAX_SAFE_INTEGER),
    tickets: asInt(data.tickets, legacy ? 0 : base.tickets, 0, 99_999_999),
    nightUnlocked: legacy
      ? Math.max(1, legacyNight)
      : asInt(data.nightUnlocked, 1, 1, 999),
    bestNight: legacy
      ? Math.max(0, asInt(data.best, 0, 0, 999))
      : asInt(data.bestNight, 0, 0, 999),
    totalRuns: asInt(data.totalRuns, 0, 0, 9_999_999),
    wins: asInt(data.wins, 0, 0, 9_999_999),
    runsSinceInterstitial: asInt(data.runsSinceInterstitial, 0, 0, 999),
    lastInterstitialAt:
      typeof data.lastInterstitialAt === 'number' && Number.isFinite(data.lastInterstitialAt)
        ? data.lastInterstitialAt
        : null,
    unlockedWeapons: asWeaponList(data.unlockedWeapons, base.unlockedWeapons),
    weaponTokens: asInt(data.weaponTokens, 0, 0, 999),
    ownedSkus: Array.isArray(data.ownedSkus)
      ? data.ownedSkus.filter((v): v is string => typeof v === 'string')
      : [],
    vipUntil: asNumber(data.vipUntil, 0, 0, Number.MAX_SAFE_INTEGER),
    removeAds: asBool(data.removeAds, false),
    settings: {
      muted:
        data.settings && typeof data.settings === 'object'
          ? asBool((data.settings as Record<string, unknown>).muted, false)
          : false,
      haptics:
        data.settings && typeof data.settings === 'object'
          ? asBool((data.settings as Record<string, unknown>).haptics, true)
          : true,
    },
    colours: Array.isArray(data.colours)
      ? data.colours.filter((v): v is string => typeof v === 'string')
      : ['standard'],
    activeColour: asString(data.activeColour, 'standard'),
    lastRun: null,
  };

  if (profile.colours.length === 0) profile.colours = ['standard'];
  if (!profile.colours.includes(profile.activeColour)) profile.activeColour = profile.colours[0];

  if (data.upgrades && typeof data.upgrades === 'object' && !Array.isArray(data.upgrades)) {
    for (const [key, value] of Object.entries(data.upgrades as Record<string, unknown>)) {
      profile.upgrades[key] = asInt(value, 0, 0, 50);
    }
  }

  if (profile.nightUnlocked < Math.max(1, profile.bestNight)) {
    profile.nightUnlocked = Math.max(1, profile.bestNight);
  }

  const daily = data.daily;
  if (daily && typeof daily === 'object') {
    const d = daily as Record<string, unknown>;
    profile.daily = {
      lastClaimDay: typeof d.lastClaimDay === 'string' ? d.lastClaimDay : null,
      streak: asInt(d.streak, 0, 0, 3650),
      adPulls: asInt(d.adPulls, 0, 0, 3),
      adPullDay: typeof d.adPullDay === 'string' ? d.adPullDay : null,
    };
  }

  const contracts = data.contracts;
  if (contracts && typeof contracts === 'object' && !Array.isArray(contracts)) {
    const c = contracts as Record<string, unknown>;
    const items = asContractList(c.items);
    if (items) {
      profile.contracts = { day: asString(c.day, ''), items };
    }
  }

  const lastRun = data.lastRun;
  if (lastRun && typeof lastRun === 'object' && !Array.isArray(lastRun)) {
    const r = lastRun as Record<string, unknown>;
    profile.lastRun = {
      night: asInt(r.night, 1, 1, 999),
      time: asNumber(r.time, 0, 0, 10_000),
      kills: asInt(r.kills, 0, 0, 1_000_000),
    };
  }

  return profile;
}

export interface LoadResult {
  profile: Profile;
  recovered: boolean;
  reason?: string;
}

/** Parse a stored string. Corrupt or empty input yields a fresh profile. */
export function parseSave(text: string | null, now = Date.now()): LoadResult {
  if (text === null || text === undefined || text.trim() === '') {
    return { profile: createFreshProfile(now), recovered: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { profile: createFreshProfile(now), recovered: true, reason: 'invalid_json' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { profile: createFreshProfile(now), recovered: true, reason: 'invalid_shape' };
  }
  const version = (parsed as Record<string, unknown>).version;
  if (typeof version === 'number' && version > SAVE_VERSION) {
    const profile = normalizeSave(parsed, now);
    return { profile, recovered: true, reason: 'future_version' };
  }
  return { profile: normalizeSave(parsed, now), recovered: false };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadProfile(storage: StorageLike | null = defaultStorage(), now = Date.now()): Profile {
  if (!storage) return createFreshProfile(now);
  let text: string | null = null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return createFreshProfile(now);
  }
  return parseSave(text, now).profile;
}

export function saveProfile(profile: Profile, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    profile.version = SAVE_VERSION;
    storage.setItem(SAVE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

/** Fill in a task set for today if the stored one is from another day. */
export function ensureDailyContracts(profile: Profile, dayKey: string, night: number): void {
  if (profile.contracts.day === dayKey && profile.contracts.items.length === 3) return;
  profile.contracts = { day: dayKey, items: generateContracts(dayKey, Math.max(1, night)) };
}