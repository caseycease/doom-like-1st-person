import { describe, it, expect } from 'vitest';
import { moveAndSlide, circleHitsWall } from '../src/engine/collision';
import { openRoom } from './_helpers';

describe('collision', () => {
  const map = openRoom();
  const r = 0.2;

  it('never lets the player end up inside a wall when shoved into one', () => {
    let x = 5.5;
    const y = 4.5;
    // Push hard east toward the wall at x=7 in small steps.
    for (let i = 0; i < 100; i++) {
      const res = moveAndSlide(map, x, y, 0.1, 0, r);
      x = res.x;
      expect(circleHitsWall(map, x, y, r)).toBe(false);
    }
    // Stopped before penetrating the wall face at x=7.
    expect(x + r).toBeLessThanOrEqual(7 + 1e-9);
    expect(x).toBeGreaterThan(6); // actually made progress toward the wall
  });

  it('slides: a blocked axis still lets the free axis through', () => {
    const x = 6.75; // hugging the east wall (6.75+0.2=6.95 < 7), not yet inside it
    const y = 4.5;
    const res = moveAndSlide(map, x, y, 1.0, 1.0, r); // east blocked, south free
    expect(res.x).toBeCloseTo(x, 6); // east movement rejected
    expect(res.y).toBeGreaterThan(y); // south movement preserved
    expect(circleHitsWall(map, res.x, res.y, r)).toBe(false);
  });

  it('does not tunnel through a concave corner', () => {
    // Aim diagonally into the NE corner; must not pass either wall.
    let x = 5.5;
    let y = 2.5;
    for (let i = 0; i < 100; i++) {
      const res = moveAndSlide(map, x, y, 0.1, -0.1, r);
      x = res.x;
      y = res.y;
      expect(circleHitsWall(map, x, y, r)).toBe(false);
    }
    expect(x + r).toBeLessThanOrEqual(7 + 1e-9);
    expect(y - r).toBeGreaterThanOrEqual(1 - 1e-9);
  });
});
