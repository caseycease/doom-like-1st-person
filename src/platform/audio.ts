// Audio is stubbed for the Phase-1 slice: events flow through the same sfxId
// string contract that real samples will use later (Phase 2+). Procedural blips
// via WebAudio so the slice has feedback without any asset files.

import type { GameEvent } from '../engine/world';

const EVENT_SFX: Partial<Record<GameEvent['type'], { freq: number; dur: number; type: OscillatorType }>> = {
  shoot: { freq: 220, dur: 0.06, type: 'square' },
  enemyHit: { freq: 320, dur: 0.05, type: 'triangle' },
  enemyDied: { freq: 110, dur: 0.25, type: 'sawtooth' },
  pickup: { freq: 660, dur: 0.12, type: 'sine' },
  playerHurt: { freq: 90, dur: 0.18, type: 'square' },
  levelComplete: { freq: 880, dur: 0.4, type: 'sine' },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;

  /** Must be called from a user gesture to satisfy autoplay policies. */
  resume(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    void this.ctx?.resume();
  }

  play(events: GameEvent[]): void {
    if (!this.ctx) return;
    for (const ev of events) {
      const spec = EVENT_SFX[ev.type];
      if (!spec) continue;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = spec.type;
      osc.frequency.setValueAtTime(spec.freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + spec.dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + spec.dur);
    }
  }
}
