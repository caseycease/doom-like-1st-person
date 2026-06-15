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
