/**
 * bake.js — turn an ocean field into an FA-ready RGBA normal map.
 *
 * Three things happen here that a naive height-to-normal pass does not do, and
 * all three are visible in the result.
 *
 * ── 1. The normal comes from the displacement Jacobian ──────────────────────
 * With choppy displacement the surface is
 *     P(x,z) = ( x + λ·Dx , h , z + λ·Dz )
 * so the tangents are
 *     ∂P/∂x = ( 1 + λ·Dxx , hx , λ·Dxz )
 *     ∂P/∂z = ( λ·Dxz     , hz , 1 + λ·Dzz )
 * and the normal is their cross product, not (−hx, 1, −hz). Skipping this
 * throws away exactly the crest sharpening that choppiness was added for.
 *
 * ── 2. Foam is det(J), and det(J) is free ───────────────────────────────────
 * The y component of that cross product *is* the Jacobian determinant. Where it
 * approaches zero the surface folds through itself — a breaking wave. So the
 * alpha channel falls out of the same expression that produced the normal, and
 * the foam sits on the crests because the mathematics puts it there.
 *
 * ── 3. Lagrangian → Eulerian scatter ────────────────────────────────────────
 * That normal is valid at the *displaced* position P(x), but a texture needs
 * texel (i,j) to hold the normal at grid position (x_i, z_j). Each sample is
 * therefore bilinearly splatted to where it actually ended up. Skipping this
 * step silently undoes the sharpening again — the crests smear back out.
 *
 * The Lagrangian grid is supersampled (N = S·M) so the splat doubles as a tent
 * reconstruction filter: antialiasing for free, and no holes to fill.
 */

import { evaluateOcean } from './ocean.js';

export const DEFAULT_BAKE = {
  lambda:       1.1,    // choppiness — horizontal displacement scale
  supersample:  2,      // Lagrangian grid = supersample × output
  // Artistic normal strength, applied after filtering. This is the contrast
  // lever, not a resolution one: FA's stock waves2 textures encode slopes far
  // steeper than real 15° wind chop, which is what gives them their crisp
  // relief. 1.0 (rms slope ~0.28, ×2 sum compensation) is the calm default;
  // push toward ~2.5 for the high-contrast engine look. Left at 1.0 because the
  // default is meant to read as gentle water, and steepness is a taste call.
  slopeGain:    1.0,
  foamMode:     'coverage', // 'coverage' = hit a target area | 'physical' = fixed det(J)
  foamCoverage: 0.30,   // coverage mode: fraction of the surface flagged as foam
  foamJacobian: 0.70,   // physical mode: det(J) below which foam starts
  foamSharp:    0.3,    // 0…1 — how fast the mask saturates below the threshold
  foamGain:     1.0,    // final multiplier on the mask
  foamBlur:     1,      // box-blur radius in texels (DXT5 alpha likes this ≥ 1)
};

const J_HIST_BINS = 4096;

/**
 * @param {object} field   from createOceanField()
 * @param {object} opts    { ...DEFAULT_BAKE, M, t }
 * @returns {{ rgba: Uint8Array, width: number, stats: object }}
 */
export function bakeNormalMap(field, opts = {}) {
  const o = { ...DEFAULT_BAKE, ...opts };
  const M = o.M;
  const N = field.N;
  const L = field.L;

  if (N % M !== 0) {
    throw new Error(`bake: sim grid ${N} must be a whole multiple of output ${M}`);
  }

  const f = evaluateOcean(field, o.t ?? 0);
  const lambda = o.lambda;
  const n2 = N * N;

  // ── pass A — det(J) per sample, then its distribution ─────────────────────
  // The foam threshold is solved from the actual distribution rather than
  // dialled in as a raw det(J) value: "30% of the surface is foam" is a number
  // a user can reason about, "det(J) < 0.62" is not.
  //
  // The histogram is built over the *measured* [jMin, jMax] rather than a fixed
  // range. A fixed range was the earlier design and it was wrong: on a slot
  // whose band carries no energy, det(J) ≡ 1 and the whole distribution
  // collapsed into one or two bins of a coarse global grid — the quantile then
  // straddled a bin boundary and flagged the entire tile as foam.
  const jacobian = new Float32Array(n2);
  let hSum = 0, hSqSum = 0, slopeSqSum = 0;
  let jMin = Infinity, jMax = -Infinity;

  for (let i = 0; i < n2; i++) {
    const jxx = 1 + lambda * f.Dxx[i];
    const jzz = 1 + lambda * f.Dzz[i];
    const jxz = lambda * f.Dxz[i];
    const J = jxx * jzz - jxz * jxz;

    jacobian[i] = J;
    if (J < jMin) jMin = J;
    if (J > jMax) jMax = J;

    const hv = f.h[i];
    hSum += hv;
    hSqSum += hv * hv;
    slopeSqSum += f.hx[i] * f.hx[i] + f.hz[i] * f.hz[i];
  }

  const jSpread = jMax - jMin;
  // Nothing folds → nothing breaks → no foam. True for λ = 0 and for any band
  // the configured sea state leaves empty.
  const foamActive = jSpread > 1e-6;

  const hist = new Uint32Array(J_HIST_BINS);
  const binScale = foamActive ? J_HIST_BINS / jSpread : 0;
  if (foamActive) {
    for (let i = 0; i < n2; i++) {
      let b = ((jacobian[i] - jMin) * binScale) | 0;
      if (b >= J_HIST_BINS) b = J_HIST_BINS - 1;
      hist[b]++;
    }
  }

  let thrHigh, foamSpan;
  if (!foamActive) {
    thrHigh = -Infinity;
    foamSpan = 1;
  } else if (o.foamMode === 'physical') {
    // Honest mode: a fixed det(J) threshold. How much foam that yields is
    // whatever the sea state produces — which is the point.
    thrHigh = o.foamJacobian;
    foamSpan = Math.max(jSpread * 0.01, o.foamJacobian * Math.max(0.02, o.foamSharp));
  } else {
    thrHigh = quantile(hist, n2, o.foamCoverage, jMin, binScale);
    const thrLow = quantile(hist, n2, o.foamCoverage * Math.max(0.02, o.foamSharp), jMin, binScale);
    // Floor the span at 1% of the real spread so an unresolvable quantile
    // degrades into a soft ramp, never into a binary step.
    foamSpan = Math.max(jSpread * 0.01, thrHigh - thrLow);
  }

  // ── pass B — normals + foam, scattered into the Eulerian grid ─────────────
  const m2 = M * M;
  const accX = new Float32Array(m2);
  const accY = new Float32Array(m2);
  const accZ = new Float32Array(m2);
  const accF = new Float32Array(m2);
  const accW = new Float32Array(m2);

  const cell = L / N;          // Lagrangian spacing, metres
  const toTexel = M / L;       // metres → output texel

  for (let row = 0; row < N; row++) {
    const z0 = row * cell;
    for (let col = 0; col < N; col++) {
      const i = row * N + col;

      const jxx = 1 + lambda * f.Dxx[i];
      const jzz = 1 + lambda * f.Dzz[i];
      const jxz = lambda * f.Dxz[i];
      const hx = f.hx[i], hz = f.hz[i];

      // n = ∂P/∂z × ∂P/∂x — and its y component is det(J), already computed
      const nx = hz * jxz - jzz * hx;
      const ny = jacobian[i];
      const nz = jxz * hx - hz * jxx;

      // A folded crest has ny ≤ 0, which would flip the normal upside down.
      // Clamp it up and record the fold in the foam channel instead — that is
      // what the alpha is for.
      const nyc = ny < 1e-3 ? 1e-3 : ny;
      const inv = 1 / Math.sqrt(nx * nx + nyc * nyc + nz * nz);

      // Foam is breaking, and breaking is compression: the Jacobian only drops
      // below 1 where the surface folds onto itself. Where det(J) ≥ 1 the water
      // is flat or stretching and cannot break, so it gets no foam no matter how
      // the threshold is set. Without this gate the 'physical' mode floods the
      // whole tile white as soon as foamJacobian is pushed up toward 1 — det(J)
      // hovers around 1 on calm water, so `thrHigh − ny` goes positive
      // everywhere. `foamActive` already excludes the truly non-folding layers.
      const FOAM_CEILING = 0.98;
      const foam = ny >= FOAM_CEILING
        ? 0
        : clamp01((Math.min(thrHigh, FOAM_CEILING) - ny) / foamSpan);

      // displaced position, wrapped into the tile
      const X = col * cell + lambda * f.Dx[i];
      const Z = z0 + lambda * f.Dz[i];

      splat(accX, accY, accZ, accF, accW, M,
            X * toTexel, Z * toTexel,
            nx * inv, nyc * inv, nz * inv, foam);
    }
  }

  // ── resolve, fill, gain, encode ───────────────────────────────────────────
  const holes = resolve(accX, accY, accZ, accF, accW, M);
  if (holes) fillHoles(accX, accY, accZ, accF, accW, M);
  if (o.foamBlur > 0) boxBlur(accF, M, o.foamBlur);

  const rgba = new Uint8Array(m2 * 4);
  const gain = o.slopeGain;
  let slopeAcc = 0, foamAcc = 0;

  for (let i = 0; i < m2; i++) {
    let x = accX[i], y = accY[i], z = accZ[i];
    const yc = y < 1e-3 ? 1e-3 : y;

    // Gain acts on the slope, not on the normal vector: a normal scaled
    // component-wise is not a normal of anything.
    const sx = (x / yc) * gain;
    const sz = (z / yc) * gain;
    const inv = 1 / Math.sqrt(sx * sx + 1 + sz * sz);
    x = sx * inv; y = inv; z = sz * inv;

    slopeAcc += sx * sx + sz * sz;

    const foam = clamp01(accF[i] * o.foamGain);
    foamAcc += foam;

    const p = i * 4;
    rgba[p]     = enc(x);   // R → world X   (see water2.fx: N.xzy)
    rgba[p + 1] = enc(z);   // G → world Z
    rgba[p + 2] = enc(y);   // B → world Y (up)
    rgba[p + 3] = (foam * 255 + 0.5) | 0;
  }

  const mean = hSum / n2;
  return {
    rgba,
    width: M,
    stats: {
      /** Realised RMS wave height, metres. Should track field.specRms. */
      rmsHeight:   Math.sqrt(Math.max(0, hSqSum / n2 - mean * mean)),
      specRms:     field.specRms,
      /** RMS of the encoded slope — what the shader will actually see. */
      rmsSlope:    Math.sqrt(slopeAcc / m2),
      /** RMS of the raw (gain-free) height gradient. */
      rmsGradient: Math.sqrt(slopeSqSum / n2),
      /** Mean alpha — four slots must sum past waveCrestThreshold (default 1). */
      foamMean:    foamAcc / m2,
      minJacobian: jMin,
      jacobianSpread: jSpread,
      foamThreshold: foamActive ? thrHigh : null,
      holesFilled: holes,
    },
  };
}

// ─── Mipmaps ──────────────────────────────────────────────────────────────────

/**
 * Full mip chain down to 1×1.
 *
 * Normals are averaged as vectors and renormalised — averaging the *encoded*
 * bytes would drift the result off the unit sphere and darken the map at every
 * level. Alpha is a plain box average.
 *
 * Without mips, the finest slot (2-ogrid tiles at repeatRate 0.5) shimmers
 * itself to death at any distance; this is not optional.
 */
export function buildMipChain(rgba, size) {
  const levels = [{ width: size, height: size, data: rgba }];
  let src = rgba, w = size;

  while (w > 1) {
    const hw = w >> 1;
    const dst = new Uint8Array(hw * hw * 4);

    for (let y = 0; y < hw; y++) {
      for (let x = 0; x < hw; x++) {
        let nx = 0, ny = 0, nz = 0, a = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const p = (((y * 2 + dy) * w) + (x * 2 + dx)) * 4;
            nx += dec(src[p]);
            nz += dec(src[p + 1]);
            ny += dec(src[p + 2]);
            a  += src[p + 3];
          }
        }
        const inv = 1 / Math.max(1e-8, Math.sqrt(nx * nx + ny * ny + nz * nz));
        const q = ((y * hw) + x) * 4;
        dst[q]     = enc(nx * inv);
        dst[q + 1] = enc(nz * inv);
        dst[q + 2] = enc(ny * inv);
        dst[q + 3] = (a / 4 + 0.5) | 0;
      }
    }

    levels.push({ width: hw, height: hw, data: dst });
    src = dst;
    w = hw;
  }

  return levels;
}

// ─── Internals ────────────────────────────────────────────────────────────────

function enc(v) {
  let b = (v * 0.5 + 0.5) * 255 + 0.5;
  if (b < 0) b = 0; else if (b > 255) b = 255;
  return b | 0;
}

function dec(b) { return (b / 255) * 2 - 1; }

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

/** Value of J below which `frac` of the samples fall. */
function quantile(hist, total, frac, jMin, binScale) {
  const target = total * clamp01(frac);
  let acc = 0;
  for (let b = 0; b < hist.length; b++) {
    acc += hist[b];
    if (acc >= target) return jMin + (b + 0.5) / binScale;
  }
  return jMin + hist.length / binScale;
}

function splat(aX, aY, aZ, aF, aW, M, u, v, nx, ny, nz, foam) {
  let i0 = Math.floor(u);
  let j0 = Math.floor(v);
  const fu = u - i0;
  const fv = v - j0;
  i0 = ((i0 % M) + M) % M;
  j0 = ((j0 % M) + M) % M;
  const i1 = i0 + 1 === M ? 0 : i0 + 1;
  const j1 = j0 + 1 === M ? 0 : j0 + 1;

  const w00 = (1 - fu) * (1 - fv);
  const w10 = fu * (1 - fv);
  const w01 = (1 - fu) * fv;
  const w11 = fu * fv;

  add(aX, aY, aZ, aF, aW, j0 * M + i0, w00, nx, ny, nz, foam);
  add(aX, aY, aZ, aF, aW, j0 * M + i1, w10, nx, ny, nz, foam);
  add(aX, aY, aZ, aF, aW, j1 * M + i0, w01, nx, ny, nz, foam);
  add(aX, aY, aZ, aF, aW, j1 * M + i1, w11, nx, ny, nz, foam);
}

function add(aX, aY, aZ, aF, aW, idx, w, nx, ny, nz, foam) {
  aX[idx] += nx * w;
  aY[idx] += ny * w;
  aZ[idx] += nz * w;
  aF[idx] += foam * w;
  aW[idx] += w;
}

/** Divide by accumulated weight and renormalise. Returns the hole count. */
function resolve(aX, aY, aZ, aF, aW, M) {
  let holes = 0;
  for (let i = 0; i < M * M; i++) {
    const w = aW[i];
    if (w < 1e-6) { holes++; continue; }
    const iw = 1 / w;
    const x = aX[i] * iw, y = aY[i] * iw, z = aZ[i] * iw;
    const inv = 1 / Math.max(1e-8, Math.sqrt(x * x + y * y + z * z));
    aX[i] = x * inv; aY[i] = y * inv; aZ[i] = z * inv;
    aF[i] = aF[i] * iw;
  }
  return holes;
}

/**
 * Wrapped 8-neighbour dilation for texels no sample landed on. Only possible
 * where the displacement field stretches hard (large λ, steep sea); at the
 * default supersample of 2 it typically fills nothing at all.
 */
function fillHoles(aX, aY, aZ, aF, aW, M) {
  for (let iter = 0; iter < 8; iter++) {
    let remaining = 0;
    const snapshot = aW.slice();

    for (let y = 0; y < M; y++) {
      for (let x = 0; x < M; x++) {
        const i = y * M + x;
        if (snapshot[i] >= 1e-6) continue;

        let sx = 0, sy = 0, sz = 0, sf = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nxi = (x + dx + M) % M;
            const nyi = (y + dy + M) % M;
            const j = nyi * M + nxi;
            if (snapshot[j] < 1e-6) continue;
            sx += aX[j]; sy += aY[j]; sz += aZ[j]; sf += aF[j]; n++;
          }
        }

        if (n === 0) { remaining++; continue; }
        const inv = 1 / Math.max(1e-8, Math.sqrt(sx * sx + sy * sy + sz * sz));
        aX[i] = sx * inv; aY[i] = sy * inv; aZ[i] = sz * inv;
        aF[i] = sf / n;
        aW[i] = 1;
      }
    }

    if (remaining === 0) return;
  }
}

/** Separable wrapped box blur — used on the foam mask only. */
function boxBlur(buf, M, radius) {
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(M * M);
  const norm = 1 / (2 * r + 1);

  for (let y = 0; y < M; y++) {
    for (let x = 0; x < M; x++) {
      let s = 0;
      for (let d = -r; d <= r; d++) s += buf[y * M + ((x + d + M * 4) % M)];
      tmp[y * M + x] = s * norm;
    }
  }
  for (let x = 0; x < M; x++) {
    for (let y = 0; y < M; y++) {
      let s = 0;
      for (let d = -r; d <= r; d++) s += tmp[((y + d + M * 4) % M) * M + x];
      buf[y * M + x] = s * norm;
    }
  }
}
