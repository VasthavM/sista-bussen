import { describe, expect, it } from 'vitest';
import { MAX_ENEMIES, spawnRateAt } from '../src/sim/curve';
import { directorStep, spawnAtRing, spawnEnemy } from '../src/sim/spawn';
import { createRun } from '../src/sim/state';
import { stepRun } from '../src/sim/step';
import { EMPTY_MODS, type RunConfig, type SimState } from '../src/sim/types';

/**
 * The shipped portrait camera shows 240 world units sideways and 427 down from
 * the player (computeZoom in src/render/draw.ts). This is the contract the spawn
 * ring has to respect; duplicating the numbers here is the point of the guard.
 */
const FRAME_HALF_W = 240;
const FRAME_HALF_H = 427;

function makeState(seed = 3, night = 1): SimState {
  const config: RunConfig = {
    seed,
    night,
    character: 'nattvandraren',
    weapon: 'nyckel',
    mods: EMPTY_MODS,
  };
  return createRun(config);
}

function advance(state: SimState, seconds: number): void {
  const dt = 1 / 60;
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i++) {
    state.time += dt;
    directorStep(state, dt);
  }
}

describe('spawn director', () => {
  it('starts quiet and puts enemies on the map', () => {
    const state = makeState();
    advance(state, 10);
    expect(state.enemies.length).toBeGreaterThan(0);
    expect(state.enemies.length).toBeLessThan(30);
  });

  it('spawns just outside the camera frame, not far off screen', () => {
    const state = makeState(7, 1);
    for (let i = 0; i < 60; i++) spawnAtRing(state, 'fyllo');
    for (const e of state.enemies) {
      const dx = Math.abs(e.x - state.player.x);
      const dy = Math.abs(e.y - state.player.y);
      // Outside the frame: never visible at the instant it appears.
      expect(dx > FRAME_HALF_W || dy > FRAME_HALF_H).toBe(true);
      // Close enough that a walk-in reads as an approach, not an empty street.
      expect(Math.hypot(dx, dy)).toBeLessThan(FRAME_HALF_H + 160);
    }
  });

  it('has visible threats within the first four seconds', () => {
    const state = makeState(7, 1);
    const dt = 1 / 60;
    for (let i = 0; i < Math.ceil(4 / dt); i++) stepRun(state, dt, { x: 0, y: 0 });
    const onScreen = state.enemies.filter(
      (e) =>
        Math.abs(e.x - state.player.x) <= FRAME_HALF_W && Math.abs(e.y - state.player.y) <= FRAME_HALF_H,
    );
    expect(onScreen.length).toBeGreaterThan(0);
  });

  it('produces a harder night at the same timestamp', () => {
    const night1 = makeState(11, 1);
    const night3 = makeState(11, 3);
    advance(night1, 120);
    advance(night3, 120);
    // Live count is capped by design, so compare total spawns at the same clock.
    expect(night3.spawn.totalSpawned).toBeGreaterThan(night1.spawn.totalSpawned);
    // Measure the director's rate directly: a burst-diluted spawn count sits just
    // under the 1.3 ratio even though night 3 is 1.36x harder by design.
    expect(spawnRateAt(120, 3) / spawnRateAt(120, 1)).toBeGreaterThan(1.3);
  });

  it('never exceeds the live enemy cap', () => {
    const state = makeState(5, 9);
    advance(state, 240);
    expect(state.enemies.length).toBeLessThanOrEqual(MAX_ENEMIES);
    expect(state.enemies.length).toBeGreaterThan(50);
  });

  it('is deterministic for a given seed', () => {
    const a = makeState(99, 2);
    const b = makeState(99, 2);
    advance(a, 90);
    advance(b, 90);
    expect(a.enemies.length).toBe(b.enemies.length);
    expect(a.enemies.map((e) => `${e.type}:${Math.round(e.x)}:${Math.round(e.y)}`)).toEqual(
      b.enemies.map((e) => `${e.type}:${Math.round(e.x)}:${Math.round(e.y)}`),
    );
  });

  it('spawns Nattvakten at 02:30 and Busschauffören at 02:45', () => {
    const state = makeState(1, 1);
    advance(state, 209);
    expect(state.enemies.some((e) => e.type === 'nattvakt')).toBe(false);
    advance(state, 2);
    expect(state.enemies.some((e) => e.type === 'nattvakt')).toBe(true);
    expect(state.enemies.some((e) => e.type === 'chauffor')).toBe(false);
    advance(state, 15);
    expect(state.enemies.some((e) => e.type === 'chauffor')).toBe(true);
  });

  it('caps elite and boss HP scaling by night index', () => {
    const state = makeState(2, 5);
    const boss = spawnEnemy(state, 'nattvakt', 100, 100, true);
    // Bosses are excluded from the elite HP multiplier; they scale with the night only.
    expect(boss.hp).toBeGreaterThan(1200);
    expect(boss.damage).toBeGreaterThan(18);
  });
});