// Level 03 — "Hall of Mirrors". A regular grid of mirrored pillars (wide,
// guaranteed-walkable corridors) where bombers snipe from the lanes and brutes
// corner you. Rocket launcher reward. Wall id 4 = mirror.

import type { GameMap, EntitySpawn } from '../engine/map';
import { rgba } from '../assets/spriteProvider';

const W = 25;
const H = 19;

function buildTiles(): Uint8Array {
  const t = new Uint8Array(W * H);
  const set = (x: number, y: number, v: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) t[y * W + x] = v;
  };
  for (let x = 0; x < W; x++) {
    set(x, 0, 1);
    set(x, H - 1, 1);
  }
  for (let y = 0; y < H; y++) {
    set(0, y, 1);
    set(W - 1, y, 1);
  }
  // 2x2 mirrored pillars on a 6-tile pitch -> 4-wide corridors between them.
  for (let py = 3; py < H - 3; py += 6) {
    for (let px = 3; px < W - 3; px += 6) {
      set(px, py, 4);
      set(px + 1, py, 4);
      set(px, py + 1, 4);
      set(px + 1, py + 1, 4);
    }
  }
  return t;
}

const entities: EntitySpawn[] = [
  { kind: 'clown', x: 12.5, y: 2.5, archetype: 'bomber' },
  { kind: 'clown', x: 22.5, y: 2.5, archetype: 'bomber' },
  { kind: 'clown', x: 2.5, y: 16.5, archetype: 'bomber' },
  { kind: 'clown', x: 23.5, y: 16.5, archetype: 'brute' },
  { kind: 'clown', x: 12.5, y: 9.5, archetype: 'acrobat' },
  { kind: 'pickup', x: 12.5, y: 16.5, pickupType: 'weapon', weaponId: 'rocket', amount: 8 },
  { kind: 'pickup', x: 2.5, y: 9.5, pickupType: 'health', amount: 25 },
  { kind: 'pickup', x: 23.5, y: 9.5, pickupType: 'ammo', ammoType: 'rockets', amount: 4 },
  { kind: 'exit', x: 12.5, y: 13.5 },
];

export const level03: GameMap = {
  width: W,
  height: H,
  tiles: buildTiles(),
  floorColor: rgba(38, 40, 50),
  ceilColor: rgba(16, 18, 28),
  lightLevel: 0.8,
  player: { x: 1.5, y: 1.5, angle: 0 },
  entities,
};
