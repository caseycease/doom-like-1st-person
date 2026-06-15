// Circle-vs-grid move-and-slide. Pure.

import type { GameMap } from './map';
import { isSolid } from './map';

/** True if a circle of radius r centered at (x,y) overlaps any solid tile. */
export function circleHitsWall(map: GameMap, x: number, y: number, r: number): boolean {
  const minX = Math.floor(x - r);
  const maxX = Math.floor(x + r);
  const minY = Math.floor(y - r);
  const maxY = Math.floor(y + r);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (isSolid(map, tx, ty)) return true;
    }
  }
  return false;
}

/**
 * Move from (x,y) by (dx,dy), sliding along walls. Axes are resolved
 * independently so that a blocked axis still lets the tangential axis through.
 * The returned position is guaranteed never to be inside a solid tile (given a
 * valid, non-colliding starting position).
 */
export function moveAndSlide(
  map: GameMap,
  x: number,
  y: number,
  dx: number,
  dy: number,
  r: number,
): { x: number; y: number } {
  const tryX = x + dx;
  if (!circleHitsWall(map, tryX, y, r)) x = tryX;
  const tryY = y + dy;
  if (!circleHitsWall(map, x, tryY, r)) y = tryY;
  return { x, y };
}
