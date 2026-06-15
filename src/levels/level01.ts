// Level 01 — "The Midway". Hand-authored. Walls use texture ids from manifest:
//   1 = brick, 2 = big-top stripe, 3 = fairground panel.

import type { GameMap, EntitySpawn } from '../engine/map';
import { rgba } from '../assets/spriteProvider';

const W = 24;
const H = 16;

function buildTiles(): Uint8Array {
  const t = new Uint8Array(W * H);
  const set = (x: number, y: number, v: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) t[y * W + x] = v;
  };
  const hwall = (x0: number, x1: number, y: number, v: number) => {
    for (let x = x0; x <= x1; x++) set(x, y, v);
  };
  const vwall = (x: number, y0: number, y1: number, v: number) => {
    for (let y = y0; y <= y1; y++) set(x, y, v);
  };

  // border
  for (let x = 0; x < W; x++) {
    set(x, 0, 1);
    set(x, H - 1, 1);
  }
  for (let y = 0; y < H; y++) {
    set(0, y, 1);
    set(W - 1, y, 1);
  }

  // a panel divider on the left (open at the bottom)
  vwall(8, 2, 5, 3);
  // big-top stripe wall splitting top/bottom, with a doorway at x=8
  hwall(3, 15, 9, 2);
  set(8, 9, 0);
  // exit room in the bottom-right, doorway at (17,12)
  vwall(17, 9, 14, 1);
  set(17, 12, 0);
  hwall(17, 22, 9, 1);

  return t;
}

const entities: EntitySpawn[] = [
  // clowns
  { kind: 'clown', x: 6.5, y: 2.5 }, // visible at spawn -> immediate chase
  { kind: 'clown', x: 12.5, y: 3.5 }, // around the divider
  { kind: 'clown', x: 5.5, y: 12.5 }, // lower midway
  { kind: 'clown', x: 20.5, y: 12.5 }, // guards the exit
  // pickups
  { kind: 'pickup', x: 10.5, y: 12.5, pickupType: 'ammo', amount: 14 },
  { kind: 'pickup', x: 13.5, y: 2.5, pickupType: 'health', amount: 25 },
  // level exit
  { kind: 'exit', x: 19.5, y: 12.5 },
];

export const level01: GameMap = {
  width: W,
  height: H,
  tiles: buildTiles(),
  floorColor: rgba(46, 42, 40),
  ceilColor: rgba(18, 16, 22),
  lightLevel: 0.95,
  player: { x: 2.5, y: 2.5, angle: 0 },
  entities,
};
