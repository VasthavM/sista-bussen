import { directorStep, spawnEnemy } from './spawn';
import {
  addShake,
  baseAngleTowardPlayer,
  findNearestEnemy,
  fireWeapons,
  spawnEnemyShot,
  updateAreaEffects,
  updateOrbs,
  updateProjectiles,
} from './combat';
import { updateObjective } from './objective';
import { WORLD, PLAYER_RADIUS, pushEvent } from './state';
import type { Enemy, SimState } from './types';

export interface MoveInput {
  x: number;
  y: number;
}

export const NO_INPUT: MoveInput = { x: 0, y: 0 };

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function hurtPlayer(state: SimState, raw: number): void {
  const p = state.player;
  if (p.invuln > 0 || p.hurtCd > 0) return;
  const dmg = Math.max(1, Math.round(raw - p.armor));
  p.hp -= dmg;
  p.hurtCd = 0.85;
  p.flash = 0.18;
  addShake(state, Math.min(12, 3 + dmg * 0.25));
  pushEvent(state, 'hurt', p.x, p.y, dmg, '');
  if (p.hp <= 0) {
    p.hp = 0;
    state.status = 'dead';
    addShake(state, 16);
  }
}

function moveEnemyToward(e: Enemy, tx: number, ty: number, speed: number, dt: number): void {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.vx = (dx / d) * speed;
  e.vy = (dy / d) * speed;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

function updateEnemy(state: SimState, e: Enemy, dt: number): void {
  const p = state.player;
  if (e.flash > 0) e.flash -= dt;

  if (e.stun > 0) {
    e.stun -= dt;
    return;
  }

  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const dirX = dx / dist;
  const dirY = dy / dist;
  e.attackCd -= dt;
  e.timer -= dt;

  switch (e.type) {
    case 'fyllo': {
      moveEnemyToward(e, p.x, p.y, e.speed, dt);
      break;
    }
    case 'duva': {
      const wob = Math.sin(state.time * 6 + e.phase) * 0.55;
      const nx = dirX * Math.cos(wob) - dirY * Math.sin(wob);
      const ny = dirX * Math.sin(wob) + dirY * Math.cos(wob);
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
      break;
    }
    case 'skugga': {
      const wob = Math.sin(state.time * 2.2 + e.phase) * 0.9;
      const nx = dirX * Math.cos(wob) - dirY * Math.sin(wob);
      const ny = dirX * Math.sin(wob) + dirY * Math.cos(wob);
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
      e.alpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(state.time * 1.7 + e.phase));
      break;
    }
    case 'vaktmastare': {
      if (dist < 132) {
        e.x -= dirX * e.speed * dt;
        e.y -= dirY * e.speed * dt;
      } else if (dist > 196) {
        moveEnemyToward(e, p.x, p.y, e.speed, dt);
      }
      if (e.timer <= 0 && dist < 460) {
        e.timer = 2.6;
        const spread = 0.22;
        for (let i = -1; i <= 1; i++) {
          spawnEnemyShot(
            state,
            e.x,
            e.y,
            baseAngleTowardPlayer(state, e.x, e.y) + i * spread,
            220,
            e.damage,
            'cone',
          );
        }
        pushEvent(state, 'shoot', e.x, e.y, 0, 'vaktmastare');
      }
      break;
    }
    case 'sparkcykel': {
      if (e.state === 0) {
        moveEnemyToward(e, p.x, p.y, e.speed * 0.7, dt);
        if (dist < 300) {
          e.state = 1;
          e.timer = 1.1;
        }
      } else if (e.state === 1) {
        if (e.timer <= 0) {
          e.state = 2;
          e.timer = 0.75;
          e.vx = dirX * 560;
          e.vy = dirY * 560;
        }
      } else if (e.state === 2) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.timer <= 0) {
          e.state = 3;
          e.timer = 1.8;
        }
      } else {
        moveEnemyToward(e, p.x, p.y, e.speed * 0.4, dt);
        if (e.timer <= 0) e.state = 0;
      }
      break;
    }
    case 'nattvakt': {
      moveEnemyToward(e, p.x, p.y, e.speed, dt);
      if (e.timer <= 0) {
        e.timer = 4.2;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + state.time;
          spawnEnemy(state, 'duva', e.x + Math.cos(a) * 34, e.y + Math.sin(a) * 34);
        }
        const shots = 10;
        for (let i = 0; i < shots; i++) {
          const a = (i / shots) * Math.PI * 2 + state.time * 0.5;
          spawnEnemyShot(state, e.x, e.y, a, 190, e.damage, 'burst');
        }
        pushEvent(state, 'shoot', e.x, e.y, 0, 'nattvakt');
      }
      break;
    }
    case 'chauffor': {
      moveEnemyToward(e, p.x, p.y, e.speed, dt);
      if (e.timer <= 0) {
        e.timer = 3.4;
        const shots = 14;
        for (let i = 0; i < shots; i++) {
          const a = (i / shots) * Math.PI * 2 + state.time * 0.35;
          spawnEnemyShot(state, e.x, e.y, a, 210, e.damage, 'burst');
        }
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          spawnEnemy(state, 'fyllo', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
        }
        pushEvent(state, 'shoot', e.x, e.y, 0, 'chauffor');
      }
      break;
    }
  }

  e.x = clamp(e.x, 18, WORLD.w - 18);
  e.y = clamp(e.y, 18, WORLD.h - 18);

  const contact = e.radius + PLAYER_RADIUS;
  if (Math.hypot(p.x - e.x, p.y - e.y) < contact && e.attackCd <= 0) {
    e.attackCd = 0.8;
    hurtPlayer(state, e.damage);
  }
}

function updateEnemyShots(state: SimState, dt: number): void {
  const p = state.player;
  for (let i = 0; i < state.enemyShots.length; i++) {
    const s = state.enemyShots[i];
    if (!s.active) continue;
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.life <= 0 || s.x < 0 || s.x > WORLD.w || s.y < 0 || s.y > WORLD.h) {
      s.active = false;
      continue;
    }
    if (Math.hypot(p.x - s.x, p.y - s.y) < s.radius + PLAYER_RADIUS) {
      hurtPlayer(state, s.damage);
      s.active = false;
    }
  }
}

function cleanup(state: SimState): void {
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    if (state.enemies[i].hp <= 0) state.enemies.splice(i, 1);
  }
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    if (!state.projectiles[i].active) state.projectiles.splice(i, 1);
  }
  for (let i = state.areaEffects.length - 1; i >= 0; i--) {
    if (!state.areaEffects[i].active) state.areaEffects.splice(i, 1);
  }
  for (let i = state.orbs.length - 1; i >= 0; i--) {
    if (!state.orbs[i].active) state.orbs.splice(i, 1);
  }
}

function updatePlayer(state: SimState, input: MoveInput, dt: number): void {
  const p = state.player;
  const len = Math.hypot(input.x, input.y);
  if (len > 0.01) {
    const nx = input.x / Math.max(1, len);
    const ny = input.y / Math.max(1, len);
    p.x += nx * p.speed * dt;
    p.y += ny * p.speed * dt;
    p.facing = Math.atan2(ny, nx);
    p.vx = nx * p.speed;
    p.vy = ny * p.speed;
  } else {
    p.vx = 0;
    p.vy = 0;
    const target = findNearestEnemy(state, p.x, p.y, 320);
    if (target) p.facing = Math.atan2(target.y - p.y, target.x - p.x);
  }

  p.x = clamp(p.x, 24, WORLD.w - 24);
  p.y = clamp(p.y, 24, WORLD.h - 24);

  if (p.invuln > 0) p.invuln -= dt;
  if (p.hurtCd > 0) p.hurtCd -= dt;
  if (p.flash > 0) p.flash -= dt;
  if (p.regen > 0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  }
}

export function stepRun(state: SimState, dt: number, input: MoveInput): void {
  if (state.status !== 'running') return;
  const step = Math.min(0.05, Math.max(0.001, dt));
  state.time += step;

  updatePlayer(state, input, step);
  directorStep(state, step);

  for (let i = 0; i < state.enemies.length; i++) {
    updateEnemy(state, state.enemies[i], step);
  }

  updateEnemyShots(state, step);
  fireWeapons(state, step);
  updateProjectiles(state, step);
  updateAreaEffects(state, step);
  updateOrbs(state, step);
  // Dying this step beats extracting this step.
  if (state.status === 'running' && updateObjective(state)) addShake(state, 8);
  cleanup(state);
}