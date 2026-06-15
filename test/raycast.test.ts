import { describe, it, expect } from 'vitest';
import { castRay } from '../src/engine/raycast';
import { planeLengthForFov } from '../src/engine/projection';
import { openRoom } from './_helpers';

describe('raycast', () => {
  const map = openRoom();

  it('hits the east wall at the expected distance and face', () => {
    const hit = castRay(map, 4.5, 4.5, 1, 0); // facing +x
    expect(hit.hit).toBe(true);
    expect(hit.dist).toBeCloseTo(2.5, 6); // wall face at x=7
    expect(hit.side).toBe(0); // x-side (E/W face)
    expect(hit.tile).toBe(1);
  });

  it('hits the north wall', () => {
    const hit = castRay(map, 4.5, 4.5, 0, -1); // facing -y
    expect(hit.hit).toBe(true);
    expect(hit.dist).toBeCloseTo(3.5, 6); // wall face at y=1
    expect(hit.side).toBe(1); // y-side (N/S face)
  });

  it('corrects fisheye: a perpendicular wall yields constant perp distance across the view', () => {
    // Camera facing +x, wall straight ahead at x=7. For every camera column the
    // perpendicular distance must be identical (=> the wall renders flat).
    const planeLen = planeLengthForFov(Math.PI / 3); // 60deg fov
    const dists: number[] = [];
    for (const cameraX of [-1, -0.5, 0, 0.5, 1]) {
      const rdx = 1; // dir.x + plane.x*cameraX ; plane.x = 0 for east facing
      const rdy = planeLen * cameraX; // dir.y + plane.y*cameraX
      const hit = castRay(map, 4.5, 4.5, rdx, rdy);
      expect(hit.hit).toBe(true);
      dists.push(hit.dist);
    }
    for (const d of dists) expect(d).toBeCloseTo(2.5, 6);
  });

  it('terminates without hitting when the ray escapes the grid (no infinite loop)', () => {
    // An open (unenclosed) 3x3 with a hole: ray heading out the gap must end.
    const map2 = {
      width: 3,
      height: 3,
      tiles: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0]),
      floorColor: 0,
      ceilColor: 0,
      lightLevel: 1,
      player: { x: 1.5, y: 1.5, angle: 0 },
      entities: [],
    };
    const hit = castRay(map2, 1.5, 1.5, 1, 0, 10);
    expect(hit.hit).toBe(false);
  });
});
