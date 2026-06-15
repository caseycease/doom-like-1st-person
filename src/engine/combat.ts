// Hitscan combat. Pure geometry: find the nearest enemy a ray hits before any
// wall, within range. Damage application is delegated to ai.damageEntity.

import type { World } from './world';
import { castRay } from './raycast';

export interface HitscanResult {
  entityId: number | null;
  dist: number;
}

/**
 * Cast a unit-direction ray from (ox,oy). Returns the nearest hittable enemy
 * whose billboard the ray intersects within `range`, AND closer than the first
 * wall (z-tested). dirX/dirY must be normalized.
 */
export function hitscan(
  world: World,
  ox: number,
  oy: number,
  dirX: number,
  dirY: number,
  range: number,
): HitscanResult {
  const wall = castRay(world.map, ox, oy, dirX, dirY, range);
  const maxT = wall.hit ? Math.min(range, wall.dist) : range;

  let bestId: number | null = null;
  let bestT = Infinity;

  for (const e of world.entities) {
    if (e.kind !== 'clown' || e.removed) continue;
    if (e.ai && (e.ai.state === 'dying' || e.ai.state === 'dead')) continue;

    const ex = e.x - ox;
    const ey = e.y - oy;
    const t = ex * dirX + ey * dirY; // projection onto ray direction
    if (t < 0 || t > maxT) continue; // behind, or past wall/range
    const perp2 = ex * ex + ey * ey - t * t; // squared distance from ray line
    if (perp2 <= e.radius * e.radius && t < bestT) {
      bestT = t;
      bestId = e.id;
    }
  }

  return bestId !== null ? { entityId: bestId, dist: bestT } : { entityId: null, dist: maxT };
}
