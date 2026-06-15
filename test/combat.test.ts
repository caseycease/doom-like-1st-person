import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld } from '../src/engine/world';
import { hitscan } from '../src/engine/combat';
import { resetEntityIds } from '../src/engine/entities';
import { openRoom, walledMap } from './_helpers';

describe('combat / hitscan', () => {
  beforeEach(() => resetEntityIds());

  it('hits an enemy directly ahead within range', () => {
    const world = createWorld(
      openRoom({ x: 2.5, y: 4.5, angle: 0 }, [{ kind: 'clown', x: 5.5, y: 4.5 }]),
    );
    const res = hitscan(world, 2.5, 4.5, 1, 0, 20);
    expect(res.entityId).toBe(world.entities[0].id);
  });

  it('does not hit through a wall (z-tested)', () => {
    const world = createWorld(
      walledMap({ x: 1.5, y: 2.5, angle: 0 }, [{ kind: 'clown', x: 6.5, y: 2.5 }]),
    );
    const res = hitscan(world, 1.5, 2.5, 1, 0, 20);
    expect(res.entityId).toBeNull();
  });

  it('misses an enemy off the aim axis', () => {
    const world = createWorld(
      openRoom({ x: 2.5, y: 4.5, angle: 0 }, [{ kind: 'clown', x: 5.5, y: 5.3 }]),
    );
    const res = hitscan(world, 2.5, 4.5, 1, 0, 20);
    expect(res.entityId).toBeNull();
  });

  it('misses an enemy beyond range', () => {
    const world = createWorld(
      openRoom({ x: 2.5, y: 4.5, angle: 0 }, [{ kind: 'clown', x: 5.5, y: 4.5 }]),
    );
    const res = hitscan(world, 2.5, 4.5, 1, 0, 1.0); // range shorter than the gap
    expect(res.entityId).toBeNull();
  });
});
