// Procedural placeholder art. Gameplay is fully provable with these; real clown
// art drops in later behind the same SpriteProvider/TextureProvider interfaces.

import {
  rgba,
  type SpriteFrame,
  type SpriteProvider,
  type SpriteSet,
  type TextureProvider,
  type WallTexture,
} from './spriteProvider';

const TEX = 64;

// --- tiny framebuffer drawing helpers (operate on packed RGBA arrays) ---

function blank(w: number, h: number, fill = 0): Uint32Array {
  const d = new Uint32Array(w * h);
  if (fill) d.fill(fill);
  return d;
}

function fillRect(d: Uint32Array, w: number, x0: number, y0: number, x1: number, y1: number, c: number): void {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) d[y * w + x] = c;
}

function fillCircle(d: Uint32Array, w: number, cx: number, cy: number, r: number, c: number): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2 && x >= 0 && y >= 0 && x < w) d[y * w + x] = c;
    }
  }
}

// ---------------------------------------------------------------- wall textures

function brickTexture(): WallTexture {
  const d = blank(TEX, TEX);
  const mortar = rgba(40, 30, 35);
  const brickA = rgba(120, 40, 45);
  const brickB = rgba(95, 32, 38);
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const row = Math.floor(y / 16);
      const offset = row % 2 === 0 ? 0 : 16;
      const onMortar = y % 16 === 0 || (x + offset) % 32 === 0;
      d[y * TEX + x] = onMortar ? mortar : (row + x) % 2 === 0 ? brickA : brickB;
    }
  }
  return { w: TEX, h: TEX, data: d };
}

function bigtopTexture(): WallTexture {
  const d = blank(TEX, TEX);
  const red = rgba(170, 40, 50);
  const white = rgba(220, 215, 210);
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      d[y * TEX + x] = Math.floor(x / 8) % 2 === 0 ? red : white;
    }
  }
  return { w: TEX, h: TEX, data: d };
}

function panelTexture(): WallTexture {
  const d = blank(TEX, TEX, rgba(70, 78, 92));
  const rivet = rgba(40, 46, 56);
  const edge = rgba(95, 104, 120);
  fillRect(d, TEX, 0, 0, TEX, 2, edge);
  fillRect(d, TEX, 0, 0, 2, TEX, edge);
  for (let y = 8; y < TEX; y += 16) for (let x = 8; x < TEX; x += 16) fillCircle(d, TEX, x, y, 2, rivet);
  return { w: TEX, h: TEX, data: d };
}

// ----------------------------------------------------------------- sprites

const SW = 48;
const SH = 64;

function clownFrame(state: string, animTime: number): SpriteFrame {
  const d = blank(SW, SH, 0); // transparent
  const dying = state === 'dying';
  const hurt = state === 'hurt';

  // body suit (color flashes white on hurt, greys out while dying)
  let suit = rgba(210, 40, 120);
  if (hurt) suit = rgba(255, 230, 230);
  if (dying) suit = rgba(90, 60, 80);

  const cx = SW / 2;
  // simple two-frame walk wobble
  const wobble = state === 'chase' && Math.floor(animTime * 6) % 2 === 0 ? 1 : 0;

  // legs
  fillRect(d, SW, cx - 10, 50, cx - 2, 62 - wobble, suit);
  fillRect(d, SW, cx + 2, 50, cx + 10, 62 + wobble, suit);
  // torso (with pom-poms)
  fillRect(d, SW, cx - 12, 28, cx + 12, 52, suit);
  fillCircle(d, SW, cx, 34, 3, rgba(255, 230, 90));
  fillCircle(d, SW, cx, 44, 3, rgba(90, 200, 255));
  // head: white face
  fillCircle(d, SW, cx, 18, 12, rgba(235, 230, 225));
  // hair tufts
  fillCircle(d, SW, cx - 11, 12, 5, rgba(230, 60, 40));
  fillCircle(d, SW, cx + 11, 12, 5, rgba(230, 60, 40));
  // eyes (X eyes when dying)
  if (dying) {
    fillRect(d, SW, cx - 7, 16, cx - 3, 18, rgba(20, 0, 0));
    fillRect(d, SW, cx + 3, 16, cx + 7, 18, rgba(20, 0, 0));
  } else {
    fillCircle(d, SW, cx - 5, 17, 2, rgba(20, 20, 30));
    fillCircle(d, SW, cx + 5, 17, 2, rgba(20, 20, 30));
  }
  // red nose + grin
  fillCircle(d, SW, cx, 21, 3, rgba(230, 30, 30));
  fillRect(d, SW, cx - 6, 24, cx + 6, 26, rgba(180, 20, 20));
  return { w: SW, h: SH, data: d };
}

function ammoFrame(): SpriteFrame {
  const d = blank(SW, SH, 0);
  fillRect(d, SW, SW / 2 - 8, 40, SW / 2 + 8, 56, rgba(180, 160, 40));
  fillRect(d, SW, SW / 2 - 8, 40, SW / 2 + 8, 44, rgba(230, 210, 80));
  return { w: SW, h: SH, data: d };
}

function healthFrame(): SpriteFrame {
  const d = blank(SW, SH, 0);
  const cx = SW / 2;
  fillRect(d, SW, cx - 9, 44, cx + 9, 56, rgba(235, 235, 235));
  fillRect(d, SW, cx - 3, 42, cx + 3, 58, rgba(220, 40, 40));
  fillRect(d, SW, cx - 8, 47, cx + 8, 53, rgba(220, 40, 40));
  return { w: SW, h: SH, data: d };
}

function exitFrame(animTime: number): SpriteFrame {
  const d = blank(SW, SH, 0);
  const blink = Math.floor(animTime * 2) % 2 === 0;
  const c = blink ? rgba(80, 255, 120) : rgba(40, 160, 70);
  fillRect(d, SW, 6, 20, SW - 6, 44, c);
  fillRect(d, SW, 8, 22, SW - 8, 42, rgba(10, 30, 15));
  // "EXIT" suggestion: four bright bars
  for (let i = 0; i < 4; i++) fillRect(d, SW, 11 + i * 8, 28, 16 + i * 8, 36, c);
  return { w: SW, h: SH, data: d };
}

class CachingSpriteSet implements SpriteSet {
  private cache = new Map<string, SpriteFrame>();
  constructor(
    public worldHeight: number,
    private gen: (state: string, animTime: number) => SpriteFrame,
    private animated: boolean,
  ) {}

  frame(state: string, _facing: number, animTime: number): SpriteFrame {
    // For animated sprites, bucket animTime so we cache a small frame set.
    const bucket = this.animated ? Math.floor(animTime * 6) % 2 : 0;
    const key = `${state}:${bucket}`;
    let f = this.cache.get(key);
    if (!f) {
      f = this.gen(state, animTime);
      this.cache.set(key, f);
    }
    return f;
  }
}

export class ProceduralAssets implements SpriteProvider, TextureProvider {
  private walls = new Map<number, WallTexture>();
  private sprites = new Map<string, SpriteSet>();

  constructor() {
    this.walls.set(1, brickTexture());
    this.walls.set(2, bigtopTexture());
    this.walls.set(3, panelTexture());

    this.sprites.set('clown.basic', new CachingSpriteSet(0.95, (s, t) => clownFrame(s, t), true));
    this.sprites.set('pickup.ammo', new CachingSpriteSet(0.5, () => ammoFrame(), false));
    this.sprites.set('pickup.health', new CachingSpriteSet(0.5, () => healthFrame(), false));
    this.sprites.set('exit.sign', new CachingSpriteSet(1.1, (_s, t) => exitFrame(t), true));
  }

  wall(id: number): WallTexture {
    return this.walls.get(id) ?? this.walls.get(1)!;
  }

  get(spriteId: string): SpriteSet {
    return this.sprites.get(spriteId) ?? this.sprites.get('clown.basic')!;
  }
}
