// Single registry mapping ids -> how to draw them. Today every id resolves to a
// procedural generator; swapping in real art later means changing only this file
// (point ids at an AtlasSpriteProvider) — no entity/AI/combat code changes.

export const SPRITE_IDS = {
  clownBasic: 'clown.basic',
  pickupAmmo: 'pickup.ammo',
  pickupHealth: 'pickup.health',
  exitSign: 'exit.sign',
} as const;

export const WALL_IDS = {
  brick: 1,
  bigtop: 2, // red/white tent stripe
  panel: 3, // metal fairground panel
} as const;
