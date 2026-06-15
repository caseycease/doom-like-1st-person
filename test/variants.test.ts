import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld, step } from '../src/engine/world';
import { updateEnemy, setEnemyState } from '../src/engine/ai';
import { resetEntityIds, ENEMIES } from '../src/engine/entities';
import { emptyInput } from '../src/engine/input';
import { openRoom, bigRoom } from './_helpers';

describe('clown variants', () => {
  beforeEach(() => resetEntityIds());

  it('spawns archetype-specific stats (brute is a tank)', () => {
    const w = createWorld(openRoom({ x: 2.5, y: 2.5, angle: 0 }, [{ kind: 'clown', x: 5.5, y: 2.5, archetype: 'brute' }]));
    const brute = w.entities[0];
    expect(brute.archetype).toBe('brute');
    expect(brute.maxHealth).toBe(ENEMIES.brute.health);
    expect(brute.radius).toBe(ENEMIES.brute.radius);
  });

  it('the acrobat is faster than the jester at closing distance', () => {
    const mk = (arch: 'jester' | 'acrobat') =>
      createWorld(bigRoom({ x: 2.5, y: 6.5, angle: 0 }, [{ kind: 'clown', x: 13.5, y: 6.5, archetype: arch }]));
    const wj = mk('jester');
    const wa = mk('acrobat');
    setEnemyState(wj.entities[0], 'chase');
    setEnemyState(wa.entities[0], 'chase');
    for (let i = 0; i < 30; i++) {
      updateEnemy(wj, wj.entities[0], 1 / 60);
      updateEnemy(wa, wa.entities[0], 1 / 60);
    }
    const dj = Math.hypot(wj.entities[0].x - 2.5, wj.entities[0].y - 6.5);
    const da = Math.hypot(wa.entities[0].x - 2.5, wa.entities[0].y - 6.5);
    expect(da).toBeLessThan(dj); // acrobat closed more ground
  });

  it('the bomber lobs a projectile at range that can hurt the player', () => {
    const w = createWorld(bigRoom({ x: 2.5, y: 6.5, angle: 0 }, [{ kind: 'clown', x: 12.5, y: 6.5, archetype: 'bomber' }]));
    const bomber = w.entities[0];
    setEnemyState(bomber, 'chase');
    updateEnemy(w, bomber, 1 / 60); // ranged fires on first chase tick (cooldown starts at 0)
    expect(w.entities.some((e) => e.kind === 'projectile' && e.owner === 'enemy')).toBe(true);

    const before = w.player.health;
    for (let i = 0; i < 120; i++) step(w, 1 / 60, emptyInput());
    expect(w.player.health).toBeLessThan(before);
  });
});
