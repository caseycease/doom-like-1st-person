// Entity & player state. Pure data + small constructors.

import type { EntitySpawn, PickupType } from './map';

export type EntityKind = 'clown' | 'pickup' | 'exit' | 'projectile';
export type AIStateName = 'idle' | 'chase' | 'attack' | 'hurt' | 'dying' | 'dead';

// ---------------------------------------------------------------- weapons

export type AmmoType = 'bullets' | 'shells' | 'rockets';
export type WeaponId = 'pistol' | 'shotgun' | 'smg' | 'rocket';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  ammoType: AmmoType;
  damage: number; // per pellet (hitscan) or per projectile
  pellets: number; // hitscan rays per shot
  spread: number; // half-angle in radians for pellet scatter
  range: number; // tiles (hitscan)
  fireRate: number; // seconds between shots
  projectile?: { speed: number; splash: number; life: number };
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { id: 'pistol', name: 'Pistol', ammoType: 'bullets', damage: 25, pellets: 1, spread: 0, range: 20, fireRate: 0.32 },
  shotgun: { id: 'shotgun', name: 'Shotgun', ammoType: 'shells', damage: 12, pellets: 8, spread: 0.12, range: 13, fireRate: 0.8 },
  smg: { id: 'smg', name: 'Nailgun', ammoType: 'bullets', damage: 12, pellets: 1, spread: 0.025, range: 18, fireRate: 0.09 },
  rocket: { id: 'rocket', name: 'Rocket', ammoType: 'rockets', damage: 60, pellets: 1, spread: 0, range: 30, fireRate: 0.9, projectile: { speed: 8, splash: 2.2, life: 4 } },
};

export const AMMO_MAX: Record<AmmoType, number> = { bullets: 200, shells: 60, rockets: 20 };

// ---------------------------------------------------------------- enemies

export type ClownArchetype = 'jester' | 'brute' | 'acrobat' | 'bomber';

export interface EnemyDef {
  archetype: ClownArchetype;
  radius: number;
  health: number;
  speed: number; // tiles/second
  damage: number; // melee or projectile damage
  sightRange: number;
  meleeRange: number;
  attackType: 'melee' | 'ranged';
  attackPeriod: number; // seconds between attacks
  strafe: boolean; // weaves while approaching
  preferredRange: number; // ranged: distance to hold
  projectileSpeed: number; // ranged
  spriteId: string;
}

export const ENEMIES: Record<ClownArchetype, EnemyDef> = {
  jester: { archetype: 'jester', radius: 0.35, health: 50, speed: 1.9, damage: 8, sightRange: 12, meleeRange: 1.1, attackType: 'melee', attackPeriod: 1.0, strafe: false, preferredRange: 0, projectileSpeed: 0, spriteId: 'clown.jester' },
  brute: { archetype: 'brute', radius: 0.45, health: 170, speed: 1.0, damage: 22, sightRange: 11, meleeRange: 1.4, attackType: 'melee', attackPeriod: 1.4, strafe: false, preferredRange: 0, projectileSpeed: 0, spriteId: 'clown.brute' },
  acrobat: { archetype: 'acrobat', radius: 0.3, health: 35, speed: 3.1, damage: 6, sightRange: 13, meleeRange: 1.0, attackType: 'melee', attackPeriod: 0.7, strafe: true, preferredRange: 0, projectileSpeed: 0, spriteId: 'clown.acrobat' },
  bomber: { archetype: 'bomber', radius: 0.38, health: 75, speed: 1.4, damage: 18, sightRange: 15, meleeRange: 1.0, attackType: 'ranged', attackPeriod: 1.9, strafe: true, preferredRange: 6, projectileSpeed: 5, spriteId: 'clown.bomber' },
};

// ---------------------------------------------------------------- types

export interface AIState {
  state: AIStateName;
  timer: number; // seconds for hurt/dying/attack windup
  cooldown: number; // ranged fire cooldown
  strafeDir: number; // +1/-1 weave direction
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
  archetype?: ClownArchetype;
  // --- pickup-only ---
  pickupType?: PickupType;
  amount?: number;
  weaponId?: WeaponId;
  ammoType?: AmmoType;
  // --- projectile-only ---
  vx?: number;
  vy?: number;
  damage?: number;
  owner?: 'player' | 'enemy';
  splash?: number;
  life?: number;
}

export interface Player {
  x: number;
  y: number;
  angle: number;
  pitch: number;
  radius: number;
  health: number;
  maxHealth: number;
  weapons: WeaponId[]; // owned, in pickup order
  currentWeapon: number; // index into weapons
  ammo: Record<AmmoType, number>;
  cooldownTimer: number; // shared fire cooldown (per current weapon's fireRate)
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
    weapons: ['pistol'],
    currentWeapon: 0,
    ammo: { bullets: 40, shells: 0, rockets: 0 },
    cooldownTimer: 0,
  };
}

export function currentWeaponDef(p: Player): WeaponDef {
  return WEAPONS[p.weapons[p.currentWeapon]];
}

let runningId = 1;
export function nextEntityId(): number {
  return runningId++;
}

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
    const arch = spawn.archetype ?? 'jester';
    const def = ENEMIES[arch];
    base.archetype = arch;
    base.radius = def.radius;
    base.health = def.health;
    base.maxHealth = def.health;
    base.spriteId = spawn.spriteId ?? def.spriteId;
    base.ai = { state: 'idle', timer: 0, cooldown: 0, strafeDir: (base.id & 1) === 0 ? 1 : -1 };
  } else if (spawn.kind === 'pickup') {
    base.radius = 0.3;
    base.pickupType = spawn.pickupType ?? 'ammo';
    if (base.pickupType === 'weapon') {
      base.weaponId = spawn.weaponId ?? 'shotgun';
      base.amount = spawn.amount ?? 12;
    } else if (base.pickupType === 'ammo') {
      base.ammoType = spawn.ammoType ?? 'bullets';
      base.amount = spawn.amount ?? 14;
    } else {
      base.amount = spawn.amount ?? 25; // health
    }
  } else if (spawn.kind === 'exit') {
    base.radius = 0.5;
  }
  return base;
}

/** Construct a live projectile entity. */
export function spawnProjectileEntity(
  x: number,
  y: number,
  vx: number,
  vy: number,
  damage: number,
  owner: 'player' | 'enemy',
  splash: number,
  life: number,
  spriteId: string,
): Entity {
  return {
    id: runningId++,
    kind: 'projectile',
    x,
    y,
    angle: Math.atan2(vy, vx),
    radius: 0.12,
    spriteId,
    health: 1,
    maxHealth: 1,
    removed: false,
    vx,
    vy,
    damage,
    owner,
    splash,
    life,
  };
}

function defaultSpriteId(spawn: EntitySpawn): string {
  switch (spawn.kind) {
    case 'clown':
      return ENEMIES[spawn.archetype ?? 'jester'].spriteId;
    case 'pickup':
      if (spawn.pickupType === 'health') return 'pickup.health';
      if (spawn.pickupType === 'weapon') return 'pickup.weapon';
      return 'pickup.ammo';
    case 'exit':
      return 'exit.sign';
  }
}

/** Test/determinism helper: reset the running id counter. */
export function resetEntityIds(): void {
  runningId = 1;
}
