// Procedural art (upgraded). Shaded, animated, multi-pose placeholders — good
// enough to feel like a game now, while staying behind the SpriteProvider /
// TextureProvider interfaces so a real atlas can replace them with no gameplay
// changes. Everything is plain typed-array drawing, so it renders headlessly.

import {
  rgba,
  type SpriteFrame,
  type SpriteProvider,
  type SpriteSet,
  type TextureProvider,
  type WallTexture,
} from './spriteProvider';

// ---------------------------------------------------------------- color utils

function chan(c: number, i: number): number {
  return (c >>> (i * 8)) & 0xff;
}
function shade(c: number, f: number): number {
  const r = Math.min(255, chan(c, 0) * f);
  const g = Math.min(255, chan(c, 1) * f);
  const b = Math.min(255, chan(c, 2) * f);
  return ((chan(c, 3) << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
function mix(c0: number, c1: number, t: number): number {
  const r = chan(c0, 0) + (chan(c1, 0) - chan(c0, 0)) * t;
  const g = chan(c0, 1) + (chan(c1, 1) - chan(c0, 1)) * t;
  const b = chan(c0, 2) + (chan(c1, 2) - chan(c0, 2)) * t;
  return rgba(r, g, b, 255);
}

// ------------------------------------------------------------ buffer drawing

function blank(w: number, h: number, fill = 0): Uint32Array {
  const d = new Uint32Array(w * h);
  if (fill) d.fill(fill);
  return d;
}
function setPx(d: Uint32Array, w: number, h: number, x: number, y: number, c: number): void {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  d[y * w + x] = c;
}
function rect(d: Uint32Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number, c: number): void {
  for (let y = Math.max(0, y0 | 0); y < Math.min(h, y1 | 0); y++)
    for (let x = Math.max(0, x0 | 0); x < Math.min(w, x1 | 0); x++) d[y * w + x] = c;
}
function gradRect(d: Uint32Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number, top: number, bot: number): void {
  const span = Math.max(1, (y1 | 0) - (y0 | 0) - 1);
  for (let y = Math.max(0, y0 | 0); y < Math.min(h, y1 | 0); y++) {
    const c = mix(top, bot, (y - y0) / span);
    for (let x = Math.max(0, x0 | 0); x < Math.min(w, x1 | 0); x++) d[y * w + x] = c;
  }
}
function ellipse(d: Uint32Array, w: number, h: number, cx: number, cy: number, rx: number, ry: number, c: number): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) setPx(d, w, h, x, y, c);
    }
  }
}
const circle = (d: Uint32Array, w: number, h: number, cx: number, cy: number, r: number, c: number) =>
  ellipse(d, w, h, cx, cy, r, r, c);

// ---------------------------------------------------------------- wall/floor textures

const TEX = 64;

function noiseTint(d: Uint32Array, w: number, h: number, amt: number, seed: number): void {
  let s = seed >>> 0;
  for (let i = 0; i < w * h; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const n = 1 + ((s >>> 24) / 255 - 0.5) * amt;
    d[i] = shade(d[i], n);
  }
}

function brickTexture(): WallTexture {
  const d = blank(TEX, TEX);
  const mortar = rgba(46, 34, 38);
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const row = Math.floor(y / 16);
      const offset = row % 2 === 0 ? 0 : 16;
      const onMortar = y % 16 < 2 || (x + offset) % 32 < 2;
      const base = (row + Math.floor((x + offset) / 32)) % 2 === 0 ? rgba(132, 46, 50) : rgba(104, 36, 42);
      // vertical shading inside each brick course
      const v = 1 - (y % 16) / 40;
      d[y * TEX + x] = onMortar ? mortar : shade(base, v);
    }
  }
  noiseTint(d, TEX, TEX, 0.1, 7);
  return { w: TEX, h: TEX, data: d };
}
function bigtopTexture(): WallTexture {
  const d = blank(TEX, TEX);
  const red = rgba(178, 44, 54);
  const white = rgba(224, 218, 212);
  for (let x = 0; x < TEX; x++) {
    const stripe = Math.floor(x / 8) % 2 === 0 ? red : white;
    for (let y = 0; y < TEX; y++) {
      const v = 0.82 + 0.18 * (1 - y / TEX); // top brighter (tent peak light)
      d[y * TEX + x] = shade(stripe, v);
    }
  }
  // scalloped valance along the top
  for (let x = 0; x < TEX; x++) {
    const s = Math.floor(2 + 2 * Math.sin((x / TEX) * Math.PI * 8));
    for (let y = 0; y < s; y++) d[y * TEX + x] = rgba(150, 30, 40);
  }
  return { w: TEX, h: TEX, data: d };
}
function panelTexture(): WallTexture {
  const d = blank(TEX, TEX);
  gradRect(d, TEX, TEX, 0, 0, TEX, TEX, rgba(86, 94, 110), rgba(58, 64, 78));
  const rivet = rgba(40, 46, 56);
  const edge = rgba(104, 114, 132);
  rect(d, TEX, TEX, 0, 0, TEX, 2, edge);
  rect(d, TEX, TEX, 0, 0, 2, TEX, edge);
  for (let y = 8; y < TEX; y += 16) for (let x = 8; x < TEX; x += 16) circle(d, TEX, TEX, x, y, 2, rivet);
  noiseTint(d, TEX, TEX, 0.06, 11);
  return { w: TEX, h: TEX, data: d };
}
function mirrorTexture(): WallTexture {
  const d = blank(TEX, TEX);
  gradRect(d, TEX, TEX, 0, 0, TEX, TEX, rgba(150, 168, 188), rgba(96, 112, 134));
  const frame = rgba(186, 154, 72);
  rect(d, TEX, TEX, 0, 0, TEX, 3, frame);
  rect(d, TEX, TEX, 0, TEX - 3, TEX, TEX, frame);
  rect(d, TEX, TEX, 0, 0, 3, TEX, frame);
  rect(d, TEX, TEX, TEX - 3, 0, TEX, TEX, frame);
  for (let i = -TEX; i < TEX; i += 14) {
    for (let y = 4; y < TEX - 4; y++) {
      const x = i + y;
      setPx(d, TEX, TEX, x, y, rgba(216, 228, 240));
      setPx(d, TEX, TEX, x + 1, y, rgba(200, 214, 228));
    }
  }
  return { w: TEX, h: TEX, data: d };
}
function floorTexture(): WallTexture {
  const d = blank(TEX, TEX);
  const a = rgba(70, 62, 58);
  const b = rgba(52, 46, 44);
  for (let y = 0; y < TEX; y++)
    for (let x = 0; x < TEX; x++) d[y * TEX + x] = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? a : b;
  noiseTint(d, TEX, TEX, 0.16, 23);
  return { w: TEX, h: TEX, data: d };
}
function ceilTexture(): WallTexture {
  const d = blank(TEX, TEX, rgba(26, 22, 32));
  for (let x = 0; x < TEX; x += 16) rect(d, TEX, TEX, x, 0, x + 2, TEX, rgba(18, 15, 22)); // beams
  noiseTint(d, TEX, TEX, 0.1, 31);
  return { w: TEX, h: TEX, data: d };
}

// ----------------------------------------------------------------- clowns

const SW = 64;
const SH = 96;
const GROUND = 88;

interface ClownPalette {
  suit: number;
  hair: number;
}
interface Pose {
  legPhase: number;
  arm: number;
  flash: boolean;
}

function drawClown(pal: ClownPalette, scale: number, view: 'front' | 'back', mirror: boolean, pose: Pose): SpriteFrame {
  const d = blank(SW, SH, 0);
  const cx = SW / 2;
  const suit = pal.suit;
  const suitDark = shade(suit, 0.62);
  const skin = rgba(238, 232, 224);
  const skinShade = rgba(206, 196, 188);
  const white = rgba(232, 230, 226);
  const bw = Math.round(13 * scale);

  // soft shadow
  ellipse(d, SW, SH, cx, GROUND + 2, 15 * scale, 4.5, rgba(0, 0, 0, 95));

  // legs (walk swing)
  const swing = [0, 3, 0, -3][pose.legPhase % 4];
  const footY = 84;
  rect(d, SW, SH, cx - 9, 58, cx - 2, footY, suitDark);
  rect(d, SW, SH, cx + 2, 58, cx + 9, footY, suitDark);
  ellipse(d, SW, SH, cx - 6 + swing, footY, 5, 3, rgba(220, 200, 70)); // shoes
  ellipse(d, SW, SH, cx + 6 - swing, footY, 5, 3, rgba(220, 200, 70));

  // torso (outline + gradient body + pom-poms)
  rect(d, SW, SH, cx - bw - 1, 33, cx + bw + 1, 61, shade(suit, 0.4));
  gradRect(d, SW, SH, cx - bw, 34, cx + bw, 60, shade(suit, 1.15), suitDark);
  circle(d, SW, SH, cx, 40, 3, rgba(255, 230, 90));
  circle(d, SW, SH, cx, 50, 3, rgba(90, 200, 255));

  // arms
  const armDown = 56;
  rect(d, SW, SH, cx - bw - 4, 36, cx - bw, armDown, suit);
  if (pose.arm > 0) rect(d, SW, SH, cx + bw, 26, cx + bw + 4, 40, suit); // raised to strike
  else rect(d, SW, SH, cx + bw, 36, cx + bw + 4, armDown, suit);
  circle(d, SW, SH, cx - bw - 2, armDown, 3, white); // gloves
  circle(d, SW, SH, cx + bw + 2, pose.arm > 0 ? 26 : armDown, 3, white);

  // ruffle collar
  for (let i = -bw; i <= bw; i += 4) circle(d, SW, SH, cx + i, 33, 3, white);

  // head
  const hr = Math.round(11 * Math.min(scale, 1.25));
  circle(d, SW, SH, cx, 19, hr + 1, shade(skin, 0.5)); // outline
  circle(d, SW, SH, cx, 19, hr, skin);
  ellipse(d, SW, SH, cx + 3, 22, hr * 0.7, hr * 0.7, skinShade); // lower-right shade
  // hair tufts
  circle(d, SW, SH, cx - hr, 12, 5, pal.hair);
  circle(d, SW, SH, cx + hr, 12, 5, pal.hair);
  circle(d, SW, SH, cx, 8, 4, pal.hair);

  if (view === 'front') {
    // eyes with diamonds
    for (const sx of [-5, 5]) {
      rect(d, SW, SH, cx + sx - 2, 15, cx + sx + 2, 23, rgba(70, 120, 200)); // diamond-ish
      circle(d, SW, SH, cx + sx, 18, 2, rgba(255, 255, 255));
      setPx(d, SW, SH, cx + sx, 18, rgba(20, 20, 30));
    }
    circle(d, SW, SH, cx, 22, 3, rgba(232, 36, 36)); // nose
    setPx(d, SW, SH, cx - 1, 21, rgba(255, 180, 180));
    ellipse(d, SW, SH, cx, 26, 6, 2, rgba(180, 24, 24)); // grin
    circle(d, SW, SH, cx - 7, 25, 2, rgba(232, 120, 120)); // cheeks
    circle(d, SW, SH, cx + 7, 25, 2, rgba(232, 120, 120));
  } else {
    // back of head: just a hint of seam
    rect(d, SW, SH, cx - 1, 12, cx + 1, 26, shade(skin, 0.8));
  }

  if (pose.flash) {
    for (let i = 0; i < SW * SH; i++) if (d[i] >>> 24) d[i] = mix(d[i], rgba(255, 255, 255), 0.55);
  }
  let frame: SpriteFrame = { w: SW, h: SH, data: d };
  if (mirror) frame = flipH(frame);
  return frame;
}

function flipH(f: SpriteFrame): SpriteFrame {
  const out = new Uint32Array(f.w * f.h);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) out[y * f.w + x] = f.data[y * f.w + (f.w - 1 - x)];
  return { w: f.w, h: f.h, data: out };
}

function applyDeath(f: SpriteFrame, t: number): SpriteFrame {
  const { w, h, data } = f;
  const out = new Uint32Array(w * h);
  const s = 1 - 0.8 * t; // collapse toward the ground
  const fa = 1 - 0.6 * t; // fade out
  for (let y = 0; y < h; y++) {
    const srcY = Math.round(GROUND - (GROUND - y) / s);
    if (srcY < 0 || srcY >= h) continue;
    for (let x = 0; x < w; x++) {
      const c = data[srcY * w + x];
      const a = c >>> 24;
      if (!a) continue;
      out[y * w + x] = (c & 0x00ffffff) | ((Math.round(a * fa) << 24) >>> 0);
    }
  }
  return { w, h, data: out };
}

// ----------------------------------------------------------------- pickups/fx

function ammoFrame(): SpriteFrame {
  const d = blank(SW, SH, 0);
  const cx = SW / 2;
  ellipse(d, SW, SH, cx, GROUND + 2, 10, 3, rgba(0, 0, 0, 90));
  gradRect(d, SW, SH, cx - 9, 64, cx + 9, 84, rgba(210, 188, 70), rgba(150, 130, 40));
  rect(d, SW, SH, cx - 9, 64, cx + 9, 68, rgba(240, 220, 110));
  rect(d, SW, SH, cx - 6, 60, cx - 2, 64, rgba(180, 150, 60));
  rect(d, SW, SH, cx + 2, 60, cx + 6, 64, rgba(180, 150, 60));
  return { w: SW, h: SH, data: d };
}
function healthFrame(): SpriteFrame {
  const d = blank(SW, SH, 0);
  const cx = SW / 2;
  ellipse(d, SW, SH, cx, GROUND + 2, 10, 3, rgba(0, 0, 0, 90));
  rect(d, SW, SH, cx - 11, 66, cx + 11, 84, rgba(238, 238, 238));
  rect(d, SW, SH, cx - 11, 66, cx + 11, 70, rgba(255, 255, 255));
  rect(d, SW, SH, cx - 3, 70, cx + 3, 82, rgba(224, 44, 44));
  rect(d, SW, SH, cx - 9, 73, cx + 9, 79, rgba(224, 44, 44));
  return { w: SW, h: SH, data: d };
}
function weaponPickupFrame(frame: number): SpriteFrame {
  const d = blank(SW, SH, 0);
  const cx = SW / 2;
  ellipse(d, SW, SH, cx, GROUND + 2, 12, 3, rgba(0, 0, 0, 90));
  const glow = frame % 2 === 0 ? rgba(255, 224, 130) : rgba(210, 168, 70);
  circle(d, SW, SH, cx, 72, 13, shade(glow, 0.5));
  circle(d, SW, SH, cx, 72, 10, glow);
  rect(d, SW, SH, cx - 14, 70, cx + 8, 76, rgba(54, 56, 66));
  rect(d, SW, SH, cx + 4, 66, cx + 10, 78, rgba(36, 38, 48));
  rect(d, SW, SH, cx - 14, 76, cx - 8, 82, rgba(36, 38, 48));
  return { w: SW, h: SH, data: d };
}
function exitFrame(frame: number): SpriteFrame {
  const d = blank(SW, SH, 0);
  const cx = SW / 2;
  const c = frame % 2 === 0 ? rgba(90, 255, 130) : rgba(46, 170, 76);
  rect(d, SW, SH, cx - 18, 26, cx + 18, 58, shade(c, 0.6));
  rect(d, SW, SH, cx - 16, 28, cx + 16, 56, rgba(10, 30, 15));
  for (let i = 0; i < 4; i++) rect(d, SW, SH, cx - 13 + i * 8, 36, cx - 8 + i * 8, 48, c);
  return { w: SW, h: SH, data: d };
}
function balloonFrame(): SpriteFrame {
  const d = blank(SW, SH, 0);
  const cx = SW / 2;
  const cy = SH / 2;
  circle(d, SW, SH, cx, cy, 9, rgba(228, 58, 78));
  circle(d, SW, SH, cx - 3, cy - 3, 3, rgba(255, 180, 190));
  rect(d, SW, SH, cx - 1, cy + 8, cx + 1, cy + 14, rgba(120, 90, 60)); // knot/string
  return { w: SW, h: SH, data: d };
}
function rocketFrame(): SpriteFrame {
  const d = blank(SW, SH, 0);
  const cx = SW / 2;
  const cy = SH / 2;
  circle(d, SW, SH, cx, cy, 6, rgba(255, 196, 86));
  circle(d, SW, SH, cx, cy, 3, rgba(255, 244, 210));
  circle(d, SW, SH, cx - 6, cy + 2, 3, rgba(220, 120, 40));
  return { w: SW, h: SH, data: d };
}

// ----------------------------------------------------------------- sprite sets

interface StateAnim {
  frames: number;
  fps: number;
  loop: boolean;
}
type DrawFn = (state: string, frame: number, view: 'front' | 'back', mirror: boolean) => SpriteFrame;

function facingToView(facing: number): { view: 'front' | 'back'; mirror: boolean } {
  // 0=front .. 4=back (8-way). Treat rear sectors as back; left sectors mirror.
  const back = facing >= 3 && facing <= 5;
  const mirror = facing >= 5;
  return { view: back ? 'back' : 'front', mirror };
}

class AnimatedSpriteSet implements SpriteSet {
  private cache = new Map<string, SpriteFrame>();
  constructor(
    public worldHeight: number,
    private anims: Record<string, StateAnim>,
    private draw: DrawFn,
    private fallback = 'idle',
  ) {}

  frame(state: string, facing: number, animTime: number): SpriteFrame {
    const st = this.anims[state] ? state : this.fallback;
    const cfg = this.anims[st];
    let idx: number;
    if (cfg.loop) idx = Math.floor(animTime * cfg.fps) % cfg.frames;
    else idx = Math.min(cfg.frames - 1, Math.max(0, Math.floor(animTime * cfg.frames)));
    const { view, mirror } = facingToView(facing);
    const key = `${st}:${idx}:${view}:${mirror ? 1 : 0}`;
    let f = this.cache.get(key);
    if (!f) {
      f = this.draw(st, idx, view, mirror);
      this.cache.set(key, f);
    }
    return f;
  }
}

const CLOWN_ANIMS: Record<string, StateAnim> = {
  idle: { frames: 1, fps: 1, loop: true },
  chase: { frames: 4, fps: 8, loop: true },
  attack: { frames: 2, fps: 8, loop: true },
  hurt: { frames: 1, fps: 1, loop: true },
  dying: { frames: 4, fps: 1, loop: false },
};
const STATIC: Record<string, StateAnim> = { idle: { frames: 1, fps: 1, loop: true } };
const BLINK: Record<string, StateAnim> = { idle: { frames: 2, fps: 3, loop: true } };

function clownDraw(pal: ClownPalette, scale: number): DrawFn {
  return (state, frame, view, mirror) => {
    let legPhase = 0;
    let arm = 0;
    if (state === 'chase') legPhase = frame;
    if (state === 'attack') arm = frame;
    const flash = state === 'hurt';
    let f = drawClown(pal, scale, view, mirror, { legPhase, arm, flash });
    if (state === 'dying') f = applyDeath(f, frame / 3);
    return f;
  };
}

const PALETTES: Record<string, { pal: ClownPalette; scale: number; height: number }> = {
  'clown.jester': { pal: { suit: rgba(214, 44, 122), hair: rgba(232, 64, 44) }, scale: 1.0, height: 0.95 },
  'clown.brute': { pal: { suit: rgba(126, 52, 166), hair: rgba(70, 46, 34) }, scale: 1.5, height: 1.3 },
  'clown.acrobat': { pal: { suit: rgba(40, 206, 184), hair: rgba(244, 224, 64) }, scale: 0.82, height: 0.9 },
  'clown.bomber': { pal: { suit: rgba(72, 116, 224), hair: rgba(244, 126, 44) }, scale: 1.12, height: 1.08 },
};

export class ProceduralAssets implements SpriteProvider, TextureProvider {
  private walls = new Map<number, WallTexture>();
  private floorTex = floorTexture();
  private ceilTex = ceilTexture();
  private sprites = new Map<string, SpriteSet>();

  constructor() {
    this.walls.set(1, brickTexture());
    this.walls.set(2, bigtopTexture());
    this.walls.set(3, panelTexture());
    this.walls.set(4, mirrorTexture());

    for (const [id, cfg] of Object.entries(PALETTES)) {
      this.sprites.set(id, new AnimatedSpriteSet(cfg.height, CLOWN_ANIMS, clownDraw(cfg.pal, cfg.scale)));
    }
    this.sprites.set('clown.basic', this.sprites.get('clown.jester')!);

    this.sprites.set('pickup.ammo', new AnimatedSpriteSet(0.5, STATIC, () => ammoFrame()));
    this.sprites.set('pickup.health', new AnimatedSpriteSet(0.5, STATIC, () => healthFrame()));
    this.sprites.set('pickup.weapon', new AnimatedSpriteSet(0.6, BLINK, (_s, fr) => weaponPickupFrame(fr)));
    this.sprites.set('exit.sign', new AnimatedSpriteSet(1.1, BLINK, (_s, fr) => exitFrame(fr)));
    this.sprites.set('projectile.balloon', new AnimatedSpriteSet(0.4, STATIC, () => balloonFrame()));
    this.sprites.set('projectile.rocket', new AnimatedSpriteSet(0.35, STATIC, () => rocketFrame()));
  }

  wall(id: number): WallTexture {
    return this.walls.get(id) ?? this.walls.get(1)!;
  }
  floor(): WallTexture {
    return this.floorTex;
  }
  ceil(): WallTexture {
    return this.ceilTex;
  }
  get(spriteId: string): SpriteSet {
    return this.sprites.get(spriteId) ?? this.sprites.get('clown.jester')!;
  }
}
