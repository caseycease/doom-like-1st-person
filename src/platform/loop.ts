// Fixed-timestep driver. Simulation advances in whole DT ticks regardless of
// paint rate; rendering happens once per RAF. PLATFORM layer.

export const DT = 1 / 60;
const MAX_FRAME = 0.25; // clamp to avoid spiral-of-death after a stall

export interface LoopCallbacks {
  /** Advance the simulation by exactly DT seconds. */
  update: (dt: number) => void;
  /** Paint. alpha is the interpolation fraction in [0,1) toward the next tick. */
  render: (alpha: number, fps: number) => void;
}

export class GameLoop {
  private acc = 0;
  private last = 0;
  private running = false;
  private rafId = 0;
  private fps = 60;
  private fpsAccum = 0;
  private fpsFrames = 0;

  constructor(private cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    let frameTime = (now - this.last) / 1000;
    this.last = now;
    if (frameTime > MAX_FRAME) frameTime = MAX_FRAME;

    // fps (smoothed over ~0.5s)
    this.fpsAccum += frameTime;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    this.acc += frameTime;
    while (this.acc >= DT) {
      this.cb.update(DT);
      this.acc -= DT;
    }
    this.cb.render(this.acc / DT, this.fps);

    this.rafId = requestAnimationFrame(this.frame);
  };

  get currentFps(): number {
    return this.fps;
  }
}
