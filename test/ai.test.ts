import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld } from '../src/engine/world';
import { updateEnemy, damageEntity, setEnemyState } from '../src/engine/ai';
import { resetEntityIds } from '../src/engine/entities';
import { openRoom, walledMap } from './_helpers';

describe('enemy AI state machine', () => {
  beforeEach(() => resetEntityIds());

  it('IDLE -> CHASE on gaining line of sight', () => {
    const world = createWorld(
      openRoom({ x: 2.5, y: 2.5, angle: 0 }, [{ kind: 'clown', x: 5.5, y: 2.5 }]),
    );
    const e = world.entities[0];
    expect(e.ai!.state).toBe('idle');
    updateEnemy(world, e, 1 / 60);
    expect(e.ai!.state).toBe('chase');
  });

  it('CHASE -> IDLE when line of sight is blocked by a wall', () => {
    const world = createWorld(
      walledMap({ x: 1.5, y: 2.5, angle: 0 }, [{ kind: 'clown', x: 6.5, y: 2.5 }]),
    );
    const e = world.entities[0];
    setEnemyState(e, 'chase');
    updateEnemy(world, e, 1 / 60);
    expect(e.ai!.state).toBe('idle');
  });

  it('CHASE -> ATTACK within melee range', () => {
    const world = createWorld(
      openRoom({ x: 2.5, y: 2.5, angle: 0 }, [{ kind: 'clown', x: 3.2, y: 2.5 }]),
    );
    const e = world.entities[0];
    setEnemyState(e, 'chase');
    updateEnemy(world, e, 1 / 60);
    expect(e.ai!.state).toBe('attack');
  });

  it('ATTACK applies damage to the player after the windup', () => {
    const world = createWorld(
      openRoom({ x: 2.5, y: 2.5, angle: 0 }, [{ kind: 'clown', x: 3.2, y: 2.5 }]),
    );
    const e = world.entities[0];
    setEnemyState(e, 'attack');
    const before = world.player.health;
    for (let i = 0; i < 6; i++) updateEnemy(world, e, 0.1); // 0.6s > windup
    expect(world.player.health).toBeLessThan(before);
  });

  it('damage drives HURT then returns to CHASE', () => {
    const world = createWorld(
      openRoom({ x: 2.5, y: 2.5, angle: 0 }, [{ kind: 'clown', x: 5.5, y: 2.5 }]),
    );
    const e = world.entities[0];
    damageEntity(e, 10);
    expect(e.ai!.state).toBe('hurt');
    expect(e.health).toBe(e.maxHealth - 10);
    updateEnemy(world, e, 0.3); // > HURT_TIME
    expect(e.ai!.state).toBe('chase');
  });

  it('lethal damage drives DYING then removal', () => {
    const world = createWorld(
      openRoom({ x: 2.5, y: 2.5, angle: 0 }, [{ kind: 'clown', x: 5.5, y: 2.5 }]),
    );
    const e = world.entities[0];
    damageEntity(e, 9999);
    expect(e.ai!.state).toBe('dying');
    expect(e.removed).toBe(false);
    updateEnemy(world, e, 0.7); // > DYING_TIME
    expect(e.ai!.state).toBe('dead');
    expect(e.removed).toBe(true);
  });

  it('a chasing clown moves toward the player without entering walls', () => {
    const world = createWorld(
      openRoom({ x: 2.5, y: 2.5, angle: 0 }, [{ kind: 'clown', x: 6.5, y: 2.5 }]),
    );
    const e = world.entities[0];
    setEnemyState(e, 'chase');
    const startDist = Math.hypot(e.x - 2.5, e.y - 2.5);
    for (let i = 0; i < 30; i++) updateEnemy(world, e, 1 / 60);
    const endDist = Math.hypot(e.x - 2.5, e.y - 2.5);
    expect(endDist).toBeLessThan(startDist); // closed the gap
  });
});
