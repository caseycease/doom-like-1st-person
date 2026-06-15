// World state + the single deterministic step() that mutates it. This is the
// pure heart of the game: tests call step() directly with synthetic input.

import type { GameMap } from './map';
import type { Entity, Player } from './entities';
import type { InputState } from './input';
import { createPlayer, spawnEntity } from './entities';
import { makeRng, type Rng } from './rng';
import { moveAndSlide } from './collision';
import { hitscan } from './combat';
import { updateEnemy, damageEntity } from './ai';

export interface GameEvent {
  type: 'shoot' | 'enemyHit' | 'enemyDied' | 'pickup' | 'playerHurt' | 'levelComplete';
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
  /** Events produced during the last step(); consumed by audio/FX layers. */
  events: GameEvent[];
}

const PLAYER_SPEED = 3.2; // tiles/second
const LOOK_PITCH_LIMIT = 0.45;

export function createWorld(map: GameMap, seed = 0x1234): World {
  const player = createPlayer(map.player.x, map.player.y, map.player.angle);
  const entities = map.entities.map(spawnEntity);
  return {
    map,
    player,
    entities,
    time: 0,
    rng: makeRng(seed),
    levelComplete: false,
    events: [],
  };
}

export function step(world: World, dt: number, input: InputState): void {
  world.events.length = 0;
  const p = world.player;

  // --- Look ---
  p.angle += input.look.x;
  p.pitch += input.look.y;
  if (p.pitch > LOOK_PITCH_LIMIT) p.pitch = LOOK_PITCH_LIMIT;
  if (p.pitch < -LOOK_PITCH_LIMIT) p.pitch = -LOOK_PITCH_LIMIT;

  // --- Movement (forward/strafe relative to facing) ---
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
    // forward = (cos,sin); strafe (right) = (-sin,cos)
    const dx = (cos * my - sin * mx) * PLAYER_SPEED * dt;
    const dy = (sin * my + cos * mx) * PLAYER_SPEED * dt;
    const moved = moveAndSlide(world.map, p.x, p.y, dx, dy, p.radius);
    p.x = moved.x;
    p.y = moved.y;
  }

  // --- Weapon swap ---
  if (input.swapWeapon !== 0 && p.weapons.length > 1) {
    const n = p.weapons.length;
    if (input.swapWeapon >= 10) {
      p.currentWeapon = (input.swapWeapon - 10) % n;
    } else {
      p.currentWeapon = (p.currentWeapon + (input.swapWeapon > 0 ? 1 : -1) + n) % n;
    }
  }

  // --- Firing ---
  const weapon = p.weapons[p.currentWeapon];
  if (weapon.cooldownTimer > 0) {
    weapon.cooldownTimer = Math.max(0, weapon.cooldownTimer - dt);
  }
  if (input.firing && weapon.cooldownTimer <= 0 && weapon.ammo > 0) {
    weapon.ammo--;
    weapon.cooldownTimer = weapon.fireRate;
    world.events.push({ type: 'shoot', x: p.x, y: p.y });
    const dirX = Math.cos(p.angle);
    const dirY = Math.sin(p.angle);
    const res = hitscan(world, p.x, p.y, dirX, dirY, weapon.range);
    if (res.entityId !== null) {
      const e = world.entities.find((en) => en.id === res.entityId);
      if (e) {
        const wasAlive = !e.removed;
        damageEntity(e, weapon.damage);
        world.events.push({ type: 'enemyHit', x: e.x, y: e.y });
        if (wasAlive && e.ai && e.ai.state === 'dying') {
          world.events.push({ type: 'enemyDied', x: e.x, y: e.y });
        }
      }
    }
  }

  // --- Entities ---
  const prevHealth = p.health;
  for (const e of world.entities) {
    if (e.removed) continue;
    if (e.kind === 'clown') {
      updateEnemy(world, e, dt);
    } else if (e.kind === 'pickup') {
      if (overlapsPlayer(e, p)) applyPickup(world, e);
    } else if (e.kind === 'exit') {
      if (overlapsPlayer(e, p) && !world.levelComplete) {
        world.levelComplete = true;
        world.events.push({ type: 'levelComplete' });
      }
    }
  }
  if (p.health < prevHealth) world.events.push({ type: 'playerHurt' });

  // --- Reap removed entities ---
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

function applyPickup(world: World, e: Entity): void {
  const p = world.player;
  if (e.pickupType === 'ammo') {
    const w = p.weapons[p.currentWeapon];
    w.ammo = Math.min(w.maxAmmo, w.ammo + (e.amount ?? 12));
  } else if (e.pickupType === 'health') {
    if (p.health >= p.maxHealth) return; // don't waste a full-health pickup
    p.health = Math.min(p.maxHealth, p.health + (e.amount ?? 25));
  }
  e.removed = true;
  world.events.push({ type: 'pickup', x: e.x, y: e.y });
}
