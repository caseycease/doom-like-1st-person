// The art-swap contract. Entities reference a `spriteId` string (never a file
// path). A SpriteProvider resolves that id to drawable frames. Swapping the
// implementation (procedural -> texture atlas) requires ZERO gameplay changes.

/** A renderer-agnostic bitmap. `data` is packed RGBA (little-endian 0xAABBGGRR). */
export interface SpriteFrame {
  w: number;
  h: number;
  data: Uint32Array;
}

export interface SpriteSet {
  /**
   * @param state    logical state, e.g. 'idle' | 'chase' | 'attack' | 'hurt' | 'dying'
   * @param facing   0..7 eight-direction billboard index (camera-relative)
   * @param animTime seconds, for frame cycling
   */
  frame(state: string, facing: number, animTime: number): SpriteFrame;
  /** Logical world height in tiles; drives on-screen scale. */
  worldHeight: number;
}

export interface SpriteProvider {
  get(spriteId: string): SpriteSet;
}

export interface WallTexture {
  w: number;
  h: number;
  data: Uint32Array;
}

export interface TextureProvider {
  wall(id: number): WallTexture;
  /** Floor/ceiling textures for floorcasting. */
  floor(): WallTexture;
  ceil(): WallTexture;
}

/** Pack RGBA into a little-endian Uint32 (matches ImageData byte order). */
export function rgba(r: number, g: number, b: number, a = 255): number {
  return (((a << 24) | (b << 16) | (g << 8) | r) >>> 0) as number;
}
