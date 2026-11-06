import { describe, expect, it } from 'vitest';
import {
  RUN_DURATION,
  XP_CURVE_BASE,
  clockLabel,
  nightDifficulty,
  spawnIntensityAt,
  spawnRateAt,
  totalXpForLevel,
  xpForLevel,
} from '../src/sim/curve';

describe('XP / level curve', () => {
  it('matches the specified 40 * level^1.35 curve', () => {
    for (const level of [1, 2, 5, 10, 20]) {
      expect(xpForLevel(level)).toBe(Math.round(XP_CURVE_BASE * Math.pow(level, 1.35)));
    }
    expect(xpForLevel(1)).toBe(40);
  });

  it('is strictly increasing so later levels always cost more', () => {
    let previous = 0;
    for (let level = 1; level <= 40; level++) {
      const need = xpForLevel(level);
      expect(need).toBeGreaterThan(previous);
      previous = need;
    }
  });

  it('accumulates total XP correctly', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(xpForLevel(1));
    expect(totalXpForLevel(4)).toBe(xpForLevel(1) + xpForLevel(2) + xpForLevel(3));
  });
});

describe('night difficulty', () => {
  it('scales exactly like the spec formula', () => {
    expect(nightDifficulty(1)).toBeCloseTo(1, 6);
    expect(nightDifficulty(2)).toBeCloseTo(1.18, 6);
    expect(nightDifficulty(10)).toBeCloseTo(2.62, 6);
  });

  it('never goes below 1 on invalid nights', () => {
    expect(nightDifficulty(0)).toBe(1);
    expect(nightDifficulty(-5)).toBe(1);
  });
});

describe('spawn director intensity', () => {
  it('ramps upward across the run', () => {
    const samples = [0, 12, 30, 60, 90, 150, 210, 239];
    let previous = 0;
    for (const t of samples) {
      const value = spawnIntensityAt(t);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });

  it('caps at the run duration', () => {
    expect(spawnIntensityAt(400)).toBe(spawnIntensityAt(RUN_DURATION));
  });

  it('multiplies the whole curve by the night difficulty', () => {
    for (const t of [0, 45, 120, 200]) {
      expect(spawnRateAt(t, 2)).toBeCloseTo(spawnRateAt(t, 1) * 1.18, 6);
      expect(spawnRateAt(t, 5)).toBeCloseTo(spawnRateAt(t, 1) * (1 + 0.18 * 4), 6);
    }
  });

  it('keeps a mobile-friendly peak rate', () => {
    expect(spawnIntensityAt(RUN_DURATION)).toBeLessThan(5);
  });
});

describe('the 03:00 clock', () => {
  it('maps run time onto the night clock', () => {
    expect(clockLabel(0)).toBe('23:00');
    expect(clockLabel(30)).toBe('23:30');
    expect(clockLabel(60)).toBe('00:00');
    expect(clockLabel(150)).toBe('01:30');
    expect(clockLabel(210)).toBe('02:30');
    expect(clockLabel(240)).toBe('03:00');
  });
});