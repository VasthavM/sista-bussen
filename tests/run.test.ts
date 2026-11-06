import { describe, expect, it } from 'vitest';
import { RUN_DURATION } from '../src/sim/curve';
import { stepRun } from '../src/sim/step';
import { applyChoice, rollChoices } from '../src/sim/upgrades';
import { WORLD, createRun } from '../src/sim/state';
import { EMPTY_MODS, type RunConfig, type SimState } from '../src/sim/types';

const DT = 1 / 60;

function makeRun(seed: number, night = 1): SimState {
  const config: RunConfig = {
    seed,
    night,
    character: 'nattvandraren',
    weapon: 'nyckel',
    mods: { ...EMPTY_MODS },
  };
  return createRun(config);
}

/**
 * Scripted dodge input: kites around the arena centre, avoids nearby enemies and
 * sidesteps enemy projectiles. This is the "good but not perfect player" proxy.
 */
function dodgeInput(t: number, state: SimState): { x: number; y: number } {
  const cx = WORLD.w / 2;
  const cy = WORLD.h / 2;
  const dx = state.player.x - cx;
  const dy = state.player.y - cy;
  const r = Math.hypot(dx, dy) || 1;
  if (r < 24) return { x: 1, y: 0 };

  const dir = Math.floor(t / 21) % 2 === 0 ? 1 : -1;
  let tx = (-dy / r) * dir;
  let ty = (dx / r) * dir;
  const radial = (330 - r) / 330;
  tx += (dx / r) * radial;
  ty += (dy / r) * radial;

  for (const e of state.enemies) {
    const ex = state.player.x - e.x;
    const ey = state.player.y - e.y;
    const d = Math.hypot(ex, ey) || 1;
    if (d < 150) {
      const w = (1 - d / 150) * 1.6;
      tx += (ex / d) * w;
      ty += (ey / d) * w;
    }
  }

  for (const shot of state.enemyShots) {
    if (!shot.active) continue;
    const ex = state.player.x - shot.x;
    const ey = state.player.y - shot.y;
    const d = Math.hypot(ex, ey) || 1;
    if (d < 110) {
      const w = (1 - d / 110) * 3;
      tx += (ex / d) * w;
      ty += (ey / d) * w;
    }
  }

  const len = Math.hypot(tx, ty) || 1;
  return { x: tx / len, y: ty / len };
}

/** A player taking the best card they are offered. */
function autoPick(state: SimState): void {
  while (state.pendingLevelUps > 0) {
    const choices = rollChoices(state, 3);
    if (choices.length === 0) {
      state.pendingLevelUps = 0;
      break;
    }
    const wantNew = state.weapons.length < 4;
    const priority: Record<string, number> = {
      evolution: 0,
      'weapon:nyckel': 1,
      'passive:handskar': 2,
      new: wantNew ? 1 : 6,
      weapon: wantNew ? 6 : 3,
      passive: 5,
    };
    const score = (c: (typeof choices)[number]) => priority[c.id] ?? priority[c.rarity] ?? 9;
    const pick = choices.slice().sort((a, b) => score(a) - score(b))[0];
    applyChoice(state, pick);
  }
}

function hashState(state: SimState): string {
  return [
    state.time.toFixed(3),
    state.status,
    state.player.x.toFixed(2),
    state.player.y.toFixed(2),
    state.player.hp.toFixed(2),
    state.level,
    state.kills,
    Math.round(state.change * 100),
    state.enemies.length,
    state.weapons.map((w) => `${w.id}:${w.level}:${w.evolved ? 1 : 0}`).join(','),
    Object.entries(state.passives)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(','),
  ].join('|');
}

function simulate(
  seconds: number,
  seed: number,
  input: (t: number, state: SimState) => { x: number; y: number },
) {
  const state = makeRun(seed);
  const steps = Math.ceil(seconds / DT);
  for (let i = 0; i < steps; i++) {
    stepRun(state, DT, input(state.time, state));
    autoPick(state);
  }
  return state;
}

describe('deterministic run', () => {
  it('produces an identical state for identical seed and inputs', () => {
    const a = simulate(60, 4242, dodgeInput);
    const b = simulate(60, 4242, dodgeInput);
    expect(hashState(a)).toBe(hashState(b));
    expect(a.kills).toBeGreaterThan(0);
    expect(a.time).toBeCloseTo(60, 1);
  });

  it('diverges when the seed changes', () => {
    const a = simulate(60, 1, dodgeInput);
    const b = simulate(60, 2, dodgeInput);
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('advances the sim and levels up during a real run', () => {
    const state = simulate(120, 777, dodgeInput);
    expect(state.time).toBeGreaterThan(118);
    expect(state.kills).toBeGreaterThan(30);
    expect(state.level).toBeGreaterThan(3);
    expect(state.enemies.length).toBeGreaterThan(0);
  });
});

describe('full night', () => {
  it('reaches 03:00 with a scripted dodge input', () => {
    const state = simulate(RUN_DURATION + 1, 2024, dodgeInput);
    expect(state.status).toBe('won');
    expect(state.time).toBeGreaterThanOrEqual(RUN_DURATION);
    expect(state.kills).toBeGreaterThan(150);
    expect(state.level).toBeGreaterThanOrEqual(6);
    expect(state.change).toBeGreaterThan(100);
  });

  it('dies without input', () => {
    const state = simulate(120, 2024, () => ({ x: 0, y: 0 }));
    expect(state.status).toBe('dead');
    expect(state.player.hp).toBe(0);
    expect(state.time).toBeLessThan(120);
  });

  it('never exceeds the live enemy cap across a whole night', () => {
    const state = simulate(RUN_DURATION, 31, dodgeInput);
    expect(state.enemies.length).toBeLessThanOrEqual(180);
    expect(state.spawn.totalSpawned).toBeGreaterThan(200);
  });
});