import { describe, expect, it } from 'vitest';
import {
  SAVE_KEY,
  SAVE_VERSION,
  createFreshProfile,
  loadProfile,
  normalizeSave,
  parseSave,
  saveProfile,
} from '../src/meta/save';

const NOW = 1_800_000_000_000;

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('save loading', () => {
  it('starts a fresh profile when nothing is stored', () => {
    const result = parseSave(null, NOW);
    expect(result.recovered).toBe(false);
    expect(result.profile.materials.scrap).toBe(0);
    expect(result.profile.nightUnlocked).toBe(1);
    expect(result.profile.unlockedWeapons).toContain('nyckel');
  });

  it('never crashes on corrupt JSON and falls back to a fresh profile', () => {
    const result = parseSave('{"tickets": 999, oops', NOW);
    expect(result.recovered).toBe(true);
    expect(result.reason).toBe('invalid_json');
    expect(result.profile.materials.scrap).toBe(0);
    expect(result.profile.version).toBe(SAVE_VERSION);
  });

  it('rejects non-object payloads', () => {
    expect(parseSave('[]', NOW).recovered).toBe(true);
    expect(parseSave('"hello"', NOW).recovered).toBe(true);
    expect(parseSave('null', NOW).recovered).toBe(true);
  });

  it('clamps hostile values instead of trusting them', () => {
    const profile = normalizeSave(
      {
        version: 1,
        tickets: -500,
        nightUnlocked: 0,
        bestNight: -3,
        weaponTokens: 'many',
        unlockedWeapons: ['nyckel', 'nonsense', 'nyckel'],
        upgrades: { kraft: -2, liv: 3.9, fart: 'x' },
        daily: { streak: -9 },
      },
      NOW,
    );
    expect(profile.materials.scrap).toBe(0);
    expect(profile.nightUnlocked).toBe(1);
    expect(profile.bestNight).toBe(0);
    expect(profile.weaponTokens).toBe(0);
    expect(profile.unlockedWeapons).toEqual(['nyckel', 'korv', 'ficklampa']);
    // Old shop keys migrate to their v4 nodes: kraft -2 and fart 'x' clamp to 0, liv 3.9 floors to 3.
    expect(profile.upgrades).toEqual({ c_hp: 3 });
    expect(profile.daily.streak).toBe(0);
  });

  it('migrates a legacy v0 save forward without losing currency or progress', () => {
    const legacy = JSON.stringify({ tickets: 250, night: 3, best: 2 });
    const result = parseSave(legacy, NOW);
    expect(result.recovered).toBe(false);
    expect(result.profile.version).toBe(SAVE_VERSION);
    expect(result.profile.materials.scrap).toBe(250);
    expect(result.profile.nightUnlocked).toBe(3);
    expect(result.profile.bestNight).toBe(2);
    expect(result.profile.unlockedWeapons.length).toBeGreaterThan(0);
    expect(result.profile.settings.muted).toBe(false);
  });

  it('round-trips a v1 save through storage', () => {
    const storage = fakeStorage();
    const profile = createFreshProfile(NOW);
    profile.materials = { scrap: 1234, parts: 0, supplies: 0 };
    profile.nightUnlocked = 4;
    profile.bestNight = 3;
    profile.upgrades = { w_damage: 4, c_hp: 2 };
    profile.settings.muted = true;
    profile.removeAds = true;
    profile.unlockedWeapons.push('vagn');
    expect(saveProfile(profile, storage)).toBe(true);

    const loaded = loadProfile(storage, NOW);
    expect(loaded.materials.scrap).toBe(1234);
    expect(loaded.nightUnlocked).toBe(4);
    expect(loaded.bestNight).toBe(3);
    expect(loaded.upgrades.w_damage).toBe(4);
    expect(loaded.settings.muted).toBe(true);
    expect(loaded.removeAds).toBe(true);
    expect(loaded.unlockedWeapons).toContain('vagn');
    expect(storage.map.get(SAVE_KEY)).toBeTruthy();
  });

  it('survives storage that throws', () => {
    const throwing = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
    };
    expect(() => loadProfile(throwing, NOW)).not.toThrow();
    expect(loadProfile(throwing, NOW).version).toBe(SAVE_VERSION);
    expect(saveProfile(createFreshProfile(NOW), throwing)).toBe(false);
  });

  it('flags saves from a newer version but still loads them', () => {
    const future = JSON.stringify({ version: 99, materials: { scrap: 42 }, nightUnlocked: 2 });
    const result = parseSave(future, NOW);
    expect(result.recovered).toBe(true);
    expect(result.reason).toBe('future_version');
    expect(result.profile.materials.scrap).toBe(42);
  });
});