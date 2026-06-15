// The single struct the simulation sees. It has no idea whether a thumb, a
// mouse, or a test produced it — which is exactly what makes step() testable.

export interface InputState {
  /** Movement intent. x = strafe (-left/+right), y = forward (-back/+fwd). */
  move: { x: number; y: number };
  /** Look delta THIS sample. x = yaw radians, y = pitch radians. */
  look: { x: number; y: number };
  firing: boolean;
  /** 0 = none, -1/+1 = cycle prev/next, >=10 reserved for direct index+10. */
  swapWeapon: number;
}

export function emptyInput(): InputState {
  return { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, firing: false, swapWeapon: 0 };
}
