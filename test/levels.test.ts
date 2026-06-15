import { describe, it, expect } from 'vitest';
import { CAMPAIGN } from '../src/levels';
import { isSolid } from '../src/engine/map';
import { createWorld } from '../src/engine/world';
import { Renderer } from '../src/render/renderer';
import { ProceduralAssets } from '../src/assets/procedural';

describe('campaign levels', () => {
  for (const level of CAMPAIGN) {
    describe(level.name, () => {
      const m = level.map;

      it('has consistent tile dimensions', () => {
        expect(m.tiles.length).toBe(m.width * m.height);
      });

      it('spawns the player on a walkable tile', () => {
        expect(isSolid(m, Math.floor(m.player.x), Math.floor(m.player.y))).toBe(false);
      });

      it('spawns every entity on a walkable tile', () => {
        for (const e of m.entities) {
          const solid = isSolid(m, Math.floor(e.x), Math.floor(e.y));
          expect(solid, `${e.kind} at (${e.x},${e.y}) is inside a wall`).toBe(false);
        }
      });

      it('has exactly one exit', () => {
        expect(m.entities.filter((e) => e.kind === 'exit').length).toBe(1);
      });

      it('renders headlessly without crashing', () => {
        const r = new Renderer(240, 135, new ProceduralAssets());
        r.render(createWorld(m));
        expect(r.buf.length).toBe(240 * 135);
      });
    });
  }
});
