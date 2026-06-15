import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld, step, type World } from '../src/engine/world';
import { resetEntityIds } from '../src/engine/entities';
import type { InputState } from '../src/engine/input';
import { emptyInput } from '../src/engine/input';
import { openRoom } from './_helpers';

function snapshot(w: World): string {
  return JSON.stringify({
    player: { x: w.player.x, y: w.player.y, angle: w.player.angle, health: w.player.health },
    ammo: w.player.weapons[0].ammo,
    entities: w.entities.map((e) => ({ id: e.id, x: e.x, y: e.y, health: e.health, state: e.ai?.state })),
    time: w.time,
  });
}

function scriptedInputs(): InputState[] {
  const seq: InputState[] = [];
  for (let i = 0; i < 90; i++) {
    seq.push({
      move: { x: Math.sin(i * 0.3) * 0.5, y: i % 3 === 0 ? 1 : 0.2 },
      look: { x: Math.cos(i * 0.2) * 0.02, y: 0 },
      firing: i % 5 === 0,
      swapWeapon: 0,
    });
  }
  return seq;
}

describe('world.step', () => {
  beforeEach(() => resetEntityIds());

  it('is deterministic for identical seed + input', () => {
    const mk = () =>
      createWorld(openRoom({ x: 3.5, y: 3.5, angle: 0.2 }, [{ kind: 'clown', x: 5.5, y: 3.5 }]), 0xc0ffee);

    resetEntityIds();
    const a = mk();
    resetEntityIds();
    const b = mk();

    const inputs = scriptedInputs();
    for (const inp of inputs) step(a, 1 / 60, inp);
    for (const inp of inputs) step(b, 1 / 60, inp);

    expect(snapshot(a)).toBe(snapshot(b));
  });

  it('firing consumes ammo and damages an enemy in front', () => {
    const w = createWorld(openRoom({ x: 2.5, y: 4.5, angle: 0 }, [{ kind: 'clown', x: 5.5, y: 4.5 }]));
    const clown = w.entities[0];
    const inp = { ...emptyInput(), firing: true };
    step(w, 1 / 60, inp);
    expect(w.player.weapons[0].ammo).toBe(23);
    expect(clown.health).toBe(35); // 60 - 25
    expect(w.events.some((e) => e.type === 'enemyHit')).toBe(true);
  });

  it('does not fire with empty ammo', () => {
    const w = createWorld(openRoom({ x: 2.5, y: 4.5, angle: 0 }, [{ kind: 'clown', x: 5.5, y: 4.5 }]));
    w.player.weapons[0].ammo = 0;
    const clown = w.entities[0];
    step(w, 1 / 60, { ...emptyInput(), firing: true });
    expect(clown.health).toBe(60);
    expect(w.player.weapons[0].ammo).toBe(0);
  });

  it('collecting an ammo pickup adds ammo and removes the pickup', () => {
    const w = createWorld(
      openRoom({ x: 2.5, y: 2.5, angle: 0 }, [{ kind: 'pickup', x: 2.5, y: 2.5, pickupType: 'ammo', amount: 12 }]),
    );
    w.player.weapons[0].ammo = 10;
    step(w, 1 / 60, emptyInput());
    expect(w.player.weapons[0].ammo).toBe(22);
    expect(w.entities.length).toBe(0);
    expect(w.events.some((e) => e.type === 'pickup')).toBe(true);
  });

  it('clamps look pitch', () => {
    const w = createWorld(openRoom());
    for (let i = 0; i < 100; i++) step(w, 1 / 60, { ...emptyInput(), look: { x: 0, y: 1 } });
    expect(w.player.pitch).toBeLessThanOrEqual(0.45 + 1e-9);
    expect(w.player.pitch).toBeGreaterThan(0.4);
  });
});
