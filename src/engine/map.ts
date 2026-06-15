// Grid-based map format. Plain data, hand-authored in src/levels/*.

export type SpawnKind = 'clown' | 'pickup' | 'exit';
export type PickupType = 'ammo' | 'health';

export interface EntitySpawn {
  kind: SpawnKind;
  x: number;
  y: number;
  angle?: number;
  /** Sprite id resolved by the SpriteProvider — NOT a file path. */
  spriteId?: string;
  /** For pickups. */
  pickupType?: PickupType;
  amount?: number;
}

export interface PlayerSpawn {
  x: number;
  y: number;
  angle: number;
}

export interface GameMap {
  width: number;
  height: number;
  /** width*height row-major. 0 = empty/walkable, >0 = wall texture id. */
  tiles: Uint8Array;
  floorColor: number; // packed 0xAABBGGRR
  ceilColor: number;
  lightLevel: number; // base ambient 0..1
  player: PlayerSpawn;
  entities: EntitySpawn[];
}

/** Tile id at a coordinate. Out-of-bounds is treated as solid wall (id 1). */
export function tileAt(map: GameMap, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return 1;
  return map.tiles[ty * map.width + tx];
}

export function isSolid(map: GameMap, tx: number, ty: number): boolean {
  return tileAt(map, tx, ty) > 0;
}

/** Convenience builder: parse an ASCII layout into tiles. '#' or digit = wall. */
export function tilesFromRows(rows: string[]): { width: number; height: number; tiles: Uint8Array } {
  const height = rows.length;
  const width = rows[0].length;
  const tiles = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < width; x++) {
      const c = row[x];
      if (c === ' ' || c === '.') {
        tiles[y * width + x] = 0;
      } else if (c >= '1' && c <= '9') {
        tiles[y * width + x] = c.charCodeAt(0) - 48;
      } else {
        // '#' or any other non-space glyph => default wall id 1
        tiles[y * width + x] = 1;
      }
    }
  }
  return { width, height, tiles };
}
