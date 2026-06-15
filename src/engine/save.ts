// Pure save/checkpoint serialization. The platform layer owns localStorage;
// these functions just convert player+progress to/from a plain object so they
// can be unit-tested headlessly.

import type { Player, WeaponId, AmmoType } from './entities';

export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  levelIndex: number;
  health: number;
  weapons: WeaponId[];
  currentWeapon: number;
  ammo: Record<AmmoType, number>;
}

export function serializeProgress(levelIndex: number, player: Player): SaveData {
  return {
    version: SAVE_VERSION,
    levelIndex,
    health: player.health,
    weapons: [...player.weapons],
    currentWeapon: player.currentWeapon,
    ammo: { ...player.ammo },
  };
}

/** Apply a save's loadout onto a fresh player (position stays from the map). */
export function applyProgress(player: Player, data: SaveData): void {
  player.health = data.health;
  player.weapons = [...data.weapons];
  player.currentWeapon = Math.min(data.currentWeapon, data.weapons.length - 1);
  player.ammo = { ...data.ammo };
}

export function encode(data: SaveData): string {
  return JSON.stringify(data);
}

export function decode(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as SaveData;
    if (!d || d.version !== SAVE_VERSION || typeof d.levelIndex !== 'number') return null;
    if (!Array.isArray(d.weapons) || !d.ammo) return null;
    return d;
  } catch {
    return null;
  }
}
