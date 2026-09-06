'use strict';
/**
 * map-rotator.js — Rotate a whole map about its centre.
 *
 * The sibling of map-resizer.js: same unpack → patch → pack cycle, same
 * headless-first shape, but it turns the map instead of scaling it. Every
 * layer that carries a position or a heading is rotated about the map centre
 * so the map stays internally consistent.
 *
 * Covers: mrot-rotate-scmap, mrot-rotate-save-lua
 *         (map lookup and versioning reuse the mr-* channels)
 *
 * Exports (headless-nutzbar):
 *   rotateScmap({ unpackFolder, size, angle, ... })
 *   rotateSaveLua({ mapFolder, size, angle, ... })
 *
 *   register() — registriert alle IPC-Handler (nur im Electron-Kontext)
 *
 * ─── Conventions ──────────────────────────────────────────────────────────
 *
 * World space: +x east, +y up, +z south. Viewed top-down (the minimap), +x
 * runs right and +z runs down, so a **positive angle is clockwise on the
 * minimap**. The rotation of a point about the map centre c is
 *
 *     x' = cx + dx·cosθ − dz·sinθ
 *     z' = cz + dx·sinθ + dz·cosθ
 *
 * Rasters are rotated by sampling the *inverse* rotation from the destination
 * pixel, which makes the raster and the object positions agree by
 * construction — an object standing on a hill still stands on that hill.
 *
 * Headings: this repo writes prop matrices as rotationX = (cos h, 0, −sin h),
 * rotationZ = (sin h, 0, cos h) — see Tabs/Scenery/Trees and RockErosion. That
 * makes h a counter-clockwise angle, so a clockwise map rotation θ gives
 * h' = h − θ. The same sign applies to decal/marker/unit euler-Y and to
 * waveGenerator.rotation.
 *
 * Prop matrices are rotated as three vectors rather than via a heading, which
 * is correct whether the stored triple is the matrix' rows or its columns:
 * for columns the new matrix is R·M (each column rotated by R), and for rows
 * it is M·Rᵀ, whose i-th row is R·rowᵢ. Both reduce to "rotate each vec3".
 */

const path = require('path');
const fs   = require('fs');
const { log } = require('./logger');
const { readSettings } = require('./settings');
const scmapUtils = require('../../utils/scmap');

// Electron-Deps nur laden wenn verfügbar
let _ipcMain = null;
try {
  _ipcMain = require('electron').ipcMain;
} catch (_) {}

const { withPathGuard: _withPathGuardBase } = require('./security');
function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

// Coordinates and angles are written at five decimal places, matching
// map-resizer.js and the rest of the toolkit. Anything smaller than this is
// below the resolution of the files we produce.
const ANGLE_EPS = 1e-5;

// ═══════════════════════════════════════════════════════════════════════════
// GEOMETRIE
// ═══════════════════════════════════════════════════════════════════════════

// Normalises any angle to [0, 360).
function normalizeAngle(deg) {
  const a = Number(deg) % 360;
  return a < 0 ? a + 360 : a;
}

// Quarter turns (0–3) for an exact multiple of 90°, otherwise null.
function quarterTurns(deg) {
  const a = normalizeAngle(deg);
  return a % 90 === 0 ? (a / 90) % 4 : null;
}

/**
 * Rotation about the centre of a `size × size` map.
 *   point(x, z)   world position → rotated world position
 *   vector(x, z)  direction / basis vector → rotated direction
 *   heading(h)    counter-clockwise heading in radians → rotated heading
 */
function makeRotator(angleDeg, size) {
  const rad   = normalizeAngle(angleDeg) * DEG;
  const turns = quarterTurns(angleDeg);
  // Math.cos(Math.PI/2) is 6.1e-17, not 0. On a quarter turn that noise would
  // leak into every coordinate, so take the exact values instead and keep the
  // "four 90° turns give you the file you started with" promise literal.
  const cos = turns !== null ? [1, 0, -1, 0][turns] : Math.cos(rad);
  const sin = turns !== null ? [0, 1, 0, -1][turns] : Math.sin(rad);
  const c   = size / 2;
  return {
    rad, cos, sin, centre: c,
    point:   (x, z) => [c + (x - c) * cos - (z - c) * sin,
                        c + (x - c) * sin + (z - c) * cos],
    vector:  (x, z) => [x * cos - z * sin, x * sin + z * cos],
    // Wrapped into [0, 2π). Without this a heading walks away from zero with
    // every rotation — four 90° turns would leave 1.2 as −5.08 rather than
    // 1.2, which renders the same but is not the file you started with, and
    // loses precision the further it drifts.
    heading: (h) => {
      let v = (h - rad) % TAU;
      if (v < 0) v += TAU;
      // [0, 2π) puts its discontinuity exactly at 0 — the single most common
      // heading in a real map — so a subtraction landing a hair below zero
      // wraps to 2π and prints as 6.28318 instead of 0. Fold both ends back.
      // The tolerance is ANGLE_EPS, the precision headings are actually
      // written at: below that the two values are the same written number, so
      // preferring 0 costs nothing and stops the drift compounding.
      if (v < ANGLE_EPS || v > TAU - ANGLE_EPS) v = 0;
      return v;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RASTER-ROTATION
// ═══════════════════════════════════════════════════════════════════════════
//
// A raster of N×N cells covering the map has its centre at pixel coordinate
// cp = (N−1)/2 — for the heightmap (N = size+1, vertices on integer world
// coords) and for the cell grids (N = size, cell centres at +0.5) alike. That
// single formula is what keeps rasters and world positions in lockstep, and
// it is why a 90° turn lands exactly on integer indices for both.

// Exact index permutation for a multiple of 90° — no interpolation, no loss.
function rotateRasterExact(src, N, bpp, turns) {
  if (turns === 0) return Buffer.from(src);
  const dst = Buffer.allocUnsafe(N * N * bpp);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      let si, sj;
      if (turns === 1)      { si = j;         sj = N - 1 - i; }  //  90° CW
      else if (turns === 2) { si = N - 1 - i; sj = N - 1 - j; }  // 180°
      else                  { si = N - 1 - j; sj = i;         }  // 270° CW
      src.copy(dst, (j * N + i) * bpp, (sj * N + si) * bpp, (sj * N + si) * bpp + bpp);
    }
  }
  return dst;
}

// Arbitrary angle. Samples the inverse rotation; source coordinates that fall
// outside the map are clamped to the edge, which extends the border outwards
// into the corners instead of punching holes into the terrain.
function rotateRasterSampled(src, N, bpp, angleDeg, { nearest = false, uint16 = false } = {}) {
  const rad = normalizeAngle(angleDeg) * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cp  = (N - 1) / 2;
  const dst = Buffer.allocUnsafe(N * N * bpp);
  const clamp = v => (v < 0 ? 0 : v > N - 1 ? N - 1 : v);

  for (let j = 0; j < N; j++) {
    const dz = j - cp;
    for (let i = 0; i < N; i++) {
      const dx = i - cp;
      // Inverse of the clockwise rotation above.
      const sx = cp + dx * cos + dz * sin;
      const sz = cp - dx * sin + dz * cos;
      const dstOff = (j * N + i) * bpp;

      if (nearest) {
        const px = clamp(Math.round(sx));
        const py = clamp(Math.round(sz));
        const srcOff = (py * N + px) * bpp;
        src.copy(dst, dstOff, srcOff, srcOff + bpp);
        continue;
      }

      // Clamp the source COORDINATE before splitting it, not the index after.
      // Clamping the index while keeping the fraction relative to the
      // unclamped floor makes an out-of-range sample interpolate towards the
      // second pixel in, so the border row came out as its neighbour rather
      // than as itself.
      const cx = clamp(sx), cz = clamp(sz);
      const x0 = Math.floor(cx),        y0 = Math.floor(cz);
      const x1 = Math.min(x0 + 1, N - 1), y1 = Math.min(y0 + 1, N - 1);
      const fx = cx - x0,               fy = cz - y0;
      const wtl = (1 - fx) * (1 - fy), wtr = fx * (1 - fy);
      const wbl = (1 - fx) * fy,       wbr = fx * fy;

      if (uint16) {
        const v = src.readUInt16LE((y0 * N + x0) * 2) * wtl
                + src.readUInt16LE((y0 * N + x1) * 2) * wtr
                + src.readUInt16LE((y1 * N + x0) * 2) * wbl
                + src.readUInt16LE((y1 * N + x1) * 2) * wbr;
        dst.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(v))), dstOff);
      } else {
        for (let ch = 0; ch < bpp; ch++) {
          const v = src[(y0 * N + x0) * bpp + ch] * wtl
                  + src[(y0 * N + x1) * bpp + ch] * wtr
                  + src[(y1 * N + x0) * bpp + ch] * wbl
                  + src[(y1 * N + x1) * bpp + ch] * wbr;
          dst[dstOff + ch] = Math.round(v);
        }
      }
    }
  }
  return dst;
}

function rotateRaster(src, N, bpp, angleDeg, opts = {}) {
  const turns = quarterTurns(angleDeg);
  return turns !== null
    ? rotateRasterExact(src, N, bpp, turns)
    : rotateRasterSampled(src, N, bpp, angleDeg, opts);
}

// ── DDS pixel format ─────────────────────────────────────────────────────────
// The payload/pixel ratio is NOT enough to tell a compressed texture from an
// uncompressed one: DXT3 and DXT5 are both exactly 1 byte per pixel, which is
// also a valid uncompressed 8-bit layout. Reading the ratio and calling an
// integral result "uncompressed" byte-permutes a DXT block grid as if it were
// pixels and destroys it — FA's normalMap.dds and waterMap.dds are DXT5, so
// this is the common case, not the exotic one. Always read the header.
const DDPF_FOURCC = 0x4;

function readDDSFormat(buf) {
  const pfFlags = buf.readUInt32LE(80);
  const fourCC  = buf.slice(84, 88).toString('ascii');
  if (pfFlags & DDPF_FOURCC) {
    const blockBytes = { DXT1: 8, DXT2: 16, DXT3: 16, DXT4: 16, DXT5: 16 }[fourCC];
    return { compressed: true, fourCC, blockBytes };
  }
  const bits = buf.readUInt32LE(88);
  return { compressed: false, fourCC: null, bpp: bits ? bits / 8 : 0 };
}

// ── 4×4 block index permutations ─────────────────────────────────────────────
// A DXT block holds a 4×4 tile of per-pixel indices. Rotating the image means
// permuting the block grid AND rotating the indices inside each block — and
// both use the very same permutation, because the map dimensions are multiples
// of 4: image dst(i,j) = src(j, N−1−i) decomposes exactly into
// block dst(bi,bj) = src(bj, BN−1−bi) with intra-tile dst(p,q) = src(q, 3−p).
// That makes a quarter turn of a compressed texture lossless — no decode, no
// re-encode, no size change, no quality loss.
function tilePermutation(turns) {
  const perm = new Array(16);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      let sx, sy;
      if (turns === 1)      { sx = y;     sy = 3 - x; }  //  90° CW
      else if (turns === 2) { sx = 3 - x; sy = 3 - y; }  // 180°
      else                  { sx = 3 - y; sy = x;     }  // 270° CW
      perm[x + y * 4] = sx + sy * 4;
    }
  }
  return perm;
}

// 2-bit colour indices: 4 bytes, one row each, pixel x at bits 2x..2x+1.
const get2 = (b, o, n) => (b[o + (n >> 2)] >> ((n & 3) * 2)) & 3;
const set2 = (b, o, n, v) => { b[o + (n >> 2)] |= (v & 3) << ((n & 3) * 2); };

// DXT5 alpha: 16 × 3 bits over 6 bytes, as two independent 24-bit groups.
function get3(b, o, n) {
  const g = n < 8 ? 0 : 3, k = n < 8 ? n : n - 8;
  return ((b[o + g] | (b[o + g + 1] << 8) | (b[o + g + 2] << 16)) >>> (k * 3)) & 7;
}
function set3(b, o, n, v) {
  const g = n < 8 ? 0 : 3, k = n < 8 ? n : n - 8;
  let word = b[o + g] | (b[o + g + 1] << 8) | (b[o + g + 2] << 16);
  word |= (v & 7) << (k * 3);
  b[o + g] = word & 0xff;
  b[o + g + 1] = (word >>> 8) & 0xff;
  b[o + g + 2] = (word >>> 16) & 0xff;
}

// DXT3 alpha: 16 × 4 bits over 8 bytes, one nibble per pixel.
const get4 = (b, o, n) => (b[o + (n >> 1)] >> ((n & 1) * 4)) & 0xf;
const set4 = (b, o, n, v) => { b[o + (n >> 1)] |= (v & 0xf) << ((n & 1) * 4); };

// Rotates the pixels inside one block. The endpoint colours describe the
// block's palette, not its layout, so a rotation copies them untouched.
function rotateBlock(src, so, dst, doff, fourCC, perm) {
  if (fourCC === 'DXT1') {
    for (let c = 0; c < 4; c++) dst[doff + c] = src[so + c];
    for (let n = 0; n < 16; n++) set2(dst, doff + 4, n, get2(src, so + 4, perm[n]));
    return;
  }
  if (fourCC === 'DXT2' || fourCC === 'DXT3') {
    // 4-bit explicit alpha, then a DXT1-style colour block.
    for (let n = 0; n < 16; n++) set4(dst, doff, n, get4(src, so, perm[n]));
  } else {
    // DXT4/5: two alpha endpoints, then 3-bit alpha indices.
    dst[doff] = src[so];
    dst[doff + 1] = src[so + 1];
    for (let n = 0; n < 16; n++) set3(dst, doff + 2, n, get3(src, so + 2, perm[n]));
  }
  for (let c = 0; c < 4; c++) dst[doff + 8 + c] = src[so + 8 + c];
  for (let n = 0; n < 16; n++) set2(dst, doff + 12, n, get2(src, so + 12, perm[n]));
}

// Rotates a whole block-compressed payload by a quarter turn.
function rotateCompressed(payload, w, fourCC, blockBytes, turns) {
  const BN   = w / 4;
  const perm = tilePermutation(turns);
  const dst  = Buffer.alloc(payload.length);   // zeroed — set2/3/4 OR bits in
  for (let bj = 0; bj < BN; bj++) {
    for (let bi = 0; bi < BN; bi++) {
      let si, sj;
      if (turns === 1)      { si = bj;          sj = BN - 1 - bi; }
      else if (turns === 2) { si = BN - 1 - bi; sj = BN - 1 - bj; }
      else                  { si = BN - 1 - bj; sj = bi;          }
      rotateBlock(payload, (sj * BN + si) * blockBytes,
                  dst,     (bj * BN + bi) * blockBytes, fourCC, perm);
    }
  }
  return dst;
}

/**
 * Rotates one DDS in place. Returns 'rotated' | 'skipped' | 'missing'.
 *
 * Uncompressed payloads rotate at any angle. Block-compressed ones rotate
 * losslessly on a quarter turn; at any other angle they would have to be
 * decoded and re-encoded, which needs a DXT encoder this project does not
 * have, so they are reported and left alone rather than damaged.
 */
async function rotateDDSFile(ddsPath, angleDeg) {
  if (!fs.existsSync(ddsPath)) return 'missing';
  const name = path.basename(ddsPath);
  const buf  = fs.readFileSync(ddsPath);
  if (buf.length < 128) { log.warn(`[mrot] ${name} too small — skipping`); return 'skipped'; }

  const h = buf.readUInt32LE(12);
  const w = buf.readUInt32LE(16);
  if (w !== h || w <= 0) {
    log.warn(`[mrot] ${name} is ${w}×${h}, not square — skipping`);
    return 'skipped';
  }

  const payload = buf.slice(128);
  const fmt     = readDDSFormat(buf);
  const turns   = quarterTurns(angleDeg);

  // ── Block-compressed ──
  if (fmt.compressed) {
    if (!fmt.blockBytes) {
      log.warn(`[mrot] ${name} has unsupported compression '${fmt.fourCC}' — left unrotated`);
      return 'skipped';
    }
    if (turns === null) {
      log.warn(`[mrot] ${name} is ${fmt.fourCC}; only a quarter turn can be rotated without ` +
               `a DXT encoder — left unrotated`);
      return 'skipped';
    }
    if (w % 4 !== 0) {
      log.warn(`[mrot] ${name} is ${fmt.fourCC} but ${w}px is not a multiple of 4 — skipping`);
      return 'skipped';
    }
    const expected = (w / 4) * (w / 4) * fmt.blockBytes;
    if (payload.length !== expected) {
      log.warn(`[mrot] ${name} payload is ${payload.length} bytes, expected ${expected} for ` +
               `${fmt.fourCC} ${w}² (mipmaps?) — skipping`);
      return 'skipped';
    }
    const rotated = rotateCompressed(payload, w, fmt.fourCC, fmt.blockBytes, turns);
    const out = Buffer.alloc(buf.length);
    buf.copy(out, 0, 0, 128);
    rotated.copy(out, 128);
    fs.writeFileSync(ddsPath, out);
    log.info(`[mrot] ${name} rotated ${angleDeg}° losslessly (${fmt.fourCC} ${w}²)`);
    return 'rotated';
  }

  // ── Uncompressed ──
  let bpp = fmt.bpp;
  if (!bpp || payload.length !== w * h * bpp) {
    const ratio = payload.length / (w * h);
    if (Number.isInteger(ratio) && ratio >= 1 && ratio <= 4) {
      bpp = ratio;   // header bit-count absent or contradicted; the size agrees
    } else {
      log.warn(`[mrot] ${name} is uncompressed but ${payload.length} bytes does not fit ` +
               `${w}² at ${bpp || '?'} bytes/px — skipping`);
      return 'skipped';
    }
  }
  const rotated = rotateRaster(payload, w, bpp, angleDeg);
  const out = Buffer.alloc(128 + rotated.length);
  buf.copy(out, 0, 0, 128);
  rotated.copy(out, 128);
  fs.writeFileSync(ddsPath, out);
  log.info(`[mrot] ${name} rotated ${angleDeg}° (${w}², ${bpp} bytes/px uncompressed)`);
  return 'rotated';
}

// ═══════════════════════════════════════════════════════════════════════════
// LUA-HELFER
// ═══════════════════════════════════════════════════════════════════════════

// A vector that has been through a Lua round-trip is a 1-based OBJECT
// ({1:x, 2:y, 3:z}), while the binary reader in utils/scmap.js hands back a
// real JS array. Both reach this module — the unpacked folder is Lua, but a
// caller may pass parsed binary data — so every vector access goes through
// these three helpers rather than assuming either shape. Getting this wrong is
// silent: Array.isArray() on the object form is false, the mutation is skipped
// and the map comes back unrotated.
const isVec = (v, n) => Array.isArray(v)
  ? v.length >= n
  : !!v && typeof v === 'object' && v[1] !== undefined && v[n] !== undefined;

const vecGet = (v, i) => (Array.isArray(v) ? v[i] : v[i + 1]);   // i is 0-based
const vecSet = (v, i, val) => { if (Array.isArray(v)) v[i] = val; else v[i + 1] = val; };

// parseLuaDataFile hands back 1-based objects for Lua arrays; the rest of this
// module wants plain JS arrays. Same pair as in map-resizer.js.
function luaObjToArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') {
    const keys = Object.keys(val).map(Number).filter(n => Number.isInteger(n) && n >= 1);
    if (!keys.length) return [];
    return keys.sort((a, b) => a - b).map(k => val[k]);
  }
  return [];
}

function arrayToLuaObj(arr) {
  return arr.reduce((obj, v, i) => { obj[i + 1] = v; return obj; }, {});
}

function serializeLuaArray(arr) {
  return scmapUtils.luaSerialize(arrayToLuaObj(arr));
}

// Reads every `<base>.lua` / `<base>N.lua` split of one entity set.
function splitFiles(unpackFolder, base) {
  const re = new RegExp(`^${base}\\d*\\.lua$`, 'i');
  return fs.readdirSync(unpackFolder).filter(f => re.test(f));
}

const round5 = v => parseFloat(v.toFixed(5));

// ═══════════════════════════════════════════════════════════════════════════
// KERN: rotateScmap
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rotates the contents of an unpacked .scmap folder about the map centre.
 * `size` is the map grid (512, 1024 …) and does not change — a rotation keeps
 * the map square and the same size, so data.lua's `size` is left alone.
 */
async function rotateScmap({
  unpackFolder,
  size,
  angle,
  rotateProps        = true,
  rotateDecals       = true,
  rotateWater        = true,
  rotateTerrain      = true,
  rotateSun          = false,
  patchScripts       = true,
}) {
  try {
    const turns = quarterTurns(angle);
    log.info(`[mrot] Rotating ${size}² map by ${angle}° in ${unpackFolder}` +
             (turns !== null ? ' (lossless quarter turn)' : ' (resampled)'));

    const R = makeRotator(angle, size);
    const stats = {
      props: 0, decals: 0, waveGenerators: 0, scripts: 0,
      rasters: [], ddsRotated: [], ddsSkipped: [], sunRotated: false,
    };

    const dataLuaPath = path.join(unpackFolder, 'data.lua');
    if (!fs.existsSync(dataLuaPath)) throw new Error('data.lua not found in unpacked folder');

    const data = scmapUtils.parseLuaDataFile(fs.readFileSync(dataLuaPath, 'utf8'));

    // ── Props ────────────────────────────────────────────────────────────────
    // Position rotates about the centre; the three basis vectors rotate as
    // vectors, which turns the model with the terrain. Scale is untouched.
    const rotateOneProp = (p) => {
      if (isVec(p.position, 3)) {
        const [nx, nz] = R.point(vecGet(p.position, 0) || 0, vecGet(p.position, 2) || 0);
        vecSet(p.position, 0, round5(nx));
        vecSet(p.position, 2, round5(nz));
      }
      for (const key of ['rotationX', 'rotationY', 'rotationZ']) {
        const v = p[key];
        if (isVec(v, 3)) {
          const [nx, nz] = R.vector(vecGet(v, 0) || 0, vecGet(v, 2) || 0);
          vecSet(v, 0, round5(nx));
          vecSet(v, 2, round5(nz));
        }
      }
      stats.props++;
    };

    if (rotateProps) {
      const files = splitFiles(unpackFolder, 'props');
      if (files.length) {
        for (const fname of files) {
          const fpath = path.join(unpackFolder, fname);
          const arr   = luaObjToArray(scmapUtils.parseLuaDataFile(fs.readFileSync(fpath, 'utf8')));
          arr.forEach(rotateOneProp);
          fs.writeFileSync(fpath, serializeLuaArray(arr), 'utf8');
          log.info(`[mrot] ${fname}: ${arr.length} props rotated`);
        }
      } else if (data.props) {
        const arr = luaObjToArray(data.props);
        arr.forEach(rotateOneProp);
        data.props = arrayToLuaObj(arr);
      }
    }

    // ── Decals ───────────────────────────────────────────────────────────────
    // Position rotates; `rotation` is an euler triple whose Y is the heading.
    // `scale` is a size, not a direction — it stays.
    const rotateOneDecal = (d) => {
      if (isVec(d.position, 3)) {
        const [nx, nz] = R.point(vecGet(d.position, 0) || 0, vecGet(d.position, 2) || 0);
        vecSet(d.position, 0, round5(nx));
        vecSet(d.position, 2, round5(nz));
      }
      // Not rounded: a basis vector survives a quarter turn as a component
      // swap and never drifts, but a scalar heading is re-derived from its own
      // previous value, so rounding it compounds over repeated rotations.
      if (isVec(d.rotation, 3)) {
        vecSet(d.rotation, 1, R.heading(vecGet(d.rotation, 1) || 0));
      }
      stats.decals++;
    };

    if (rotateDecals) {
      const files = splitFiles(unpackFolder, 'decals');
      if (files.length) {
        for (const fname of files) {
          const fpath = path.join(unpackFolder, fname);
          const arr   = luaObjToArray(scmapUtils.parseLuaDataFile(fs.readFileSync(fpath, 'utf8')));
          arr.forEach(rotateOneDecal);
          fs.writeFileSync(fpath, serializeLuaArray(arr), 'utf8');
          log.info(`[mrot] ${fname}: ${arr.length} decals rotated`);
        }
      } else if (data.decals) {
        const arr = luaObjToArray(data.decals);
        arr.forEach(rotateOneDecal);
        data.decals = arrayToLuaObj(arr);
      }
    }

    // ── Wave generators + wave texture movement ──────────────────────────────
    if (rotateWater) {
      const rotateOneWave = (w) => {
        if (isVec(w.position, 3)) {
          const [nx, nz] = R.point(vecGet(w.position, 0) || 0, vecGet(w.position, 2) || 0);
          vecSet(w.position, 0, round5(nx));
          vecSet(w.position, 2, round5(nz));
        }
        if (typeof w.rotation === 'number') w.rotation = R.heading(w.rotation);
        if (isVec(w.velocity, 3)) {
          const [nx, nz] = R.vector(vecGet(w.velocity, 0) || 0, vecGet(w.velocity, 2) || 0);
          vecSet(w.velocity, 0, round5(nx));
          vecSet(w.velocity, 2, round5(nz));
        }
        stats.waveGenerators++;
      };

      const files = splitFiles(unpackFolder, 'waveGenerators');
      if (files.length) {
        for (const fname of files) {
          const fpath = path.join(unpackFolder, fname);
          const arr   = luaObjToArray(scmapUtils.parseLuaDataFile(fs.readFileSync(fpath, 'utf8')));
          arr.forEach(rotateOneWave);
          fs.writeFileSync(fpath, serializeLuaArray(arr), 'utf8');
          log.info(`[mrot] ${fname}: ${arr.length} wave generators rotated`);
        }
      } else if (data.waveGenerators) {
        const arr = luaObjToArray(data.waveGenerators);
        arr.forEach(rotateOneWave);
        data.waveGenerators = arrayToLuaObj(arr);
      }

      // The four water wave textures scroll along a 2D direction in XZ.
      const waveTextures = luaObjToArray(data.waterSettings?.waveTextures);
      for (const wt of waveTextures) {
        if (isVec(wt.movement, 2)) {
          const [nx, nz] = R.vector(vecGet(wt.movement, 0) || 0, vecGet(wt.movement, 1) || 0);
          vecSet(wt.movement, 0, round5(nx));
          vecSet(wt.movement, 1, round5(nz));
        }
      }
      if (waveTextures.length) log.info(`[mrot] ${waveTextures.length} wave texture directions rotated`);
    }

    // ── Sun direction (opt-in) ───────────────────────────────────────────────
    // Off by default: leaving the sun where it is keeps the lighting agreeing
    // with the skybox, which this tool deliberately does not turn.
    if (rotateSun && isVec(data.lightingSettings?.sunDirection, 3)) {
      const sd = data.lightingSettings.sunDirection;
      const [nx, nz] = R.vector(vecGet(sd, 0) || 0, vecGet(sd, 2) || 0);
      vecSet(sd, 0, round5(nx));
      vecSet(sd, 2, round5(nz));
      stats.sunRotated = true;
      log.info(`[mrot] sunDirection rotated → ` +
               `[${[0, 1, 2].map(i => vecGet(sd, i)).join(', ')}]`);
    }

    fs.writeFileSync(dataLuaPath, scmapUtils.luaSerialize(data), 'utf8');

    // ── Rasters ──────────────────────────────────────────────────────────────
    if (rotateTerrain) {
      // heightmap: (size+1)² uint16. Heights are untouched — only their
      // positions move — so a quarter turn is bit-exact.
      const hmPath = path.join(unpackFolder, 'heightmap.raw');
      if (fs.existsSync(hmPath)) {
        const N = size + 1;
        const buf = fs.readFileSync(hmPath);
        if (buf.length !== N * N * 2) {
          log.warn(`[mrot] heightmap.raw is ${buf.length} bytes, expected ${N * N * 2} — skipping`);
        } else {
          fs.writeFileSync(hmPath, rotateRaster(buf, N, 2, angle, { uint16: true }));
          stats.rasters.push('heightmap.raw');
          log.info(`[mrot] heightmap.raw rotated (${N}²)`);
        }
      } else {
        log.warn('[mrot] heightmap.raw not found — skipping');
      }

      // terrainType: size², one byte of enum per cell — nearest neighbour, or
      // interpolation would invent terrain types that do not exist.
      const ttPath = path.join(unpackFolder, 'terrainType.raw');
      if (fs.existsSync(ttPath)) {
        const buf = fs.readFileSync(ttPath);
        if (buf.length !== size * size) {
          log.warn(`[mrot] terrainType.raw is ${buf.length} bytes, expected ${size * size} — skipping`);
        } else {
          fs.writeFileSync(ttPath, rotateRaster(buf, size, 1, angle, { nearest: true }));
          stats.rasters.push('terrainType.raw');
          log.info(`[mrot] terrainType.raw rotated (${size}²)`);
        }
      }

      // Half-resolution uint8 water masks.
      const half = size / 2;
      for (const name of ['waterFoamMask.raw', 'waterFlatness.raw', 'waterDepthBiasMask.raw']) {
        const p = path.join(unpackFolder, name);
        if (!fs.existsSync(p)) { log.warn(`[mrot] ${name} not found — skipping`); continue; }
        const buf = fs.readFileSync(p);
        if (buf.length !== half * half) {
          log.warn(`[mrot] ${name} is ${buf.length} bytes, expected ${half * half} — skipping`);
          continue;
        }
        fs.writeFileSync(p, rotateRaster(buf, half, 1, angle));
        stats.rasters.push(name);
        log.info(`[mrot] ${name} rotated (${half}²)`);
      }

      // DDS layers. previewImage is the minimap thumbnail and is square at its
      // own resolution, so it is rotated from its own header.
      for (const name of ['textureMaskLow.dds', 'textureMaskHigh.dds',
                          'normalMap.dds', 'waterMap.dds', 'previewImage.dds']) {
        const result = await rotateDDSFile(path.join(unpackFolder, name), angle);
        if (result === 'rotated')      stats.ddsRotated.push(name);
        else if (result === 'skipped') stats.ddsSkipped.push(name);
      }
    }

    // ── Prop _script.lua coordinate + heading patching ───────────────────────
    if (patchScripts && rotateProps) {
      stats.scripts = patchPropScripts(unpackFolder, R);
    }

    log.info(`[mrot] rotate-scmap complete — props: ${stats.props}, decals: ${stats.decals}, ` +
             `waveGens: ${stats.waveGenerators}, scripts: ${stats.scripts}`);
    return { success: true, ...stats, lossless: turns !== null };

  } catch (err) {
    log.error('[mrot] rotateScmap failed:', err);
    return { success: false, error: err.message };
  }
}

// ── _script.lua patching ─────────────────────────────────────────────────────
// Props whose blueprint is `<name>_prop.bp` have a sibling `<name>_script.lua`
// under the maps folder that spawns wreckage or civilians at hard-coded
// coordinates. Same discovery walk as map-resizer.js, but rotating x/z and the
// heading instead of scaling.
//
// CreateUnitHPR(id, army, x, y, z, h, p, r) and CreatePropHPR(bp, x, y, z, h, p, r)
// take their angles in radians (the editor writes `math.pi` here). Headings
// that are expressions rather than plain numbers are left alone — the number
// pattern simply does not match them.
function patchPropScripts(unpackFolder, R) {
  const settings   = readSettings();
  const mapsFolder = (settings.mapsFolder || '').replace(/\\/g, '/').replace(/\/$/, '');
  if (!mapsFolder) {
    log.warn('[mrot] mapsFolder not set — skipping _script.lua patching');
    return 0;
  }

  const NUM = '[\\d.eE+\\-]+';
  const rotateCall = (src, fnName, leadingArgs) => {
    const lead = Array(leadingArgs).fill('[^,]+').join(',');
    const re = new RegExp(
      `(${fnName}\\s*\\(\\s*${lead}\\s*,\\s*)(${NUM})(\\s*,\\s*)(${NUM})(\\s*,\\s*)(${NUM})` +
      `(\\s*,\\s*)(${NUM})`, 'g'
    );
    return src.replace(re, (m, pre, x, s1, y, s2, z, s3, h) => {
      const [nx, nz] = R.point(parseFloat(x), parseFloat(z));
      const nh = R.heading(parseFloat(h));
      return `${pre}${nx.toFixed(5)}${s1}${y}${s2}${nz.toFixed(5)}${s3}${nh.toFixed(5)}`;
    });
  };

  const seen = new Set();
  const patched = [];

  for (const fname of splitFiles(unpackFolder, 'props')) {
    const arr = luaObjToArray(
      scmapUtils.parseLuaDataFile(fs.readFileSync(path.join(unpackFolder, fname), 'utf8'))
    );
    for (const p of arr) {
      const propPath = p.path || '';
      if (!/_prop\.bp$/i.test(propPath)) continue;

      const rel       = propPath.replace(/_prop\.bp$/i, '_script.lua').replace(/^\/maps\//i, '');
      const absScript = path.join(mapsFolder, rel);
      if (seen.has(absScript)) continue;
      seen.add(absScript);
      if (!fs.existsSync(absScript)) continue;

      const before = fs.readFileSync(absScript, 'utf8');
      const after  = rotateCall(rotateCall(before, 'CreateUnitHPR', 2), 'CreatePropHPR', 1);
      if (after !== before) {
        fs.writeFileSync(absScript, after, 'utf8');
        patched.push(path.basename(absScript));
        log.info(`[mrot] _script.lua rotated: ${absScript}`);
      }
    }
  }

  if (patched.length) log.info(`[mrot] ${patched.length} _script.lua file(s) patched: ${patched.join(', ')}`);
  return patched.length;
}

// ═══════════════════════════════════════════════════════════════════════════
// KERN: rotateSaveLua
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rotates `<Map>_save.lua`: marker and unit positions, their headings, and the
 * area rectangles. Text-level regex patching, exactly like scaleSaveLua — the
 * file is hand-edited by mappers and a Lua round-trip would reformat it.
 */
async function rotateSaveLua({
  mapFolder, size, angle,
  rotateMarkers = true,
  rotateUnits   = true,
  rotateAreas   = true,
}) {
  try {
    const files    = fs.readdirSync(mapFolder);
    const saveName = files.find(f => f.toLowerCase().endsWith('_save.lua'));
    if (!saveName) throw new Error('_save.lua not found in map folder');

    const savePath = path.join(mapFolder, saveName);
    let   src      = fs.readFileSync(savePath, 'utf8');

    const R   = makeRotator(angle, size);
    const NUM = '[\\d.eE+\\-]+';
    let markers = 0, units = 0, areas = 0, headings = 0;

    // Markers sit on the half-grid in the editor, so snap them back onto it —
    // same convention scaleSaveLua uses.
    const snapHalf = v => Math.floor(v) + 0.5;

    if (rotateMarkers) {
      src = src.replace(
        new RegExp(`\\['position'\\]\\s*=\\s*VECTOR3\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)`, 'g'),
        (m, x, y, z) => {
          markers++;
          const [nx, nz] = R.point(parseFloat(x), parseFloat(z));
          return `['position'] = VECTOR3( ${snapHalf(nx).toFixed(5)}, ${parseFloat(y).toFixed(5)}, ${snapHalf(nz).toFixed(5)} )`;
        }
      );

      src = src.replace(
        new RegExp(`\\['orientation'\\]\\s*=\\s*VECTOR3\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)`, 'g'),
        (m, x, y, z) => {
          headings++;
          return `['orientation'] = VECTOR3( ${parseFloat(x).toFixed(5)}, ${R.heading(parseFloat(y)).toFixed(5)}, ${parseFloat(z).toFixed(5)} )`;
        }
      );
    }

    if (rotateUnits) {
      src = src.replace(
        new RegExp(`(\\bPosition\\s*=\\s*\\{\\s*)(${NUM})(\\s*,\\s*)(${NUM})(\\s*,\\s*)(${NUM})(\\s*\\})`, 'g'),
        (m, open, x, s1, y, s2, z, close) => {
          units++;
          const [nx, nz] = R.point(parseFloat(x), parseFloat(z));
          return `${open}${nx.toFixed(5)}${s1}${parseFloat(y).toFixed(5)}${s2}${nz.toFixed(5)}${close}`;
        }
      );

      src = src.replace(
        new RegExp(`(\\bOrientation\\s*=\\s*\\{\\s*)(${NUM})(\\s*,\\s*)(${NUM})(\\s*,\\s*)(${NUM})(\\s*\\})`, 'g'),
        (m, open, x, s1, y, s2, z, close) => {
          headings++;
          return `${open}${parseFloat(x).toFixed(5)}${s1}${R.heading(parseFloat(y)).toFixed(5)}${s2}${parseFloat(z).toFixed(5)}${close}`;
        }
      );
    }

    // A rectangle has no orientation, so a rotated one is stored as the
    // bounding box of its four rotated corners. On a quarter turn that is the
    // exact same rectangle, turned; on any other angle it grows, which is why
    // the tab calls non-quarter turns approximate for areas.
    if (rotateAreas) {
      src = src.replace(
        new RegExp(`RECTANGLE\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)`, 'g'),
        (m, x1, y1, x2, y2) => {
          areas++;
          const ax = parseFloat(x1), az = parseFloat(y1);
          const bx = parseFloat(x2), bz = parseFloat(y2);
          const corners = [[ax, az], [bx, az], [bx, bz], [ax, bz]].map(([x, z]) => R.point(x, z));
          const xs = corners.map(c => c[0]);
          const zs = corners.map(c => c[1]);
          const clamp = v => Math.max(0, Math.min(size, v));
          return `RECTANGLE( ${clamp(Math.min(...xs)).toFixed(2)}, ${clamp(Math.min(...zs)).toFixed(2)}, ` +
                 `${clamp(Math.max(...xs)).toFixed(2)}, ${clamp(Math.max(...zs)).toFixed(2)} )`;
        }
      );
    }

    fs.writeFileSync(savePath, src, 'utf8');
    log.info(`[mrot] save.lua rotated — markers: ${markers}, units: ${units}, areas: ${areas}, headings: ${headings}`);
    return { success: true, markers, units, areas, headings };

  } catch (err) {
    log.error('[mrot] rotateSaveLua failed:', err);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC HANDLER REGISTRATION (nur im Electron-Kontext)
// ═══════════════════════════════════════════════════════════════════════════

function register() {
  if (!_ipcMain) return;

  _ipcMain.handle('mrot-rotate-scmap', withPathGuard(
    ({ unpackFolder }) => [unpackFolder],
    async (event, args) => rotateScmap(args)
  ));

  _ipcMain.handle('mrot-rotate-save-lua', withPathGuard(
    ({ mapFolder }) => [mapFolder],
    async (event, args) => rotateSaveLua(args)
  ));
}

module.exports = {
  register,
  // Headless-API
  rotateScmap,
  rotateSaveLua,
  // Geometrie — exportiert für Tests und Wiederverwendung
  makeRotator,
  quarterTurns,
  normalizeAngle,
  rotateRaster,
  rotateDDSFile,
};
