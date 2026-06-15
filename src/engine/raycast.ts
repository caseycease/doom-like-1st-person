// DDA grid raycaster. Pure: returns hit data only, draws nothing.
//
// Following the classic Lode Vandevenne formulation: when the caller passes an
// UN-normalized camera ray (dir + plane*cameraX), the returned `dist` is the
// perpendicular (fisheye-corrected) distance, ready to use as a wall slice
// height. When the caller passes a NORMALIZED direction, `dist` is the true
// Euclidean distance — which is what hit-detection / line-of-sight want.

import type { GameMap } from './map';

export interface RayHit {
  hit: boolean;
  dist: number; // perpendicular distance for camera rays; euclidean for unit rays
  tile: number; // wall texture id, 0 if no hit
  side: 0 | 1; // 0 = x-side (E/W faces), 1 = y-side (N/S faces)
  wallX: number; // texture u coordinate in [0,1)
  mapX: number;
  mapY: number;
}

export function castRay(
  map: GameMap,
  posX: number,
  posY: number,
  dirX: number,
  dirY: number,
  maxDist = 64,
): RayHit {
  let mapX = Math.floor(posX);
  let mapY = Math.floor(posY);

  const deltaDistX = dirX === 0 ? Infinity : Math.abs(1 / dirX);
  const deltaDistY = dirY === 0 ? Infinity : Math.abs(1 / dirY);

  let stepX: number;
  let stepY: number;
  let sideDistX: number;
  let sideDistY: number;

  if (dirX < 0) {
    stepX = -1;
    sideDistX = (posX - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1 - posX) * deltaDistX;
  }
  if (dirY < 0) {
    stepY = -1;
    sideDistY = (posY - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1 - posY) * deltaDistY;
  }

  let side: 0 | 1 = 0;
  let dist = 0;

  // Bounded loop: terminates on wall hit, on leaving the grid, or at maxDist.
  while (dist <= maxDist) {
    if (sideDistX < sideDistY) {
      mapX += stepX;
      side = 0;
      dist = sideDistX;
      sideDistX += deltaDistX;
    } else {
      mapY += stepY;
      side = 1;
      dist = sideDistY;
      sideDistY += deltaDistY;
    }

    if (mapX < 0 || mapY < 0 || mapX >= map.width || mapY >= map.height) {
      // Left the grid without hitting an interior wall.
      return { hit: false, dist: maxDist, tile: 0, side, wallX: 0, mapX, mapY };
    }

    const tile = map.tiles[mapY * map.width + mapX];
    if (tile > 0) {
      const perp = dist; // already perpendicular for camera rays
      let wallX = side === 0 ? posY + perp * dirY : posX + perp * dirX;
      wallX -= Math.floor(wallX);
      return { hit: true, dist: perp, tile, side, wallX, mapX, mapY };
    }
  }

  return { hit: false, dist: maxDist, tile: 0, side, wallX: 0, mapX, mapY };
}
