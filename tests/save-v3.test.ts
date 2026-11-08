import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, createFreshProfile, loadProfile, normalizeSave, parseSave, saveProfile } from '../src/meta/save';
import v2Fixture from './fixtures/save-v2.json';
import { SEGMENT_LENGTH, deriveSegmentSeed, segmentIndexOf } from '../src/meta/route';

const NOW = 1_800_000_000_000;
/** A real save written by the v2 code (SAVE_VERSION 2). */
const V2_TEXT = JSON.stringify(v2Fixture);

describe('save v3', () => {
  it('is version 3', () => {
    expect(SAVE_VERSION).toBe(3);
  });

  it('gives a fresh profile empty materials and a start-of-route state', () => {
    const p = createFreshProfile(NOW);
    expect(p.materials).toEqual({ scrap: 0, parts: 0, supplies: 0 });
    expect(p.route).toMatchObject({ depth: 1, checkpoint: 0, path: [], bestDepth: 0 });
    expect(Number.isInteger(p.routeSeed)).toBe(true);
    expect(p.route.segmentSeed).toBe(deriveSegmentSeed(p.routeSeed, 0));
    expect(createFreshProfile(NOW).routeSeed).toBe(p.routeSeed);
  });

  it('migrates the real v2 fixture: Biljetter become Scrap 1:1 and nights map to bestDepth', () => {
    const v2 = JSON.parse(V2_TEXT);
    expect(v2.version).toBe(2);
    const { profile, recovered } = parseSave(V2_TEXT, NOW);
    expect(recovered).toBe(false);
    expect(profile.version).toBe(3);
    expect(profile.materials).toEqual({ scrap: 842, parts: 0, supplies: 0 });
    expect(profile.route.bestDepth).toBe(4);
    expect(profile.route).toMatchObject({ depth: 1, checkpoint: 0, path: [] });
    expect(profile.route.segmentSeed).toBe(deriveSegmentSeed(profile.routeSeed, 0));
  });

  it('keeps every v2 field the current game reads, shop upgrade levels included', () => {
    const v2 = JSON.parse(V2_TEXT);
    const { profile } = parseSave(V2_TEXT, NOW);
    expect(profile.tickets).toBe(v2.tickets);
    expect(profile.nightUnlocked).toBe(v2.nightUnlocked);
    expect(profile.bestNight).toBe(v2.bestNight);
    expect(profile.upgrades).toEqual(v2.upgrades);
    expect(profile.unlockedWeapons).toEqual(v2.unlockedWeapons);
    expect(profile.playtimeSeconds).toBe(v2.playtimeSeconds);
    expect(profile.daily).toEqual(v2.daily);
    expect(profile.createdAt).toBe(v2.createdAt);
  });

  it('derives the same routeSeed every time it migrates the same save', () => {
    expect(parseSave(V2_TEXT, NOW + 5000).profile.routeSeed).toBe(parseSave(V2_TEXT, NOW).profile.routeSeed);
  });

  it('uses the higher of bestNight and nightUnlocked - 1 for bestDepth', () => {
    expect(normalizeSave({ version: 2, nightUnlocked: 9, bestNight: 2 }, NOW).route.bestDepth).toBe(8);
    expect(normalizeSave({ version: 2, nightUnlocked: 1, bestNight: 0 }, NOW).route.bestDepth).toBe(0);
  });

  it('migrates legacy v0 saves too', () => {
    const p = normalizeSave({ tickets: 250, night: 3, best: 2 }, NOW);
    expect(p.materials.scrap).toBe(250);
    expect(p.route.bestDepth).toBe(2);
  });

  it('does not run the migration again on a v3 save', () => {
    const p = normalizeSave({ version: 3, tickets: 500, nightUnlocked: 6, bestNight: 5, materials: { scrap: 3 } }, NOW);
    expect(p.materials).toEqual({ scrap: 3, parts: 0, supplies: 0 });
    expect(p.route.bestDepth).toBe(0);
  });

  it('round-trips materials, route and routeSeed through storage', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    const p = createFreshProfile(NOW);
    p.materials = { scrap: 12, parts: 3, supplies: 7 };
    p.routeSeed = 4242;
    p.route = { depth: 14, checkpoint: 10, segmentSeed: deriveSegmentSeed(4242, 1), path: [2, 0, 1], bestDepth: 17 };
    expect(saveProfile(p, storage)).toBe(true);
    const loaded = loadProfile(storage, NOW);
    expect(loaded.materials).toEqual(p.materials);
    expect(loaded.routeSeed).toBe(4242);
    expect(loaded.route).toEqual(p.route);
  });

  it('repairs hostile or inconsistent route data instead of trusting it', () => {
    const bad = [
      { depth: -5, checkpoint: 99, path: 'x', bestDepth: 'deep' },
      { depth: 14, checkpoint: 10, path: [1], bestDepth: 3 },
      { depth: 14, checkpoint: 20, path: [9, -1, 'a', 1.5], bestDepth: 1e12 },
      null,
      [],
    ];
    for (const route of bad) {
      const p = normalizeSave({ version: 3, routeSeed: 77, route, materials: { scrap: -4, parts: 'x', supplies: 1e15 } }, NOW);
      const r = p.route;
      expect(r.depth).toBeGreaterThanOrEqual(1);
      expect(r.checkpoint % SEGMENT_LENGTH).toBe(0);
      expect(r.checkpoint).toBeLessThan(r.depth);
      expect(r.path).toHaveLength((r.depth - 1) % SEGMENT_LENGTH);
      expect(r.path.every((i) => Number.isInteger(i) && i >= 0 && i <= 3)).toBe(true);
      expect(r.segmentSeed).toBe(deriveSegmentSeed(77, segmentIndexOf(r.depth)));
      expect(r.bestDepth).toBeGreaterThanOrEqual(0);
      expect(r.bestDepth).toBeLessThan(1e12);
      expect(p.materials.scrap).toBe(0);
      expect(p.materials.parts).toBe(0);
      expect(p.materials.supplies).toBeLessThan(1e15);
    }
  });

  it('falls back to a fresh v3 profile on corrupt input as before', () => {
    const { profile, recovered, reason } = parseSave('{"tickets": 5, nope', NOW);
    expect(recovered).toBe(true);
    expect(reason).toBe('invalid_json');
    expect(profile.version).toBe(3);
    expect(profile.materials).toEqual({ scrap: 0, parts: 0, supplies: 0 });
    expect(profile.route.depth).toBe(1);
  });
});
