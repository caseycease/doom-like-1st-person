// Deterministic, seedable PRNG (mulberry32). Used everywhere in logic so that
// AI/spawn behavior is reproducible in headless tests. Never use Math.random in
// the engine layer.

export interface Rng {
  next(): number; // [0, 1)
  seed: number;
}

export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    get seed() {
      return state;
    },
    next() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
