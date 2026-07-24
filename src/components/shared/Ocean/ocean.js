/**
 * ocean.js — Tessendorf FFT ocean field.
 *
 * Produces eight real fields on an N×N grid covering L×L metres:
 *
 *   h              surface height
 *   Dx,  Dz        horizontal (choppy) displacement
 *   hx,  hz        height gradient
 *   Dxx, Dxz, Dzz  displacement gradient  (Dzx ≡ Dxz analytically)
 *
 * Every one of them comes out of the frequency domain, so the derivatives are
 * analytically exact — no finite differencing, no Sobel noise. That is the
 * single biggest quality difference against sampling a baked height image.
 *
 * ── Transform budget ────────────────────────────────────────────────────────
 * Eight real fields would be eight inverse transforms. But every one of these
 * spectra is Hermitian, so two real fields can ride in one complex transform
 * (`IFFT(Ã + iB̃)` → real part = A, imaginary part = B). Four transforms, not
 * eight. Better still: each of the eight spectra turns out to be h̃ times a
 * per-cell complex constant, so the four packed spectra are one multiply each.
 *
 *   pass 1:  h   + i·Dx    ⟶  h̃ · (1 + kx/k)
 *   pass 2:  Dz  + i·hx    ⟶  h̃ · (−kx − i·kz/k)
 *   pass 3:  hz  + i·Dxx   ⟶  h̃ · i·(kz + kx²/k)
 *   pass 4:  Dxz + i·Dzz   ⟶  h̃ · (kx·kz/k + i·kz²/k)
 *
 * derived from
 *   h̃x = i·kx·h̃      D̃x  = −i·(kx/k)·h̃      D̃xx = (kx²/k)·h̃
 *   h̃z = i·kz·h̃      D̃z  = −i·(kz/k)·h̃      D̃xz = (kx·kz/k)·h̃
 *                                             D̃zz = (kz²/k)·h̃
 */

import { makePlan, fft2d, binToMode } from './fft.js';
import { makeRng, makeGaussian } from './random.js';
import { makeSpectrum, dispersion } from './spectrum.js';

/**
 * Power-complementary band window.
 *
 * Slots are independent random realisations of one spectrum, so their *powers*
 * add — which means the windows must satisfy Σ w² = 1, not Σ w = 1. Hence the
 * sqrt: `w = √(highpass · lowpass)`. Get this wrong and the octave split either
 * gains or loses energy at every band edge.
 */
function bandWindow(k, kLo, kHi, octaves) {
  const f = Math.pow(2, octaves / 2);
  let p = 1;

  if (kLo > 0) {
    const a = kLo / f, b = kLo * f;
    if (k <= a) return 0;
    if (k < b) {
      const t = (Math.log(k) - Math.log(a)) / (Math.log(b) - Math.log(a));
      p *= t * t * (3 - 2 * t);
    }
  }

  if (Number.isFinite(kHi)) {
    const a = kHi / f, b = kHi * f;
    if (k >= b) return 0;
    if (k > a) {
      const t = (Math.log(k) - Math.log(a)) / (Math.log(b) - Math.log(a));
      p *= 1 - t * t * (3 - 2 * t);
    }
  }

  return Math.sqrt(p);
}

/**
 * Build the time-zero amplitudes h̃₀(k) and the dispersion table.
 *
 * @param {object}  opts
 * @param {number}  opts.N       grid resolution (power of two)
 * @param {number}  opts.L       tile size in metres
 * @param {object}  opts.sea     sea state (see spectrum.js DEFAULT_SEA)
 * @param {number}  opts.seed    PRNG seed
 * @param {number} [opts.kLo]    band low edge  (rad/m, 0 = none)
 * @param {number} [opts.kHi]    band high edge (rad/m, Infinity = none)
 * @param {number} [opts.bandOctaves] crossfade width at the band edges
 */
export function createOceanField({
  N, L, sea, seed = 1,
  kLo = 0, kHi = Infinity, bandOctaves = 0.75,
}) {
  const spectrum = makeSpectrum(sea);
  const rng      = makeRng(seed);
  const gauss    = makeGaussian(rng);

  const h0re  = new Float32Array(N * N);
  const h0im  = new Float32Array(N * N);
  const omega = new Float32Array(N * N);

  const dk  = (2 * Math.PI) / L;
  const dk2 = dk * dk;          // Δkx·Δkz — the discretisation factor that makes
                                // the amplitudes come out in metres

  const kxs = new Float64Array(N);
  for (let i = 0; i < N; i++) kxs[i] = binToMode(i, N) * dk;

  let variance = 0;

  for (let row = 0; row < N; row++) {
    const kz = kxs[row];
    for (let col = 0; col < N; col++) {
      const kx  = kxs[col];
      const idx = row * N + col;

      const k = Math.hypot(kx, kz);
      if (k === 0) { h0re[idx] = 0; h0im[idx] = 0; omega[idx] = 0; continue; }

      const w = bandWindow(k, kLo, kHi, bandOctaves);
      // Two Gaussians are drawn regardless of the window so that the random
      // stream stays aligned — changing a band edge must not reshuffle the sea.
      const xr = gauss();
      const xi = gauss();

      omega[idx] = dispersion(k, sea.depth, sea.deepWater);

      if (w <= 0) { h0re[idx] = 0; h0im[idx] = 0; continue; }

      const psi = spectrum(kx, kz);
      if (!(psi > 0)) { h0re[idx] = 0; h0im[idx] = 0; continue; }

      // The ½ (not the 1/√2 of Tessendorf's paper) is deliberate. His
      // h̃ = h̃₀(k)e^{iωt} + conj(h̃₀(−k))e^{−iωt} sums two independent draws per
      // mode, so E[h²] comes out at 2·∫Ψ d²k — twice the variance the spectrum
      // asked for. Halving the amplitude restores it, which is what makes
      // `specRms` below an actual wave height in metres rather than a knob.
      const amp = w * 0.5 * Math.sqrt(psi * dk2);
      h0re[idx] = xr * amp;
      h0im[idx] = xi * amp;
      variance += 4 * amp * amp;   // E[|h̃|²] = 2amp(k)² + 2amp(−k)², summed
    }
  }

  return {
    N, L, seed, sea, kLo, kHi,
    h0re, h0im, omega, kxs,
    /** Predicted RMS wave height in metres, straight from the spectrum.
     *  bake.js measures the realised value from the samples — the two agreeing
     *  is the cheapest end-to-end check that the scaling chain is intact. */
    specRms: Math.sqrt(variance),
    plan: makePlan(N),
  };
}

/**
 * Evaluate the field at time t.
 * Returns eight Float32Arrays of length N².
 *
 * FA does not animate the texture — it scrolls UVs — so t is not an animation
 * parameter here. It is a free knob for re-rolling the wave arrangement at a
 * fixed spectrum, which is cheaper and more controllable than changing the seed.
 */
export function evaluateOcean(field, t = 0) {
  const { N, h0re, h0im, omega, kxs, plan } = field;
  const n2 = N * N;

  const out = {
    h:   new Float32Array(n2), Dx:  new Float32Array(n2),
    Dz:  new Float32Array(n2), hx:  new Float32Array(n2),
    hz:  new Float32Array(n2), Dxx: new Float32Array(n2),
    Dxz: new Float32Array(n2), Dzz: new Float32Array(n2),
  };

  // Reused across all four passes.
  const re = new Float64Array(n2);
  const im = new Float64Array(n2);

  // h̃(k,t) — computed once and reused by all four passes. Float32 is enough
  // here: these are transform *inputs*, and the accumulation that actually needs
  // the precision happens in the float64 re/im buffers above. At a 4096² grid
  // this is the difference between 268 and 134 MB.
  const hr = new Float32Array(n2);
  const hi = new Float32Array(n2);

  for (let row = 0; row < N; row++) {
    const mRow = (N - row) % N;           // index of −kz
    for (let col = 0; col < N; col++) {
      const idx  = row * N + col;
      const midx = mRow * N + ((N - col) % N);   // index of −k⃗

      const w = omega[idx] * t;
      const c = Math.cos(w);
      const s = Math.sin(w);

      const a = h0re[idx],  b = h0im[idx];       // h̃₀(k)
      const p = h0re[midx], q = -h0im[midx];     // conj(h̃₀(−k))

      // h̃ = h̃₀(k)·e^{iωt} + conj(h̃₀(−k))·e^{−iωt}
      // This form is what makes h̃ Hermitian for *any* spectrum, including
      // directional ones where Ψ(k) ≠ Ψ(−k) — so h comes out strictly real.
      hr[idx] = a * c - b * s + p * c + q * s;
      hi[idx] = a * s + b * c - p * s + q * c;
    }
  }

  // ── the four packed passes ────────────────────────────────────────────────
  for (let pass = 0; pass < 4; pass++) {
    for (let row = 0; row < N; row++) {
      const kz = kxs[row];
      for (let col = 0; col < N; col++) {
        const idx = row * N + col;
        const kx  = kxs[col];
        const k   = Math.hypot(kx, kz);

        if (k === 0) { re[idx] = 0; im[idx] = 0; continue; }

        const invK = 1 / k;
        const a = kx * invK;    // k̂x
        const b = kz * invK;    // k̂z

        let mr, mi;             // the per-cell complex multiplier
        switch (pass) {
          case 0: mr = 1 + a;               mi = 0;                 break;
          case 1: mr = -kx;                 mi = -b;                break;
          case 2: mr = 0;                   mi = kz + kx * kx * invK; break;
          default: mr = kx * kz * invK;     mi = kz * kz * invK;    break;
        }

        const x = hr[idx], y = hi[idx];
        re[idx] = x * mr - y * mi;
        im[idx] = x * mi + y * mr;
      }
    }

    fft2d(re, im, N, +1, plan);   // unnormalised inverse — see fft.js

    switch (pass) {
      case 0: pack(out.h,   out.Dx,  re, im, n2); break;
      case 1: pack(out.Dz,  out.hx,  re, im, n2); break;
      case 2: pack(out.hz,  out.Dxx, re, im, n2); break;
      default: pack(out.Dxz, out.Dzz, re, im, n2); break;
    }
  }

  return out;
}

function pack(A, B, re, im, n2) {
  for (let i = 0; i < n2; i++) { A[i] = re[i]; B[i] = im[i]; }
}
