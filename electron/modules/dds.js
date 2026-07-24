'use strict';
/**
 * dds.js — DDS writer with mipmaps and a quality BC3/DXT5 encoder.
 *
 * The suite already had a DDS *decoder* (props.js) and a 128-byte
 * A8R8G8B8 header emitter with no mip support (cli.js). Neither is enough for
 * water normal maps:
 *
 *  · Mipmaps are not optional. FA's finest water layer tiles every couple of
 *    ogrids; without a mip chain it aliases into shimmer at any distance.
 *
 *  · Normal maps punish lazy block compression. A min/max-endpoint BC3 encoder
 *    puts visible banding into a surface that is almost entirely smooth
 *    gradients, which is exactly what water is. So the colour endpoints here
 *    come from a PCA of each block followed by least-squares refinement, and
 *    the alpha block tries both BC4 modes and keeps the better one.
 *
 *  · FA reads .xyz and .a with fixed meanings, so the usual normal-map trick of
 *    swizzling X into alpha (DXT5nm) is unavailable — quality has to come from
 *    the encoder rather than from a better channel layout.
 *
 * Measured on a real 512² bake (see the Phase-2 gate in the plan doc):
 *
 *   naive min/max endpoints   RGB PSNR 25.4 dB
 *   PCA + least-squares       RGB PSNR 28.1 dB,  mean normal error 6.5°
 *   A8R8G8B8                  lossless,          4× the bytes
 *
 * Those numbers used to read 28.7 / 31.8 dB and 4.2°. They got worse — because
 * the bake got *better*: fixing the small-wave damping put three more octaves of
 * micro-detail into the texture, and micro-detail inside a 4×4 block is exactly
 * what BC1 cannot represent. The sharper the water, the more DXT5 costs.
 *
 * The extra ±1 lattice search around the quantised endpoints buys only 0.1 dB,
 * which says the remaining error is not endpoint placement but the four-entry
 * palette itself. So **uncompressed is the default here** and DXT5 is the
 * deliberate size trade-off, not the other way round. 512² + mips is 1.4 MB
 * uncompressed — against a 20 MB scmap, that is not a real cost.
 *
 * Electron is required lazily inside register() so this module can be exercised
 * from plain Node.
 *
 * Exports: encodeBC3, buildHeader, encodeDDS, writeDDS, register
 */

const fs = require('fs');

const DDSD_CAPS        = 0x1;
const DDSD_HEIGHT      = 0x2;
const DDSD_WIDTH       = 0x4;
const DDSD_PITCH       = 0x8;
const DDSD_PIXELFORMAT = 0x1000;
const DDSD_MIPMAPCOUNT = 0x20000;
const DDSD_LINEARSIZE  = 0x80000;

const DDPF_ALPHAPIXELS = 0x1;
const DDPF_FOURCC      = 0x4;
const DDPF_RGB         = 0x40;

const DDSCAPS_COMPLEX = 0x8;
const DDSCAPS_TEXTURE = 0x1000;
const DDSCAPS_MIPMAP  = 0x400000;

const FOURCC_DXT5 = 0x35545844; // 'DXT5'

// ═══════════════════════════════════════════════════════════════════════════════
// Header
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {object} o
 * @param {number} o.width
 * @param {number} o.height
 * @param {number} o.mipCount
 * @param {'DXT5'|'RGBA'} o.format
 */
function buildHeader({ width, height, mipCount, format }) {
  const buf = Buffer.alloc(128, 0);
  const compressed = format === 'DXT5';

  buf.writeUInt32LE(0x20534444, 0);   // 'DDS '
  buf.writeUInt32LE(124, 4);          // dwSize

  let flags = DDSD_CAPS | DDSD_HEIGHT | DDSD_WIDTH | DDSD_PIXELFORMAT;
  flags |= compressed ? DDSD_LINEARSIZE : DDSD_PITCH;
  if (mipCount > 1) flags |= DDSD_MIPMAPCOUNT;
  buf.writeUInt32LE(flags, 8);

  buf.writeUInt32LE(height, 12);
  buf.writeUInt32LE(width, 16);
  // Compressed: size of the top level in bytes. Uncompressed: bytes per scanline.
  buf.writeUInt32LE(
    compressed ? Math.max(1, Math.ceil(width / 4)) * Math.max(1, Math.ceil(height / 4)) * 16
               : width * 4,
    20,
  );
  buf.writeUInt32LE(0, 24);           // dwDepth
  buf.writeUInt32LE(mipCount, 28);

  // ── DDS_PIXELFORMAT @76 ──
  buf.writeUInt32LE(32, 76);
  if (compressed) {
    buf.writeUInt32LE(DDPF_FOURCC, 80);
    buf.writeUInt32LE(FOURCC_DXT5, 84);
  } else {
    buf.writeUInt32LE(DDPF_RGB | DDPF_ALPHAPIXELS, 80);
    buf.writeUInt32LE(0, 84);
    buf.writeUInt32LE(32, 88);          // bit count
    buf.writeUInt32LE(0x00FF0000, 92);  // R
    buf.writeUInt32LE(0x0000FF00, 96);  // G
    buf.writeUInt32LE(0x000000FF, 100); // B
    buf.writeUInt32LE(0xFF000000, 104); // A
  }

  let caps = DDSCAPS_TEXTURE;
  if (mipCount > 1) caps |= DDSCAPS_COMPLEX | DDSCAPS_MIPMAP;
  buf.writeUInt32LE(caps, 108);

  return buf;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BC3 / DXT5
// ═══════════════════════════════════════════════════════════════════════════════

/** Weight of endpoint 0 for each BC1 palette index. */
const COLOR_W0 = [1, 0, 2 / 3, 1 / 3];
/** Weight of endpoint 0 for each BC4 index — 8-value mode. */
const ALPHA8_W0 = [1, 0, 6 / 7, 5 / 7, 4 / 7, 3 / 7, 2 / 7, 1 / 7];
/** …and 6-value mode; indices 6 and 7 are the absolute 0 and 255. */
const ALPHA6_W0 = [1, 0, 4 / 5, 3 / 5, 2 / 5, 1 / 5];

const q5 = v => Math.max(0, Math.min(31, Math.round((v * 31) / 255)));
const q6 = v => Math.max(0, Math.min(63, Math.round((v * 63) / 255)));
const dq5 = v => Math.round((v * 255) / 31);
const dq6 = v => Math.round((v * 255) / 63);

const pack565 = (r, g, b) => (q5(r) << 11) | (q6(g) << 5) | q5(b);
const unpack565 = (c) => [dq5((c >> 11) & 31), dq6((c >> 5) & 63), dq5(c & 31)];

/**
 * Principal axis of a 16-point RGB block, by power iteration on the covariance
 * matrix. Bounding-box endpoints (the usual shortcut) are only right when the
 * block's colours happen to align with an RGB axis; on a normal map they almost
 * never do, and the error shows up as banding across smooth slopes.
 */
function principalAxis(px, mean) {
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (let i = 0; i < 16; i++) {
    const r = px[i * 3] - mean[0];
    const g = px[i * 3 + 1] - mean[1];
    const b = px[i * 3 + 2] - mean[2];
    xx += r * r; xy += r * g; xz += r * b;
    yy += g * g; yz += g * b; zz += b * b;
  }

  let vx = xx + xy + xz, vy = xy + yy + yz, vz = xz + yz + zz;
  if (vx === 0 && vy === 0 && vz === 0) return [1, 0, 0];

  for (let it = 0; it < 12; it++) {
    const nx = xx * vx + xy * vy + xz * vz;
    const ny = xy * vx + yy * vy + yz * vz;
    const nz = xz * vx + yz * vy + zz * vz;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 1e-12) return [1, 0, 0];
    vx = nx / len; vy = ny / len; vz = nz / len;
  }
  return [vx, vy, vz];
}

/** Least-squares refit of two endpoints given a fixed index assignment. */
function refitEndpoints(px, idx, weights, e0, e1) {
  let A = 0, B = 0, C = 0;
  const P = [0, 0, 0], Q = [0, 0, 0];

  for (let i = 0; i < 16; i++) {
    const a = weights[idx[i]];
    const b = 1 - a;
    A += a * a; B += a * b; C += b * b;
    for (let c = 0; c < 3; c++) {
      P[c] += a * px[i * 3 + c];
      Q[c] += b * px[i * 3 + c];
    }
  }

  const det = A * C - B * B;
  if (Math.abs(det) < 1e-9) return false;

  for (let c = 0; c < 3; c++) {
    e0[c] = Math.max(0, Math.min(255, (C * P[c] - B * Q[c]) / det));
    e1[c] = Math.max(0, Math.min(255, (A * Q[c] - B * P[c]) / det));
  }
  return true;
}

function assignColorIndices(px, pal, idx) {
  let err = 0;
  for (let i = 0; i < 16; i++) {
    let best = 0, bestD = Infinity;
    for (let p = 0; p < 4; p++) {
      const dr = px[i * 3] - pal[p * 3];
      const dg = px[i * 3 + 1] - pal[p * 3 + 1];
      const db = px[i * 3 + 2] - pal[p * 3 + 2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = p; }
    }
    idx[i] = best;
    err += bestD;
  }
  return err;
}

function buildColorPalette(c0, c1, pal) {
  const [r0, g0, b0] = unpack565(c0);
  const [r1, g1, b1] = unpack565(c1);
  pal[0] = r0; pal[1] = g0; pal[2] = b0;
  pal[3] = r1; pal[4] = g1; pal[5] = b1;
  // BC2/BC3 colour blocks are always four-colour, regardless of endpoint order.
  pal[6] = (2 * r0 + r1) / 3; pal[7] = (2 * g0 + g1) / 3; pal[8] = (2 * b0 + b1) / 3;
  pal[9] = (r0 + 2 * r1) / 3; pal[10] = (g0 + 2 * g1) / 3; pal[11] = (b0 + 2 * b1) / 3;
}

// Scratch reused across blocks — the encoder is single-threaded and this is on
// the hot path (a 1024² chain is ~87k blocks × ~40 palette evaluations each).
const _pal = new Float64Array(12);
const _idx = new Uint8Array(16);
const _try = new Uint8Array(16);

/** Error of a candidate endpoint pair, writing the winning indices into `_try`. */
function evalEndpoints(px, c0, c1) {
  buildColorPalette(c0, c1, _pal);
  return assignColorIndices(px, _pal, _try);
}

const clamp5 = v => (v < 0 ? 0 : v > 31 ? 31 : v);
const clamp6 = v => (v < 0 ? 0 : v > 63 ? 63 : v);

/** Replace one 565 component of a packed colour. */
function withComponent(c, comp, value) {
  if (comp === 0) return (c & 0x07ff) | (clamp5(value) << 11);
  if (comp === 1) return (c & 0xf81f) | (clamp6(value) << 5);
  return (c & 0xffe0) | clamp5(value);
}

function getComponent(c, comp) {
  if (comp === 0) return (c >> 11) & 31;
  if (comp === 1) return (c >> 5) & 63;
  return c & 31;
}

function encodeColorBlock(px, out, off) {
  const mean = [0, 0, 0];
  for (let i = 0; i < 16; i++) {
    mean[0] += px[i * 3]; mean[1] += px[i * 3 + 1]; mean[2] += px[i * 3 + 2];
  }
  mean[0] /= 16; mean[1] /= 16; mean[2] /= 16;

  const ax = principalAxis(px, mean);
  let tMin = Infinity, tMax = -Infinity;
  for (let i = 0; i < 16; i++) {
    const t = (px[i * 3] - mean[0]) * ax[0]
            + (px[i * 3 + 1] - mean[1]) * ax[1]
            + (px[i * 3 + 2] - mean[2]) * ax[2];
    if (t < tMin) tMin = t;
    if (t > tMax) tMax = t;
  }

  const e0 = [0, 0, 0], e1 = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    e0[c] = Math.max(0, Math.min(255, mean[c] + ax[c] * tMax));
    e1[c] = Math.max(0, Math.min(255, mean[c] + ax[c] * tMin));
  }

  let c0 = pack565(e0[0], e0[1], e0[2]);
  let c1 = pack565(e1[0], e1[1], e1[2]);

  const idx = _idx;
  let err = evalEndpoints(px, c0, c1);
  idx.set(_try);

  // Two refinement rounds: quantising the PCA endpoints moves them off the
  // optimum, and refitting against the actual index assignment moves them back.
  for (let round = 0; round < 2; round++) {
    if (!refitEndpoints(px, idx, COLOR_W0, e0, e1)) break;
    const n0 = pack565(e0[0], e0[1], e0[2]);
    const n1 = pack565(e1[0], e1[1], e1[2]);
    const nErr = evalEndpoints(px, n0, n1);
    if (nErr >= err) break;
    c0 = n0; c1 = n1; err = nErr; idx.set(_try);
  }

  // Greedy lattice search around the quantised endpoints.
  //
  // The refit above optimises in continuous colour space, but the endpoints are
  // then rounded to 5:6:5 — a step of 8 units in red and blue. On water normals
  // that rounding is the dominant error source, because the whole block sits in
  // a narrow band around "pointing up" and an 8-unit endpoint shift rotates the
  // decoded normal by degrees. Nudging each of the six components by ±1 and
  // keeping what helps recovers most of it.
  for (let pass = 0; pass < 2; pass++) {
    let improved = false;
    for (let e = 0; e < 2; e++) {
      for (let comp = 0; comp < 3; comp++) {
        const cur = e === 0 ? c0 : c1;
        const base = getComponent(cur, comp);
        for (const delta of [-1, 1]) {
          const cand = withComponent(cur, comp, base + delta);
          if (cand === cur) continue;
          const nErr = e === 0 ? evalEndpoints(px, cand, c1) : evalEndpoints(px, c0, cand);
          if (nErr < err) {
            err = nErr;
            if (e === 0) c0 = cand; else c1 = cand;
            idx.set(_try);
            improved = true;
          }
        }
      }
    }
    if (!improved) break;
  }

  // The winning indices may be stale if the last evaluation lost; recompute once.
  err = evalEndpoints(px, c0, c1);
  idx.set(_try);

  // The suite's own decoder (props.js) interprets a DXT5 colour block through
  // its DXT1 path, which switches on c0 > c1. Emitting the four-colour ordering
  // keeps that decoder — and any other that shares the shortcut — correct.
  if (c0 < c1) {
    const t = c0; c0 = c1; c1 = t;
    for (let i = 0; i < 16; i++) {
      const v = idx[i];
      idx[i] = v === 0 ? 1 : v === 1 ? 0 : v === 2 ? 3 : 2;
    }
  } else if (c0 === c1) {
    // A flat block: any index resolves to the same colour, so drop c1 one step
    // to restore the ordering without changing what gets decoded.
    if (c1 > 0) c1 -= 1; else { c0 = 1; }
    for (let i = 0; i < 16; i++) idx[i] = 0;
  }

  out.writeUInt16LE(c0, off);
  out.writeUInt16LE(c1, off + 2);
  let bits = 0;
  for (let i = 0; i < 16; i++) bits |= idx[i] << (2 * i);
  out.writeUInt32LE(bits >>> 0, off + 4);
}

function alphaError(vals, pal, idx) {
  let err = 0;
  for (let i = 0; i < 16; i++) {
    let best = 0, bestD = Infinity;
    for (let p = 0; p < pal.length; p++) {
      const d = (vals[i] - pal[p]) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    idx[i] = best;
    err += bestD;
  }
  return err;
}

function encodeAlphaBlock(vals, out, off) {
  let lo = 255, hi = 0;
  for (let i = 0; i < 16; i++) {
    if (vals[i] < lo) lo = vals[i];
    if (vals[i] > hi) hi = vals[i];
  }

  // ── mode 8: a0 > a1, six interpolated steps ──
  let a0 = hi, a1 = lo;
  const pal8 = new Float64Array(8);
  const idx8 = new Uint8Array(16);
  const build8 = (x, y) => {
    pal8[0] = x; pal8[1] = y;
    for (let i = 2; i < 8; i++) pal8[i] = ((8 - i) * x + (i - 1) * y) / 7;
  };
  build8(a0, a1);
  let err8 = alphaError(vals, pal8, idx8);

  for (let round = 0; round < 2; round++) {
    let A = 0, B = 0, C = 0, P = 0, Q = 0;
    for (let i = 0; i < 16; i++) {
      const a = ALPHA8_W0[idx8[i]];
      const b = 1 - a;
      A += a * a; B += a * b; C += b * b;
      P += a * vals[i]; Q += b * vals[i];
    }
    const det = A * C - B * B;
    if (Math.abs(det) < 1e-9) break;
    const n0 = Math.max(0, Math.min(255, Math.round((C * P - B * Q) / det)));
    const n1 = Math.max(0, Math.min(255, Math.round((A * Q - B * P) / det)));
    if (n0 <= n1) break;
    build8(n0, n1);
    const nIdx = new Uint8Array(16);
    const nErr = alphaError(vals, pal8, nIdx);
    if (nErr >= err8) { build8(a0, a1); break; }
    a0 = n0; a1 = n1; err8 = nErr; idx8.set(nIdx);
  }

  // ── mode 6: a0 < a1, four interpolated steps plus hard 0 and 255 ──
  // Worth trying because a foam mask spends most of its area pinned at 0 and
  // occasionally at 1 — spending two palette slots on the extremes leaves more
  // resolution for the ramp in between.
  let b0 = 255, b1 = 0;
  for (let i = 0; i < 16; i++) {
    const v = vals[i];
    if (v === 0 || v === 255) continue;
    if (v < b0) b0 = v;
    if (v > b1) b1 = v;
  }
  let err6 = Infinity;
  const idx6 = new Uint8Array(16);
  if (b0 < b1) {
    const pal6 = new Float64Array(8);
    pal6[0] = b0; pal6[1] = b1;
    for (let i = 2; i < 6; i++) pal6[i] = ((6 - i) * b0 + (i - 1) * b1) / 5;
    pal6[6] = 0; pal6[7] = 255;
    err6 = alphaError(vals, pal6, idx6);
  }

  const use6 = err6 < err8;
  const e0 = use6 ? b0 : a0;
  const e1 = use6 ? b1 : a1;
  const idx = use6 ? idx6 : idx8;

  out[off] = e0;
  out[off + 1] = e1;

  // 16 × 3 bits, LSB first, across six bytes.
  let bits = 0n;
  for (let i = 0; i < 16; i++) bits |= BigInt(idx[i] & 7) << BigInt(i * 3);
  for (let i = 0; i < 6; i++) out[off + 2 + i] = Number((bits >> BigInt(i * 8)) & 0xffn);
}

/**
 * Compress an RGBA8 image to BC3.
 * @param {Uint8Array|Buffer} rgba  width*height*4
 */
function encodeBC3(rgba, width, height) {
  const bw = Math.max(1, Math.ceil(width / 4));
  const bh = Math.max(1, Math.ceil(height / 4));
  const out = Buffer.alloc(bw * bh * 16);

  const px = new Float64Array(48);
  const av = new Uint8Array(16);

  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          // Clamp rather than wrap at the edge: only reached for
          // non-power-of-two sizes, where the padding texels are never sampled.
          const sx = Math.min(width - 1, bx * 4 + x);
          const sy = Math.min(height - 1, by * 4 + y);
          const s = (sy * width + sx) * 4;
          const d = (y * 4 + x);
          px[d * 3] = rgba[s];
          px[d * 3 + 1] = rgba[s + 1];
          px[d * 3 + 2] = rgba[s + 2];
          av[d] = rgba[s + 3];
        }
      }
      const off = (by * bw + bx) * 16;
      encodeAlphaBlock(av, out, off);
      encodeColorBlock(px, out, off + 8);
    }
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Assembly
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {Array<{width:number,height:number,data:Uint8Array}>} levels  RGBA8, level 0 first
 * @param {'DXT5'|'RGBA'} format
 */
function encodeDDS(levels, format = 'RGBA') {
  if (!levels?.length) throw new Error('encodeDDS: no mip levels supplied');

  const parts = [buildHeader({
    width: levels[0].width,
    height: levels[0].height,
    mipCount: levels.length,
    format,
  })];

  for (const lvl of levels) {
    const src = Buffer.isBuffer(lvl.data) ? lvl.data : Buffer.from(lvl.data.buffer ?? lvl.data,
      lvl.data.byteOffset ?? 0, lvl.data.byteLength ?? lvl.data.length);

    if (format === 'DXT5') {
      parts.push(encodeBC3(src, lvl.width, lvl.height));
    } else {
      // A8R8G8B8 is stored BGRA on disk.
      const n = lvl.width * lvl.height;
      const buf = Buffer.alloc(n * 4);
      for (let i = 0; i < n; i++) {
        buf[i * 4]     = src[i * 4 + 2];
        buf[i * 4 + 1] = src[i * 4 + 1];
        buf[i * 4 + 2] = src[i * 4];
        buf[i * 4 + 3] = src[i * 4 + 3];
      }
      parts.push(buf);
    }
  }

  return Buffer.concat(parts);
}

function writeDDS(filePath, levels, format = 'RGBA') {
  const buf = encodeDDS(levels, format);
  fs.writeFileSync(filePath, buf);
  return { bytes: buf.length, mipCount: levels.length, format };
}

// ═══════════════════════════════════════════════════════════════════════════════
// IPC
// ═══════════════════════════════════════════════════════════════════════════════

function register() {
  const path = require('path');
  const { ipcMain } = require('electron');
  const { log } = require('./logger');
  const { withPathGuard: guardBase } = require('./security');
  const { readSettings } = require('./settings');

  const guard = (extract, handler) => guardBase(extract, handler, readSettings, log);

  ipcMain.handle('write-dds', guard(
    // The extractor must return an array — withPathGuard calls .filter() on it.
    ({ filePath }) => [filePath],
    async (event, { filePath, levels, format = 'RGBA' }) => {
      try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const info = writeDDS(filePath, levels, format);
        log.info(`[dds] wrote ${filePath} — ${info.mipCount} mips, ${info.format}, ${info.bytes} bytes`);
        return { success: true, ...info, path: filePath };
      } catch (e) {
        log.error('write-dds failed:', e);
        return { success: false, error: e.message };
      }
    },
  ));
}

module.exports = { buildHeader, encodeBC3, encodeDDS, writeDDS, register };
