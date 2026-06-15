// Entity & player state. Pure data + small constructors.

import type { EntitySpawn, PickupType } from './map';

export type EntityKind = 'clown' | 'pickup' | 'exit';
export type AIStateName = 'idle' | 'chase' | 'attack' | 'hurt' | 'dying' | 'dead';

export interface AIState {
  state: AIStateName;
  timer: number; // seconds remaining in timed states / until next attack
}

export interface Entity {
  id: number;
  kind: EntityKind;
  x: number;
  y: number;
  angle: number;
  radius: number;
  spriteId: string;
  health: number;
  maxHealth: number;
  removed: boolean;
  // --- enemy-only ---
  ai?: AIState;
  speed?: number; // tiles/second
  damage?: number; // melee damage per attack
  // --- pickup-only ---
  pickupType?: PickupType;
  amount?: number;
}

export interface WeaponState {
  id: string;
  name: string;
  ammo: number;
  maxAmmo: number;
  damage: number;
  range: number; // tiles
  fireRate: number; // seconds between shots
  cooldownTimer: number;
}

export interface Player {
  x: number;
  y: number;
  angle: number;
  pitch: number; // fake vertical look: horizon offset in [-0.5, 0.5] of screen
  radius: number;
  health: number;
  maxHealth: number;
  weapons: WeaponState[];
  currentWeapon: number;
}

export function makePistol(): WeaponState {
  return {
    id: 'pistol',
    name: 'Pistol',
    ammo: 24,
    maxAmmo: 99,
    damage: 25,
    range: 20,
    fireRate: 0.32,
    cooldownTimer: 0,
  };
}

export function createPlayer(x: number, y: number, angle: number): Player {
  return {
    x,
    y,
    angle,
    pitch: 0,
    radius: 0.2,
    health: 100,
    maxHealth: 100,
    weapons: [makePistol()],
    currentWeapon: 0,
  };
}

/** Stats for the Phase-1 basic clown. */
function clownStats(): Partial<Entity> {
  return {
    radius: 0.35,
    health: 60,
    maxHealth: 60,
    speed: 1.7,
    damage: 9,
    ai: { state: 'idle', timer: 0 },
  };
}

let runningId = 1;

/** Instantiate a live Entity from authoring data. */
export function spawnEntity(spawn: EntitySpawn): Entity {
  const base: Entity = {
    id: runningId++,
    kind: spawn.kind,
    x: spawn.x,
    y: spawn.y,
    angle: spawn.angle ?? 0,
    radius: 0.3,
    spriteId: spawn.spriteId ?? defaultSpriteId(spawn),
    health: 1,
    maxHealth: 1,
    removed: false,
  };

  if (spawn.kind === 'clown') {
    Object.assign(base, clownStats());
  } else if (spawn.kind === 'pickup') {
    base.radius = 0.3;
    base.pickupType = spawn.pickupType ?? 'ammo';
    base.amount = spawn.amount ?? (base.pickupType === 'ammo' ? 12 : 25);
  } else if (spawn.kind === 'exit') {
    base.radius = 0.5;
  }
  return base;
}

function defaultSpriteId(spawn: EntitySpawn): string {
  switch (spawn.kind) {
    case 'clown':
      return 'clown.basic';
    case 'pickup':
      return spawn.pickupType === 'health' ? 'pickup.health' : 'pickup.ammo';
    case 'exit':
      return 'exit.sign';
  }
}

/** Test/determinism helper: reset the running id counter. */
export function resetEntityIds(): void {
  runningId = 1;
}
