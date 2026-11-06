import type { EnemyType, RunResult, WeaponId } from '../sim/types';
import { makeRng, nextFloat, nextInt } from '../sim/rng';

export type ContractKind = 'kill_type' | 'kills_total' | 'survive' | 'night_clear' | 'weapon_only';

export interface Contract {
  id: string;
  kind: ContractKind;
  targetType?: EnemyType;
  weaponId?: WeaponId;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
  text: string;
}

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const ENEMY_LABELS: Record<string, string> = {
  fyllo: 'fyllon',
  duva: 'duvor',
  skugga: 'skuggor',
  vaktmastare: 'vaktmästare',
  sparkcykel: 'elsparkcyklar',
};

const WEAPON_LABELS: Record<string, string> = {
  nyckel: 'Nyckel',
  korv: 'Grillkorv',
  telefon: 'Laddad telefon',
  spray: 'Sprayburk',
  vagn: 'Kundvagn',
  ficklampa: 'Ficklampa',
};

/** Deterministic daily contract set. Same day + night = same three contracts. */
export function generateContracts(dayKey: string, night: number): Contract[] {
  const rng = makeRng(hashString(`${dayKey}:${night}`));
  const out: Contract[] = [];

  const killTargets: { type: EnemyType; count: number }[] = [
    { type: 'duva', count: 120 + nextInt(rng, 8) * 20 },
    { type: 'fyllo', count: 40 + nextInt(rng, 5) * 10 },
    { type: 'skugga', count: 30 + nextInt(rng, 5) * 10 },
    { type: 'sparkcykel', count: 18 + nextInt(rng, 4) * 6 },
  ];
  const killPick = killTargets[nextInt(rng, killTargets.length)];
  out.push({
    id: 'c1',
    kind: 'kill_type',
    targetType: killPick.type,
    target: killPick.count,
    progress: 0,
    reward: 120 + nextInt(rng, 5) * 30,
    claimed: false,
    text: `Döda ${killPick.count} ${ENEMY_LABELS[killPick.type] ?? killPick.type}`,
  });

  const weaponPick = (['nyckel', 'korv', 'spray'] as WeaponId[])[nextInt(rng, 3)];
  const surviveSeconds = 90 + nextInt(rng, 5) * 15;
  out.push({
    id: 'c2',
    kind: 'weapon_only',
    weaponId: weaponPick,
    target: surviveSeconds,
    progress: 0,
    reward: 150 + nextInt(rng, 5) * 25,
    claimed: false,
    text: `Överlev till ${formatClockTarget(surviveSeconds)} med bara ${WEAPON_LABELS[weaponPick]}`,
  });

  if (nextFloat(rng) < 0.55) {
    out.push({
      id: 'c3',
      kind: 'night_clear',
      target: 1,
      progress: 0,
      reward: 220 + night * 30,
      claimed: false,
      text: `Klara natt ${night} utan att missa bussen`,
    });
  } else {
    const totalTarget = 260 + nextInt(rng, 6) * 30;
    out.push({
      id: 'c3',
      kind: 'kills_total',
      target: totalTarget,
      progress: 0,
      reward: 180 + nextInt(rng, 5) * 30,
      claimed: false,
      text: `Döda ${totalTarget} fiender under en natt`,
    });
  }

  return out;
}

function formatClockTarget(seconds: number): string {
  const total = 23 * 60 + seconds;
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Progress one run against the active contracts. Returns a new array. */
export function updateContracts(contracts: Contract[], run: RunResult): Contract[] {
  return contracts.map((c) => {
    if (c.claimed) return c;
    let progress = c.progress;
    switch (c.kind) {
      case 'kill_type':
        progress += c.targetType ? (run.killsByType[c.targetType] ?? 0) : 0;
        break;
      case 'kills_total':
        progress += run.kills;
        break;
      case 'survive':
        progress = Math.max(progress, Math.floor(run.time));
        break;
      case 'night_clear':
        if (run.won && run.night >= c.target) progress = c.target;
        break;
      case 'weapon_only': {
        const allowed = c.weaponId;
        if (allowed) {
          const onlyThat = run.weapons.every((w) => w === allowed || w === `${allowed}_evo`);
          if (onlyThat) progress = Math.max(progress, Math.floor(run.time));
        }
        break;
      }
    }
    return { ...c, progress: Math.min(c.target, progress) };
  });
}

export function isContractComplete(c: Contract): boolean {
  return c.progress >= c.target;
}

export function claimContractReward(contracts: Contract[], id: string): { contracts: Contract[]; reward: number } {
  let reward = 0;
  const next = contracts.map((c) => {
    if (c.id !== id || c.claimed || !isContractComplete(c)) return c;
    reward = c.reward;
    return { ...c, claimed: true };
  });
  return { contracts: next, reward };
}

export function completeContractByAd(contracts: Contract[], id: string): Contract[] {
  return contracts.map((c) => (c.id === id ? { ...c, progress: c.target, claimed: true } : c));
}