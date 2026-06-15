import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld, step, type World } from '../src/engine/world';
import { resetEntityIds, WEAPONS, type WeaponId } from '../src/engine/entities';
import { emptyInput } from '../src/engine/input';
import { openRoom } from './_helpers';

function equip(w: World, id: WeaponId, ammo: number): void {
  w.player.weapons.push(id);
  w.player.currentWeapon = w.player.weapons.length - 1;
  w.player.ammo[WEAPONS[id].ammoType] = ammo;
}

describe('weapons', () => {
  beforeEach(() => resetEntityIds());

  it('shotgun fires a spread of pellets and consumes one shell', () => {
    const w = createWorld(openRoom({ x: 2.5, y: 4.5, angle: 0 }, [{ kind: 'clown', x: 4.0, y: 4.5 }]));
    equip(w, 'shotgun', 5);
    const clown = w.entities[0];
    step(w, 1 / 60, { ...emptyInput(), firing: true });
    expect(w.player.ammo.shells).toBe(4);
    // At point-blank several pellets connect -> more than a single pellet's damage.
    expect(clown.health).toBeLessThan(50 - WEAPONS.shotgun.damage);
  });

  it('nailgun (smg) consumes bullets and damages', () => {
    const w = createWorld(openRoom({ x: 2.5, y: 4.5, angle: 0 }, [{ kind: 'clown', x: 5.5, y: 4.5 }]));
    equip(w, 'smg', 50);
    const clown = w.entities[0];
    step(w, 1 / 60, { ...emptyInput(), firing: true });
    expect(w.player.ammo.bullets).toBe(49);
    expect(clown.health).toBe(50 - WEAPONS.smg.damage);
  });

  it('rocket spawns a player projectile that kills an enemy on impact', () => {
    const w = createWorld(openRoom({ x: 2.5, y: 4.5, angle: 0 }, [{ kind: 'clown', x: 6.5, y: 4.5 }]));
    equip(w, 'rocket', 3);

    step(w, 1 / 60, { ...emptyInput(), firing: true });
    expect(w.player.ammo.rockets).toBe(2);
    expect(w.entities.some((e) => e.kind === 'projectile' && e.owner === 'player')).toBe(true);

    for (let i = 0; i < 90; i++) step(w, 1 / 60, emptyInput());
    expect(w.entities.some((e) => e.kind === 'clown')).toBe(false); // direct hit + splash killed it
  });
});
