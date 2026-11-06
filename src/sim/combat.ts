import { ENEMIES, WEAPONS } from './content';
import { nextFloat } from './rng';
import { WORLD, addXp, pushEvent } from './state';
import type {
  AreaEffect,
  Enemy,
  EnemyShot,
  Orb,
  Projectile,
  SimState,
  WeaponInstance,
} from './types';

export const PROJECTILE_CAP = 180;
export const ENEMY_SHOT_CAP = 220;
export const ORB_CAP = 420;

function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

export function findNearestEnemy(
  state: SimState,
  x: number,
  y: number,
  maxDist: number,
  skip?: Set<number>,
): Enemy | null {
  let best: Enemy | null = null;
  let bestD2 = maxDist * maxDist;
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0) continue;
    if (skip && skip.has(e.uid)) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  return best;
}

function acquireProjectile(state: SimState): Projectile {
  for (let i = 0; i < state.projectiles.length; i++) {
    if (!state.projectiles[i].active) return state.projectiles[i];
  }
  if (state.projectiles.length < PROJECTILE_CAP) {
    const p: Projectile = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 8,
      damage: 0,
      pierce: 0,
      bounces: 0,
      life: 2,
      crit: false,
      kind: 'korv',
      explodeRadius: 0,
      hits: [],
      spin: 0,
    };
    state.projectiles.push(p);
    return p;
  }
  return state.projectiles[0];
}

export function acquireEnemyShot(state: SimState): EnemyShot {
  for (let i = 0; i < state.enemyShots.length; i++) {
    if (!state.enemyShots[i].active) return state.enemyShots[i];
  }
  if (state.enemyShots.length < ENEMY_SHOT_CAP) {
    const s: EnemyShot = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 7,
      damage: 0,
      life: 4,
      kind: 'cone',
    };
    state.enemyShots.push(s);
    return s;
  }
  return state.enemyShots[0];
}

function acquireArea(state: SimState): AreaEffect {
  for (let i = 0; i < state.areaEffects.length; i++) {
    if (!state.areaEffects[i].active) return state.areaEffects[i];
  }
  const a: AreaEffect = {
    active: false,
    kind: 'fire',
    x: 0,
    y: 0,
    radius: 0,
    angle: 0,
    spread: 0,
    damage: 0,
    life: 0,
    maxLife: 1,
    tick: 0,
    interval: 0.3,
    stun: 0,
    owner: 'player',
  };
  state.areaEffects.push(a);
  return a;
}

export function spawnOrb(state: SimState, x: number, y: number, value: number, kind: 'xp' | 'change'): Orb {
  let orb: Orb | null = null;
  for (let i = 0; i < state.orbs.length; i++) {
    if (!state.orbs[i].active) {
      orb = state.orbs[i];
      break;
    }
  }
  if (!orb) {
    if (state.orbs.length >= ORB_CAP) {
      orb = state.orbs[0];
    } else {
      orb = { active: false, x: 0, y: 0, vx: 0, vy: 0, value: 0, magnet: 0, life: 0, kind: 'xp' };
      state.orbs.push(orb);
    }
  }
  orb.active = true;
  orb.x = x;
  orb.y = y;
  orb.vx = (nextFloat(state.rng) - 0.5) * 90;
  orb.vy = (nextFloat(state.rng) - 0.5) * 90;
  orb.value = value;
  orb.magnet = 0;
  orb.life = 0;
  orb.kind = kind;
  return orb;
}

export function addShake(state: SimState, amount: number): void {
  if (amount > state.shake) state.shake = Math.min(18, amount);
}

function killEnemy(state: SimState, enemy: Enemy): void {
  const def = ENEMIES[enemy.type];
  state.kills += 1;
  state.killsByType[enemy.type] = (state.killsByType[enemy.type] ?? 0) + 1;
  state.change += def.change * (enemy.elite ? 2.5 : 1) * state.player.luck;
  spawnOrb(state, enemy.x, enemy.y, Math.round(def.xp * (enemy.elite ? 2.2 : 1)), 'xp');
  pushEvent(state, 'kill', enemy.x, enemy.y, def.xp, enemy.type);
  addShake(state, enemy.type === 'nattvakt' || enemy.type === 'chauffor' ? 14 : enemy.elite ? 7 : 4);
}

export function dealDamage(
  state: SimState,
  enemy: Enemy,
  base: number,
  crit: boolean,
  stun = 0,
): number {
  if (enemy.hp <= 0) return 0;
  const amount = base * (crit ? 2.2 : 1);
  enemy.hp -= amount;
  enemy.flash = 0.14;
  if (stun > 0) enemy.stun = Math.max(enemy.stun, stun);
  state.damageDealt += amount;
  pushEvent(state, 'hit', enemy.x, enemy.y - enemy.radius, Math.round(amount), crit ? 'crit' : '');
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    killEnemy(state, enemy);
  }
  return amount;
}

function rollCrit(state: SimState): boolean {
  return nextFloat(state.rng) < state.player.crit;
}

function weaponDamage(state: SimState, weapon: WeaponInstance): number {
  const def = WEAPONS[weapon.id];
  const levelMult = 1 + 0.32 * (weapon.level - 1);
  const evoMult = weapon.evolved ? 1.75 : 1;
  return def.baseDamage * levelMult * evoMult * state.player.damage * state.player.area;
}

function fireOrbit(state: SimState, weapon: WeaponInstance): void {
  const baseRadius = (74 + weapon.level * 5) * state.player.area;
  const radius = weapon.evolved ? baseRadius + 44 : baseRadius;
  const damage = weaponDamage(state, weapon) * 0.55;
  const crit = rollCrit(state);
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0) continue;
    const dx = e.x - state.player.x;
    const dy = e.y - state.player.y;
    if (dx * dx + dy * dy <= (radius + e.radius) * (radius + e.radius)) {
      dealDamage(state, e, damage, crit, weapon.evolved ? 0.7 : 0);
    }
  }
  pushEvent(state, 'shoot', state.player.x, state.player.y, radius, 'orbit');
}

function fireThrow(state: SimState, weapon: WeaponInstance): void {
  const target = findNearestEnemy(state, state.player.x, state.player.y, 520);
  const angle = target
    ? angleTo(state.player.x, state.player.y, target.x, target.y)
    : state.player.facing;
  const p = acquireProjectile(state);
  const speed = 430;
  p.active = true;
  p.x = state.player.x + Math.cos(angle) * 18;
  p.y = state.player.y + Math.sin(angle) * 18;
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
  p.radius = 11;
  p.damage = weaponDamage(state, weapon);
  p.pierce = weapon.evolved ? 7 : 2 + Math.floor(weapon.level / 2);
  p.bounces = 0;
  p.life = 1.8;
  p.crit = rollCrit(state);
  p.kind = 'korv';
  p.explodeRadius = weapon.evolved ? 90 : 0;
  p.hits.length = 0;
  p.spin = 0;
  pushEvent(state, 'shoot', p.x, p.y, 0, 'korv');
}

function fireChain(state: SimState, weapon: WeaponInstance): void {
  const maxChains = weapon.evolved ? 8 : 3 + Math.floor(weapon.level / 3);
  const skip = new Set<number>();
  let fromX = state.player.x;
  let fromY = state.player.y;
  const damage = weaponDamage(state, weapon) * 0.8;
  let chainDamage = damage;
  let any = false;
  for (let i = 0; i < maxChains; i++) {
    const target = findNearestEnemy(state, fromX, fromY, i === 0 ? 420 : 210, skip);
    if (!target) break;
    any = true;
    skip.add(target.uid);
    dealDamage(state, target, chainDamage, rollCrit(state), weapon.evolved ? 0.6 : 0);
    pushEvent(state, 'chain', fromX, fromY, 0, 'telefon', target.x, target.y);
    fromX = target.x;
    fromY = target.y;
    chainDamage *= 0.86;
  }
  if (!any) pushEvent(state, 'shoot', state.player.x, state.player.y, 0, 'telefon');
}

function fireCone(state: SimState, weapon: WeaponInstance): void {
  const target = findNearestEnemy(state, state.player.x, state.player.y, 640);
  const angle = target ? angleTo(state.player.x, state.player.y, target.x, target.y) : state.player.facing;
  const a = acquireArea(state);
  a.active = true;
  a.kind = 'cone';
  a.x = state.player.x;
  a.y = state.player.y;
  a.radius = 185 * state.player.area;
  a.angle = angle;
  a.spread = 0.85;
  a.damage = weaponDamage(state, weapon) * 0.34;
  a.life = 0.9;
  a.maxLife = 0.9;
  a.tick = 0;
  a.interval = 0.28;
  a.stun = 0;
  pushEvent(state, 'shoot', state.player.x, state.player.y, a.radius, 'spray');

  if (weapon.evolved) {
    const pool = acquireArea(state);
    pool.active = true;
    pool.kind = 'fire';
    pool.x = state.player.x + Math.cos(angle) * a.radius * 0.72;
    pool.y = state.player.y + Math.sin(angle) * a.radius * 0.72;
    pool.radius = 96;
    pool.angle = angle;
    pool.spread = 0;
    pool.damage = weaponDamage(state, weapon) * 0.3;
    pool.life = 3.2;
    pool.maxLife = 3.2;
    pool.tick = 0;
    pool.interval = 0.4;
    pool.stun = 0;
  }
}

function fireBounce(state: SimState, weapon: WeaponInstance): void {
  const target = findNearestEnemy(state, state.player.x, state.player.y, 540);
  const angle = target ? angleTo(state.player.x, state.player.y, target.x, target.y) : state.player.facing;
  const p = acquireProjectile(state);
  p.active = true;
  p.x = state.player.x;
  p.y = state.player.y;
  p.vx = Math.cos(angle) * 380;
  p.vy = Math.sin(angle) * 380;
  p.radius = 12;
  p.damage = weaponDamage(state, weapon);
  p.pierce = weapon.evolved ? 5 : 1;
  p.bounces = weapon.evolved ? 3 : 1;
  p.life = 3.4;
  p.crit = rollCrit(state);
  p.kind = 'vagn';
  p.explodeRadius = 0;
  p.hits.length = 0;
  p.spin = 0;
  pushEvent(state, 'shoot', p.x, p.y, 0, 'vagn');
}

function fireBeam(state: SimState, weapon: WeaponInstance): void {
  const target = findNearestEnemy(state, state.player.x, state.player.y, 700);
  const angle = target ? angleTo(state.player.x, state.player.y, target.x, target.y) : state.player.facing;
  state.player.facing = angle;
  const length = (weapon.evolved ? 560 : 430) * (1 + (state.player.area - 1) * 0.4);
  const width = weapon.evolved ? 92 : 34;
  const damage = weaponDamage(state, weapon) * (weapon.evolved ? 0.85 : 0.7);
  const crit = rollCrit(state);
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0) continue;
    const dx = e.x - state.player.x;
    const dy = e.y - state.player.y;
    const proj = dx * dirX + dy * dirY;
    if (proj < 0 || proj > length) continue;
    const perp = Math.abs(dx * -dirY + dy * dirX);
    if (perp <= width * 0.5 + e.radius) {
      dealDamage(state, e, damage, crit, weapon.evolved ? 0.5 : 0);
    }
  }

  pushEvent(
    state,
    'beam',
    state.player.x,
    state.player.y,
    width,
    'ficklampa',
    state.player.x + dirX * length,
    state.player.y + dirY * length,
  );

  if (weapon.evolved) {
    const pool = acquireArea(state);
    pool.active = true;
    pool.kind = 'fire';
    pool.x = state.player.x + dirX * length * 0.7;
    pool.y = state.player.y + dirY * length * 0.7;
    pool.radius = 110;
    pool.angle = angle;
    pool.spread = 0.5;
    pool.damage = damage * 0.3;
    pool.life = 2.4;
    pool.maxLife = 2.4;
    pool.tick = 0;
    pool.interval = 0.35;
    pool.stun = 0;
  }
}

export function fireWeapon(state: SimState, weapon: WeaponInstance): void {
  const def = WEAPONS[weapon.id];
  switch (def.behaviour) {
    case 'orbit':
      fireOrbit(state, weapon);
      break;
    case 'throw':
      fireThrow(state, weapon);
      break;
    case 'chain':
      fireChain(state, weapon);
      break;
    case 'cone':
      fireCone(state, weapon);
      break;
    case 'bounce':
      fireBounce(state, weapon);
      break;
    case 'beam':
      fireBeam(state, weapon);
      break;
  }
}

export function fireWeapons(state: SimState, dt: number): void {
  for (let i = 0; i < state.weapons.length; i++) {
    const w = state.weapons[i];
    w.cooldown -= dt;
    if (w.cooldown > 0) continue;
    const def = WEAPONS[w.id];
    w.cooldown = (def.baseCooldown / Math.max(0.25, state.player.attackSpeed)) * (w.evolved ? 0.86 : 1);
    fireWeapon(state, w);
  }
}

function explode(state: SimState, x: number, y: number, radius: number, damage: number): void {
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy <= (radius + e.radius) * (radius + e.radius)) {
      dealDamage(state, e, damage, false);
    }
  }
  pushEvent(state, 'burst', x, y, radius, 'korv');
  addShake(state, 6);
}

export function updateProjectiles(state: SimState, dt: number): void {
  for (let i = 0; i < state.projectiles.length; i++) {
    const p = state.projectiles[i];
    if (!p.active) continue;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.x < 16 || p.x > WORLD.w - 16) {
      if (p.bounces > 0) {
        p.bounces -= 1;
        p.vx *= -1;
        p.x = Math.max(16, Math.min(WORLD.w - 16, p.x));
      } else {
        p.active = false;
        continue;
      }
    }
    if (p.y < 16 || p.y > WORLD.h - 16) {
      if (p.bounces > 0) {
        p.bounces -= 1;
        p.vy *= -1;
        p.y = Math.max(16, Math.min(WORLD.h - 16, p.y));
      } else {
        p.active = false;
        continue;
      }
    }

    if (p.life <= 0) {
      p.active = false;
      continue;
    }

    for (let j = 0; j < state.enemies.length; j++) {
      const e = state.enemies[j];
      if (e.hp <= 0) continue;
      if (p.hits.indexOf(e.uid) >= 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > (p.radius + e.radius) * (p.radius + e.radius)) continue;
      p.hits.push(e.uid);
      dealDamage(state, e, p.damage, p.crit);

      if (p.kind === 'vagn') {
        if (p.bounces > 0) {
          p.bounces -= 1;
          const next = findNearestEnemy(state, p.x, p.y, 320, new Set(p.hits));
          const angle = next ? angleTo(p.x, p.y, next.x, next.y) : nextFloat(state.rng) * Math.PI * 2;
          const speed = Math.hypot(p.vx, p.vy);
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
        } else if (p.pierce > 0) {
          p.pierce -= 1;
        } else {
          p.active = false;
          break;
        }
      } else if (p.pierce > 0) {
        p.pierce -= 1;
      } else {
        if (p.explodeRadius > 0) {
          explode(state, p.x, p.y, p.explodeRadius, p.damage * 0.7);
        }
        p.active = false;
        break;
      }
    }
  }
}

export function updateAreaEffects(state: SimState, dt: number): void {
  for (let i = 0; i < state.areaEffects.length; i++) {
    const a = state.areaEffects[i];
    if (!a.active) continue;
    a.life -= dt;
    if (a.life <= 0) {
      a.active = false;
      continue;
    }
    a.tick -= dt;
    if (a.tick > 0) continue;
    a.tick = a.interval;

    for (let j = 0; j < state.enemies.length; j++) {
      const e = state.enemies[j];
      if (e.hp <= 0) continue;
      const dx = e.x - a.x;
      const dy = e.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > a.radius + e.radius) continue;
      if (a.kind === 'cone' && dist > 4) {
        const ang = Math.atan2(dy, dx);
        let diff = ang - a.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > a.spread * 0.5) continue;
      }
      dealDamage(state, e, a.damage, false, a.stun);
    }
  }
}

export function updateOrbs(state: SimState, dt: number): void {
  const px = state.player.x;
  const py = state.player.y;
  for (let i = 0; i < state.orbs.length; i++) {
    const orb = state.orbs[i];
    if (!orb.active) continue;
    orb.life += dt;
    const dx = px - orb.x;
    const dy = py - orb.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist < state.player.pickup) {
      // Strong magnet inside the pickup radius: snap with easing.
      orb.magnet = Math.min(1, orb.magnet + dt * 2.2);
      const pull = 180 + (1 - dist / Math.max(1, state.player.pickup)) * 720;
      orb.vx = (dx / dist) * pull;
      orb.vy = (dy / dist) * pull;
    } else if (orb.life > 1.8) {
      // After a short delay leftover orbs drift back so kiting never orphans progress.
      orb.magnet = Math.max(orb.magnet, 0.35);
      const drift = 90 + Math.min(150, (orb.life - 1.8) * 35);
      orb.vx = (dx / dist) * drift;
      orb.vy = (dy / dist) * drift;
    } else {
      const drag = Math.max(0, 1 - dt * 4.5);
      orb.vx *= drag;
      orb.vy *= drag;
    }

    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;

    if (dist < 22) {
      if (orb.kind === 'xp') {
        const levels = addXp(state, orb.value);
        if (levels > 0) {
          pushEvent(state, 'levelup', px, py, state.level, 'LEVEL');
          addShake(state, 5);
        }
      } else {
        state.change += orb.value;
      }
      pushEvent(state, 'pickup', orb.x, orb.y, orb.value, orb.kind);
      orb.active = false;
    }
  }
}

export function spawnEnemyShot(
  state: SimState,
  x: number,
  y: number,
  angle: number,
  speed: number,
  damage: number,
  kind: 'cone' | 'burst',
): void {
  const s = acquireEnemyShot(state);
  s.active = true;
  s.x = x;
  s.y = y;
  s.vx = Math.cos(angle) * speed;
  s.vy = Math.sin(angle) * speed;
  s.radius = kind === 'burst' ? 9 : 7;
  s.damage = damage;
  s.life = 4;
  s.kind = kind;
}

/** Weapon evolution effect: instantly apply the evolved payload to nearby targets. */
export function areaBlast(state: SimState, x: number, y: number, radius: number, damage: number, stun: number): void {
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy <= (radius + e.radius) * (radius + e.radius)) {
      dealDamage(state, e, damage, false, stun);
    }
  }
  pushEvent(state, 'burst', x, y, radius, 'evo');
  addShake(state, 8);
}

export function baseAngleTowardPlayer(state: SimState, x: number, y: number): number {
  return Math.atan2(state.player.y - y, state.player.x - x);
}

export function pickOrbTone(kind: 'xp' | 'change'): string {
  return kind === 'change' ? 'change' : 'xp';
}