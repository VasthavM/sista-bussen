import { describe, expect, it } from 'vitest';
import { adsOfferable } from '../src/monetize/ads';
import { REWARDED_ONBOARDING_FREE_MINUTES } from '../src/monetize/catalog';
import { SAVE_VERSION, createFreshProfile, normalizeSave, parseSave } from '../src/meta/save';

const NOW = 1_800_000_000_000;
const GATE_SECONDS = REWARDED_ONBOARDING_FREE_MINUTES * 60;

describe('playtime in the save', () => {
  it('starts a fresh profile at zero', () => {
    expect(createFreshProfile(NOW).playtimeSeconds).toBe(0);
  });

  it('migrates a v1 save without the field to 0 and keeps the rest', () => {
    const v1 = JSON.stringify({ version: 1, createdAt: NOW, tickets: 321, nightUnlocked: 3, bestNight: 2 });
    const { profile, recovered } = parseSave(v1, NOW);
    expect(recovered).toBe(false);
    expect(profile.playtimeSeconds).toBe(0);
    expect(profile.tickets).toBe(321);
    expect(profile.nightUnlocked).toBe(3);
    expect(profile.version).toBe(SAVE_VERSION);
  });

  it('keeps stored playtime', () => {
    expect(normalizeSave({ version: SAVE_VERSION, nightUnlocked: 1, playtimeSeconds: 123.5 }, NOW).playtimeSeconds).toBe(123.5);
  });

  it('clamps hostile playtime values', () => {
    for (const bad of [-5, NaN, Infinity, '600', null, {}, []]) {
      const p = normalizeSave({ version: SAVE_VERSION, nightUnlocked: 1, playtimeSeconds: bad }, NOW);
      expect(p.playtimeSeconds).toBe(0);
    }
    expect(normalizeSave({ version: SAVE_VERSION, nightUnlocked: 1, playtimeSeconds: 1e15 }, NOW).playtimeSeconds).toBeLessThan(1e15);
  });

  it('falls back to 0 on the corrupt-save path', () => {
    expect(parseSave('{broken', NOW).profile.playtimeSeconds).toBe(0);
  });
});

describe('adsOfferable', () => {
  it('uses a 12 minute gate', () => {
    expect(REWARDED_ONBOARDING_FREE_MINUTES).toBe(12);
  });

  it('hides offers for a fresh profile and just below the gate', () => {
    expect(adsOfferable({ playtimeSeconds: 0 })).toBe(false);
    expect(adsOfferable({ playtimeSeconds: GATE_SECONDS - 1 })).toBe(false);
  });

  it('shows offers at and past the gate', () => {
    expect(adsOfferable({ playtimeSeconds: GATE_SECONDS })).toBe(true);
    expect(adsOfferable({ playtimeSeconds: GATE_SECONDS + 1 })).toBe(true);
  });
});
