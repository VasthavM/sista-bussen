import { describe, expect, it } from 'vitest';
import { createFreshProfile, type Profile } from '../src/meta/save';
import {
  EXPECTED_PER_DEPTH1_MAP,
  STARTER_WEAPONS,
  UPGRADE_NODES,
  WEAPON_UNLOCK_SCRAP,
  buy,
  buyBlock,
  canBuy,
  costOf,
  getNode,
  levelOf,
  modsFromProfileV2,
} from '../src/meta/upgrades-v2';
import { EMPTY_MODS } from '../src/sim/types';

const NOW = 1_800_000_000_000;

function withMaterials(scrap: number, parts: number, supplies: number): Profile {
  return { ...createFreshProfile(NOW), materials: { scrap, parts, supplies } };
}
const rich = (): Profile => withMaterials(1e8, 1e8, 1e8);

/** Buy in a loop until nothing more is buyable. */
function buyEverything(start: Profile): Profile {
  let p = start;
  for (let progressed = true; progressed; ) {
    progressed = false;
    for (const n of UPGRADE_NODES) {
      const next = buy(p, n.id);
      if (next) {
        p = next;
        progressed = true;
      }
    }
  }
  return p;
}

describe('upgrade data', () => {
  it('has unique ids and the three single trees plus the three combinations', () => {
    expect(new Set(UPGRADE_NODES.map((n) => n.id)).size).toBe(UPGRADE_NODES.length);
    expect(new Set(UPGRADE_NODES.map((n) => n.tree))).toEqual(new Set(['character', 'weapons', 'bus', 'evolution', 'mods', 'crew']));
  });

  it('gives each tree its design nodes at the design level counts', () => {
    const character = UPGRADE_NODES.filter((n) => n.tree === 'character');
    expect(character.map((n) => n.id).sort()).toEqual(['c_armor', 'c_hp', 'c_pickup', 'c_revive', 'c_speed']);
    expect(character.every((n) => n.maxLevel === 5)).toBe(true);
    expect(getNode('w_damage')!.maxLevel).toBe(5);
    expect(getNode('w_attack')!.maxLevel).toBe(5);
    for (const id of ['b_fuel', 'b_storage', 'b_turret', 'b_plow', 'b_radio', 'b_armor']) expect(getNode(id)).toBeDefined();
    expect(getNode('b_turret')!.maxLevel).toBe(1);
    expect(getNode('b_plow')!.maxLevel).toBe(1);
  });

  it('prices single trees in one material and combinations in two', () => {
    const mats = (id: string) => Object.keys(getNode(id)!.baseCost).sort();
    expect(UPGRADE_NODES.filter((n) => n.tree === 'character').every((n) => mats(n.id).join() === 'supplies')).toBe(true);
    expect(UPGRADE_NODES.filter((n) => n.tree === 'weapons').every((n) => mats(n.id).join() === 'scrap')).toBe(true);
    expect(UPGRADE_NODES.filter((n) => n.tree === 'bus').every((n) => mats(n.id).join() === 'parts')).toBe(true);
    expect(mats('evo_korv').join()).toBe('scrap,supplies');
    expect(mats('mod_pierce').join()).toBe('parts,scrap');
    expect(mats('crew_shield').join()).toBe('parts,supplies');
  });
});

describe('costs', () => {
  it('scale up with every level and never go to zero for a material the node uses', () => {
    for (const n of UPGRADE_NODES) {
      for (const m of Object.keys(n.baseCost) as (keyof typeof n.baseCost)[]) {
        let prev = 0;
        for (let l = 0; l < n.maxLevel; l++) {
          const c = costOf(n.id, l)[m]!;
          expect(c, `${n.id} L${l + 1} ${m}`).toBeGreaterThan(0);
          if (n.growth > 1) expect(c, `${n.id} L${l + 1} ${m} strictly rises`).toBeGreaterThan(prev);
          else expect(c).toBeGreaterThanOrEqual(prev);
          prev = c;
        }
      }
    }
  });

  it('first purchases are affordable after 3 depth-1 extractions at the stated per-map yield', () => {
    expect(EXPECTED_PER_DEPTH1_MAP).toEqual({ scrap: 650, parts: 16, supplies: 12 });
    const three = withMaterials(3 * 650, 3 * 16, 3 * 12);
    for (const n of UPGRADE_NODES) {
      const c = costOf(n.id, 0);
      expect(c.scrap, `${n.id} scrap`).toBeLessThanOrEqual(three.materials.scrap);
      expect(c.parts, `${n.id} parts`).toBeLessThanOrEqual(three.materials.parts);
      expect(c.supplies, `${n.id} supplies`).toBeLessThanOrEqual(three.materials.supplies);
    }
  });

  it('lets two maps buy the first two levels of each basic node', () => {
    for (const id of ['c_hp', 'c_speed', 'c_pickup', 'w_damage', 'b_fuel', 'b_storage']) {
      const total = { scrap: 0, parts: 0, supplies: 0 };
      for (const l of [0, 1]) {
        const c = costOf(id, l);
        total.scrap += c.scrap; total.parts += c.parts; total.supplies += c.supplies;
      }
      expect(total.scrap, id).toBeLessThanOrEqual(2 * 650 + 650); // levels 1 and 2 within three maps
      expect(total.parts, id).toBeLessThanOrEqual(3 * 16);
      expect(total.supplies, id).toBeLessThanOrEqual(3 * 12);
    }
  });
});

describe('canBuy and buy', () => {
  it('every node is buyable, in dependency order, to its maximum', () => {
    const done = buyEverything(rich());
    for (const n of UPGRADE_NODES) expect(levelOf(done, n.id), n.id).toBe(n.maxLevel);
    expect(done.unlockedWeapons.sort()).toEqual(['ficklampa', 'korv', 'nyckel', 'spray', 'telefon', 'vagn']);
  });

  it('starts with Grillkorv, Ficklampa and Nyckel; the other three unlock in any order', () => {
    const p = rich();
    expect(p.unlockedWeapons).toEqual([...STARTER_WEAPONS]);
    const order = ['vagn', 'telefon', 'spray'] as const;
    let cur = p;
    for (const w of order) {
      expect(canBuy(cur, `w_unlock_${w}`)).toBe(true);
      cur = buy(cur, `w_unlock_${w}`)!;
      expect(cur.unlockedWeapons).toContain(w);
    }
    expect(cur.materials.scrap).toBe(1e8 - 3 * WEAPON_UNLOCK_SCRAP);
    expect(canBuy(cur, 'w_unlock_vagn')).toBe(false);
    expect(buyBlock(cur, 'w_unlock_vagn')).toBe('maxed');
  });

  it('spends exactly the cost, in the right materials', () => {
    const p = withMaterials(2000, 50, 50);
    const after = buy(p, 'w_damage')!;
    expect(after.materials).toEqual({ scrap: 2000 - 400, parts: 50, supplies: 50 });
    expect(levelOf(after, 'w_damage')).toBe(1);
    const after2 = buy(after, 'w_damage')!;
    expect(after2.materials.scrap).toBe(2000 - 400 - 640);
  });

  it('refuses when poor, maxed, locked or unknown, and returns null', () => {
    expect(buyBlock(withMaterials(399, 0, 0), 'w_damage')).toBe('poor');
    expect(buy(withMaterials(399, 0, 0), 'w_damage')).toBeNull();
    expect(buyBlock(rich(), 'nope')).toBe('unknown');
    expect(buy(rich(), 'nope')).toBeNull();
    const maxed = buyEverything(rich());
    expect(buyBlock(maxed, 'c_hp')).toBe('maxed');
    expect(buy(maxed, 'c_hp')).toBeNull();
  });

  it('does not mutate the profile it is given', () => {
    const p = rich();
    const snapshot = JSON.stringify(p);
    const next = buy(p, 'w_unlock_spray')!;
    const next2 = buy(next, 'c_hp')!;
    expect(JSON.stringify(p)).toBe(snapshot);
    expect(next).not.toBe(p);
    expect(next.unlockedWeapons).not.toBe(p.unlockedWeapons);
    expect(next.upgrades).not.toBe(p.upgrades);
    expect(next.materials).not.toBe(p.materials);
    // The intermediate profile is untouched by the next purchase too.
    expect(next.upgrades.c_hp).toBeUndefined();
    expect(next2.upgrades.c_hp).toBe(1);
  });
});

describe('combination prerequisites', () => {
  it('evolution needs the weapon on the rack, Scrap-tree and Supplies-tree levels', () => {
    let p = rich();
    expect(buyBlock(p, 'evo_korv')).toBe('locked'); // no weapon damage, no HP yet
    p = buy(p, 'w_damage')!;
    expect(buyBlock(p, 'evo_korv')).toBe('locked'); // still no Supplies foothold
    p = buy(p, 'c_hp')!;
    expect(canBuy(p, 'evo_korv')).toBe(true);
    // Both trees are in place, but Telefon is not on the rack yet.
    expect(buyBlock(p, 'evo_telefon')).toBe('locked');
    p = buy(p, 'w_unlock_telefon')!;
    expect(canBuy(p, 'evo_telefon')).toBe(true);
    expect(modsFromProfileV2(buy(p, 'evo_korv')!).evolutionUnlocks).toEqual(['korv']);
  });

  it('weapon mods need weapon levels and a Parts foothold', () => {
    let p = rich();
    expect(buyBlock(p, 'mod_projectile')).toBe('locked');
    p = buy(buy(p, 'w_damage')!, 'w_damage')!;
    expect(buyBlock(p, 'mod_projectile')).toBe('locked'); // damage 2 is not enough alone
    p = buy(p, 'b_storage')!;
    expect(canBuy(p, 'mod_projectile')).toBe(true);
    expect(buyBlock(p, 'mod_pierce')).toBe('locked');
  });

  it('bus crew perks need both a Bus node and a Character node', () => {
    let p = rich();
    p = buy(p, 'b_armor')!;
    expect(buyBlock(p, 'crew_shield')).toBe('locked');
    p = buy(p, 'c_armor')!;
    expect(canBuy(p, 'crew_shield')).toBe(true);
    expect(buyBlock(p, 'crew_magnet')).toBe('locked');
    p = buy(buy(p, 'b_fuel')!, 'c_pickup')!;
    expect(canBuy(p, 'crew_magnet')).toBe(true);
  });

  it('is poor, not locked, once prerequisites are met but the second material is short', () => {
    let p = rich();
    p = buy(buy(p, 'w_damage')!, 'c_hp')!;
    const short: Profile = { ...p, materials: { scrap: 1e8, parts: 0, supplies: 10 } };
    expect(buyBlock(short, 'evo_korv')).toBe('poor'); // 20 supplies needed
  });
});

describe('modsFromProfileV2', () => {
  it('is neutral on a fresh profile and covers every MetaMods field', () => {
    const m = modsFromProfileV2(createFreshProfile(NOW));
    for (const k of Object.keys(EMPTY_MODS) as (keyof typeof EMPTY_MODS)[]) expect(m[k], k).toEqual(EMPTY_MODS[k]);
    expect(m).toMatchObject({
      evolutionUnlocks: [],
      quotaMultiplier: 1,
      materialGainMultiplier: 1,
      startShield: 0,
      fuelMagnet: 0,
      turret: false,
      plow: false,
    });
  });

  it('sums per-level effects from the node table', () => {
    const p: Profile = {
      ...createFreshProfile(NOW),
      upgrades: { c_hp: 5, c_speed: 2, c_pickup: 1, c_armor: 3, w_damage: 4, w_attack: 2, b_fuel: 5, b_storage: 5, b_turret: 1, crew_shield: 2, crew_magnet: 3, mod_projectile: 2, mod_pierce: 1, evo_ficklampa: 1 },
    };
    const m = modsFromProfileV2(p);
    expect(m.hp).toBe(60);
    expect(m.speed).toBeCloseTo(0.08);
    expect(m.pickup).toBe(10);
    expect(m.armor).toBe(3);
    expect(m.damage).toBeCloseTo(0.32);
    expect(m.attackSpeed).toBeCloseTo(0.1);
    expect(m.quotaMultiplier).toBeCloseTo(0.8);
    expect(m.materialGainMultiplier).toBeCloseTo(1.4);
    expect(m.fares).toBeCloseTo(0.4);
    expect(m.turret).toBe(true);
    expect(m.plow).toBe(false);
    expect(m.startShield).toBe(30);
    expect(m.fuelMagnet).toBe(120);
    expect(m.extraProjectiles).toBe(2);
    expect(m.pierce).toBe(1);
    expect(m.evolutionUnlocks).toEqual(['ficklampa']);
    expect(m.crit).toBe(0);
    expect(m.startWeaponLevel).toBe(0);
  });

  it('reflects a purchase made through buy()', () => {
    const p = buy(rich(), 'c_hp')!;
    expect(modsFromProfileV2(p).hp).toBe(12);
  });
});

describe('a bought evolution unlock reaches the sim', () => {
  it('modsFromProfile feeds MetaMods.evolutionUnlocks and canEvolve uses the early rule', async () => {
    const { modsFromProfile } = await import('../src/meta/shop');
    const { createRun } = await import('../src/sim/state');
    const { canEvolve } = await import('../src/sim/upgrades');
    const { runConfig } = await import('./helpers');
    let p = rich();
    p = buy(buy(buy(p, 'w_damage')!, 'c_hp')!, 'evo_nyckel')!;
    expect(modsFromProfile(p).evolutionUnlocks).toEqual(['nyckel']);
    const cfg = { ...runConfig(5), mods: modsFromProfile(p) };
    const state = createRun(cfg);
    state.weapons[0].level = 5;
    state.passives.handskar = 2;
    expect(canEvolve(state, 'nyckel')).toBe(true);
    const plain = createRun(runConfig(5));
    plain.weapons[0].level = 5;
    plain.passives.handskar = 2;
    expect(canEvolve(plain, 'nyckel')).toBe(false);
  });
});
