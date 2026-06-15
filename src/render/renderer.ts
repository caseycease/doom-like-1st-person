// Canvas raycasting renderer. PLATFORM layer: reads pure world state, writes a
// packed pixel buffer. Walls (DDA + textures), floor/ceiling casting, distance
// fog, and z-tested, alpha-blended, animated billboard sprites.

import type { World } from '../engine/world';
import type { Entity } from '../engine/entities';
import { castRay } from '../engine/raycast';
import { projectSprite, planeLengthForFov } from '../engine/projection';
import { DYING_TIME } from '../engine/ai';
import type { SpriteProvider, TextureProvider } from '../assets/spriteProvider';

export interface RenderAssets extends SpriteProvider, TextureProvider {}

export class Renderer {
  width = 0;
  height = 0;
  buf!: Uint32Array;
  private zbuf!: Float32Array;
  private planeLen: number;
  private fogColor = 0xff141018;

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
    this.fogColor = darken(world.map.ceilColor, 0.7);
    this.drawFloorCeiling(world);
    this.drawWalls(world);
    this.drawSprites(world);
  }

  private horizon(world: World): number {
    return Math.floor(this.height / 2 + world.player.pitch * this.height);
  }

  // --- floor + ceiling casting (per row, affine) ---
  private drawFloorCeiling(world: World): void {
    const { buf, width, height, planeLen } = this;
    const p = world.player;
    const dirX = Math.cos(p.angle);
    const dirY = Math.sin(p.angle);
    const planeX = -dirY * planeLen;
    const planeY = dirX * planeLen;
    const hz = this.horizon(world);
    const posZ = 0.5 * height;
    const floorTex = this.assets.floor();
    const ceilTex = this.assets.ceil();
    const light = world.map.lightLevel;

    for (let y = 0; y < height; y++) {
      const isFloor = y > hz;
      const pRow = isFloor ? y - hz : hz - y;
      if (pRow <= 0) {
        buf.fill(this.fogColor, y * width, (y + 1) * width); // horizon line
        continue;
      }
      const rowDist = posZ / pRow;
      const fog = fogFactor(rowDist, light);

      const stepX = (rowDist * 2 * planeX) / width;
      const stepY = (rowDist * 2 * planeY) / width;
      let wx = p.x + rowDist * (dirX - planeX);
      let wy = p.y + rowDist * (dirY - planeY);
      const tex = isFloor ? floorTex : ceilTex;
      const rowOff = y * width;

      for (let x = 0; x < width; x++) {
        const tx = (((wx - Math.floor(wx)) * tex.w) | 0) & (tex.w - 1);
        const ty = (((wy - Math.floor(wy)) * tex.h) | 0) & (tex.h - 1);
        buf[rowOff + x] = fogMix(tex.data[ty * tex.w + tx], this.fogColor, fog);
        wx += stepX;
        wy += stepY;
      }
    }
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
      const drawStart = hz - (lineH >> 1);
      const drawEnd = hz + (lineH >> 1);
      const clipStart = drawStart < 0 ? 0 : drawStart;
      const clipEnd = drawEnd > height ? height : drawEnd;

      const tex = this.assets.wall(hit.tile);
      let texX = Math.floor(hit.wallX * tex.w);
      if ((hit.side === 0 && rdx > 0) || (hit.side === 1 && rdy < 0)) texX = tex.w - 1 - texX;

      const sh = wallShade(dist, hit.side, light);
      const fog = fogFactor(dist, light);
      const step = tex.h / lineH;
      let texPos = (clipStart - drawStart) * step;

      for (let y = clipStart; y < clipEnd; y++) {
        let texY = texPos | 0;
        if (texY >= tex.h) texY = tex.h - 1;
        texPos += step;
        buf[y * width + x] = fogMix(shade(tex.data[texY * tex.w + texX], sh), this.fogColor, fog);
      }
    }
  }

  private drawSprites(world: World): void {
    const { width, height, zbuf, buf, planeLen } = this;
    const p = world.player;
    const hz = this.horizon(world);
    const light = world.map.lightLevel;

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
      const facing = spriteFacing(p.x, p.y, p.angle, e);
      let animTime = world.time;
      if (state === 'dying' && e.ai) animTime = clamp01(1 - e.ai.timer / DYING_TIME);
      const frame = set.frame(state, facing, animTime);

      const unit = height / depth;
      const screenH = unit * set.worldHeight;
      const screenW = (screenH * frame.w) / frame.h;
      const top = e.kind === 'projectile' ? hz - screenH / 2 : hz + (unit >> 1) - screenH;
      const left = screenX - screenW / 2;
      const sh = spriteShade(depth, light);
      const fog = fogFactor(depth, light);

      const sxStart = Math.max(0, Math.floor(left));
      const sxEnd = Math.min(width, Math.ceil(left + screenW));
      const syStart = Math.max(0, Math.floor(top));
      const syEnd = Math.min(height, Math.ceil(top + screenH));

      for (let x = sxStart; x < sxEnd; x++) {
        if (depth >= zbuf[x]) continue;
        const texX = Math.min(frame.w - 1, Math.floor(((x - left) / screenW) * frame.w));
        for (let y = syStart; y < syEnd; y++) {
          const texY = Math.min(frame.h - 1, Math.floor(((y - top) / screenH) * frame.h));
          const c = frame.data[texY * frame.w + texX];
          const a = c >>> 24;
          if (a === 0) continue;
          const src = fogMix(shade(c, sh), this.fogColor, fog);
          const idx = y * width + x;
          buf[idx] = a >= 255 ? src : blend(buf[idx], src, a);
        }
      }
    }
  }
}

// --- shading / fog helpers (packed 0xAABBGGRR) ---

function wallShade(dist: number, side: 0 | 1, light: number): number {
  let s = light * (1 / (1 + dist * dist * 0.02));
  if (side === 1) s *= 0.72;
  return s < 0.14 ? 0.14 : s > 1 ? 1 : s;
}
function spriteShade(dist: number, light: number): number {
  const s = light * (1 / (1 + dist * dist * 0.018));
  return s < 0.22 ? 0.22 : s > 1 ? 1 : s;
}
function fogFactor(dist: number, light: number): number {
  // 0 = clear, 1 = full fog. Darker levels fog in sooner.
  const start = 4 + light * 4;
  const end = 16 + light * 8;
  if (dist <= start) return 0;
  if (dist >= end) return 0.85;
  return ((dist - start) / (end - start)) * 0.85;
}
function shade(c: number, s: number): number {
  const r = (c & 0xff) * s;
  const g = ((c >>> 8) & 0xff) * s;
  const b = ((c >>> 16) & 0xff) * s;
  return ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
function darken(c: number, f: number): number {
  return shade(c, f);
}
function fogMix(c: number, fog: number, t: number): number {
  if (t <= 0) return c;
  const r = (c & 0xff) + ((fog & 0xff) - (c & 0xff)) * t;
  const g = ((c >>> 8) & 0xff) + (((fog >>> 8) & 0xff) - ((c >>> 8) & 0xff)) * t;
  const b = ((c >>> 16) & 0xff) + (((fog >>> 16) & 0xff) - ((c >>> 16) & 0xff)) * t;
  return ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
function blend(dst: number, src: number, a: number): number {
  const t = a / 255;
  const r = (dst & 0xff) + ((src & 0xff) - (dst & 0xff)) * t;
  const g = ((dst >>> 8) & 0xff) + (((src >>> 8) & 0xff) - ((dst >>> 8) & 0xff)) * t;
  const b = ((dst >>> 16) & 0xff) + (((src >>> 16) & 0xff) - ((dst >>> 16) & 0xff)) * t;
  return ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function spriteFacing(px: number, py: number, _pa: number, e: Entity): number {
  if (!e.ai) return 0;
  const toViewer = Math.atan2(py - e.y, px - e.x);
  let d = e.angle - toViewer;
  while (d < -Math.PI) d += Math.PI * 2;
  while (d > Math.PI) d -= Math.PI * 2;
  // 8 sectors centered so 0 = facing the viewer (front)
  return ((Math.round((d / (Math.PI * 2)) * 8) % 8) + 8) % 8;
}
