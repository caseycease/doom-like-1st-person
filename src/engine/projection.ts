// Pure billboard projection math, shared by the renderer and its tests.
// World -> camera space -> screen x + depth. No drawing here.

export interface SpriteProjection {
  visible: boolean; // in front of the camera
  screenX: number; // pixel column of the sprite center
  depth: number; // perpendicular camera depth (compare against wall z-buffer)
  transformX: number; // lateral camera-space coordinate
}

/** Camera plane half-width for a given horizontal FOV. */
export function planeLengthForFov(fov: number): number {
  return Math.tan(fov / 2);
}

/**
 * Project a world point onto the screen given the camera pose.
 * `planeLen` is the camera plane half-width (see planeLengthForFov).
 */
export function projectSprite(
  px: number,
  py: number,
  angle: number,
  planeLen: number,
  screenWidth: number,
  wx: number,
  wy: number,
): SpriteProjection {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const planeX = -dirY * planeLen;
  const planeY = dirX * planeLen;

  const sx = wx - px;
  const sy = wy - py;

  const det = planeX * dirY - dirX * planeY;
  const invDet = 1 / det;
  const transformX = invDet * (dirY * sx - dirX * sy);
  const depth = invDet * (-planeY * sx + planeX * sy);

  const visible = depth > 1e-4;
  const screenX = (screenWidth / 2) * (1 + transformX / depth);

  return { visible, screenX, depth, transformX };
}
