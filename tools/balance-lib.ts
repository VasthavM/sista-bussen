/**
 * Balance harness core. Headless bot runs against the sim in src/sim (import only).
 * Loaded by tools/balance.mjs (Node type stripping + tools/ts-hooks.mjs) and by vitest.
 * Type-only imports MUST use `import type`: Node strips them, it cannot elide plain imports.
 */
import type { MapConfig } from '../src/sim/map';
import { EMPTY_MODS } from '../src/sim/types';
import type {
  CharacterId,
  MetaMods,
  RunConfig,
  SimState,
  UpgradeChoice,
  WeaponId,
  WeaponInstance,
} from '../src/sim/types';
import { WEAPONS, WEAPON_ORDER } from '../src/sim/content';
import { makeRng, nextFloat } from '../src/sim/rng';
import { defaultMapConfig, fuelQuotaFor } from '../src/sim/objective';
import { WORLD, createRun } from '../src/sim/state';
import { stepRun } from '../src/sim/step';
import { applyChoice, rollChoices } from '../src/sim/upgrades';

const DT = 1 / 60;
/** Safety net so a bot that never reaches the bus cannot loop forever. Counts as not extracted. */
const MAX_MAP_SECONDS = 900;

export interface BalanceConfig {
  /** Map depth (difficulty). */
  depth: number;
  /** Fuel quota override. Default: fuelQuotaFor(depth). */
  quota?: number;
  character: CharacterId;
  weapon: WeaponId;
  /** 'random' | 'greedy' | 'rush' (rush the starting weapon) | 'rush:<weaponId>' */
  policy: string;
  mods: Partial<MetaMods>;
  n: number;
  baseSeed: number;
}

export interface RunSummary {
  seed: number;
  extracted: boolean;
  /** Seconds of sim time when the map ended (extraction or death). */
  endTime: number;
  /** Seconds when the quota was met, or null if it never was. */
  quotaTime: number | null;
  fuel: number;
  finalLevel: number;
  kills: number;
  peakEnemies: number;
  owned: WeaponId[];
  evolved: WeaponId[];
  /** Raw damage per weapon id (evolved forms count under the base id). Sums to damageDealt. */
  damage: Record<string, number>;
  damageDealt: number;
}

export interface ConfigReport {
  config: BalanceConfig & { policy: string };
  runs: number;
  extractRate: number;
  /** Share of runs that met the fuel quota (extracted or died on the way to the bus). */
  quotaRate: number;
  endTime: { median: number; p10: number; p90: number };
  /** Median seconds to meet the quota, over runs that did. */
  timeToQuota: { median: number | null; runs: number };
  /** Median seconds to extract, over runs that did. */
  timeToExtract: { median: number | null; runs: number };
  /** Level when the map ended, only for runs that extracted. */
  levelAtExtract: { median: number | null; runsReached: number };
  finalLevelMedian: number;
  peakEnemies: { median: number; max: number };
  weapons: Record<WeaponId, { ownedRate: number; evolutionRate: number; damageShare: number }>;
}

// ---------------------------------------------------------------- bot movement

/**
 * Kiting vector, ported from tests/run.test.ts dodgeInput: orbits the arena centre, is pushed away
 * by enemies within 150px and sidesteps enemy shots within 110px. `orbit` scales the orbit terms
 * (tangent + pull back to radius 330); the avoidance terms always count in full.
 */
function kiteVector(state: SimState, orbit: number): { x: number; y: number } {
  const t = state.time;
  const cx = WORLD.w / 2;
  const cy = WORLD.h / 2;
  const dx = state.player.x - cx;
  const dy = state.player.y - cy;
  const r = Math.hypot(dx, dy) || 1;

  const dir = Math.floor(t / 21) % 2 === 0 ? 1 : -1;
  let tx = ((-dy / r) * dir + (dx / r) * ((330 - r) / 330)) * orbit;
  let ty = ((dx / r) * dir + (dy / r) * ((330 - r) / 330)) * orbit;

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
  return { x: tx, y: ty };
}

function unit(v: { x: number; y: number }): { x: number; y: number } {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

/** Pure kiting, the old night-1 bot. Kept for the attribution test and as the no-objective fallback. */
export function kiteInput(state: SimState): { x: number; y: number } {
  const r = Math.hypot(state.player.x - WORLD.w / 2, state.player.y - WORLD.h / 2);
  if (r < 24) return { x: 1, y: 0 };
  return unit(kiteVector(state, 1));
}

/** How much of the orbit survives while the bot walks to a goal, and how hard the goal pulls. */
export const BOT_ORBIT_WHILE_SEEKING = 0.3;
export const BOT_GOAL_PULL = 1.2;

/** The nearest uncollected canister, or the bus once the quota is met. */
export function botTarget(state: SimState): { x: number; y: number } | null {
  if (state.quotaMet) return state.bus;
  let best: { x: number; y: number } | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const c of state.canisters) {
    if (!c.active || state.time < c.at) continue;
    const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/**
 * Objective bot: kites like the old bot, but leans toward the nearest canister until the quota is
 * met, then toward the bus. Enemy and shot avoidance still apply.
 */
export function botInput(state: SimState): { x: number; y: number } {
  const goal = botTarget(state);
  if (!goal) return kiteInput(state);
  const v = kiteVector(state, BOT_ORBIT_WHILE_SEEKING);
  const gx = goal.x - state.player.x;
  const gy = goal.y - state.player.y;
  const gd = Math.hypot(gx, gy) || 1;
  return unit({ x: v.x + (gx / gd) * BOT_GOAL_PULL, y: v.y + (gy / gd) * BOT_GOAL_PULL });
}

// ---------------------------------------------------------------- card policies

export type Policy = (state: SimState, choices: UpgradeChoice[]) => UpgradeChoice;

const MAX_GREEDY_WEAPONS = 4;

/** Lower is better. Damage first: evolution, then deeper owned weapons, damage passives, then new weapons. */
function greedyScore(state: SimState, c: UpgradeChoice): number {
  if (c.kind === 'evolution') return 0;
  if (c.kind === 'weapon') {
    const owned = state.weapons.some((w) => w.id === c.weaponId);
    if (owned) return 1;
    return state.weapons.length < MAX_GREEDY_WEAPONS ? 3 : 9;
  }
  switch (c.passiveId) {
    case 'handskar':
      return 2;
    case 'laddare':
      return 4;
    case 'senap':
      return 5;
    case 'tandstickor':
      return 6;
    default:
      return 8;
  }
}

function lowest(state: SimState, choices: UpgradeChoice[], score: (c: UpgradeChoice) => number): UpgradeChoice {
  let best = choices[0];
  let bestScore = score(best);
  for (let i = 1; i < choices.length; i++) {
    const s = score(choices[i]);
    if (s < bestScore) {
      best = choices[i];
      bestScore = s;
    }
  }
  return best;
}

/**
 * Policy RNG is separate from the sim RNG so a policy never perturbs the sim's rolls.
 * `rush` resolves to the starting weapon.
 */
export function makePolicy(name: string, startWeapon: WeaponId, seed: number): Policy {
  if (name === 'random') {
    const rng = makeRng((seed ^ 0x9e3779b9) >>> 0);
    return (_s, choices) => choices[Math.min(choices.length - 1, Math.floor(nextFloat(rng) * choices.length))];
  }
  if (name === 'greedy') return (s, choices) => lowest(s, choices, (c) => greedyScore(s, c));
  if (name === 'rush' || name.startsWith('rush:')) {
    const target = (name === 'rush' ? startWeapon : name.slice(5)) as WeaponId;
    if (!WEAPONS[target]) throw new Error(`unknown weapon in policy: ${name}`);
    const passive = WEAPONS[target].passive;
    return (s, choices) =>
      lowest(s, choices, (c) => {
        if (c.id === `evo:${target}`) return -4;
        if (c.id === `weapon:${target}`) return -3;
        if (c.id === `passive:${passive}`) return -2;
        if (c.kind === 'evolution') return -1;
        // A rusher keeps the pool narrow: no other new weapon unless nothing else is on offer.
        if (c.kind === 'weapon' && !s.weapons.some((w) => w.id === c.weaponId)) return 20;
        return greedyScore(s, c);
      });
  }
  throw new Error(`unknown policy: ${name} (use random | greedy | rush | rush:<weapon>)`);
}

export function resolvePolicy(name: string, weapon: WeaponId): string {
  return name === 'rush' ? `rush:${weapon}` : name;
}

// ---------------------------------------------------------------- damage attribution

/**
 * The sim only keeps a total `damageDealt`. To split it per weapon without touching src/sim, shadow
 * a few fields with accessors that record "who is acting right now":
 *  - weapon.cooldown is written right before that weapon fires (orbit, chain, beam hit instantly)
 *  - projectile.life / areaEffect.life are written at the top of each projectile / area update
 * then the damageDealt setter books each increment to the current actor. Pooled objects are hooked
 * on push (before their first update). Verified by tests: instrumented run is identical to a plain one
 * and the per-weapon sum equals damageDealt.
 */
function attachAttribution(state: SimState): { damage: Record<string, number> } {
  const damage: Record<string, number> = {};
  let actor: string = state.weapons[0].id;
  let total = state.damageDealt;

  Object.defineProperty(state, 'damageDealt', {
    configurable: true,
    enumerable: true,
    get: () => total,
    set: (v: number) => {
      damage[actor] = (damage[actor] ?? 0) + (v - total);
      total = v;
    },
  });

  const hookLife = (obj: { life: number }, who: () => string) => {
    let life = obj.life;
    Object.defineProperty(obj, 'life', {
      configurable: true,
      enumerable: true,
      get: () => life,
      set: (v: number) => {
        life = v;
        actor = who();
      },
    });
  };
  const hookWeapon = (w: WeaponInstance) => {
    let cooldown = w.cooldown;
    Object.defineProperty(w, 'cooldown', {
      configurable: true,
      enumerable: true,
      get: () => cooldown,
      set: (v: number) => {
        cooldown = v;
        actor = w.id;
      },
    });
  };
  const hookPush = <T>(arr: T[], hook: (item: T) => void) => {
    const push = Array.prototype.push;
    Object.defineProperty(arr, 'push', {
      configurable: true,
      value: (...items: T[]) => {
        for (const it of items) hook(it);
        return push.apply(arr, items);
      },
    });
    for (const it of arr) hook(it);
  };

  hookPush(state.weapons, hookWeapon);
  // 'korv' | 'vagn' projectile kind is written after push, so read it lazily.
  hookPush(state.projectiles, (p) => hookLife(p, () => p.kind));
  // Cone is the spray. The fire pools: spray evolution radius 96, flashlight evolution radius 110.
  hookPush(state.areaEffects, (a) => hookLife(a, () => (a.kind === 'cone' || a.radius === 96 ? 'spray' : 'ficklampa')));
  return { damage };
}

// ---------------------------------------------------------------- one map

export function simulateMap(cfg: BalanceConfig, seed: number): RunSummary {
  const map: MapConfig = { ...defaultMapConfig(seed, cfg.depth), ...(cfg.quota === undefined ? {} : { fuelQuota: cfg.quota }) };
  const config: RunConfig = {
    character: cfg.character,
    weapon: cfg.weapon,
    mods: { ...EMPTY_MODS, ...cfg.mods },
    map,
  };
  const state = createRun(config);
  const policy = makePolicy(cfg.policy, cfg.weapon, seed);
  const { damage } = attachAttribution(state);
  let peak = 0;
  let quotaTime: number | null = null;

  while (state.status === 'running' && state.time < MAX_MAP_SECONDS) {
    stepRun(state, DT, botInput(state));
    if (state.enemies.length > peak) peak = state.enemies.length;
    if (quotaTime === null && state.quotaMet) quotaTime = state.time;
    while (state.pendingLevelUps > 0) {
      const choices = rollChoices(state, 3);
      if (choices.length === 0) {
        state.pendingLevelUps = 0;
        break;
      }
      applyChoice(state, policy(state, choices));
    }
  }

  return {
    seed,
    extracted: state.status === 'extracted',
    endTime: state.time,
    quotaTime,
    fuel: state.fuel,
    finalLevel: state.level,
    kills: state.kills,
    peakEnemies: peak,
    owned: state.weapons.map((w) => w.id),
    evolved: state.weapons.filter((w) => w.evolved).map((w) => w.id),
    damage,
    damageDealt: state.damageDealt,
  };
}

export function simulateRange(cfg: BalanceConfig, from: number, count: number): RunSummary[] {
  const out: RunSummary[] = [];
  for (let i = from; i < from + count; i++) out.push(simulateMap(cfg, (cfg.baseSeed + i) >>> 0));
  return out;
}

// ---------------------------------------------------------------- aggregation

/** Nearest-rank percentile on a sorted copy (no interpolation, so it is always an observed value). */
export function percentile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.round(q * (sorted.length - 1))];
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

const median = (values: number[]): number | null => (values.length ? r2(percentile(values, 0.5)) : null);

export function summarise(cfg: BalanceConfig, runs: RunSummary[]): ConfigReport {
  const n = runs.length;
  const out = runs.filter((r) => r.extracted);
  const quota = runs.filter((r) => r.quotaTime !== null);
  const totalDamage = runs.reduce((s, r) => s + Object.values(r.damage).reduce((a, b) => a + b, 0), 0);
  const weapons = {} as ConfigReport['weapons'];
  for (const id of WEAPON_ORDER) {
    const dmg = runs.reduce((s, r) => s + (r.damage[id] ?? 0), 0);
    weapons[id] = {
      ownedRate: r4(runs.filter((r) => r.owned.includes(id)).length / n),
      evolutionRate: r4(runs.filter((r) => r.evolved.includes(id)).length / n),
      damageShare: r4(totalDamage > 0 ? dmg / totalDamage : 0),
    };
  }
  const ends = runs.map((r) => r.endTime);
  return {
    config: { ...cfg, quota: cfg.quota ?? fuelQuotaFor(cfg.depth), policy: resolvePolicy(cfg.policy, cfg.weapon) },
    runs: n,
    extractRate: r4(out.length / n),
    quotaRate: r4(quota.length / n),
    endTime: { median: r2(percentile(ends, 0.5)), p10: r2(percentile(ends, 0.1)), p90: r2(percentile(ends, 0.9)) },
    timeToQuota: { median: median(quota.map((r) => r.quotaTime as number)), runs: quota.length },
    timeToExtract: { median: median(out.map((r) => r.endTime)), runs: out.length },
    levelAtExtract: {
      median: out.length ? percentile(out.map((r) => r.finalLevel), 0.5) : null,
      runsReached: out.length,
    },
    finalLevelMedian: percentile(runs.map((r) => r.finalLevel), 0.5),
    peakEnemies: {
      median: percentile(runs.map((r) => r.peakEnemies), 0.5),
      max: Math.max(...runs.map((r) => r.peakEnemies)),
    },
    weapons,
  };
}

export function runConfigSync(cfg: BalanceConfig): ConfigReport {
  return summarise(cfg, simulateRange(cfg, 0, cfg.n));
}

// ---------------------------------------------------------------- markdown

const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;
const mmss = (s: number | null) => (s === null ? 'n/a' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);

/** Short table for one config: headline row plus one row per weapon. */
export function renderConfigTable(r: ConfigReport): string {
  const c = r.config;
  const lvl = r.levelAtExtract.median === null ? 'n/a' : String(r.levelAtExtract.median);
  const lines = [
    `### Depth ${c.depth}, quota ${c.quota}, ${c.character}, start ${c.weapon}, policy ${c.policy}, N=${r.runs}, seed ${c.baseSeed}`,
    '',
    '| extraction rate | reached quota | median time to quota | median time to extract | level at extract | peak live enemies (median / max) |',
    '|---|---|---|---|---|---|',
    `| ${pct(r.extractRate)} | ${pct(r.quotaRate)} | ${mmss(r.timeToQuota.median)} (n=${r.timeToQuota.runs}) | ${mmss(r.timeToExtract.median)} (n=${r.timeToExtract.runs}) | ${lvl} (n=${r.levelAtExtract.runsReached}) | ${r.peakEnemies.median} / ${r.peakEnemies.max} |`,
    '',
    '| weapon | owned | evolved | damage share |',
    '|---|---|---|---|',
  ];
  for (const id of WEAPON_ORDER) {
    const w = r.weapons[id];
    lines.push(`| ${id} | ${pct(w.ownedRate)} | ${pct(w.evolutionRate)} | ${pct(w.damageShare)} |`);
  }
  return lines.join('\n');
}

/** Baseline layout: per starting weapon, one headline table over depths and one weapon table over depths. */
export function renderBaselineTables(reports: ConfigReport[]): string {
  const starts = [...new Set(reports.map((r) => r.config.weapon))];
  const out: string[] = [];
  for (const start of starts) {
    const rs = reports.filter((r) => r.config.weapon === start).sort((a, b) => a.config.depth - b.config.depth);
    const first = rs[0].config;
    out.push(`### Start weapon: ${start} (${WEAPONS[start].name})`, '');
    out.push(`Policy \`${first.policy}\`, ${first.character}, N=${first.n} per depth, base seed ${first.baseSeed}.`, '');
    out.push('| depth | quota | extraction rate | reached quota | time to quota (median) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |');
    out.push('|---|---|---|---|---|---|---|---|---|');
    for (const r of rs) {
      out.push(
        `| ${r.config.depth} | ${r.config.quota} | ${pct(r.extractRate)} | ${pct(r.quotaRate)} | ${mmss(r.timeToQuota.median)} | ${mmss(r.timeToExtract.median)} | ${mmss(r.endTime.median)} (${mmss(r.endTime.p10)}-${mmss(r.endTime.p90)}) | ${r.finalLevelMedian} | ${r.peakEnemies.median} / ${r.peakEnemies.max} |`,
      );
    }
    out.push('', `Evolved % of all runs / damage share, per weapon:`, '');
    out.push(`| weapon | ${rs.map((r) => `depth ${r.config.depth}`).join(' | ')} |`);
    out.push(`|---|${rs.map(() => '---').join('|')}|`);
    for (const id of WEAPON_ORDER) {
      const mark = id === start ? ' (start)' : '';
      out.push(
        `| ${id}${mark} | ${rs.map((r) => `${pct(r.weapons[id].evolutionRate)} / ${pct(r.weapons[id].damageShare)}`).join(' | ')} |`,
      );
    }
    out.push('');
  }
  return out.join('\n');
}
