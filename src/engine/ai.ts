// Enemy AI as explicit finite state machines, parameterized per clown
// archetype (jester / brute / acrobat / bomber). Pure: each update mutates the
// entity (and may push projectiles into the world).

import type { GameMap } from './map';
import type { Entity, AIStateName } from './entities';
import type { World } from './world';
import { ENEMIES, spawnProjectileEntity } from './entities';
import { castRay } from './raycast';
import { moveAndSlide } from './collision';

export const ATTACK_WINDUP = 0.45;
export const HURT_TIME = 0.25;
export const DYING_TIME = 0.6;

export function hasLineOfSight(map: GameMap, ax: number, ay: number, bx: number, by: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return true;
  const hit = castRay(map, ax, ay, dx / dist, dy / dist, dist);
  return !hit.hit || hit.dist >= dist - 1e-4;
}

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
  const def = ENEMIES[e.archetype!];
  const p = world.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const dist = Math.hypot(dx, dy);

  switch (ai.state) {
    case 'idle':
      if (dist <= def.sightRange && hasLineOfSight(world.map, e.x, e.y, p.x, p.y)) {
        setEnemyState(e, 'chase');
      }
      break;

    case 'chase': {
      if (!hasLineOfSight(world.map, e.x, e.y, p.x, p.y)) {
        setEnemyState(e, 'idle');
        break;
      }
      e.angle = Math.atan2(dy, dx);

      if (def.attackType === 'melee') {
        if (dist <= def.meleeRange) {
          setEnemyState(e, 'attack');
          break;
        }
        step(world, e, dx, dy, dist, 1, dt);
      } else {
        // Ranged: hold preferred distance and lob projectiles.
        if (dist > def.preferredRange + 1) step(world, e, dx, dy, dist, 1, dt);
        else if (dist < def.preferredRange - 1) step(world, e, dx, dy, dist, -1, dt);
        else step(world, e, dx, dy, dist, 0, dt);

        ai.cooldown -= dt;
        if (ai.cooldown <= 0) {
          fireProjectile(world, e, dx, dy, dist, def.projectileSpeed, def.damage);
          ai.cooldown = def.attackPeriod;
        }
      }
      break;
    }

    case 'attack':
      e.angle = Math.atan2(dy, dx);
      if (dist > def.meleeRange * 1.25) {
        setEnemyState(e, 'chase');
        break;
      }
      ai.timer -= dt;
      if (ai.timer <= 0) {
        p.health -= def.damage;
        if (p.health < 0) p.health = 0;
        ai.timer = def.attackPeriod;
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

function step(world: World, e: Entity, dx: number, dy: number, dist: number, towardSign: number, dt: number): void {
  const ai = e.ai!;
  const def = ENEMIES[e.archetype!];
  if (dist < 1e-6) return;
  const inv = 1 / dist;
  let mx = dx * inv * towardSign;
  let my = dy * inv * towardSign;
  if (def.strafe) {
    const px = -dy * inv;
    const py = dx * inv;
    mx += px * ai.strafeDir * 0.6;
    my += py * ai.strafeDir * 0.6;
  }
  const m = Math.hypot(mx, my);
  if (m < 1e-6) return;
  mx /= m;
  my /= m;
  const dStep = def.speed * dt;
  const px0 = e.x;
  const py0 = e.y;
  const moved = moveAndSlide(world.map, e.x, e.y, mx * dStep, my * dStep, e.radius);
  e.x = moved.x;
  e.y = moved.y;
  // If we got stuck against a wall, flip the weave direction.
  if (Math.hypot(e.x - px0, e.y - py0) < dStep * 0.3) ai.strafeDir *= -1;
}

function fireProjectile(world: World, e: Entity, dx: number, dy: number, dist: number, speed: number, damage: number): void {
  if (dist < 1e-6) return;
  const inv = 1 / dist;
  const dirX = dx * inv;
  const dirY = dy * inv;
  const sx = e.x + dirX * (e.radius + 0.25);
  const sy = e.y + dirY * (e.radius + 0.25);
  const proj = spawnProjectileEntity(sx, sy, dirX * speed, dirY * speed, damage, 'enemy', 0, 5, 'projectile.balloon');
  world.entities.push(proj);
  world.events.push({ type: 'shoot', x: e.x, y: e.y });
}
