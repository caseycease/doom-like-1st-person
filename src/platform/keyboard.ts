// Dev-only fallback: keyboard + mouse. The game never assumes this exists —
// it just contributes to the same InputState the touch layer produces. PLATFORM.

import type { InputState } from '../engine/input';

const KEY_YAW = 0.045; // rad per sample when an arrow is held
const KEY_PITCH = 0.03;
const MOUSE_YAW = 0.0022;
const MOUSE_PITCH = 0.0018;

export class KeyboardControls {
  private keys = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private swapPulse = 0;
  private pausePulse = false;

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    el.addEventListener('click', () => {
      if (document.pointerLockElement !== el) el.requestPointerLock?.();
    });
    document.addEventListener('mousemove', this.onMouse);
  }

  private onKey = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (k === 'q') this.swapPulse = -1;
    if (k === 'e') this.swapPulse = 1;
    if (k === 'p' || k === 'escape') this.pausePulse = true;
    this.keys.add(k);
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };
  private onMouse = (e: MouseEvent): void => {
    if (document.pointerLockElement !== this.el) return;
    this.mouseDX += e.movementX * MOUSE_YAW;
    this.mouseDY += e.movementY * MOUSE_PITCH;
  };

  /** Whether any keyboard/mouse input is currently active (to know if to merge). */
  active(): boolean {
    return this.keys.size > 0 || this.mouseDX !== 0 || this.mouseDY !== 0 || this.swapPulse !== 0;
  }

  sample(): InputState {
    const k = this.keys;
    const move = { x: 0, y: 0 };
    if (k.has('w') || k.has('arrowup')) move.y += 1;
    if (k.has('s') || k.has('arrowdown')) move.y -= 1;
    if (k.has('d')) move.x += 1;
    if (k.has('a')) move.x -= 1;

    let lookX = this.mouseDX;
    let lookY = this.mouseDY;
    if (k.has('arrowleft')) lookX -= KEY_YAW;
    if (k.has('arrowright')) lookX += KEY_YAW;
    if (k.has('pageup')) lookY -= KEY_PITCH;
    if (k.has('pagedown')) lookY += KEY_PITCH;

    const s: InputState = {
      move,
      look: { x: lookX, y: lookY },
      firing: k.has(' ') || k.has('control') || k.has('enter'),
      swapWeapon: this.swapPulse,
    };
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.swapPulse = 0;
    return s;
  }

  consumePause(): boolean {
    const p = this.pausePulse;
    this.pausePulse = false;
    return p;
  }
}
