// Combat: hitscan geometry, weapon firing (hitscan + projectile), projectile
// integration, and splash damage. Pure — mutates the world, draws nothing.

import type { World } from './world';
import type { Entity } from './entities';
import { currentWeaponDef, spawnProjectileEntity } from './entities';
import { castRay } from './raycast';
import { isSolid } from './map';
import { damageEntity } from './ai';

export interface HitscanResult {
  entityId: number | null;
  dist: number;
}

/** Nearest enemy a unit-direction ray hits before any wall, within range. */
export function hitscan(world: World, ox: number, oy: number, dirX: number, dirY: number, range: number): HitscanResult {
  const wall = castRay(world.map, ox, oy, dirX, dirY, range);
  const maxT = wall.hit ? Math.min(range, wall.dist) : range;

  let bestId: number | null = null;
  let bestT = Infinity;
  for (const e of world.entities) {
    if (e.kind !== 'clown' || e.removed) continue;
    if (e.ai && (e.ai.state === 'dying' || e.ai.state === 'dead')) continue;
    const ex = e.x - ox;
    const ey = e.y - oy;
    const t = ex * dirX + ey * dirY;
    if (t < 0 || t > maxT) continue;
    const perp2 = ex * ex + ey * ey - t * t;
    if (perp2 <= e.radius * e.radius && t < bestT) {
      bestT = t;
      bestId = e.id;
    }
  }
  return bestId !== null ? { entityId: bestId, dist: bestT } : { entityId: null, dist: maxT };
}

/** Fire the player's current weapon if able (ammo + cooldown). Mutates world. */
export function fireWeapon(world: World): boolean {
  const p = world.player;
  const def = currentWeaponDef(p);
  if (p.cooldownTimer > 0) return false;
  if (p.ammo[def.ammoType] < 1) return false;

  p.ammo[def.ammoType] -= 1;
  p.cooldownTimer = def.fireRate;
  world.events.push({ type: 'shoot', x: p.x, y: p.y });

  if (def.projectile) {
    const dirX = Math.cos(p.angle);
    const dirY = Math.sin(p.angle);
    const proj = spawnProjectileEntity(
      p.x + dirX * 0.4,
      p.y + dirY * 0.4,
      dirX * def.projectile.speed,
      dirY * def.projectile.speed,
      def.damage,
      'player',
      def.projectile.splash,
      def.projectile.life,
      'projectile.rocket',
    );
    world.entities.push(proj);
    return true;
  }

  // Hitscan: one ray per pellet, deterministic scatter via world.rng.
  for (let i = 0; i < def.pellets; i++) {
    const jitter = def.spread > 0 ? (world.rng.next() - 0.5) * 2 * def.spread : 0;
    const a = p.angle + jitter;
    const res = hitscan(world, p.x, p.y, Math.cos(a), Math.sin(a), def.range);
    if (res.entityId !== null) {
      const e = world.entities.find((en) => en.id === res.entityId);
      if (e) {
        const wasDying = e.ai?.state === 'dying';
        damageEntity(e, def.damage);
        world.events.push({ type: 'enemyHit', x: e.x, y: e.y });
        if (!wasDying && e.ai?.state === 'dying') world.events.push({ type: 'enemyDied', x: e.x, y: e.y });
      }
    }
  }
  return true;
}

/** Integrate projectiles, resolve wall/target collisions and splash. */
export function updateProjectiles(world: World, dt: number): void {
  const p = world.player;
  for (const proj of world.entities) {
    if (proj.kind !== 'projectile' || proj.removed) continue;
    const speed = Math.hypot(proj.vx ?? 0, proj.vy ?? 0);
    // Substep to avoid tunneling through thin walls / small targets.
    const substeps = Math.max(1, Math.ceil((speed * dt) / 0.2));
    const sdt = dt / substeps;
    let exploded = false;
    for (let s = 0; s < substeps && !exploded; s++) {
      proj.x += (proj.vx ?? 0) * sdt;
      proj.y += (proj.vy ?? 0) * sdt;

      if (isSolid(world.map, Math.floor(proj.x), Math.floor(proj.y))) {
        explode(world, proj);
        exploded = true;
        break;
      }
      if (proj.owner === 'enemy') {
        const dx = proj.x - p.x;
        const dy = proj.y - p.y;
        const rr = proj.radius + p.radius;
        if (dx * dx + dy * dy <= rr * rr) {
          p.health -= proj.damage ?? 0;
          if (p.health < 0) p.health = 0;
          explode(world, proj);
          exploded = true;
          break;
        }
      } else {
        for (const e of world.entities) {
          if (e.kind !== 'clown' || e.removed || e.ai?.state === 'dying' || e.ai?.state === 'dead') continue;
          const dx = proj.x - e.x;
          const dy = proj.y - e.y;
          const rr = proj.radius + e.radius;
          if (dx * dx + dy * dy <= rr * rr) {
            explode(world, proj);
            exploded = true;
            break;
          }
        }
      }
    }
    if (exploded) continue;
    proj.life = (proj.life ?? 0) - dt;
    if ((proj.life ?? 0) <= 0) proj.removed = true;
  }
}

function explode(world: World, proj: Entity): void {
  proj.removed = true;
  world.events.push({ type: proj.owner === 'player' ? 'enemyDied' : 'playerHurt', x: proj.x, y: proj.y });
  const splash = proj.splash ?? 0;
  if (proj.owner === 'player') {
    // Direct + splash damage to enemies.
    for (const e of world.entities) {
      if (e.kind !== 'clown' || e.removed || e.ai?.state === 'dying' || e.ai?.state === 'dead') continue;
      const d = Math.hypot(e.x - proj.x, e.y - proj.y);
      if (splash <= 0) {
        if (d <= e.radius + proj.radius) damageEntity(e, proj.damage ?? 0);
      } else if (d <= splash) {
        const falloff = 1 - d / splash;
        damageEntity(e, (proj.damage ?? 0) * Math.max(0.25, falloff));
      }
    }
  }
}
