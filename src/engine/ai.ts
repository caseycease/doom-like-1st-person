// Enemy AI as an explicit finite state machine, plus damage application.
// Pure: each update is a function of (world, entity, dt) that mutates the entity.

import type { GameMap } from './map';
import type { Entity, AIStateName } from './entities';
import type { World } from './world';
import { castRay } from './raycast';
import { moveAndSlide } from './collision';

export const SIGHT_RANGE = 12;
export const MELEE_RANGE = 1.1;
export const ATTACK_PERIOD = 1.0; // seconds between melee hits
export const ATTACK_WINDUP = 0.45; // delay before the first hit on entering attack
export const HURT_TIME = 0.25;
export const DYING_TIME = 0.6;

/** Clear line of sight between two world points (no wall in between). */
export function hasLineOfSight(map: GameMap, ax: number, ay: number, bx: number, by: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return true;
  const hit = castRay(map, ax, ay, dx / dist, dy / dist, dist);
  // Blocked only if a wall is hit strictly before the target.
  return !hit.hit || hit.dist >= dist - 1e-4;
}

/** Enter a new AI state, initializing its timer. */
export function setEnemyState(e: Entity, state: AIStateName): void {
  if (!e.ai) return;
  e.ai.state = state;
  switch (state) {
    case 'attack':
      e.ai.timer = ATTACK_WINDUP;
      break;
    case 'hurt':
      e.ai.timer = HURT_TIME;
      break;
    case 'dying':
      e.ai.timer = DYING_TIME;
      break;
    default:
      e.ai.timer = 0;
  }
}

/** Apply damage to an entity, driving the hurt/dying transitions. */
export function damageEntity(e: Entity, amount: number): void {
  if (!e.ai) {
    e.health -= amount;
    if (e.health <= 0) {
      e.health = 0;
      e.removed = true;
    }
    return;
  }
  if (e.ai.state === 'dying' || e.ai.state === 'dead') return;
  e.health -= amount;
  if (e.health <= 0) {
    e.health = 0;
    setEnemyState(e, 'dying');
  } else {
    setEnemyState(e, 'hurt');
  }
}

export function updateEnemy(world: World, e: Entity, dt: number): void {
  const ai = e.ai;
  if (!ai) return;
  const p = world.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const dist = Math.hypot(dx, dy);

  switch (ai.state) {
    case 'idle':
      if (dist <= SIGHT_RANGE && hasLineOfSight(world.map, e.x, e.y, p.x, p.y)) {
        setEnemyState(e, 'chase');
      }
      break;

    case 'chase': {
      if (!hasLineOfSight(world.map, e.x, e.y, p.x, p.y)) {
        setEnemyState(e, 'idle');
        break;
      }
      if (dist <= MELEE_RANGE) {
        setEnemyState(e, 'attack');
        break;
      }
      e.angle = Math.atan2(dy, dx);
      if (dist > 1e-6) {
        const speed = e.speed ?? 1.5;
        const inv = (speed * dt) / dist;
        const moved = moveAndSlide(world.map, e.x, e.y, dx * inv, dy * inv, e.radius);
        e.x = moved.x;
        e.y = moved.y;
      }
      break;
    }

    case 'attack':
      e.angle = Math.atan2(dy, dx);
      if (dist > MELEE_RANGE * 1.25) {
        setEnemyState(e, 'chase');
        break;
      }
      ai.timer -= dt;
      if (ai.timer <= 0) {
        p.health -= e.damage ?? 8;
        if (p.health < 0) p.health = 0;
        ai.timer = ATTACK_PERIOD;
      }
      break;

    case 'hurt':
      ai.timer -= dt;
      if (ai.timer <= 0) setEnemyState(e, 'chase');
      break;

    case 'dying':
      ai.timer -= dt;
      if (ai.timer <= 0) {
        setEnemyState(e, 'dead');
        e.removed = true;
      }
      break;

    case 'dead':
      break;
  }
}
