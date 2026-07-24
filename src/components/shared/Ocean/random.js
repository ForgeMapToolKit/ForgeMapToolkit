/**
 * random.js — seeded PRNG + Gaussian sampling for the ocean spectrum.
 *
 * Math.random cannot be seeded, and a wave field has to be reproducible: the
 * same seed must give the same sea, or nothing in the UI is tunable. xorshift128+
 * is used because it is short, fast, and has a long enough period (2¹²⁸−1) that
 * a 4096² grid drawing two Gaussians per cell never revisits its own stream.
 */

/** xorshift128+ — returns a function producing uniforms in [0,1). */
export function makeRng(seed = 1) {
  // SplitMix64-ish expansion so that adjacent integer seeds diverge immediately.
  let s0 = 0x9e3779b9 ^ (seed | 0);
  let s1 = 0x243f6a88 ^ ((seed * 0x85ebca6b) | 0);
  let s2 = 0xb7e15162 ^ ((seed * 0xc2b2ae35) | 0);
  let s3 = 0x8f1bbcdc ^ ((seed * 0x27d4eb2f) | 0);

  // Warm-up: without it, low seeds correlate for the first few dozen draws.
  const next = () => {
    let t = s3;
    const s = s0;
    s3 = s2;
    s2 = s1;
    s1 = s;
    t ^= t << 11; t >>>= 0;
    t ^= t >>> 8;
    s0 = (t ^ s ^ (s >>> 19)) >>> 0;
    return s0;
  };
  for (let i = 0; i < 32; i++) next();

  return () => next() / 4294967296;
}

/**
 * Box-Muller. Returns a function yielding one standard normal per call,
 * caching the second value of each pair rather than discarding it.
 */
export function makeGaussian(rng) {
  let spare = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0, v = 0, s = 0;
    // Marsaglia polar — no trig, and it never returns the 0 that log() hates.
    do {
      u = rng() * 2 - 1;
      v = rng() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * f;
    return u * f;
  };
}
