import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, createFreshProfile, normalizeSave, parseSave, saveProfile, loadProfile } from '../src/meta/save';
import { migrateShopLevels } from '../src/meta/migrate-v4';
import { UPGRADE_NODES, getNode } from '../src/meta/upgrades-v2';
import v3Fixture from './fixtures/save-v3.json';

const NOW = 1_800_000_000_000;
const V3_TEXT = JSON.stringify(v3Fixture);

describe('save v4', () => {
  it('is version 4 and has no tickets or shop levels on a fresh profile', () => {
    const p = createFreshProfile(NOW) as unknown as Record<string, unknown>;
    expect(SAVE_VERSION).toBe(4);
    expect(p.version).toBe(4);
    expect('tickets' in p).toBe(false);
    expect(p.upgrades).toEqual({});
    expect(p.unlockedWeapons).toEqual(['nyckel', 'korv', 'ficklampa']);
  });

  it('migrates the v3 fixture: shop levels become upgrade nodes', () => {
    const v3 = JSON.parse(V3_TEXT);
    expect(v3.version).toBe(3);
    const { profile, recovered } = parseSave(V3_TEXT, NOW);
    expect(recovered).toBe(false);
    expect(profile.version).toBe(4);
    expect('tickets' in profile).toBe(false);
    expect(profile.upgrades).toEqual({
      w_damage: 5, // kraft 6 + tur 2, capped at 5
      c_hp: 4, // liv
      c_speed: 2, // fart
      c_pickup: 3, // plock
      c_armor: 1, // skinn
      b_storage: 3, // vaxling
    });
    // startnyckel is gone: no node for it, and it is not carried as a level.
    expect(Object.keys(profile.upgrades).every((id) => getNode(id) !== undefined)).toBe(true);
  });

  it('refunds Startnyckel as Scrap and takes the larger of tickets and the stale v3 snapshot', () => {
    const { profile } = parseSave(V3_TEXT, NOW);
    // tickets 1200 beat the materials.scrap snapshot (842); startnyckel 2 refunds 900 + 2160.
    expect(profile.materials).toEqual({ scrap: 1200 + 900 + 2160, parts: 6, supplies: 3 });
  });

  it('carries unlocked weapons over and keeps route, daily and counters', () => {
    const v3 = JSON.parse(V3_TEXT);
    const { profile } = parseSave(V3_TEXT, NOW);
    expect(profile.unlockedWeapons).toEqual(expect.arrayContaining(v3.unlockedWeapons));
    expect(profile.routeSeed).toBe(v3.routeSeed);
    expect(profile.route.bestDepth).toBe(14);
    expect(profile.route.depth).toBe(12);
    expect(profile.daily).toEqual(v3.daily);
    expect(profile.totalRuns).toBe(v3.totalRuns);
    expect(profile.weaponTokens).toBe(v3.weaponTokens);
  });

  it('does not run the v3 migration again on a v4 save', () => {
    const once = parseSave(V3_TEXT, NOW).profile;
    const twice = normalizeSave(JSON.parse(JSON.stringify(once)), NOW);
    expect(twice.upgrades).toEqual(once.upgrades);
    expect(twice.materials).toEqual(once.materials);
  });

  it('migrates a v1/v2 save straight to v4 without double counting the wallet', () => {
    const p = normalizeSave({ version: 2, tickets: 300, upgrades: { startnyckel: 1, liv: 1 } }, NOW);
    expect(p.materials.scrap).toBe(300 + 900);
    expect(p.upgrades).toEqual({ c_hp: 1 });
  });

  it('migrateShopLevels maps every old shop key and ignores unknown ones', () => {
    const { upgrades, refundScrap } = migrateShopLevels({ kraft: 2, tur: 1, liv: 1, fart: 1, plock: 1, skinn: 1, vaxling: 1, bogus: 4 });
    expect(upgrades).toEqual({ w_damage: 3, c_hp: 1, c_speed: 1, c_pickup: 1, c_armor: 1, b_storage: 1 });
    expect(refundScrap).toBe(0);
  });

  it('drops unknown node ids and clamps levels on a v4 save', () => {
    const p = normalizeSave(
      { version: 4, upgrades: { c_hp: 99, w_damage: -1, nope: 3, w_unlock_vagn: 1, kraft: 4 } },
      NOW,
    );
    expect(p.upgrades).toEqual({ c_hp: getNode('c_hp')!.maxLevel });
  });

  it('round-trips levels and owned weapons through storage', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    const p = createFreshProfile(NOW);
    p.upgrades = { c_hp: 2, evo_korv: 1 };
    p.unlockedWeapons = ['nyckel', 'korv', 'ficklampa', 'vagn'];
    expect(saveProfile(p, storage)).toBe(true);
    const loaded = loadProfile(storage, NOW);
    expect(loaded.upgrades).toEqual(p.upgrades);
    expect(loaded.unlockedWeapons).toEqual(p.unlockedWeapons);
  });

  it('every node id in a fresh save round-trips as a valid key', () => {
    const upgrades = Object.fromEntries(UPGRADE_NODES.filter((n) => n.effect.kind !== 'unlockWeapon').map((n) => [n.id, 1]));
    expect(normalizeSave({ version: 4, upgrades }, NOW).upgrades).toEqual(upgrades);
  });
});
