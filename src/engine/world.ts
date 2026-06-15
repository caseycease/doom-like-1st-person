// World state + the single deterministic step() that mutates it. Pure heart of
// the game: tests call step() directly with synthetic input.

import type { GameMap } from './map';
import type { Entity, Player, WeaponId, AmmoType } from './entities';
import type { InputState } from './input';
import { createPlayer, spawnEntity, currentWeaponDef, WEAPONS, AMMO_MAX } from './entities';
import { makeRng, type Rng } from './rng';
import { moveAndSlide } from './collision';
import { fireWeapon, updateProjectiles } from './combat';
import { updateEnemy } from './ai';

export interface GameEvent {
  type: 'shoot' | 'enemyHit' | 'enemyDied' | 'pickup' | 'weaponPickup' | 'playerHurt' | 'levelComplete';
  x?: number;
  y?: number;
}

export interface World {
  map: GameMap;
  player: Player;
  entities: Entity[];
  time: number;
  rng: Rng;
  levelComplete: boolean;
  events: GameEvent[];
}

const PLAYER_SPEED = 3.2;
const LOOK_PITCH_LIMIT = 0.45;

/** Create a world. If `carry` is given, the player's loadout is transferred
 *  (for level-to-level progression) while position comes from the new map. */
export function createWorld(map: GameMap, seed = 0x1234, carry?: Player): World {
  const player = createPlayer(map.player.x, map.player.y, map.player.angle);
  if (carry) {
    player.health = carry.health;
    player.maxHealth = carry.maxHealth;
    player.weapons = [...carry.weapons];
    player.currentWeapon = carry.currentWeapon;
    player.ammo = { ...carry.ammo };
  }
  const entities = map.entities.map(spawnEntity);
  return { map, player, entities, time: 0, rng: makeRng(seed), levelComplete: false, events: [] };
}

export function step(world: World, dt: number, input: InputState): void {
  world.events.length = 0;
  const p = world.player;

  // --- Look ---
  p.angle += input.look.x;
  p.pitch += input.look.y;
  if (p.pitch > LOOK_PITCH_LIMIT) p.pitch = LOOK_PITCH_LIMIT;
  if (p.pitch < -LOOK_PITCH_LIMIT) p.pitch = -LOOK_PITCH_LIMIT;

  // --- Movement ---
  let mx = input.move.x;
  let my = input.move.y;
  const mag = Math.hypot(mx, my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }
  if (mx !== 0 || my !== 0) {
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);
    const dx = (cos * my - sin * mx) * PLAYER_SPEED * dt;
    const dy = (sin * my + cos * mx) * PLAYER_SPEED * dt;
    const moved = moveAndSlide(world.map, p.x, p.y, dx, dy, p.radius);
    p.x = moved.x;
    p.y = moved.y;
  }

  // --- Weapon swap (cycle owned weapons) ---
  if (input.swapWeapon !== 0 && p.weapons.length > 1) {
    const n = p.weapons.length;
    if (input.swapWeapon >= 10) p.currentWeapon = (input.swapWeapon - 10) % n;
    else p.currentWeapon = (p.currentWeapon + (input.swapWeapon > 0 ? 1 : -1) + n) % n;
  }

  // --- Firing ---
  if (p.cooldownTimer > 0) p.cooldownTimer = Math.max(0, p.cooldownTimer - dt);
  if (input.firing) fireWeapon(world);

  // --- Projectiles ---
  updateProjectiles(world, dt);

  // --- Entities ---
  const prevHealth = p.health;
  for (const e of world.entities) {
    if (e.removed) continue;
    if (e.kind === 'clown') updateEnemy(world, e, dt);
    else if (e.kind === 'pickup') {
      if (overlapsPlayer(e, p)) applyPickup(world, e);
    } else if (e.kind === 'exit') {
      if (overlapsPlayer(e, p) && !world.levelComplete) {
        world.levelComplete = true;
        world.events.push({ type: 'levelComplete' });
      }
    }
  }
  if (p.health < prevHealth) world.events.push({ type: 'playerHurt' });

  if (world.entities.some((e) => e.removed)) {
    world.entities = world.entities.filter((e) => !e.removed);
  }

  world.time += dt;
}

function overlapsPlayer(e: Entity, p: Player): boolean {
  const dx = e.x - p.x;
  const dy = e.y - p.y;
  const rr = e.radius + p.radius;
  return dx * dx + dy * dy <= rr * rr;
}

function giveAmmo(p: Player, type: AmmoType, amount: number): void {
  p.ammo[type] = Math.min(AMMO_MAX[type], p.ammo[type] + amount);
}

function applyPickup(world: World, e: Entity): void {
  const p = world.player;
  if (e.pickupType === 'weapon') {
    const wid = (e.weaponId ?? 'shotgun') as WeaponId;
    if (!p.weapons.includes(wid)) {
      p.weapons.push(wid);
      p.currentWeapon = p.weapons.indexOf(wid);
    }
    // Always grant a chunk of its ammo on pickup.
    giveAmmo(p, WEAPONS[wid].ammoType, e.amount ?? 12);
    world.events.push({ type: 'weaponPickup', x: e.x, y: e.y });
  } else if (e.pickupType === 'ammo') {
    giveAmmo(p, e.ammoType ?? 'bullets', e.amount ?? 14);
    world.events.push({ type: 'pickup', x: e.x, y: e.y });
  } else {
    // health
    if (p.health >= p.maxHealth) return;
    p.health = Math.min(p.maxHealth, p.health + (e.amount ?? 25));
    world.events.push({ type: 'pickup', x: e.x, y: e.y });
  }
  e.removed = true;
}

export { currentWeaponDef };
