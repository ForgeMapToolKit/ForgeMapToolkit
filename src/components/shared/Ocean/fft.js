/**
 * fft.js — iterative radix-2 Cooley-Tukey FFT for the ocean simulator.
 *
 * Two things here are deliberate and matter downstream:
 *
 *  1. The inverse transform is **unnormalised** — it evaluates the plain sum
 *     `x[n] = Σ X[k]·e^{+2πikn/N}` with no 1/N factor. The ocean spectrum in
 *     spectrum.js is scaled in physical units (metres) on the assumption that
 *     this sum is what reconstructs the surface. Adding a 1/N here would
 *     silently rescale every wave height by the grid size.
 *
 *  2. Columns are copied into a contiguous scratch buffer rather than being
 *     transformed in place with a stride. A 2048² bake runs four 2D inverse
 *     transforms; the strided variant spends most of its time waiting on cache
 *     misses. The copy costs one pass and buys roughly 3×.
 *
 * All buffers are Float64Array — the spectrum spans several decades of
 * amplitude and float32 loses the low end of it.
 */

/** Precomputed bit-reversal permutation + twiddle table for one length. */
export function makePlan(n) {
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new Error(`fft: length must be a power of two ≥ 2, got ${n}`);
  }

  let levels = 0;
  while ((1 << levels) < n) levels++;

  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let x = i, r = 0;
    for (let b = 0; b < levels; b++) { r = (r << 1) | (x & 1); x >>>= 1; }
    rev[i] = r;
  }

  const half = n >> 1;
  const cos = new Float64Array(half);
  const sin = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }

  return { n, levels, rev, cos, sin };
}

/**
 * In-place 1D transform over `re`/`im` (length plan.n).
 * `sign` = -1 forward (e^{-iθ}), +1 inverse (e^{+iθ}, unnormalised).
 */
export function fft1d(re, im, plan, sign) {
  const { n, rev, cos, sin } = plan;

  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i];     im[i] = im[j]; im[j] = t;
    }
  }

  for (let size = 2; size <= n; size <<= 1) {
    const halfSize = size >> 1;
    const step = n / size;
    for (let base = 0; base < n; base += size) {
      for (let j = base, k = 0; j < base + halfSize; j++, k += step) {
        const l  = j + halfSize;
        const wr = cos[k];
        const wi = sign * sin[k];
        const tr = re[l] * wr - im[l] * wi;
        const ti = re[l] * wi + im[l] * wr;
        re[l] = re[j] - tr;  im[l] = im[j] - ti;
        re[j] = re[j] + tr;  im[j] = im[j] + ti;
      }
    }
  }
}

/**
 * In-place 2D transform over a row-major n×n complex field.
 * Same `sign` convention as fft1d. Scratch buffers are allocated once per
 * call — a 2048² pair is 32 KB, not worth threading through the API.
 */
export function fft2d(re, im, n, sign, plan = makePlan(n)) {
  // rows — already contiguous
  for (let row = 0; row < n; row++) {
    const off = row * n;
    fft1dOffset(re, im, off, plan, sign);
  }

  // columns — gather, transform, scatter
  const cre = new Float64Array(n);
  const cim = new Float64Array(n);
  for (let col = 0; col < n; col++) {
    for (let row = 0; row < n; row++) {
      const idx = row * n + col;
      cre[row] = re[idx];
      cim[row] = im[idx];
    }
    fft1d(cre, cim, plan, sign);
    for (let row = 0; row < n; row++) {
      const idx = row * n + col;
      re[idx] = cre[row];
      im[idx] = cim[row];
    }
  }
}

/** fft1d over a contiguous slice starting at `off`. */
function fft1dOffset(re, im, off, plan, sign) {
  const { n, rev, cos, sin } = plan;

  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      const a = off + i, b = off + j;
      let t = re[a]; re[a] = re[b]; re[b] = t;
      t = im[a];     im[a] = im[b]; im[b] = t;
    }
  }

  for (let size = 2; size <= n; size <<= 1) {
    const halfSize = size >> 1;
    const step = n / size;
    for (let base = 0; base < n; base += size) {
      for (let j = base, k = 0; j < base + halfSize; j++, k += step) {
        const a  = off + j;
        const b  = off + j + halfSize;
        const wr = cos[k];
        const wi = sign * sin[k];
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;  im[b] = im[a] - ti;
        re[a] = re[a] + tr;  im[a] = im[a] + ti;
      }
    }
  }
}

/**
 * Signed wavenumber index for FFT bin `i` of a length-n axis.
 * Bins 0…n/2-1 are the positive frequencies, n/2…n-1 the negative ones.
 */
export function binToMode(i, n) {
  return i < n / 2 ? i : i - n;
}
