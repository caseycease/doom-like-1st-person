import type { GameMap, EntitySpawn } from '../src/engine/map';
import { tilesFromRows } from '../src/engine/map';

/** 8x8 enclosed empty room. */
export function openRoom(player = { x: 4.5, y: 4.5, angle: 0 }, entities: EntitySpawn[] = []): GameMap {
  const { width, height, tiles } = tilesFromRows([
    '########',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '########',
  ]);
  return {
    width,
    height,
    tiles,
    floorColor: 0xff333333,
    ceilColor: 0xff111111,
    lightLevel: 1,
    player,
    entities,
  };
}

/** Large enclosed empty room (18x12) for movement/ranged tests. */
export function bigRoom(player = { x: 2.5, y: 6.5, angle: 0 }, entities: EntitySpawn[] = []): GameMap {
  const width = 18;
  const height = 12;
  const tiles = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    tiles[x] = 1;
    tiles[(height - 1) * width + x] = 1;
  }
  for (let y = 0; y < height; y++) {
    tiles[y * width] = 1;
    tiles[y * width + width - 1] = 1;
  }
  return { width, height, tiles, floorColor: 0xff333333, ceilColor: 0xff111111, lightLevel: 1, player, entities };
}

/** Two chambers split by a solid wall column at x=4. */
export function walledMap(player = { x: 1.5, y: 2.5, angle: 0 }, entities: EntitySpawn[] = []): GameMap {
  const { width, height, tiles } = tilesFromRows([
    '#########',
    '#...#...#',
    '#...#...#',
    '#...#...#',
    '#########',
  ]);
  return {
    width,
    height,
    tiles,
    floorColor: 0xff333333,
    ceilColor: 0xff111111,
    lightLevel: 1,
    player,
    entities,
  };
}
