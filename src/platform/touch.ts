// Touch-first controls: floating left-thumb joystick (move/strafe), right-side
// drag to look, a fire button, and a weapon-swap button. All multi-touch
// simultaneous (tracked by pointer id). Produces a plain InputState. PLATFORM.

import type { InputState } from '../engine/input';

const JOY_RADIUS = 70; // px
const LOOK_YAW = 0.005; // rad per px
const LOOK_PITCH = 0.004; // rad per px (screen-space)
const FIRE_R = 70;
const SWAP_R = 38;

type Role = 'move' | 'look' | 'fire' | 'swap';

interface Pointer {
  role: Role;
  originX: number;
  originY: number;
  lastX: number;
  lastY: number;
}

export interface TouchUiState {
  joyActive: boolean;
  joyX: number;
  joyY: number;
  joyDX: number;
  joyDY: number;
  fireCX: number;
  fireCY: number;
  swapCX: number;
  swapCY: number;
}

export class TouchControls {
  private pointers = new Map<number, Pointer>();
  private move = { x: 0, y: 0 };
  private lookDX = 0;
  private lookDY = 0;
  private firing = false;
  private swapPulse = 0;
  private joyActive = false;
  private joyX = 0;
  private joyY = 0;

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private rect() {
    return this.el.getBoundingClientRect();
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.rect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private fireCenter() {
    const r = this.rect();
    return { x: r.width - 90, y: r.height - 90 };
  }
  private swapCenter() {
    const r = this.rect();
    return { x: r.width / 2, y: r.height - 56 };
  }

  private classify(x: number, y: number): Role {
    const f = this.fireCenter();
    if (Math.hypot(x - f.x, y - f.y) <= FIRE_R) return 'fire';
    const s = this.swapCenter();
    if (Math.hypot(x - s.x, y - s.y) <= SWAP_R) return 'swap';
    const r = this.rect();
    return x < r.width * 0.5 ? 'move' : 'look';
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    const { x, y } = this.local(e);
    const role = this.classify(x, y);
    this.pointers.set(e.pointerId, { role, originX: x, originY: y, lastX: x, lastY: y });
    if (role === 'move') {
      this.joyActive = true;
      this.joyX = x;
      this.joyY = y;
      this.move.x = 0;
      this.move.y = 0;
    } else if (role === 'fire') {
      this.firing = true;
    } else if (role === 'swap') {
      this.swapPulse = 1;
    }
  };

  private onMove = (e: PointerEvent): void => {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    e.preventDefault();
    const { x, y } = this.local(e);
    if (ptr.role === 'move') {
      let dx = (x - ptr.originX) / JOY_RADIUS;
      let dy = (y - ptr.originY) / JOY_RADIUS;
      const mag = Math.hypot(dx, dy);
      if (mag > 1) {
        dx /= mag;
        dy /= mag;
      }
      this.move.x = dx; // strafe
      this.move.y = -dy; // up = forward
    } else if (ptr.role === 'look') {
      this.lookDX += (x - ptr.lastX) * LOOK_YAW;
      this.lookDY += (y - ptr.lastY) * LOOK_PITCH;
    }
    ptr.lastX = x;
    ptr.lastY = y;
  };

  private onUp = (e: PointerEvent): void => {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    this.pointers.delete(e.pointerId);
    if (ptr.role === 'move') {
      this.joyActive = false;
      this.move.x = 0;
      this.move.y = 0;
    } else if (ptr.role === 'fire') {
      // keep firing only if another fire pointer remains
      this.firing = [...this.pointers.values()].some((q) => q.role === 'fire');
    }
  };

  /** Sample input and consume per-frame deltas (look + swap pulse). */
  sample(): InputState {
    const s: InputState = {
      move: { x: this.move.x, y: this.move.y },
      look: { x: this.lookDX, y: this.lookDY },
      firing: this.firing,
      swapWeapon: this.swapPulse,
    };
    this.lookDX = 0;
    this.lookDY = 0;
    this.swapPulse = 0;
    return s;
  }

  ui(): TouchUiState {
    const f = this.fireCenter();
    const sw = this.swapCenter();
    return {
      joyActive: this.joyActive,
      joyX: this.joyX,
      joyY: this.joyY,
      joyDX: this.move.x * JOY_RADIUS,
      joyDY: -this.move.y * JOY_RADIUS,
      fireCX: f.x,
      fireCY: f.y,
      swapCX: sw.x,
      swapCY: sw.y,
    };
  }
}
