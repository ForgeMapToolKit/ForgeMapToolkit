'use strict';
/**
 * map-resizer.js — Map scaling, Lua patching, economy data IPC handlers.
 *
 * Covers: mr-find-scmap, mr-scale-scmap, mr-scale-save-lua,
 *         mr-update-scenario-lua, read-economy-data, settings-pick-file.
 *
 * Exports:
 *   register(deps) — registers all IPC handlers in this module
 */

const path  = require('path');
const fs    = require('fs');
const { ipcMain, dialog } = require('electron');
const JSZip = require('jszip');
const { log, yieldTick } = require('./logger');
const { readSettings, SCMAP_DIR } = require('./settings');
const scmapUtils = require('../../utils/scmap');
const { execFile, execFileSync } = require('child_process');
const os = require('os');
const { withPathGuard: _withPathGuardBase } = require('./security');

function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAP RESIZER — IPC HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

// ── mr-find-scmap ────────────────────────────────────────────────────────────
// Locates the .scmap file inside a versioned map folder.
// e.g.  C:\maps\helheim.v0002\  →  helheim.scmap  (any .scmap found inside)
ipcMain.handle('mr-find-scmap', withPathGuard(
  ({ mapFolder }) => [mapFolder],
  async (event, { mapFolder }) => {
  try {
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
  } catch (err) {
    log.error('[mr] mr-find-scmap failed:', err);
    return { success: false, error: err.message };
  }
}));

// ── mr-scale-scmap ───────────────────────────────────────────────────────────
// After scmap-unpack, reads the data.lua in the unpacked folder and rewrites:
//   - size header (width/height)
//   - prop positions (X/Z × factor)
//   - decal positions (X/Z × factor) and scale (X/Z × factor)
//   - all raw binary image files resampled to the new resolution:
//       heightmap, textureMaskLow, textureMaskHigh, normalMap,
//       waterMap, waterFoamMask, waterFlatness, waterDepthBiasMask, terrainType
//
// Bilinear resampling for float/short textures, nearest-neighbour for terrainType.
ipcMain.handle('mr-scale-scmap', withPathGuard(
  ({ unpackFolder }) => [unpackFolder],
  async (event, { unpackFolder, fromSize, toSize, factor, scaleProps, scaleDecals, scaleTextures, scaleSkybox, scaleFog }) => {
  try {
    log.info(`[mr] Scaling scmap data ×${factor} in ${unpackFolder}`);

    // ── 1. Update data.lua ────────────────────────────────────────────────────
    const dataLuaPath = path.join(unpackFolder, 'data.lua');
    if (!fs.existsSync(dataLuaPath)) throw new Error('data.lua not found in unpacked folder');

    const rawLua = fs.readFileSync(dataLuaPath, 'utf8');
    const data   = scmapUtils.parseLuaDataFile(rawLua);

    // Update size fields
    data.size = [toSize, toSize];

    let propsScaled  = 0;
    let decalsScaled = 0;

    // ── Helper: convert Lua-parsed 1-based object to plain JS array ──────────
    // exportScmapData writes props/decals as separate .lua files with 1-based
    // integer keys: { '1': {...}, '2': {...}, ... }. This converts them to [].
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

    // ── Helper: serialize JS array back to Lua return { ... } ────────────────
    function serializeLuaArray(arr) {
      return scmapUtils.luaSerialize(
        arr.reduce((obj, v, i) => { obj[i + 1] = v; return obj; }, {})
      );
    }

    // ── Props ─────────────────────────────────────────────────────────────────
    // exportScmapData splits props into props.lua / props1.lua / props2.lua …
    // and removes them from data.lua. We must patch every split file directly.
    // Lua 1-based position keys: { 1: X, 2: Y, 3: Z }
    //   X (key 1) × factor, Y (key 2) × factor (matches scaled heightmap), Z (key 3) × factor
    //   rotationX/Y/Z: unit direction vectors — leave untouched
    //   scale: prop's own mesh scale — leave untouched
    if (scaleProps) {
      const allFiles = fs.readdirSync(unpackFolder);
      const propsFiles = allFiles.filter(f => f === 'props.lua' || /^props\d+\.lua$/.test(f));

      if (propsFiles.length === 0) {
        // Fallback: props still embedded in data.lua
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
              p.position[1] = (p.position[1] || 0) * factor; // X
              p.position[2] = (p.position[2] || 0) * factor; // Y — matches scaled heightmap
              p.position[3] = (p.position[3] || 0) * factor; // Z
            }
            propsScaled++;
          }
          fs.writeFileSync(fpath, serializeLuaArray(arr), 'utf8');
          log.info(`[mr] ${fname}: ${arr.length} props scaled`);
        }
      }
    }

    // ── Prop script.lua coordinate patching ──────────────────────────────────
    // Some props are invisible marker props whose _prop.bp does nothing —
    // the real spawn coordinates are hardcoded inside a sibling _script.lua
    // via CreateUnitHPR / CreatePropHPR calls. Scaling props.lua positions
    // has no effect on these; we must patch the coordinates in the script itself.
    //
    // Strategy:
    //   1. Scan every entry in all props*.lua files.
    //   2. For entries whose path ends in _prop.bp, look for a sibling _script.lua
    //      at the same map-relative path (resolved via settings.mapsFolder).
    //   3. Regex-patch all CreateUnitHPR / CreatePropHPR X,Y,Z args × factor.
    //   4. Write the script back in place.
    //
    // This runs regardless of scaleProps because the script coordinate is
    // independent of the props.lua position field.
    {
      const settings   = readSettings();
      const mapsFolder = (settings.mapsFolder || '').replace(/\\/g, '/').replace(/\/$/, '');

      if (mapsFolder) {
        // Collect all props entries across all split files
        const allPropFiles = fs.readdirSync(unpackFolder)
          .filter(f => f === 'props.lua' || /^props\d+\.lua$/.test(f));

        const scriptsPatched = [];
        const scriptsSeen    = new Set(); // avoid double-patching if path appears twice

        for (const fname of allPropFiles) {
          const fpath  = path.join(unpackFolder, fname);
          const parsed = scmapUtils.parseLuaDataFile(fs.readFileSync(fpath, 'utf8'));
          const arr    = luaObjToArray(parsed);

          for (const p of arr) {
            const propPath = p.path || '';
            // Only entries whose filename ends in _prop.bp
            if (!/\_prop\.bp$/i.test(propPath)) continue;

            // Derive the sibling _script.lua path
            // propPath: /maps/helheim.v0002/env/.../uel0103_01_prop.bp
            //   →  /maps/helheim.v0002/env/.../uel0103_01_script.lua
            const scriptMapPath = propPath.replace(/_prop\.bp$/i, '_script.lua');

            // Resolve to absolute filesystem path:
            //   strip leading /maps/ and prepend mapsFolder
            const rel         = scriptMapPath.replace(/^\/maps\//i, '');
            const absScript   = path.join(mapsFolder, rel);

            if (scriptsSeen.has(absScript)) continue;
            scriptsSeen.add(absScript);

            if (!fs.existsSync(absScript)) continue;

            let src = fs.readFileSync(absScript, 'utf8');
            let changed = false;

            // Patch CreateUnitHPR('id', 'army', X, Y, Z, rX, rY, rZ)
            src = src.replace(
              /(CreateUnitHPR\s*\([^,]+,[^,]+,\s*)([\d.eE+\-]+)(\s*,\s*)([\d.eE+\-]+)(\s*,\s*)([\d.eE+\-]+)/g,
              (m, pre, x, s1, y, s2, z) => {
                changed = true;
                return `${pre}${(parseFloat(x) * factor).toFixed(5)}${s1}${(parseFloat(y) * factor).toFixed(5)}${s2}${(parseFloat(z) * factor).toFixed(5)}`;
              }
            );

            // Patch CreatePropHPR('bp', X, Y, Z, rX, rY, rZ)
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
          log.info(`[mr] ${scriptsPatched.length} _script.lua file(s) coordinate-patched: ${scriptsPatched.join(', ')}`);
        }
      } else {
        log.warn('[mr] mapsFolder not set in settings — skipping _script.lua coordinate patching');
      }
    }

    // ── Decals ────────────────────────────────────────────────────────────────
    // Same split-file pattern: decals.lua / decals1.lua / decals2.lua …
    // Lua 1-based keys: position { 1:X, 2:Y, 3:Z }, scale { 1:X, 2:Y, 3:Z }
    //   position X/Y/Z × factor
    //   scale[1] (footprint width) × factor, scale[3] (footprint depth) × factor
    //   scale[2] (vertical projection depth) — NOT scaled
    //   rotation (Y-axis radians) — NOT scaled
    if (scaleDecals) {
      const allFiles2  = fs.readdirSync(unpackFolder);
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
              // d.scale[2] untouched — vertical projection depth
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
              // d.scale[2] untouched
              d.scale[3] = (d.scale[3] || 0) * factor;
            }
            decalsScaled++;
          }
          fs.writeFileSync(fpath, serializeLuaArray(arr), 'utf8');
          log.info(`[mr] ${fname}: ${arr.length} decals scaled`);
        }
      }
    }

    // ── Textures / Normals scale ──────────────────────────────────────────────
    // data.lua contains two arrays that hold terrain layer texture tile sizes:
    //   normals  = { { path = "...", scale = N }, ... }
    //   textures = { { path = "...", scale = N }, ... }
    // Both scale values represent tile size in world units and must grow/shrink
    // proportionally with the map so the visual density stays the same.
    // Scale = 0 entries are special (no tiling / disabled) — leave them untouched.
    let texturesScaled = 0;
    let normalsScaled  = 0;
    if (scaleTextures) {
      // Helper: scale all "scale = N" entries inside a named block, skipping 0.
      // Works directly on the raw Lua string to avoid round-trip serialisation loss.
      const scaleBlock = (src, blockName) => {
        // Match the block: blockName = { ... } (non-greedy, stops at closing brace
        // followed by a comma or newline at the same indent level).
        const blockRe = new RegExp(`(${blockName}\\s*=\\s*\\{)([\\s\\S]*?)(\\n    \\})`, 'g');
        return src.replace(blockRe, (full, open, inner, close) => {
          const scaled = inner.replace(
            /(\bscale\s*=\s*)([\d.eE+\-]+)/g,
            (m, prefix, val) => {
              const n = parseFloat(val);
              if (isNaN(n) || n === 0) return m; // leave scale=0 untouched
              if (blockName === 'normals') normalsScaled++;
              else texturesScaled++;
              return `${prefix}${parseFloat((n * factor).toPrecision(7))}`;
            }
          );
          return open + scaled + close;
        });
      };

      // We must operate on the final serialised string, not the parsed object,
      // because luaSerialize may not preserve floating-point precision of the
      // original values. Write the serialised base first, then patch it.
      const baseLua = scmapUtils.luaSerialize(data);
      const patched = scaleBlock(scaleBlock(baseLua, 'normals'), 'textures');
      fs.writeFileSync(dataLuaPath, patched, 'utf8');
      log.info(`[mr] data.lua textures/normals scaled — normals: ${normalsScaled}, textures: ${texturesScaled}`);

    } else {
      // No texture scaling — just write the serialised base
      const newLua = scmapUtils.luaSerialize(data);
      fs.writeFileSync(dataLuaPath, newLua, 'utf8');
    }

    // ── Skybox scaling ────────────────────────────────────────────────────────
    // Mirrors UpdateSize() in SkyboxData.cs exactly:
    //   Position = WorldPosToScmap(MapCenterPoint)
    //     MapCenterPoint.x = mapWidth  / 20   (Unity world units)
    //     MapCenterPoint.z = -mapHeight / 20
    //     WorldPosToScmap: x *= 10, z *= -10  →  x = mapWidth/2, z = mapHeight/2
    //   Scale = max(Width, Height) * 2.288245
    //
    // These values live in the BINARY .scmap (skyBox block), not only in data.lua.
    // writeDatastream() reads data.lua's skyBox object and writes it as binary,
    // so we patch the parsed `data` object here — before either serialization path
    // has written it — so both the binary and the Lua mirror are always consistent.
    //
    // horizonHeight / zenithHeight / cirrusLayers are also stored in the binary
    // skyBox block and must be scaled the same way.
    if (scaleSkybox && data.skyBox) {
      const sb = data.skyBox;

      // Position: always set to exact map center regardless of old value
      sb.position = [toSize / 2, 0, toSize / 2];

      // Scale: dome radius, matches editor formula (2.288245 not 2.288)
      sb.scale = toSize * 2.288245;

      // horizonHeight / zenithHeight: multiply by scale factor
      if (sb.horizonHeight != null) sb.horizonHeight = parseFloat((sb.horizonHeight * factor).toFixed(4));
      if (sb.zenithHeight  != null) sb.zenithHeight  = parseFloat((sb.zenithHeight  * factor).toFixed(4));

      // cirrusLayers: frequency ÷ factor (tiles less → appears larger), speed × factor
      if (Array.isArray(sb.cirrusLayers)) {
        for (const cl of sb.cirrusLayers) {
          if (cl.frequency) {
            cl.frequency[0] = parseFloat((cl.frequency[0] / factor).toPrecision(5));
            cl.frequency[1] = parseFloat((cl.frequency[1] / factor).toPrecision(5));
          }
          if (cl.speed != null) cl.speed = parseFloat((cl.speed * factor).toPrecision(5));
        }
      } else if (sb.cirrusLayers && typeof sb.cirrusLayers === 'object') {
        // Lua 1-based object form
        for (const k of Object.keys(sb.cirrusLayers)) {
          const cl = sb.cirrusLayers[k];
          if (cl && cl.frequency) {
            cl.frequency[1] = parseFloat((cl.frequency[1] / factor).toPrecision(5));
            cl.frequency[2] = parseFloat((cl.frequency[2] / factor).toPrecision(5));
          }
          if (cl && cl.speed != null) cl.speed = parseFloat((cl.speed * factor).toPrecision(5));
        }
      }

      // BUG FIX: Do NOT re-serialize the whole data object here — that would overwrite
      // the texture scale patches applied by scaleTextures above (which work on the raw
      // string so that floating-point precision of original values is preserved).
      //
      // Instead, patch the skyBox fields directly in the already-written file string,
      // exactly the same way fogStart/fogEnd are patched below. This keeps the texture
      // scale values intact regardless of which combination of options is active.
      {
        let src = fs.readFileSync(dataLuaPath, 'utf8');

        // patch position = { X, 0, Z }  — the skyBox top-level position sits AFTER the
        // planets array inside the skyBox block. Using a greedy match on the full skyBox
        // block and replacing the LAST position occurrence avoids hitting planets[0].position.
        src = src.replace(
          /(skyBox\s*=\s*\{[\s\S]*)\bposition\s*=\s*\{[^}]*\}([\s\S]*?\n\s*\},?\s*\n\s*skyCubePath)/,
          (m, before, after) => `${before}position = { ${toSize / 2}, 0, ${toSize / 2} }${after}`
        );

        // patch scale = N  (dome scale) — skyBox.scale is the LAST top-level scale entry
        // in the skyBox block (planets each have their own scale sub-table). Match the
        // bare "scale = <number>" that is NOT followed by a brace (i.e. not a table).
        // We extract the skyBox block first to avoid touching anything outside it.
        src = src.replace(
          /(skyBox\s*=\s*\{[\s\S]*?\n)([ \t]*scale\s*=\s*)([\d.eE+\-]+)(\s*,?\s*\n[\s\S]*?skyCubePath)/,
          (m, before, pre, _old, after) => `${before}${pre}${parseFloat((toSize * 2.288245).toFixed(4))}${after}`
        );

        // patch horizonHeight = N
        if (sb.horizonHeight != null) {
          src = src.replace(
            /(\bhorizonHeight\s*=\s*)([\d.eE+\-]+)/g,
            (m, pre, val) => `${pre}${parseFloat((parseFloat(val) * factor).toFixed(4))}`
          );
        }

        // patch zenithHeight = N
        if (sb.zenithHeight != null) {
          src = src.replace(
            /(\bzenithHeight\s*=\s*)([\d.eE+\-]+)/g,
            (m, pre, val) => `${pre}${parseFloat((parseFloat(val) * factor).toFixed(4))}`
          );
        }

        // patch cirrusLayers frequency and speed values
        // frequency = { X, Y } — divide by factor
        src = src.replace(
          /(\bfrequency\s*=\s*\{)\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)\s*(\})/g,
          (m, open, f0, f1, close) =>
            `${open} ${parseFloat((parseFloat(f0) / factor).toPrecision(5))}, ${parseFloat((parseFloat(f1) / factor).toPrecision(5))} ${close}`
        );
        // speed = N — multiply by factor
        src = src.replace(
          /(\bspeed\s*=\s*)([\d.eE+\-]+)/g,
          (m, pre, val) => `${pre}${parseFloat((parseFloat(val) * factor).toPrecision(5))}`
        );

        fs.writeFileSync(dataLuaPath, src, 'utf8');
      }

      log.info(`[mr] skyBox updated — position=[${sb.position}], scale=${sb.scale.toFixed(3)}, horizonHeight=${sb.horizonHeight}, zenithHeight=${sb.zenithHeight}, cirrus ×${factor}`);
    }
    log.info(`[mr] data.lua updated — props: ${propsScaled}, decals: ${decalsScaled}, normals: ${normalsScaled}, textures: ${texturesScaled}`);

    // ── 2. Resample binary image files ────────────────────────────────────────
    //
    // The scmap parser exports each image as a raw file in the unpacked folder.
    // We read each file, resample it to the new dimensions, and overwrite.
    //
    // File → dimensions:
    //   heightmap.raw     : (fromSize+1)×(fromSize+1), uint16 LE per pixel
    //   textureMaskLow.dds: fromSize×fromSize, DDS (skip — FA regenerates from data)
    //   textureMaskHigh.dds
    //   normalMap.dds
    //   waterMap.dds
    //   waterFoamMask.raw : (fromSize/2)×(fromSize/2), uint8
    //   waterFlatness.raw : (fromSize/2)×(fromSize/2), uint8
    //   waterDepthBias.raw: (fromSize/2)×(fromSize/2), uint8
    //   terrainType.raw   : fromSize×fromSize, uint8 — nearest neighbour
    //
    // DDS files: we use the raw pixel bytes embedded by the scmap exporter.
    // For simplicity we bilinear-resample the raw DDS data blocks in-place.
    // The DDS header dimensions need to be patched as well.
    //
    // NOTE: sharp is optional. If not available we fall back to nearest-neighbour
    // using a pure-JS resampler for all files.

    const resampleRaw = (buf, srcW, srcH, dstW, dstH, bytesPerPixel, nearest) => {
      const dst = Buffer.allocUnsafe(dstW * dstH * bytesPerPixel);
      for (let dy = 0; dy < dstH; dy++) {
        for (let dx = 0; dx < dstW; dx++) {
          // Use (dstW-1)/(srcW-1) mapping so edges map exactly to edges
          const sx = dstW > 1 ? (dx / (dstW - 1)) * (srcW - 1) : 0;
          const sy = dstH > 1 ? (dy / (dstH - 1)) * (srcH - 1) : 0;

          const dstOff = (dy * dstW + dx) * bytesPerPixel;

          if (nearest) {
            // Nearest neighbour — preserves hard category boundaries (terrainType)
            const px = Math.min(Math.round(sx), srcW - 1);
            const py = Math.min(Math.round(sy), srcH - 1);
            const srcOff = (py * srcW + px) * bytesPerPixel;
            buf.copy(dst, dstOff, srcOff, srcOff + bytesPerPixel);
          } else if (bytesPerPixel === 2) {
            // Bilinear uint16 LE — read/write as 16-bit values, not raw bytes
            const x0 = Math.min(Math.floor(sx), srcW - 1);
            const y0 = Math.min(Math.floor(sy), srcH - 1);
            const x1 = Math.min(x0 + 1, srcW - 1);
            const y1 = Math.min(y0 + 1, srcH - 1);
            const fx = sx - x0;
            const fy = sy - y0;
            const tl = buf.readUInt16LE((y0 * srcW + x0) * 2);
            const tr = buf.readUInt16LE((y0 * srcW + x1) * 2);
            const bl = buf.readUInt16LE((y1 * srcW + x0) * 2);
            const br = buf.readUInt16LE((y1 * srcW + x1) * 2);
            const v  = tl * (1-fx)*(1-fy) + tr * fx*(1-fy) + bl * (1-fx)*fy + br * fx*fy;
            dst.writeUInt16LE(Math.round(v), dstOff);
          } else {
            // Bilinear uint8 (multi-channel)
            const x0 = Math.min(Math.floor(sx), srcW - 1);
            const y0 = Math.min(Math.floor(sy), srcH - 1);
            const x1 = Math.min(x0 + 1, srcW - 1);
            const y1 = Math.min(y0 + 1, srcH - 1);
            const fx = sx - x0;
            const fy = sy - y0;

            for (let c = 0; c < bytesPerPixel; c++) {
              const tl = buf[(y0 * srcW + x0) * bytesPerPixel + c];
              const tr = buf[(y0 * srcW + x1) * bytesPerPixel + c];
              const bl = buf[(y1 * srcW + x0) * bytesPerPixel + c];
              const br = buf[(y1 * srcW + x1) * bytesPerPixel + c];
              const v  = tl * (1-fx)*(1-fy) + tr * fx*(1-fy) + bl * (1-fx)*fy + br * fx*fy;
              dst[dstOff + c] = Math.round(v);
            }
          }
        }
      }
      return dst;
    };

    // ── heightmap.raw ──────────────────────────────────────────────────────────
    // Step 1: Spatial resample to new resolution (bilinear).
    // Step 2 (Option A): Scale every pixel value × factor so slopes stay identical.
    //   Without this, doubling the map doubles horizontal distances but keeps the
    //   same height values → all slopes are halved. Clamp to uint16 max (65535).
    const hmPath = path.join(unpackFolder, 'heightmap.raw');
    if (fs.existsSync(hmPath)) {
      const hmBuf = fs.readFileSync(hmPath);
      const srcHM = fromSize + 1;
      const dstHM = toSize  + 1;

      const resampled = resampleRaw(hmBuf, srcHM, srcHM, dstHM, dstHM, 2, false);

      if (factor !== 1) {
        let clipped = 0;
        const pixelCount = dstHM * dstHM;
        for (let i = 0; i < pixelCount; i++) {
          const off    = i * 2;
          const scaled = resampled.readUInt16LE(off) * factor;
          if (scaled > 65535) clipped++;
          resampled.writeUInt16LE(Math.min(65535, Math.round(scaled)), off);
        }
        if (clipped > 0) {
          log.warn(`[mr] heightmap: ${clipped} pixel(s) clamped to 65535 — very tall cliffs may be slightly flattened at their peaks`);
        } else {
          log.info(`[mr] heightmap height values scaled x${factor} — no clipping`);
        }
      }

      fs.writeFileSync(hmPath, resampled);
      log.info(`[mr] heightmap resampled: ${srcHM}x${srcHM} -> ${dstHM}x${dstHM}`);
    } else {
      log.warn('[mr] heightmap.raw not found — skipping');
    }

    // ── Raw uint8 masks at fromSize/2 ─────────────────────────────────────────
    const halfSrc = fromSize / 2;
    const halfDst = toSize  / 2;
for (const name of ['waterFoamMask.raw', 'waterFlatness.raw', 'waterDepthBiasMask.raw']) {
      const p = path.join(unpackFolder, name);
      if (!fs.existsSync(p)) { log.warn(`[mr] ${name} not found — skipping`); continue; }
      const buf   = fs.readFileSync(p);
      const res   = resampleRaw(buf, halfSrc, halfSrc, halfDst, halfDst, 1, false);
      fs.writeFileSync(p, res);
      log.info(`[mr] ${name} resampled: ${halfSrc}² → ${halfDst}²`);
    }

    // ── terrainType.raw — nearest neighbour ───────────────────────────────────
    const ttPath = path.join(unpackFolder, 'terrainType.raw');
    if (fs.existsSync(ttPath)) {
      const buf = fs.readFileSync(ttPath);
      // terrainType is fromSize×fromSize uint8
      const res = resampleRaw(buf, fromSize, fromSize, toSize, toSize, 1, true);
      fs.writeFileSync(ttPath, res);
      log.info(`[mr] terrainType.raw resampled: ${fromSize}² → ${toSize}²`);
    }

    // ── DDS files — resize pixel data + patch header ────────────────────────
    //
    // FA texture masks are often DXT1 (0.5 bytes/px) or DXT5 (1 byte/px) block-
    // compressed. The old code detected this as "unusual bytes/px" and fell back
    // to header-only patching, which caused the visible tile/grid artefacts:
    // FA received a header saying e.g. 512×512 but pixel data was still 256×256,
    // so it tiled the old data across the new resolution in coarse blocks.
    //
    // Fix: let sharp decode the full DDS file (it handles DXT via libvips).
    // Sharp can read a DDS file directly as input — no need to strip the header
    // manually. We then resize with lanczos3 and write the raw RGBA output back
    // with a minimal uncompressed DDS header (format: A8R8G8B8 / RGBA8).
    //
    // Why uncompressed output is fine:
    //   FA reads textureMask as a lookup table, not a visual texture — compression
    //   artefacts in DXT would actually be worse than clean uncompressed RGBA.
    //   File size increase is acceptable (masks are small: 512² × 4 = 1 MB).
    //
    // Fallback when sharp is unavailable: pure-JS bilinear resampler on the raw
    // pixel bytes. For uncompressed DDS (bytes/px is a clean integer) this works
    // perfectly. For block-compressed DDS it will still produce tile artefacts —
    // install sharp to avoid them.

    const ddsFiles = [
      { name: 'textureMaskLow.dds',  srcW: fromSize,   srcH: fromSize,   dstW: toSize,   dstH: toSize   },
      { name: 'textureMaskHigh.dds', srcW: fromSize,   srcH: fromSize,   dstW: toSize,   dstH: toSize   },
      { name: 'normalMap.dds',       srcW: fromSize/2, srcH: fromSize/2, dstW: toSize/2, dstH: toSize/2 },
      { name: 'waterMap.dds',        srcW: fromSize/2, srcH: fromSize/2, dstW: toSize/2, dstH: toSize/2 },
    ];

    // Minimal uncompressed RGBA DDS header builder (128 bytes).
    // Format: DXT none, DDPF_RGBA, A8R8G8B8.
    function buildUncompressedDDSHeader(w, h) {
      const hdr = Buffer.alloc(128, 0);
      hdr.write('DDS ', 0, 'ascii');                   // magic
      hdr.writeUInt32LE(124,       4);                 // dwSize
      hdr.writeUInt32LE(0x1 | 0x2 | 0x4 | 0x1000, 8); // dwFlags: CAPS|HEIGHT|WIDTH|PIXELFORMAT
      hdr.writeUInt32LE(h,         12);                // dwHeight
      hdr.writeUInt32LE(w,         16);                // dwWidth
      hdr.writeUInt32LE(w * 4,     20);                // dwPitchOrLinearSize
      hdr.writeUInt32LE(0,         24);                // dwDepth
      hdr.writeUInt32LE(0,         28);                // dwMipMapCount
      // pixel format at offset 76
      hdr.writeUInt32LE(32,        76);                // ddspf.dwSize
      hdr.writeUInt32LE(0x41,      80);                // ddspf.dwFlags: DDPF_ALPHAPIXELS|DDPF_RGB
      hdr.writeUInt32LE(0,         84);                // ddspf.dwFourCC (none = uncompressed)
      hdr.writeUInt32LE(32,        88);                // ddspf.dwRGBBitCount
      hdr.writeUInt32LE(0x00ff0000, 92);               // dwRBitMask
      hdr.writeUInt32LE(0x0000ff00, 96);               // dwGBitMask
      hdr.writeUInt32LE(0x000000ff, 100);              // dwBBitMask
      hdr.writeUInt32LE(0xff000000, 104);              // dwABitMask
      hdr.writeUInt32LE(0x1000,    108);               // dwCaps: DDSCAPS_TEXTURE
      return hdr;
    }

    let sharp;
    let sharpAvailable = false;
    try {
      sharp = require('sharp');
      sharpAvailable = true;
    } catch (_) {
      log.warn('[mr] sharp not available — compressed DDS textures may show tile artefacts. Install sharp for clean results.');
    }

    for (const { name, srcW, srcH, dstW, dstH } of ddsFiles) {
      const ddsp = path.join(unpackFolder, name);
      if (!fs.existsSync(ddsp)) { log.debug(`[mr] ${name} not found — skipping`); continue; }

      const buf = fs.readFileSync(ddsp);
      if (buf.length < 128) {
        log.warn(`[mr] ${name} too small to be a valid DDS (${buf.length} bytes) — skipping`);
        continue;
      }

      const actualH = buf.readUInt32LE(12);
      const actualW = buf.readUInt32LE(16);

      if (sharpAvailable) {
        // ── Sharp path: decode full DDS (handles DXT1/DXT5/uncompressed), resize,
        //    write back as uncompressed RGBA DDS. ────────────────────────────────
        try {
          const rawPixels = await sharp(buf)   // sharp reads DDS natively via libvips
            .resize(dstW, dstH, { kernel: 'lanczos3' })
            .raw()
            .toBuffer({ resolveWithObject: true });

          const { data, info } = rawPixels;
          const channels = info.channels;        // 1, 3, or 4
          let outData = data;

          // Normalise to 4 channels (RGBA) for the uncompressed DDS header
          if (channels !== 4) {
            outData = Buffer.alloc(dstW * dstH * 4);
            for (let i = 0; i < dstW * dstH; i++) {
              const s = i * channels;
              const d = i * 4;
              outData[d]   = data[s];                          // R
              outData[d+1] = channels >= 2 ? data[s+1] : data[s]; // G
              outData[d+2] = channels >= 3 ? data[s+2] : data[s]; // B
              outData[d+3] = channels === 4 ? data[s+3] : 255;    // A
            }
          }

          const hdr    = buildUncompressedDDSHeader(dstW, dstH);
          const newBuf = Buffer.concat([hdr, outData]);
          fs.writeFileSync(ddsp, newBuf);
          log.info(`[mr] ${name} resampled via sharp (DDS decode): ${actualW}x${actualH} -> ${dstW}x${dstH} (${channels}ch -> RGBA)`);
        } catch (e) {
          // sharp failed (e.g. exotic DDS variant) — fall back to pure-JS resample
          log.warn(`[mr] ${name} sharp DDS decode failed (${e.message}) — falling back to JS resampler`);
          try {
            const pixData    = buf.slice(128);
            const totalPx    = actualW * actualH;
            if (totalPx === 0) { log.warn(`[mr] ${name} zero pixels — skipping`); continue; }
            const bpp        = pixData.length / totalPx;
            const ch         = Math.round(bpp);
            if (ch < 1 || ch > 4 || Math.abs(bpp - ch) > 0.01) {
              // Block-compressed — only patch header (artefacts will appear)
              log.warn(`[mr] ${name} block-compressed DDS, cannot JS-resample — header-only patch (artefacts likely)`);
              const b2 = Buffer.from(buf); b2.writeUInt32LE(dstH, 12); b2.writeUInt32LE(dstW, 16);
              fs.writeFileSync(ddsp, b2);
            } else {
              const resampled = resampleRaw(pixData, actualW, actualH, dstW, dstH, ch, false);
              const newBuf    = Buffer.alloc(128 + resampled.length);
              buf.copy(newBuf, 0, 0, 128);
              newBuf.writeUInt32LE(dstH, 12); newBuf.writeUInt32LE(dstW, 16);
              resampled.copy(newBuf, 128);
              fs.writeFileSync(ddsp, newBuf);
              log.info(`[mr] ${name} JS-resampled (fallback): ${actualW}x${actualH} -> ${dstW}x${dstH}`);
            }
          } catch (e2) {
            log.warn(`[mr] ${name} all resize attempts failed (${e2.message}) — skipping`);
          }
        }
      } else {
        // ── No sharp: pure-JS bilinear resampler ─────────────────────────────────
        // Works cleanly for uncompressed DDS. Block-compressed DDS will have artefacts.
        try {
          const pixData = buf.slice(128);
          const totalPx = actualW * actualH;
          if (totalPx === 0) { log.warn(`[mr] ${name} zero pixels — skipping`); continue; }
          const bpp  = pixData.length / totalPx;
          const ch   = Math.round(bpp);
          if (ch < 1 || ch > 4 || Math.abs(bpp - ch) > 0.01) {
            log.warn(`[mr] ${name} block-compressed DDS + no sharp — header-only patch (tile artefacts expected; install sharp to fix)`);
            const b2 = Buffer.from(buf); b2.writeUInt32LE(dstH, 12); b2.writeUInt32LE(dstW, 16);
            fs.writeFileSync(ddsp, b2);
          } else {
            const resampled = resampleRaw(pixData, actualW, actualH, dstW, dstH, ch, false);
            const newBuf    = Buffer.alloc(128 + resampled.length);
            buf.copy(newBuf, 0, 0, 128);
            newBuf.writeUInt32LE(dstH, 12); newBuf.writeUInt32LE(dstW, 16);
            resampled.copy(newBuf, 128);
            fs.writeFileSync(ddsp, newBuf);
            log.info(`[mr] ${name} JS-resampled (no sharp): ${actualW}x${actualH} -> ${dstW}x${dstH} (${ch}ch)`);
          }
        } catch (e) {
          log.warn(`[mr] ${name} JS resample failed (${e.message}) — skipping`);
        }
      }
    }

    log.info(`[mr] Scale-scmap complete`);
    // ── Fog of War scaling ────────────────────────────────────────────────────
    // fogStart and fogEnd are top-level fields in data.lua (same level as skyBox).
    // They define world-unit distances at which the fog of war gradient begins and
    // ends. Both scale linearly with map size so visibility range stays proportional.
    // fogStart = 0 stays 0 (scaling 0 × anything is 0, so it's a no-op, but we
    // write it explicitly for clarity).
    let fogScaled = false;
    if (scaleFog) {
      let src = fs.readFileSync(dataLuaPath, 'utf8');
      let changed = false;

      src = src.replace(/(\bfogStart\s*=\s*)([\d.eE+\-]+)/g, (m, pre, val) => {
        changed = true;
        const scaled = parseFloat((parseFloat(val) * factor).toFixed(4));
        return `${pre}${scaled}`;
      });
      src = src.replace(/(\bfogEnd\s*=\s*)([\d.eE+\-]+)/g, (m, pre, val) => {
        changed = true;
        const scaled = parseFloat((parseFloat(val) * factor).toFixed(4));
        return `${pre}${scaled}`;
      });

      if (changed) {
        fs.writeFileSync(dataLuaPath, src, 'utf8');
        fogScaled = true;
        log.info(`[mr] data.lua fog scaled ×${factor}`);
      }
    }

    // ── Water elevation scaling ───────────────────────────────────────────────
    // elevation, elevationAbyss, elevationDeep in waterSettings scale with the
    // heightmap — because we multiply all heightmap pixel values by factor,
    // water levels must also scale by factor.
    let waterScaled = false;
    {
      let src = fs.readFileSync(dataLuaPath, 'utf8');
      let changed = false;

      ['elevation', 'elevationAbyss', 'elevationDeep'].forEach(key => {
        const re = new RegExp(`(\\b${key}\\s*=\\s*)([\\d.eE+\\-]+)`, 'g');
        src = src.replace(re, (m, pre, val) => {
          changed = true;
          const scaled = parseFloat((parseFloat(val) * factor).toFixed(4));
          return `${pre}${scaled}`;
        });
      });

      if (changed) {
        fs.writeFileSync(dataLuaPath, src, 'utf8');
        waterScaled = true;
        log.info(`[mr] data.lua water elevation scaled ×${factor}`);
      }
    }

    return { success: true, propsScaled, decalsScaled, normalsScaled, texturesScaled, fogScaled, waterScaled };

    
  } catch (err) {
    log.error('[mr] mr-scale-scmap failed:', err);
    return { success: false, error: err.message };
  }
}));

// ── mr-scale-save-lua ────────────────────────────────────────────────────────
// Reads the map's _save.lua, multiplies all marker X/Z positions and area
// rectangle coordinates by the scale factor, writes the file back in place.
ipcMain.handle('mr-scale-save-lua', withPathGuard(
  ({ mapFolder }) => [mapFolder],
  async (event, { mapFolder, factor, toSize, scaleMarkers, scaleAreas }) => {
  try {
    const files    = fs.readdirSync(mapFolder);
    const saveName = files.find(f => f.toLowerCase().endsWith('_save.lua'));
    if (!saveName) throw new Error('_save.lua not found in map folder');

    const savePath = path.join(mapFolder, saveName);
    let   src      = fs.readFileSync(savePath, 'utf8');

    let markersScaled = 0;
    let areasScaled   = 0;

    // ── Scale VECTOR3 positions inside markers ────────────────────────────────
    // Format in save.lua: ['position'] = VECTOR3( X, Y, Z ),
    // X and Z are map-space coordinates that scale with the map size.
    // Y is an absolute world height matching the heightmap. Because we multiply
    // all heightmap pixel values by factor (Option A), Y must also scale by factor —
    // otherwise every marker ends up buried under the raised terrain.
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
    }

    // ── Scale RECTANGLE areas ─────────────────────────────────────────────────
    // Format: RECTANGLE( x1, y1, x2, y2 )
    // All four values are map-space coordinates → scale all by factor.
    if (scaleAreas) {
      src = src.replace(
        /RECTANGLE\(\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)\s*,\s*([\d.eE+\-]+)\s*\)/g,
        (match, x1, y1, x2, y2) => {
          areasScaled++;
          return `RECTANGLE( ${(parseFloat(x1)*factor).toFixed(2)}, ${(parseFloat(y1)*factor).toFixed(2)}, ${(parseFloat(x2)*factor).toFixed(2)}, ${(parseFloat(y2)*factor).toFixed(2)} )`;
        }
      );
    }
    
// ── Scale Unit Positions ──────────────────────────────────────────────────
    // Units use:  Position = { X, Y, Z },  (flat table, NOT VECTOR3)
    let unitsScaled = 0;
    if (scaleMarkers) {
      src = src.replace(
        /(\bPosition\s*=\s*\{\s*)([\d.eE+\-]+)(\s*,\s*)([\d.eE+\-]+)(\s*,\s*)([\d.eE+\-]+)(\s*\})/g,
        (match, open, x, sep1, y, sep2, z, close) => {
          unitsScaled++;
          const nx = parseFloat(x) * factor;
          const ny = parseFloat(y) * factor;
          const nz = parseFloat(z) * factor;
          return `${open}${nx.toFixed(5)}${sep1}${ny.toFixed(5)}${sep2}${nz.toFixed(5)}${close}`;
        }
      );
    }

    fs.writeFileSync(savePath, src, 'utf8');
    log.info(`[mr] save.lua scaled — markers: ${markersScaled}, areas: ${areasScaled}, units: ${unitsScaled}`);
    return { success: true, markersScaled, areasScaled, unitsScaled };

  } catch (err) {
    log.error('[mr] mr-scale-save-lua failed:', err);
    return { success: false, error: err.message };
  }
}));

// ── mr-update-scenario-lua ───────────────────────────────────────────────────
// Updates the map's _scenario.lua: sets size = { toSize, toSize }
// and scales all norushradius values by the factor.
ipcMain.handle('mr-update-scenario-lua', withPathGuard(
  ({ mapFolder }) => [mapFolder],
  async (event, { mapFolder, toSize, factor }) => {
  try {
    const files        = fs.readdirSync(mapFolder);
    const scenarioName = files.find(f => f.toLowerCase().endsWith('_scenario.lua'));
    if (!scenarioName) throw new Error('_scenario.lua not found in map folder');

    const scenarioPath = path.join(mapFolder, scenarioName);
    let src = fs.readFileSync(scenarioPath, 'utf8');

    // 1. Update size = { N, N }
    src = src.replace(
      /size\s*=\s*\{\s*\d+\s*,\s*\d+\s*\}/,
      `size = { ${toSize}, ${toSize} }`
    );

    // 2. Scale all norushradius values
    src = src.replace(
      /norushradius\s*=\s*([\d.eE+\-]+)/g,
      (match, val) => {
        const scaled = Math.round(parseFloat(val) * factor * 100) / 100;
        return `norushradius = ${scaled}`;
      }
    );

    fs.writeFileSync(scenarioPath, src, 'utf8');
    log.info(`[mr] scenario.lua updated — size: ${toSize}, factor: ${factor}`);
    return { success: true };

  } catch (err) {
    log.error('[mr] mr-update-scenario-lua failed:', err);
    return { success: false, error: err.message };
  }
}));

// ── read-economy-data session cache (cleared on app restart) ─────────────────
const _econDataCache = new Map(); // key: mapFolderPath → cached result

// ── read-economy-data ─────────────────────────────────────────────────────────
// MEX:     _save.lua -> markers with type = 'Mass'
// Reclaim: unpacks .scmap -> props.lua -> reads .bp (loose OR inside .scd zips)
//          -> Economy.ReclaimMassMax
ipcMain.handle('read-economy-data', withPathGuard(
  ({ mapFolderPath }) => [mapFolderPath],
  async (event, { mapFolderPath }) => {
  try {
    log.info('[economy] read-economy-data for:', mapFolderPath);

    if (!fs.existsSync(mapFolderPath)) {
      return { success: false, error: 'Map folder not found: ' + mapFolderPath };
    }

    // ── Session cache hit? ────────────────────────────────────────────────────
    if (_econDataCache.has(mapFolderPath)) {
      log.debug('[economy] returning cached result for:', mapFolderPath);
      return _econDataCache.get(mapFolderPath);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    const findInDir = (dir, pred) => {
      if (!fs.existsSync(dir)) return null;
      const hit = fs.readdirSync(dir).find(pred);
      return hit ? path.join(dir, hit) : null;
    };
    const savePath     = findInDir(mapFolderPath, f => f.endsWith('_save.lua') || f === 'save.lua');
    const scenarioPath = findInDir(mapFolderPath, f => f.endsWith('_scenario.lua') || f === 'scenario.lua');
    const scmapPath    = findInDir(mapFolderPath, f => f.endsWith('.scmap'));

    if (!savePath) {
      return { success: false, error: 'save.lua not found — open the map in the FA editor once to generate it.' };
    }

    // ── Map size ─────────────────────────────────────────────────────────────
    let mapSize = 512;
    if (scenarioPath && fs.existsSync(scenarioPath)) {
      const sc = fs.readFileSync(scenarioPath, 'utf8');
      const m1 = sc.match(/size\s*=\s*\{\s*(\d+)\s*,\s*(\d+)\s*\}/i);
      if (m1) {
        mapSize = parseInt(m1[1], 10);
      } else {
        const m2 = sc.match(/playable_area\s*=\s*['"]([^'"]+)['"]/i);
        if (m2) {
          const n = m2[1].match(/[\d.]+/g);
          if (n && n.length >= 4) mapSize = Math.round(parseFloat(n[2]));
        }
      }
    }
    const kmTable    = { 128: '2.5 km', 256: '5 km', 512: '10 km', 1024: '20 km', 2048: '40 km', 4096: '80 km' };
    const playableKm = kmTable[mapSize] || ((mapSize * 0.02).toFixed(1) + ' km');

    // -- MEX from save.lua
    // save.lua uses STRING()/FLOAT()/VECTOR3() wrappers, no nested {} inside
    // marker blocks. Flat regex avoids the brace-depth bug (only 1 MEX found).
    const mexPoints = [];
    {
      const luaSrc = fs.readFileSync(savePath, 'utf8');
      const MEX_RE = /\['[^']*'\]\s*=\s*\{[^{}]*\['type'\]\s*=\s*STRING\s*\(\s*'Mass'\s*\)[^{}]*\['position'\]\s*=\s*VECTOR3\s*\(\s*([\d.\-e]+)\s*,\s*[\d.\-e]+\s*,\s*([\d.\-e]+)\s*\)[^{}]*\}/gis;
      let m;
      while ((m = MEX_RE.exec(luaSrc)) !== null) {
        mexPoints.push({ x: parseFloat(m[1]), z: parseFloat(m[2]), weight: 1.8 });
      }
      log.info('[economy] MEX found:', mexPoints.length);
    }

    // ── Reclaim from props.lua + .bp ──────────────────────────────────────────
    const reclaimPoints = [];

    if (!scmapPath) {
      log.warn('[economy] No .scmap found — returning MEX only');
      return { success: true, mapSize, playableKm, mexPoints, reclaimPoints };
    }

    // Unpack scmap (mirrors scmap-unpack handler logic, but inline)
    const parentFolder = path.basename(path.dirname(scmapPath));
    const unpackFolder = path.join(SCMAP_DIR, parentFolder);

    if (fs.existsSync(unpackFolder)) {
      fs.rmSync(unpackFolder, { recursive: true, force: true });
      await new Promise(r => setTimeout(r, 300));
    }
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        fs.mkdirSync(unpackFolder, { recursive: true });
        break;
      } catch (e) {
        if ((e.code === 'EPERM' || e.code === 'EACCES' || e.code === 'ENOENT') && attempt < 14)
          await new Promise(r => setTimeout(r, 200));
        else throw e;
      }
    }

    const buf  = fs.readFileSync(scmapPath);
    const data = scmapUtils.readDatastream(buf);
    scmapUtils.exportScmapData(data, unpackFolder, msg => log.debug('[economy] unpack:', msg));
    log.info('[economy] scmap unpacked to:', unpackFolder);

    // Find props.lua / props1.lua / props2.lua …
    const propsFiles = fs.existsSync(unpackFolder)
      ? fs.readdirSync(unpackFolder)
          .filter(f => /^props\d*\.lua$/i.test(f))
          .map(f => path.join(unpackFolder, f))
      : [];

    log.info('[economy] props files found:', propsFiles.length);

    if (propsFiles.length === 0) {
      return { success: true, mapSize, playableKm, mexPoints, reclaimPoints };
    }

    // Game data path for blueprint lookup
    const settings     = readSettings();
    const gameDataPath = settings.faInstallPath || settings.fafPath || '';
    if (!gameDataPath) {
      return { success: false, error: 'FA install path not set in Settings — required to read blueprint files for reclaim data.' };
    }

    // ── Blueprint reader: loose files first, then .scd/.zip archives ─────────
    // Props in FA/FAF are packed inside .scd files (which are just zip archives).
    // Loose files in gameDataPath are only present in dev/modded setups.

    const bpCache = new Map();

    // SCD index: built once per handler call, maps normalised bp path → location
    // { type: 'scd', scdPath, entryName }
    let scdIndex = null;
    const buildScdIndex = async () => {
      if (scdIndex) return;
      scdIndex = new Map();
      const searchDirs = [
        gameDataPath,
        path.join(gameDataPath, 'gamedata'),
      ].filter(d => fs.existsSync(d));

      for (const dir of searchDirs) {
        let entries;
        try { entries = fs.readdirSync(dir); } catch { continue; }
        const scdFiles = entries.filter(f => f.endsWith('.scd') || f.endsWith('.zip'));
        for (const scdFile of scdFiles) {
          try {
            const scdBuf = fs.readFileSync(path.join(dir, scdFile));
            const zip    = await JSZip.loadAsync(scdBuf);
            for (const entryName of Object.keys(zip.files)) {
              if (entryName.toLowerCase().endsWith('.bp')) {
                const key = entryName.toLowerCase().replace(/\\/g, '/').replace(/^\//, '');
                // First writer wins — lower-priority SCDs may not overwrite
                if (!scdIndex.has(key)) {
                  scdIndex.set(key, { scdPath: path.join(dir, scdFile), entryName });
                }
              }
            }
          } catch { /* skip corrupt/unreadable scd */ }
        }
      }
      log.info('[economy] SCD index built, bp entries:', scdIndex.size);
    };

    // Extract ReclaimMassMax from blueprint source text
    const extractMassFromBp = (bpSrc) => {
      const econM = bpSrc.match(/Economy\s*=\s*\{([^{}]*)\}/i);
      if (!econM) return null;
      const massM = econM[1].match(/ReclaimMassMax\s*=\s*([\d.]+)/i);
      return massM ? parseFloat(massM[1]) : null;
    };

    const readBpMass = async (bpRel) => {
      const key = bpRel.toLowerCase().replace(/\\/g, '/').replace(/^\//, '');
      if (bpCache.has(key)) return bpCache.get(key);

      // 1) Loose file directly on disk
      const rel      = bpRel.replace(/^\//, '').replace(/\//g, path.sep);
      const fullPath = path.join(gameDataPath, rel);
      if (fs.existsSync(fullPath)) {
        try {
          const val = extractMassFromBp(fs.readFileSync(fullPath, 'utf8'));
          bpCache.set(key, val);
          return val;
        } catch { /* fall through to SCD */ }
      }

      // 2) Inside a .scd archive
      await buildScdIndex();
      const entry = scdIndex.get(key);
      if (entry) {
        try {
          const scdBuf = fs.readFileSync(entry.scdPath);
          const zip    = await JSZip.loadAsync(scdBuf);
          const file   = zip.files[entry.entryName];
          if (file) {
            const val = extractMassFromBp(await file.async('string'));
            bpCache.set(key, val);
            return val;
          }
        } catch { /* ignore */ }
      }

      bpCache.set(key, null);
      return null;
    };

    // -- Parse each props.lua and look up blueprints
    // Props files use plain Lua table format: { path = "...", position = { x,y,z } }
    // NOT the Prop('path') { } call format.
    for (const luaFile of propsFiles) {
      const luaSrc = fs.readFileSync(luaFile, 'utf8');
      let pos = 0;

      while (pos < luaSrc.length) {
        const pathKeyIdx = luaSrc.indexOf('path =', pos);
        if (pathKeyIdx === -1) break;

        const q1 = luaSrc.indexOf('"', pathKeyIdx + 6);
        if (q1 === -1) { pos = pathKeyIdx + 6; continue; }
        const q2 = luaSrc.indexOf('"', q1 + 1);
        if (q2 === -1) { pos = q1 + 1; continue; }
        const bpPath = luaSrc.slice(q1 + 1, q2);

        const posKeyIdx = luaSrc.indexOf('position =', pathKeyIdx);
        if (posKeyIdx === -1) { pos = pathKeyIdx + 6; continue; }

        const brace  = luaSrc.indexOf('{', posKeyIdx);
        if (brace === -1) { pos = posKeyIdx + 10; continue; }
        const brace2 = luaSrc.indexOf('}', brace + 1);
        if (brace2 === -1) { pos = brace + 1; continue; }

        const posBody = luaSrc.slice(brace + 1, brace2);
        const nums = posBody.match(/([\d.\-e]+)/gi);
        if (nums && nums.length >= 3) {
          const x = parseFloat(nums[0]);
          const z = parseFloat(nums[2]);
          const mass = await readBpMass(bpPath);
          if (mass && mass > 0) {
            reclaimPoints.push({ x, z, weight: mass });
          }
        }

        pos = brace2 + 1;
        await yieldTick();
      }
    }

    log.info('[economy] Reclaim points found:', reclaimPoints.length);

    // ── previewImage: find the DDS written by exportScmapData, convert to PNG ──
    let previewImageDataUrl = null;
    if (unpackFolder && fs.existsSync(unpackFolder)) {
      const previewFile = fs.readdirSync(unpackFolder).find(f => /^previewImage/i.test(f));
      if (previewFile) {
        try {
          const ddsBuf = fs.readFileSync(path.join(unpackFolder, previewFile));
          const pngBuf = await decodeDDSToPNG(ddsBuf);
          if (pngBuf) {
            previewImageDataUrl = 'data:image/png;base64,' + pngBuf.toString('base64');
            log.info('[economy] previewImage converted, size:', pngBuf.length);
          } else {
            log.warn('[economy] previewImage DDS decode returned null');
          }
        } catch (e) {
          log.warn('[economy] previewImage conversion failed:', e.message);
        }
      } else {
        log.warn('[economy] no previewImage file found in unpack folder');
      }
    }

    const result = { success: true, mapSize, playableKm, mexPoints, reclaimPoints, previewImageDataUrl };
    _econDataCache.set(mapFolderPath, result);
    return result;

  } catch (err) {
    log.error('[economy] read-economy-data failed:', err);
    return { success: false, error: err.message };
  }
}));


// ── settings-pick-file ───────────────────────────────────────────────────────
// File picker for single files (e.g. .exe). Add next to settings-pick-folder.
ipcMain.handle('settings-pick-file', async (event, { title, filters }) => {
  const result = await dialog.showOpenDialog({
    title:      title || 'Select File',
    filters:    filters || [{ name: 'All Files', extensions: ['*'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return { success: false };
  return { success: true, path: result.filePaths[0] };
});





function register() {
  // handlers registered at module load time via ipcMain.handle above
}

module.exports = { register };
