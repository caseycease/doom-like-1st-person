// Level 02 — "The Big Top". A tent arena: brutes and acrobats, a nailgun pickup.
// Wall id 2 = big-top stripe, id 1 = brick.

import type { GameMap, EntitySpawn } from '../engine/map';
import { rgba } from '../assets/spriteProvider';

const W = 26;
const H = 20;

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
  // Loose grid of stripe pillars — open arena, nothing can be boxed in.
  for (const py of [5, 10, 15]) {
    for (const px of [5, 10, 15, 20]) {
      set(px, py, 2);
    }
  }
  return t;
}

const entities: EntitySpawn[] = [
  { kind: 'clown', x: 13.5, y: 10.5, archetype: 'brute' }, // in the ring
  { kind: 'clown', x: 4.5, y: 4.5, archetype: 'acrobat' },
  { kind: 'clown', x: 22.5, y: 4.5, archetype: 'acrobat' },
  { kind: 'clown', x: 22.5, y: 16.5, archetype: 'jester' },
  { kind: 'clown', x: 4.5, y: 16.5, archetype: 'brute' },
  { kind: 'pickup', x: 13.5, y: 3.5, pickupType: 'weapon', weaponId: 'smg', amount: 60 },
  { kind: 'pickup', x: 2.5, y: 10.5, pickupType: 'health', amount: 25 },
  { kind: 'pickup', x: 24.5, y: 10.5, pickupType: 'ammo', ammoType: 'shells', amount: 12 },
  { kind: 'exit', x: 13.5, y: 17.5 },
];

export const level02: GameMap = {
  width: W,
  height: H,
  tiles: buildTiles(),
  floorColor: rgba(52, 40, 36),
  ceilColor: rgba(24, 14, 18),
  lightLevel: 0.9,
  player: { x: 13.5, y: 1.5, angle: Math.PI / 2 },
  entities,
};
