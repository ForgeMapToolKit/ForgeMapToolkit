'use strict';
/**
 * terraintype.js — TerrainType auto-paint IPC handlers.
 *
 *   scmap-read-strata      Read the two stratum masks (+ shader/blend meta)
 *                          straight out of a .scmap, decoded and resampled to
 *                          the terrainType grid, for the auto-paint UI.
 *   scmap-write-terraintype Overwrite terrainType.raw inside an unpacked map
 *                          folder with a freshly computed byte grid.
 *
 * The dominance maths lives renderer-side (Shared/MapLogic/terrainTypeLogic.js)
 * so the threshold/remap controls stay instant; this module is pure I/O:
 * decode → resample → hand the raw channels over, then write the result back.
 * See docs/TERRAINTYPE_PLAN.md.
 *
 * Exports: register(deps) — no-op; handlers register at module load.
 */

const path = require('path');
const fs   = require('fs');
const { ipcMain } = require('electron');
const { log } = require('./logger');
const { readSettings } = require('./settings');
const { withPathGuard: _withPathGuardBase } = require('./security');
const { decodeDDSToRGBA } = require('./dds-decode');
const scmapUtils = require('../../utils/scmap');
const JSZip = require('jszip');

function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

// Nearest-neighbour resample of an RGBA buffer to (dstW × dstH). Returns a flat
// RGBA Uint8Array. terrainType is row-major from the top-left (Map.cs:
// TerrainTypeData[(j*Width)+i]); we keep that orientation and let the in-app
// validation catch any vertical flip against a real map.
function resampleRGBA(src, srcW, srcH, dstW, dstH) {
  if (srcW === dstW && srcH === dstH) return src;
  const out = new Uint8Array(dstW * dstH * 4);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, (y * srcH / dstH) | 0);
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, (x * srcW / dstW) | 0);
      const s = (sy * srcW + sx) * 4;
      const d = (y * dstW + x) * 4;
      out[d] = src[s]; out[d + 1] = src[s + 1]; out[d + 2] = src[s + 2]; out[d + 3] = src[s + 3];
    }
  }
  return out;
}

// ── scmap-read-strata ─────────────────────────────────────────────────────────
ipcMain.handle('scmap-read-strata', withPathGuard(
  ({ scmapPath }) => [scmapPath],
  async (event, { scmapPath }) => {
    try {
      const buf  = fs.readFileSync(scmapPath);
      const data = scmapUtils.readDatastream(buf);

      const [w, h] = data.size;
      const decLow  = data.textureMaskLow  ? decodeDDSToRGBA(data.textureMaskLow.data)  : null;
      const decHigh = data.textureMaskHigh ? decodeDDSToRGBA(data.textureMaskHigh.data) : null;
      if (!decLow || !decHigh) {
        return { success: false, error: 'Could not decode textureMaskLow/High (unsupported DDS format)' };
      }

      const maskLow  = resampleRGBA(decLow.data,  decLow.width,  decLow.height,  w, h);
      const maskHigh = resampleRGBA(decHigh.data, decHigh.width, decHigh.height, w, h);

      const spec = data.lightingSettings?.specularColor;
      const blurriness = Array.isArray(spec) ? Number(spec[0]) : (spec && spec[1] != null ? Number(spec[1]) : null);

      return {
        success: true,
        size: data.size,
        shaderPath: data.shaderPath || '',
        blurriness,
        maskResolution: [decLow.width, decLow.height],
        textures: (data.textures || []).map(t => ({ path: t.path || '', scale: t.scale })),
        // Buffers cross IPC as Uint8Array on the renderer side.
        maskLow:  Buffer.from(maskLow.buffer, maskLow.byteOffset, maskLow.byteLength),
        maskHigh: Buffer.from(maskHigh.buffer, maskHigh.byteOffset, maskHigh.byteLength),
        terrainType: data.terrainType ? data.terrainType.data : null,
      };
    } catch (err) {
      log.error('[terraintype] scmap-read-strata failed:', err);
      return { success: false, error: err.message };
    }
  },
));

// ── scmap-write-terraintype ────────────────────────────────────────────────────
// Overwrites terrainType.raw inside an already-unpacked map folder. The caller
// runs scmap-unpack before and scmap-pack after — the same proven cycle the
// water patch and props injector use.
ipcMain.handle('scmap-write-terraintype', withPathGuard(
  ({ folder }) => [folder],
  async (event, { folder, terrainTypeData, size }) => {
    try {
      const rawPath = path.join(folder, 'terrainType.raw');
      if (!fs.existsSync(rawPath)) {
        return { success: false, error: `terrainType.raw not found in ${folder}` };
      }

      const bytes = Buffer.from(terrainTypeData);
      const expected = fs.statSync(rawPath).size;
      if (bytes.length !== expected) {
        return { success: false, error: `terrainType size mismatch — got ${bytes.length} bytes, existing file is ${expected}` };
      }
      if (size && bytes.length !== size[0] * size[1]) {
        return { success: false, error: `terrainType size mismatch — ${bytes.length} bytes vs ${size[0]}×${size[1]}` };
      }

      fs.writeFileSync(rawPath, bytes);
      log.info(`[terraintype] wrote ${bytes.length} bytes → ${rawPath}`);
      return { success: true, bytes: bytes.length };
    } catch (err) {
      log.error('[terraintype] scmap-write-terraintype failed:', err);
      return { success: false, error: err.message };
    }
  },
));

// ── Albedo texture preview (best-effort, from the FA install) ───────────────
// Stratum albedo textures are game assets, not part of the scmap — they live in
// the FA install's gamedata .scd archives (env.scd for layer albedos) or, rarely,
// in a custom map's own folder. We open only env.scd/textures.scd (where layer
// albedos live), cache them, and return small decoded thumbnails. Missing FA
// install / texture → null; the UI falls back to the path name.

const _scdCache = new Map(); // scdPath -> { zip, index: Map(lowerName -> realName) }

async function openScd(scdPath) {
  if (_scdCache.has(scdPath)) return _scdCache.get(scdPath);
  const zip = await JSZip.loadAsync(fs.readFileSync(scdPath));
  const index = new Map();
  zip.forEach((rel) => index.set(rel.toLowerCase(), rel));
  const entry = { zip, index };
  _scdCache.set(scdPath, entry);
  return entry;
}

function nearestThumb(src, sw, sh, d) {
  const out = Buffer.alloc(d * d * 4);
  for (let y = 0; y < d; y++) {
    const sy = Math.min(sh - 1, (y * sh / d) | 0);
    for (let x = 0; x < d; x++) {
      const sx = Math.min(sw - 1, (x * sw / d) | 0);
      const s = (sy * sw + sx) * 4, o = (y * d + x) * 4;
      out[o] = src[s]; out[o + 1] = src[s + 1]; out[o + 2] = src[s + 2]; out[o + 3] = src[s + 3];
    }
  }
  return out;
}

async function loadAlbedoThumb(gamePath, mapFolderPath, faInstallPath) {
  if (!gamePath) return null;
  const norm = gamePath.replace(/\\/g, '/').replace(/^\//, '');
  let ddsBuf = null;

  // 1. Custom map-local texture
  const local = [];
  if (mapFolderPath) {
    if (/^maps\//i.test(norm)) local.push(path.join(mapFolderPath, norm.replace(/^maps\/[^/]+\//i, '')));
    local.push(path.join(mapFolderPath, norm));
  }
  for (const c of local) {
    try { if (fs.existsSync(c)) { ddsBuf = fs.readFileSync(c); break; } } catch (_) { /* skip */ }
  }

  // 2. FA install env.scd / textures.scd
  if (!ddsBuf && faInstallPath) {
    const gamedata = path.join(faInstallPath, 'gamedata');
    for (const name of ['env.scd', 'textures.scd']) {
      const scdPath = path.join(gamedata, name);
      if (!fs.existsSync(scdPath)) continue;
      try {
        const { zip, index } = await openScd(scdPath);
        const hit = index.get(norm.toLowerCase());
        if (hit) { ddsBuf = await zip.file(hit).async('nodebuffer'); break; }
      } catch (_) { /* skip bad scd */ }
    }
  }

  if (!ddsBuf) return null;
  const dec = decodeDDSToRGBA(ddsBuf);
  if (!dec) return null;
  const D = 64;
  return { w: D, h: D, rgba: nearestThumb(dec.data, dec.width, dec.height, D) };
}

ipcMain.handle('resolve-stratum-albedos', withPathGuard(
  ({ mapFolderPath }) => {
    const st = readSettings();
    const p = [];
    if (mapFolderPath) p.push(mapFolderPath);
    if (st.faInstallPath) p.push(st.faInstallPath);
    return p;
  },
  async (event, { texturePaths, mapFolderPath }) => {
    try {
      const fa = readSettings().faInstallPath || '';
      const thumbs = [];
      for (const tp of (texturePaths || [])) {
        try { thumbs.push(await loadAlbedoThumb(tp, mapFolderPath, fa)); }
        catch (_) { thumbs.push(null); }
      }
      return { success: true, thumbs };
    } catch (err) {
      log.error('[terraintype] resolve-stratum-albedos failed:', err);
      return { success: false, error: err.message, thumbs: [] };
    }
  },
));

function register() {
  // handlers registered at module load via ipcMain.handle above
}

module.exports = { register };
