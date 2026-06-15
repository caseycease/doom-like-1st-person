// Canvas raycasting renderer. PLATFORM layer: it reads pure world state and
// writes a packed pixel buffer. It does not mutate the world.

import type { World } from '../engine/world';
import type { Entity } from '../engine/entities';
import { castRay } from '../engine/raycast';
import { projectSprite, planeLengthForFov } from '../engine/projection';
import type { SpriteProvider, TextureProvider } from '../assets/spriteProvider';

export interface RenderAssets extends SpriteProvider, TextureProvider {}

export class Renderer {
  width = 0;
  height = 0;
  buf!: Uint32Array;
  private zbuf!: Float32Array;
  private planeLen: number;

  constructor(width: number, height: number, private assets: RenderAssets, fov = Math.PI / 3) {
    this.planeLen = planeLengthForFov(fov);
    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.buf = new Uint32Array(width * height);
    this.zbuf = new Float32Array(width);
  }

  render(world: World): void {
    this.drawBackground(world);
    this.drawWalls(world);
    this.drawSprites(world);
  }

  private horizon(world: World): number {
    return Math.floor(this.height / 2 + world.player.pitch * this.height);
  }

  private drawBackground(world: World): void {
    const { buf, width, height } = this;
    const hz = this.horizon(world);
    const ceil = world.map.ceilColor;
    const floor = world.map.floorColor;
    const clamped = hz < 0 ? 0 : hz > height ? height : hz;
    buf.fill(ceil, 0, clamped * width);
    buf.fill(floor, clamped * width, width * height);
  }

  private drawWalls(world: World): void {
    const { buf, width, height, zbuf, planeLen } = this;
    const p = world.player;
    const dirX = Math.cos(p.angle);
    const dirY = Math.sin(p.angle);
    const planeX = -dirY * planeLen;
    const planeY = dirX * planeLen;
    const hz = this.horizon(world);
    const light = world.map.lightLevel;

    for (let x = 0; x < width; x++) {
      const cameraX = (2 * x) / width - 1;
      const rdx = dirX + planeX * cameraX;
      const rdy = dirY + planeY * cameraX;
      const hit = castRay(world.map, p.x, p.y, rdx, rdy, 64);
      zbuf[x] = hit.hit ? hit.dist : Infinity;
      if (!hit.hit) continue;

      const dist = hit.dist;
      const lineH = Math.floor(height / dist);
      let drawStart = hz - (lineH >> 1);
      let drawEnd = hz + (lineH >> 1);
      const clipStart = drawStart < 0 ? 0 : drawStart;
      const clipEnd = drawEnd > height ? height : drawEnd;

      const tex = this.assets.wall(hit.tile);
      let texX = Math.floor(hit.wallX * tex.w);
      if ((hit.side === 0 && rdx > 0) || (hit.side === 1 && rdy < 0)) texX = tex.w - 1 - texX;

      const shade = wallShade(dist, hit.side, light);
      const step = tex.h / lineH;
      let texPos = (clipStart - drawStart) * step;

      for (let y = clipStart; y < clipEnd; y++) {
        let texY = texPos | 0;
        if (texY >= tex.h) texY = tex.h - 1;
        texPos += step;
        buf[y * width + x] = shadeColor(tex.data[texY * tex.w + texX], shade);
      }
    }
  }

  private drawSprites(world: World): void {
    const { width, height, zbuf, buf, planeLen } = this;
    const p = world.player;
    const hz = this.horizon(world);
    const light = world.map.lightLevel;

    // Collect visible entities with depth, sort far -> near.
    const list: { e: Entity; depth: number; screenX: number }[] = [];
    for (const e of world.entities) {
      if (e.removed) continue;
      const proj = projectSprite(p.x, p.y, p.angle, planeLen, width, e.x, e.y);
      if (!proj.visible) continue;
      list.push({ e, depth: proj.depth, screenX: proj.screenX });
    }
    list.sort((a, b) => b.depth - a.depth);

    for (const { e, depth, screenX } of list) {
      const set = this.assets.get(e.spriteId);
      const state = e.ai?.state ?? '';
      const frame = set.frame(state, 0, world.time);

      const unit = height / depth; // screen px for a 1-tile-tall object
      const screenH = unit * set.worldHeight;
      const screenW = (screenH * frame.w) / frame.h;
      const floorY = hz + (unit >> 1);
      const top = floorY - screenH;
      const left = screenX - screenW / 2;
      const shade = spriteShade(depth, light);

      const sxStart = Math.max(0, Math.floor(left));
      const sxEnd = Math.min(width, Math.ceil(left + screenW));
      const syStart = Math.max(0, Math.floor(top));
      const syEnd = Math.min(height, Math.ceil(top + screenH));

      for (let x = sxStart; x < sxEnd; x++) {
        if (depth >= zbuf[x]) continue; // occluded by a nearer wall
        const texX = Math.min(frame.w - 1, Math.floor(((x - left) / screenW) * frame.w));
        for (let y = syStart; y < syEnd; y++) {
          const texY = Math.min(frame.h - 1, Math.floor(((y - top) / screenH) * frame.h));
          const c = frame.data[texY * frame.w + texX];
          if (c >>> 24 === 0) continue; // transparent
          buf[y * width + x] = shadeColor(c, shade);
        }
      }
    }
  }
}

// --- shading helpers (operate on packed 0xAABBGGRR) ---

function wallShade(dist: number, side: 0 | 1, light: number): number {
  let s = light * (1 / (1 + dist * dist * 0.035));
  if (side === 1) s *= 0.72;
  return s < 0.12 ? 0.12 : s > 1 ? 1 : s;
}

function spriteShade(dist: number, light: number): number {
  const s = light * (1 / (1 + dist * dist * 0.03));
  return s < 0.2 ? 0.2 : s > 1 ? 1 : s;
}

function shadeColor(c: number, s: number): number {
  const r = (c & 0xff) * s;
  const g = ((c >>> 8) & 0xff) * s;
  const b = ((c >>> 16) & 0xff) * s;
  return ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
