'use strict';
/**
 * map-resizer.js — Map scaling, Lua patching, economy data IPC handlers.
 *
 * Covers: mr-find-scmap, mr-scale-scmap, mr-scale-save-lua,
 *         mr-update-scenario-lua, mr-duplicate-map-version,
 *         read-economy-data, settings-pick-file.
 *
 * Exports (headless-nutzbar):
 *   findScmap(mapFolder)
 *   duplicateMapVersion(mapFolder)
 *   scaleScmap({ unpackFolder, fromSize, toSize, factor, scaleProps, scaleDecals, scaleTextures, scaleSkybox, scaleFog })
 *   scaleSaveLua({ mapFolder, factor, toSize, scaleMarkers, scaleAreas })
 *   updateScenarioLua({ mapFolder, toSize, factor })
 *
 *   register() — registriert alle IPC-Handler (nur im Electron-Kontext)
 */

const path  = require('path');
const fs    = require('fs');
const JSZip = require('jszip');
const { log, yieldTick } = require('./logger');
const { readSettings, SCMAP_DIR } = require('./settings');
const scmapUtils = require('../../utils/scmap');

// Electron-Deps nur laden wenn verfügbar
let _ipcMain = null;
let _dialog  = null;
try {
  const electron = require('electron');
  _ipcMain       = electron.ipcMain;
  _dialog        = electron.dialog;
} catch (_) {}

const { withPathGuard: _withPathGuardBase } = require('./security');
function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

// ═══════════════════════════════════════════════════════════════════════════
// KERN-FUNKTIONEN (headless-nutzbar, kein IPC/Electron)
// ═══════════════════════════════════════════════════════════════════════════

// ── findScmap ────────────────────────────────────────────────────────────────
async function findScmap(mapFolder) {
  if (!fs.existsSync(mapFolder)) {
    return { success: false, error: `Map folder not found: ${mapFolder}` };
  }
  const files = fs.readdirSync(mapFolder).filter(f => f.toLowerCase().endsWith('.scmap'));
  if (!files.length) {
    return { success: false, error: `No .scmap found in: ${mapFolder}` };
  }
  const scmapPath = path.join(mapFolder, files[0]);
  log.info(`[mr] Found .scmap: ${scmapPath}`);
  return { success: true, scmapPath };
}

// ── duplicateMapVersion ───────────────────────────────────────────────────────
// Findet die nächste freie vNNNN-Version und kopiert den Ordner.
async function duplicateMapVersion(mapFolder) {
  try {
    const parent  = path.dirname(mapFolder);
    const base    = path.basename(mapFolder);

    // Versionsnummer aus Ordnername extrahieren: map.v0003 → 3
    const vMatch  = base.match(/\.v(\d{4})$/);
    if (!vMatch) return { success: false, error: `Map folder has no version suffix: ${base}` };

    const currentVersion = parseInt(vMatch[1], 10);

    // Nächste freie Version finden
    let nextVersion = currentVersion + 1;
    let newFolderName, newMapFolder;
    for (let attempts = 0; attempts < 100; attempts++) {
      newFolderName = base.replace(/\.v\d{4}$/, `.v${String(nextVersion).padStart(4, '0')}`);
      newMapFolder  = path.join(parent, newFolderName);
      if (!fs.existsSync(newMapFolder)) break;
      nextVersion++;
    }

    if (fs.existsSync(newMapFolder)) {
      return { success: false, error: 'Could not find a free version slot (v0001–v9999 all taken)' };
    }

    // Ordner rekursiv kopieren
    const copyDir = (src, dst) => {
      fs.mkdirSync(dst, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dst, entry.name);
        if (entry.isDirectory()) copyDir(s, d);
        else fs.copyFileSync(s, d);
      }
    };
    copyDir(mapFolder, newMapFolder);

    log.info(`[mr] Duplicated ${base} → ${newFolderName}`);
    return { success: true, newMapFolder, newVersionName: newFolderName };
  } catch (err) {
    log.error('[mr] duplicateMapVersion failed:', err);
    return { success: false, error: err.message };
  }
}

// ── scaleScmap ───────────────────────────────────────────────────────────────
async function scaleScmap({ unpackFolder, fromSize, toSize, factor, scaleProps, scaleDecals, scaleTextures, scaleSkybox, scaleFog }) {
  try {
    log.info(`[mr] Scaling scmap data ×${factor} in ${unpackFolder}`);

    const dataLuaPath = path.join(unpackFolder, 'data.lua');
    if (!fs.existsSync(dataLuaPath)) throw new Error('data.lua not found in unpacked folder');

    const rawLua = fs.readFileSync(dataLuaPath, 'utf8');
    const data   = scmapUtils.parseLuaDataFile(rawLua);

    data.size = [toSize, toSize];

    let propsScaled  = 0;
    let decalsScaled = 0;

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

    function serializeLuaArray(arr) {
      return scmapUtils.luaSerialize(
        arr.reduce((obj, v, i) => { obj[i + 1] = v; return obj; }, {})
      );
    }

    // ── Props ─────────────────────────────────────────────────────────────────
    if (scaleProps) {
      const allFiles   = fs.readdirSync(unpackFolder);
      const propsFiles = allFiles.filter(f => f === 'props.lua' || /^props\d+\.lua$/.test(f));

      if (propsFiles.length === 0) {
        if (data.props) {
          const arr = luaObjToArray(data.props);
          for (const p of arr) {
            if (p.position) {
              p.position[1] = (p.position[1] || 0) * factor;
              p.position[2] = (p.position[2] || 0) * factor;
              p.position[3] = (p.position[3] || 0) * factor;
            }
            propsScaled++;
          }
          data.props = arr.reduce((obj, v, i) => { obj[i + 1] = v; return obj; }, {});
        }
      } else {
        for (const fname of propsFiles) {
          const fpath  = path.join(unpackFolder, fname);
          const parsed = scmapUtils.parseLuaDataFile(fs.readFileSync(fpath, 'utf8'));
          const arr    = luaObjToArray(parsed);
          for (const p of arr) {
            if (p.position) {
              p.position[1] = (p.position[1] || 0) * factor;
              p.position[2] = (p.position[2] || 0) * factor;
              p.position[3] = (p.position[3] || 0) * factor;
            }
            propsScaled++;
          }
          fs.writeFileSync(fpath, serializeLuaArray(arr), 'utf8');
          log.info(`[mr] ${fname}: ${arr.length} props scaled`);
        }
      }
    }

    // ── Prop script.lua coordinate patching ──────────────────────────────────
    {
      const settings   = readSettings();
      const mapsFolder = (settings.mapsFolder || '').replace(/\\/g, '/').replace(/\/$/, '');

      if (mapsFolder) {
        const allPropFiles = fs.readdirSync(unpackFolder)
          .filter(f => f === 'props.lua' || /^props\d+\.lua$/.test(f));

        const scriptsPatched = [];
        const scriptsSeen    = new Set();

        for (const fname of allPropFiles) {
          const fpath  = path.join(unpackFolder, fname);
          const parsed = scmapUtils.parseLuaDataFile(fs.readFileSync(fpath, 'utf8'));
          const arr    = luaObjToArray(parsed);

          for (const p of arr) {
            const propPath = p.path || '';
            if (!/\_prop\.bp$/i.test(propPath)) continue;

            const scriptMapPath = propPath.replace(/_prop\.bp$/i, '_script.lua');
            const rel           = scriptMapPath.replace(/^\/maps\//i, '');
            const absScript     = path.join(mapsFolder, rel);

            if (scriptsSeen.has(absScript)) continue;
            scriptsSeen.add(absScript);
            if (!fs.existsSync(absScript)) continue;

            let src     = fs.readFileSync(absScript, 'utf8');
            let changed = false;

            src = src.replace(
              /(CreateUnitHPR\s*\([^,]+,[^,]+,\s*)([\d.eE+\-]+)(\s*,\s*)([\d.eE+\-]+)(\s*,\s*)([\d.eE+\-]+)/g,
              (m, pre, x, s1, y, s2, z) => {
                changed = true;
                return `${pre}${(parseFloat(x) * factor).toFixed(5)}${s1}${(parseFloat(y) * factor).toFixed(5)}${s2}${(parseFloat(z) * factor).toFixed(5)}`;
              }
            );

            src = src.replace(
              /(CreatePropHPR\s*\([^,]+,\s*)([\d.eE+\-]+)(\s*,\s*)([\d.eE+\-]+)(\s*,\s*)([\d.eE+\-]+)/g,
              (m, pre, x, s1, y, s2, z) => {
                changed = true;
                return `${pre}${(parseFloat(x) * factor).toFixed(5)}${s1}${(parseFloat(y) * factor).toFixed(5)}${s2}${(parseFloat(z) * factor).toFixed(5)}`;
              }
            );

            if (changed) {
              fs.writeFileSync(absScript, src, 'utf8');
              scriptsPatched.push(path.basename(absScript));
              log.info(`[mr] script.lua patched ×${factor}: ${absScript}`);
            }
          }
        }

        if (scriptsPatched.length > 0) {
          log.info(`[mr] ${scriptsPatched.length} _script.lua file(s) patched: ${scriptsPatched.join(', ')}`);
        }
      } else {
        log.warn('[mr] mapsFolder not set — skipping _script.lua coordinate patching');
      }
    }

    // ── Decals ────────────────────────────────────────────────────────────────
    if (scaleDecals) {
      const allFiles2   = fs.readdirSync(unpackFolder);
      const decalsFiles = allFiles2.filter(f => f === 'decals.lua' || /^decals\d+\.lua$/.test(f));

      if (decalsFiles.length === 0) {
        if (data.decals) {
          const arr = luaObjToArray(data.decals);
          for (const d of arr) {
            if (d.position) {
              d.position[1] = (d.position[1] || 0) * factor;
              d.position[2] = (d.position[2] || 0) * factor;
              d.position[3] = (d.position[3] || 0) * factor;
            }
            if (d.scale) {
              d.scale[1] = (d.scale[1] || 0) * factor;
              d.scale[3] = (d.scale[3] || 0) * factor;
            }
            decalsScaled++;
          }
          data.decals = arr.reduce((obj, v, i) => { obj[i + 1] = v; return obj; }, {});
        }
      } else {
        for (const fname of decalsFiles) {
          const fpath  = path.join(unpackFolder, fname);
          const parsed = scmapUtils.parseLuaDataFile(fs.readFileSync(fpath, 'utf8'));
          const arr    = luaObjToArray(parsed);
          for (const d of arr) {
            if (d.position) {
              d.position[1] = (d.position[1] || 0) * factor;
              d.position[2] = (d.position[2] || 0) * factor;
              d.position[3] = (d.position[3] || 0) * factor;
            }
            if (d.scale) {
              d.scale[1] = (d.scale[1] || 0) * factor;
              d.scale[3] = (d.scale[3] || 0) * factor;
            }
            decalsScaled++;
          }
          fs.writeFileSync(fpath, serializeLuaArray(arr), 'utf8');
          log.info(`[mr] ${fname}: ${arr.length} decals scaled`);
        }
      }
    }

    // ── Textures / Normals ────────────────────────────────────────────────────
    let texturesScaled = 0;
    let normalsScaled  = 0;
    if (scaleTextures) {
      const scaleBlock = (src, blockName) => {
        const blockRe = new RegExp(`(${blockName}\\s*=\\s*\\{)([\\s\\S]*?)(\\n    \\})`, 'g');
        return src.replace(blockRe, (full, open, inner, close) => {
          const scaled = inner.replace(
            /(\bscale\s*=\s*)([\d.eE+\-]+)/g,
            (m, prefix, val) => {
              const n = parseFloat(val);
              if (isNaN(n) || n === 0) return m;
              if (blockName === 'normals') normalsScaled++;
              else texturesScaled++;
              return `${prefix}${parseFloat((n * factor).toPrecision(7))}`;
            }
          );
          return open + scaled + close;
        });
      };

      const baseLua = scmapUtils.luaSerialize(data);
      const patched = scaleBlock(scaleBlock(baseLua, 'normals'), 'textures');
      fs.writeFileSync(dataLuaPath, patched, 'utf8');
      log.info(`[mr] textures/normals scaled — normals: ${normalsScaled}, textures: ${texturesScaled}`);
    } else {
      fs.writeFileSync(dataLuaPath, scmapUtils.luaSerialize(data), 'utf8');
    }

    // ── Skybox ────────────────────────────────────────────────────────────────
    if (scaleSkybox && data.skyBox) {
      const sb = data.skyBox;
      sb.position = [toSize / 2, 0, toSize / 2];
      sb.scale    = toSize * 2.288245;

      if (sb.horizonHeight != null) sb.horizonHeight = parseFloat((sb.horizonHeight * factor).toFixed(4));
      if (sb.zenithHeight  != null) sb.zenithHeight  = parseFloat((sb.zenithHeight  * factor).toFixed(4));

      if (Array.isArray(sb.cirrusLayers)) {
        for (const cl of sb.cirrusLayers) {
          if (cl.frequency) {
            cl.frequency[0] = parseFloat((cl.frequency[0] / factor).toPrecision(5));
            cl.frequency[1] = parseFloat((cl.frequency[1] / factor).toPrecision(5));
          }
          if (cl.speed != null) cl.speed = parseFloat((cl.speed * factor).toPrecision(5));
        }
      } else if (sb.cirrusLayers && typeof sb.cirrusLayers === 'object') {
        for (const k of Object.keys(sb.cirrusLayers)) {
          const cl = sb.cirrusLayers[k];
          if (cl?.frequency) {
            cl.frequency[1] = parseFloat((cl.frequency[1] / factor).toPrecision(5));
            cl.frequency[2] = parseFloat((cl.frequency[2] / factor).toPrecision(5));
          }
          if (cl?.speed != null) cl.speed = parseFloat((cl.speed * factor).toPrecision(5));
        }
      }

      {
        let src = fs.readFileSync(dataLuaPath, 'utf8');

        src = src.replace(
          /(skyBox\s*=\s*\{[\s\S]*)\bposition\s*=\s*\{[^}]*\}([\s\S]*?\n\s*\},?\s*\n\s*skyCubePath)/,
          (m, before, after) => `${before}position = { ${toSize / 2}, 0, ${toSize / 2} }${after}`
        );
        src = src.replace(
          /(skyBox\s*=\s*\{[\s\S]*?\n)([ \t]*scale\s*=\s*)([\d.eE+\-]+)(\s*,?\s*\n[\s\S]*?skyCubePath)/,
          (m, before, pre, _old, after) => `${before}${pre}${parseFloat((toSize * 2.288245).toFixed(4))}${after}`
        );
        if (sb.horizonHeight != null) {
          src = src.replace(
            /(\bhorizonHeight\s*=\s*)([\d.eE+\-]+)/g,
            (m, pre, val) => `${pre}${parseFloat((parseFloat(val) * factor).toFixed(4))}`
          );
        }
        if (sb.zenithHeight != null) {
          src = src.replace(
            /(\bzenithHeight\s*=\s*)([\d.eE+\-]+)/g,
            (m, pre, val) => `${pre}${parseFloat((parseFloat(val) * factor).toFixed(4))}`
          );
        }
        src = src.replace(
          /(\bfrequency\s*=\s*\{)\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)\s*(\})/g,
          (m, open, f0, f1, close) =>
            `${open} ${parseFloat((parseFloat(f0) / factor).toPrecision(5))}, ${parseFloat((parseFloat(f1) / factor).toPrecision(5))} ${close}`
        );
        src = src.replace(
          /(\bspeed\s*=\s*)([\d.eE+\-]+)/g,
          (m, pre, val) => `${pre}${parseFloat((parseFloat(val) * factor).toPrecision(5))}`
        );

        fs.writeFileSync(dataLuaPath, src, 'utf8');
      }

      log.info(`[mr] skyBox updated — position=[${sb.position}], scale=${sb.scale.toFixed(3)}`);
    }

    log.info(`[mr] data.lua updated — props: ${propsScaled}, decals: ${decalsScaled}`);

    // ── Bilinear resampler (pure JS) ──────────────────────────────────────────
    const resampleRaw = (buf, srcW, srcH, dstW, dstH, bytesPerPixel, nearest) => {
      const dst = Buffer.allocUnsafe(dstW * dstH * bytesPerPixel);
      for (let dy = 0; dy < dstH; dy++) {
        for (let dx = 0; dx < dstW; dx++) {
          const sx = dstW > 1 ? (dx / (dstW - 1)) * (srcW - 1) : 0;
          const sy = dstH > 1 ? (dy / (dstH - 1)) * (srcH - 1) : 0;
          const dstOff = (dy * dstW + dx) * bytesPerPixel;

          if (nearest) {
            const px     = Math.min(Math.round(sx), srcW - 1);
            const py     = Math.min(Math.round(sy), srcH - 1);
            const srcOff = (py * srcW + px) * bytesPerPixel;
            buf.copy(dst, dstOff, srcOff, srcOff + bytesPerPixel);
          } else if (bytesPerPixel === 2) {
            const x0 = Math.min(Math.floor(sx), srcW - 1);
            const y0 = Math.min(Math.floor(sy), srcH - 1);
            const x1 = Math.min(x0 + 1, srcW - 1);
            const y1 = Math.min(y0 + 1, srcH - 1);
            const fx = sx - x0, fy = sy - y0;
            const tl = buf.readUInt16LE((y0 * srcW + x0) * 2);
            const tr = buf.readUInt16LE((y0 * srcW + x1) * 2);
            const bl = buf.readUInt16LE((y1 * srcW + x0) * 2);
            const br = buf.readUInt16LE((y1 * srcW + x1) * 2);
            const v  = tl*(1-fx)*(1-fy) + tr*fx*(1-fy) + bl*(1-fx)*fy + br*fx*fy;
            dst.writeUInt16LE(Math.round(v), dstOff);
          } else {
            const x0 = Math.min(Math.floor(sx), srcW - 1);
            const y0 = Math.min(Math.floor(sy), srcH - 1);
            const x1 = Math.min(x0 + 1, srcW - 1);
            const y1 = Math.min(y0 + 1, srcH - 1);
            const fx = sx - x0, fy = sy - y0;
            for (let c = 0; c < bytesPerPixel; c++) {
              const tl = buf[(y0 * srcW + x0) * bytesPerPixel + c];
              const tr = buf[(y0 * srcW + x1) * bytesPerPixel + c];
              const bl = buf[(y1 * srcW + x0) * bytesPerPixel + c];
              const br = buf[(y1 * srcW + x1) * bytesPerPixel + c];
              dst[dstOff + c] = Math.round(tl*(1-fx)*(1-fy) + tr*fx*(1-fy) + bl*(1-fx)*fy + br*fx*fy);
            }
          }
        }
      }
      return dst;
    };

    // ── heightmap.raw ─────────────────────────────────────────────────────────
    const hmPath = path.join(unpackFolder, 'heightmap.raw');
    if (fs.existsSync(hmPath)) {
      const hmBuf = fs.readFileSync(hmPath);
      const srcHM = fromSize + 1, dstHM = toSize + 1;
      const resampled = resampleRaw(hmBuf, srcHM, srcHM, dstHM, dstHM, 2, false);
      if (factor !== 1) {
        let clipped = 0;
        for (let i = 0; i < dstHM * dstHM; i++) {
          const off    = i * 2;
          const scaled = resampled.readUInt16LE(off) * factor;
          if (scaled > 65535) clipped++;
          resampled.writeUInt16LE(Math.min(65535, Math.round(scaled)), off);
        }
        if (clipped > 0) log.warn(`[mr] heightmap: ${clipped} pixel(s) clamped to 65535`);
        else log.info(`[mr] heightmap height values scaled ×${factor} — no clipping`);
      }
      fs.writeFileSync(hmPath, resampled);
      log.info(`[mr] heightmap resampled: ${srcHM}×${srcHM} → ${dstHM}×${dstHM}`);
    } else {
      log.warn('[mr] heightmap.raw not found — skipping');
    }

    // ── uint8 Masks (halbe Auflösung) ─────────────────────────────────────────
    const halfSrc = fromSize / 2, halfDst = toSize / 2;
    for (const name of ['waterFoamMask.raw', 'waterFlatness.raw', 'waterDepthBiasMask.raw']) {
      const p = path.join(unpackFolder, name);
      if (!fs.existsSync(p)) { log.warn(`[mr] ${name} not found — skipping`); continue; }
      const buf = fs.readFileSync(p);
      fs.writeFileSync(p, resampleRaw(buf, halfSrc, halfSrc, halfDst, halfDst, 1, false));
      log.info(`[mr] ${name} resampled: ${halfSrc}² → ${halfDst}²`);
    }

    // ── terrainType.raw (nearest neighbour) ───────────────────────────────────
    const ttPath = path.join(unpackFolder, 'terrainType.raw');
    if (fs.existsSync(ttPath)) {
      const buf = fs.readFileSync(ttPath);
      fs.writeFileSync(ttPath, resampleRaw(buf, fromSize, fromSize, toSize, toSize, 1, true));
      log.info(`[mr] terrainType.raw resampled: ${fromSize}² → ${toSize}²`);
    }

    // ── DDS-Files ─────────────────────────────────────────────────────────────
    function buildUncompressedDDSHeader(w, h) {
      const hdr = Buffer.alloc(128, 0);
      hdr.write('DDS ', 0, 'ascii');
      hdr.writeUInt32LE(124,            4);
      hdr.writeUInt32LE(0x1|0x2|0x4|0x1000, 8);
      hdr.writeUInt32LE(h,             12);
      hdr.writeUInt32LE(w,             16);
      hdr.writeUInt32LE(w * 4,         20);
      hdr.writeUInt32LE(0,             24);
      hdr.writeUInt32LE(0,             28);
      hdr.writeUInt32LE(32,            76);
      hdr.writeUInt32LE(0x41,          80);
      hdr.writeUInt32LE(0,             84);
      hdr.writeUInt32LE(32,            88);
      hdr.writeUInt32LE(0x00ff0000,    92);
      hdr.writeUInt32LE(0x0000ff00,    96);
      hdr.writeUInt32LE(0x000000ff,   100);
      hdr.writeUInt32LE(0xff000000,   104);
      hdr.writeUInt32LE(0x1000,       108);
      return hdr;
    }

    let sharp, sharpAvailable = false;
    try { sharp = require('sharp'); sharpAvailable = true; }
    catch (_) { log.warn('[mr] sharp not available — install sharp for clean DDS resampling'); }

    const ddsFiles = [
      { name: 'textureMaskLow.dds',  srcW: fromSize,   srcH: fromSize,   dstW: toSize,   dstH: toSize   },
      { name: 'textureMaskHigh.dds', srcW: fromSize,   srcH: fromSize,   dstW: toSize,   dstH: toSize   },
      { name: 'normalMap.dds',       srcW: fromSize/2, srcH: fromSize/2, dstW: toSize/2, dstH: toSize/2 },
      { name: 'waterMap.dds',        srcW: fromSize/2, srcH: fromSize/2, dstW: toSize/2, dstH: toSize/2 },
    ];

    for (const { name, srcW, srcH, dstW, dstH } of ddsFiles) {
      const ddsp = path.join(unpackFolder, name);
      if (!fs.existsSync(ddsp)) { log.debug(`[mr] ${name} not found — skipping`); continue; }

      const buf = fs.readFileSync(ddsp);
      if (buf.length < 128) { log.warn(`[mr] ${name} too small — skipping`); continue; }

      const actualH = buf.readUInt32LE(12);
      const actualW = buf.readUInt32LE(16);

      if (sharpAvailable) {
        try {
          const { data: rawPixels, info } = await sharp(buf)
            .resize(dstW, dstH, { kernel: 'lanczos3' })
            .raw()
            .toBuffer({ resolveWithObject: true });

          const channels = info.channels;
          let outData = rawPixels;
          if (channels !== 4) {
            outData = Buffer.alloc(dstW * dstH * 4);
            for (let i = 0; i < dstW * dstH; i++) {
              const s = i * channels, d = i * 4;
              outData[d]   = rawPixels[s];
              outData[d+1] = channels >= 2 ? rawPixels[s+1] : rawPixels[s];
              outData[d+2] = channels >= 3 ? rawPixels[s+2] : rawPixels[s];
              outData[d+3] = channels === 4 ? rawPixels[s+3] : 255;
            }
          }
          fs.writeFileSync(ddsp, Buffer.concat([buildUncompressedDDSHeader(dstW, dstH), outData]));
          log.info(`[mr] ${name} resampled via sharp: ${actualW}×${actualH} → ${dstW}×${dstH}`);
        } catch (e) {
          log.warn(`[mr] ${name} sharp failed (${e.message}) — JS fallback`);
          _ddsJsFallback(ddsp, buf, actualW, actualH, dstW, dstH, name, resampleRaw);
        }
      } else {
        _ddsJsFallback(ddsp, buf, actualW, actualH, dstW, dstH, name, resampleRaw);
      }
    }

    // ── Fog of War ────────────────────────────────────────────────────────────
    let fogScaled = false;
    if (scaleFog) {
      let src = fs.readFileSync(dataLuaPath, 'utf8');
      let changed = false;
      src = src.replace(/(\bfogStart\s*=\s*)([\d.eE+\-]+)/g, (m, pre, val) => {
        changed = true;
        return `${pre}${parseFloat((parseFloat(val) * factor).toFixed(4))}`;
      });
      src = src.replace(/(\bfogEnd\s*=\s*)([\d.eE+\-]+)/g, (m, pre, val) => {
        changed = true;
        return `${pre}${parseFloat((parseFloat(val) * factor).toFixed(4))}`;
      });
      if (changed) { fs.writeFileSync(dataLuaPath, src, 'utf8'); fogScaled = true; }
      log.info(`[mr] data.lua fog scaled ×${factor}`);
    }

    // ── Water elevation ───────────────────────────────────────────────────────
    let waterScaled = false;
    {
      let src = fs.readFileSync(dataLuaPath, 'utf8');
      let changed = false;
      for (const key of ['elevation', 'elevationAbyss', 'elevationDeep']) {
        const re = new RegExp(`(\\b${key}\\s*=\\s*)([\\d.eE+\\-]+)`, 'g');
        src = src.replace(re, (m, pre, val) => {
          changed = true;
          return `${pre}${parseFloat((parseFloat(val) * factor).toFixed(4))}`;
        });
      }
      if (changed) { fs.writeFileSync(dataLuaPath, src, 'utf8'); waterScaled = true; }
      log.info(`[mr] data.lua water elevation scaled ×${factor}`);
    }

    log.info('[mr] Scale-scmap complete');
    return { success: true, propsScaled, decalsScaled, normalsScaled, texturesScaled, fogScaled, waterScaled };

  } catch (err) {
    log.error('[mr] scaleScmap failed:', err);
    return { success: false, error: err.message };
  }
}

// Hilfsfunktion: JS-Fallback für DDS-Resampling (kein sharp)
function _ddsJsFallback(ddsp, buf, actualW, actualH, dstW, dstH, name, resampleRaw) {
  try {
    const pixData = buf.slice(128);
    const totalPx = actualW * actualH;
    if (totalPx === 0) { log.warn(`[mr] ${name} zero pixels — skipping`); return; }
    const bpp = pixData.length / totalPx;
    const ch  = Math.round(bpp);
    if (ch < 1 || ch > 4 || Math.abs(bpp - ch) > 0.01) {
      log.warn(`[mr] ${name} block-compressed + no sharp — header-only patch (artefacts likely)`);
      const b2 = Buffer.from(buf);
      b2.writeUInt32LE(dstH, 12); b2.writeUInt32LE(dstW, 16);
      fs.writeFileSync(ddsp, b2);
    } else {
      const resampled = resampleRaw(pixData, actualW, actualH, dstW, dstH, ch, false);
      const newBuf    = Buffer.alloc(128 + resampled.length);
      buf.copy(newBuf, 0, 0, 128);
      newBuf.writeUInt32LE(dstH, 12); newBuf.writeUInt32LE(dstW, 16);
      resampled.copy(newBuf, 128);
      fs.writeFileSync(ddsp, newBuf);
      log.info(`[mr] ${name} JS-resampled: ${actualW}×${actualH} → ${dstW}×${dstH}`);
    }
  } catch (e) {
    log.warn(`[mr] ${name} JS resample failed (${e.message}) — skipping`);
  }
}

// ── scaleSaveLua ──────────────────────────────────────────────────────────────
async function scaleSaveLua({ mapFolder, factor, toSize, scaleMarkers, scaleAreas }) {
  try {
    const files    = fs.readdirSync(mapFolder);
    const saveName = files.find(f => f.toLowerCase().endsWith('_save.lua'));
    if (!saveName) throw new Error('_save.lua not found in map folder');

    const savePath = path.join(mapFolder, saveName);
    let   src      = fs.readFileSync(savePath, 'utf8');
    let   markersScaled = 0, areasScaled = 0, unitsScaled = 0;

    if (scaleMarkers) {
      src = src.replace(
        /\['position'\]\s*=\s*VECTOR3\(\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)\s*\)/g,
        (match, x, y, z) => {
          markersScaled++;
          const snapToHalf = v => Math.floor(v) + 0.5;
          const nx = snapToHalf(parseFloat(x) * factor);
          const ny = parseFloat(y) * factor;
          const nz = snapToHalf(parseFloat(z) * factor);
          return `['position'] = VECTOR3( ${nx.toFixed(5)}, ${ny.toFixed(5)}, ${nz.toFixed(5)} )`;
        }
      );

      src = src.replace(
        /(\bPosition\s*=\s*\{\s*)([\d.eE+\-]+)(\s*,\s*)([\d.eE+\-]+)(\s*,\s*)([\d.eE+\-]+)(\s*\})/g,
        (match, open, x, sep1, y, sep2, z, close) => {
          unitsScaled++;
          return `${open}${(parseFloat(x)*factor).toFixed(5)}${sep1}${(parseFloat(y)*factor).toFixed(5)}${sep2}${(parseFloat(z)*factor).toFixed(5)}${close}`;
        }
      );
    }

    if (scaleAreas) {
      src = src.replace(
        /RECTANGLE\(\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)\s*\)/g,
        (match, x1, y1, x2, y2) => {
          areasScaled++;
          return `RECTANGLE( ${(parseFloat(x1)*factor).toFixed(2)}, ${(parseFloat(y1)*factor).toFixed(2)}, ${(parseFloat(x2)*factor).toFixed(2)}, ${(parseFloat(y2)*factor).toFixed(2)} )`;
        }
      );
    }

    fs.writeFileSync(savePath, src, 'utf8');
    log.info(`[mr] save.lua scaled — markers: ${markersScaled}, areas: ${areasScaled}, units: ${unitsScaled}`);
    return { success: true, markersScaled, areasScaled, unitsScaled };

  } catch (err) {
    log.error('[mr] scaleSaveLua failed:', err);
    return { success: false, error: err.message };
  }
}

// ── updateScenarioLua ─────────────────────────────────────────────────────────
async function updateScenarioLua({ mapFolder, toSize, factor }) {
  try {
    const files        = fs.readdirSync(mapFolder);
    const scenarioName = files.find(f => f.toLowerCase().endsWith('_scenario.lua'));
    if (!scenarioName) throw new Error('_scenario.lua not found in map folder');

    const scenarioPath = path.join(mapFolder, scenarioName);
    let src = fs.readFileSync(scenarioPath, 'utf8');

    src = src.replace(
      /size\s*=\s*\{\s*\d+\s*,\s*\d+\s*\}/,
      `size = { ${toSize}, ${toSize} }`
    );
    src = src.replace(
      /norushradius\s*=\s*([\d.eE+\-]+)/g,
      (match, val) => `norushradius = ${Math.round(parseFloat(val) * factor * 100) / 100}`
    );

    fs.writeFileSync(scenarioPath, src, 'utf8');
    log.info(`[mr] scenario.lua updated — size: ${toSize}, factor: ${factor}`);
    return { success: true };

  } catch (err) {
    log.error('[mr] updateScenarioLua failed:', err);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC HANDLER REGISTRATION (nur im Electron-Kontext)
// ═══════════════════════════════════════════════════════════════════════════

function register() {
  if (!_ipcMain) return;

  _ipcMain.handle('mr-find-scmap', withPathGuard(
    ({ mapFolder }) => [mapFolder],
    async (event, { mapFolder }) => findScmap(mapFolder)
  ));

  _ipcMain.handle('mr-duplicate-map-version', withPathGuard(
    ({ mapFolder }) => [mapFolder],
    async (event, { mapFolder }) => duplicateMapVersion(mapFolder)
  ));

  _ipcMain.handle('mr-scale-scmap', withPathGuard(
    ({ unpackFolder }) => [unpackFolder],
    async (event, args) => scaleScmap(args)
  ));

  _ipcMain.handle('mr-scale-save-lua', withPathGuard(
    ({ mapFolder }) => [mapFolder],
    async (event, args) => scaleSaveLua(args)
  ));

  _ipcMain.handle('mr-update-scenario-lua', withPathGuard(
    ({ mapFolder }) => [mapFolder],
    async (event, args) => updateScenarioLua(args)
  ));

  if (_dialog) {
    _ipcMain.handle('settings-pick-file', async (event, { title, filters }) => {
      const result = await _dialog.showOpenDialog({
        title:      title || 'Select File',
        filters:    filters || [{ name: 'All Files', extensions: ['*'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths.length) return { success: false };
      return { success: true, path: result.filePaths[0] };
    });
  }
}

module.exports = {
  register,
  // Headless-API
  findScmap,
  duplicateMapVersion,
  scaleScmap,
  scaleSaveLua,
  updateScenarioLua,
};
