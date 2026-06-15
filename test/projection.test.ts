import { describe, it, expect } from 'vitest';
import { projectSprite, planeLengthForFov } from '../src/engine/projection';

describe('sprite projection', () => {
  const W = 640;
  const planeLen = planeLengthForFov(Math.PI / 3);

  it('places an entity straight ahead at screen center', () => {
    const p = projectSprite(2, 2, 0, planeLen, W, 6, 2); // facing +x, target +x
    expect(p.visible).toBe(true);
    expect(p.screenX).toBeCloseTo(W / 2, 4);
    expect(p.depth).toBeCloseTo(4, 6); // 4 tiles ahead
  });

  it('culls entities behind the camera', () => {
    const p = projectSprite(6, 2, 0, planeLen, W, 2, 2); // target is behind (-x)
    expect(p.visible).toBe(false);
  });

  it('puts an entity to the right at screenX > center', () => {
    const p = projectSprite(2, 2, 0, planeLen, W, 5, 3); // ahead and to the +y (right) side
    expect(p.visible).toBe(true);
    expect(p.screenX).toBeGreaterThan(W / 2);
  });
});
