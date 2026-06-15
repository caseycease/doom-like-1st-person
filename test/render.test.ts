import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/engine/world';
import { Renderer } from '../src/render/renderer';
import { ProceduralAssets } from '../src/assets/procedural';
import { level01 } from '../src/levels/level01';

// The renderer and procedural assets are DOM-free (typed arrays only), so the
// whole render path is exercisable headlessly. This both guards against crashes
// and acts as a coarse performance smoke test.

describe('renderer (headless)', () => {
  it('fills the frame buffer with wall + background variation, no crash', () => {
    const assets = new ProceduralAssets();
    const world = createWorld(level01);
    const r = new Renderer(320, 180, assets);
    r.render(world);

    const colors = new Set<number>();
    for (let i = 0; i < r.buf.length; i += 97) colors.add(r.buf[i]);
    expect(colors.size).toBeGreaterThan(3); // ceiling, floor, multiple wall shades
  });

  it('renders many frames within a coarse time budget', () => {
    const assets = new ProceduralAssets();
    const world = createWorld(level01);
    const r = new Renderer(480, 270, assets);

    const N = 120;
    const start = performance.now();
    for (let i = 0; i < N; i++) {
      world.player.angle += 0.01;
      r.render(world);
    }
    const msPerFrame = (performance.now() - start) / N;
    // Generous CI-safe ceiling; on-device target is ~5-8ms. Catches algorithmic
    // regressions (e.g. an accidental per-pixel raycast) without a GPU.
    expect(msPerFrame).toBeLessThan(33);
  });
});
