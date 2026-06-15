import { describe, it, expect } from 'vitest';
import { createPlayer } from '../src/engine/entities';
import { serializeProgress, applyProgress, encode, decode } from '../src/engine/save';

describe('save/checkpoint', () => {
  it('round-trips a player loadout through encode/decode', () => {
    const p = createPlayer(1, 1, 0);
    p.weapons = ['pistol', 'shotgun', 'rocket'];
    p.currentWeapon = 2;
    p.ammo = { bullets: 12, shells: 7, rockets: 3 };
    p.health = 64;

    const data = serializeProgress(2, p);
    const round = decode(encode(data));
    expect(round).not.toBeNull();
    expect(round!.levelIndex).toBe(2);

    const fresh = createPlayer(9, 9, 1.5);
    applyProgress(fresh, round!);
    expect(fresh.weapons).toEqual(['pistol', 'shotgun', 'rocket']);
    expect(fresh.currentWeapon).toBe(2);
    expect(fresh.ammo).toEqual({ bullets: 12, shells: 7, rockets: 3 });
    expect(fresh.health).toBe(64);
    // position is NOT restored from save (comes from the map)
    expect(fresh.x).toBe(9);
  });

  it('decode rejects garbage and wrong-version data', () => {
    expect(decode(null)).toBeNull();
    expect(decode('not json')).toBeNull();
    expect(decode(JSON.stringify({ version: 999, levelIndex: 0 }))).toBeNull();
  });
});
