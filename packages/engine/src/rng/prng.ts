/**
 * Deterministic, seedable PRNG for the engine.
 *
 * Engine randomness must be reproducible: the same seed + same draw sequence
 * always yields the same numbers. Per `docs/engine/architecture.md` §1, all
 * randomness is server-side and persisted via seeds (see `engine_seeds`), so a
 * campaign can be replayed deterministically from its event log.
 *
 * Implementation: `xmur3` string hash → 32-bit seed → `mulberry32` stream.
 * These are small, well-known, fast generators. They are NOT cryptographically
 * secure; do not use for anything security-sensitive. They are chosen for
 * determinism and reproducibility, which is what the engine needs.
 */

/** Hash an arbitrary string into a 32-bit seed (xmur3). */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 PRNG: returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** Create a deterministic float stream in [0, 1) from a string seed. */
export function createSeededRng(seed: string): Rng {
  const seedFn = xmur3(seed);
  return mulberry32(seedFn());
}

/** Inclusive integer in [min, max] drawn from `rng`. */
export function randomInt(rng: Rng, min: number, max: number): number {
  if (max < min) {
    throw new Error(`randomInt: max (${max}) < min (${min})`);
  }
  return min + Math.floor(rng() * (max - min + 1));
}
