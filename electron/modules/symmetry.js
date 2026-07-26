'use strict';
/**
 * symmetry.js — Symmetry Checker: one read of everything a map mirrors.
 *
 *   symmetry-read-map   Reads the map folder's .scmap and _save.lua in a single
 *                       pass and hands the renderer every layer that has to be
 *                       mirrored: the raw grids (heightmap, terrainType, water
 *                       masks, decoded stratum masks) plus the placed entities
 *                       (props, decals, markers, army units).
 *
 * The comparison maths lives renderer-side (Shared/MapLogic/symmetryLogic.js) so
 * the mode/tolerance controls stay instant and the per-cell error field can drive
 * the heatmap without another IPC round-trip. This module is pure I/O: read,
 * decode, resample, flatten — never judge.
 *
 * A map's placed entities live in two different files with two different
 * formats. Props and decals sit inside the .scmap binary; markers and units sit
 * in <MapName>_save.lua, which is Lua source using the editor's wrapper calls
 * (STRING/FLOAT/BOOLEAN/VECTOR3/RECTANGLE/GROUP). utils/scmap.js's
 * parseLuaDataFile handles plain data tables only and throws on those calls, so
 * this module carries its own tolerant parser for that dialect.
 *
 * Exports: register() — no-op; handlers register at module load.
 */

const path = require('path');
const fs   = require('fs');
const { ipcMain } = require('electron');
const { log } = require('./logger');
const { readSettings } = require('./settings');
const { withPathGuard: _withPathGuardBase } = require('./security');
const { decodeDDSToRGBA } = require('./dds-decode');
const scmapUtils = require('../../utils/scmap');

function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

// ═══════════════════════════════════════════════════════════════════════════
// _save.lua PARSER — the editor's Lua dialect
// ═══════════════════════════════════════════════════════════════════════════
// The file is `Scenario = { … }` where every leaf value is wrapped in a call:
//   ['type']     = STRING( 'Mass' )
//   ['position'] = VECTOR3( 100.5, 20.2, 412.5 )
//   ['Units']    = GROUP { … }
// Calls collapse to their payload (one arg → the arg, several → an array);
// `IDENT { … }` wrappers collapse to the table. Everything else is plain Lua.

function makeCtx(src) { return { src, pos: 0 }; }

function skipTrivia(c) {
  const { src } = c;
  while (c.pos < src.length) {
    const ch = src[c.pos];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { c.pos++; continue; }
    if (src.startsWith('--[[', c.pos)) {
      const end = src.indexOf(']]', c.pos + 4);
      c.pos = end < 0 ? src.length : end + 2;
      continue;
    }
    if (src.startsWith('--', c.pos)) {
      while (c.pos < src.length && src[c.pos] !== '\n') c.pos++;
      continue;
    }
    break;
  }
}

function parseString(c) {
  const q = c.src[c.pos++];
  let out = '';
  while (c.pos < c.src.length) {
    const ch = c.src[c.pos];
    if (ch === q) { c.pos++; break; }
    if (ch === '\\') { c.pos++; out += c.src[c.pos++] ?? ''; continue; }
    out += ch; c.pos++;
  }
  return out;
}

function parseNumber(c) {
  const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(c.src.slice(c.pos));
  if (!m) throw new Error(`save.lua: number expected at ${c.pos}`);
  c.pos += m[0].length;
  return parseFloat(m[0]);
}

function parseTable(c) {
  c.pos++; // {
  const obj = {};
  let arrayIndex = 1;
  for (;;) {
    skipTrivia(c);
    if (c.pos >= c.src.length) break;
    if (c.src[c.pos] === '}') { c.pos++; break; }
    if (c.src[c.pos] === ',' || c.src[c.pos] === ';') { c.pos++; continue; }

    let key = null;
    if (c.src[c.pos] === '[') {
      c.pos++;
      key = parseValue(c);
      skipTrivia(c);
      if (c.src[c.pos] === ']') c.pos++;
      skipTrivia(c);
      if (c.src[c.pos] === '=') c.pos++;
    } else {
      const m = /^([A-Za-z_][\w]*)\s*=(?!=)/.exec(c.src.slice(c.pos));
      if (m) { key = m[1]; c.pos += m[0].length; }
    }

    const val = parseValue(c);
    if (key != null) obj[key] = val;
    else obj[arrayIndex++] = val;
  }
  return obj;
}

function parseCallArgs(c) {
  c.pos++; // (
  const args = [];
  for (;;) {
    skipTrivia(c);
    if (c.pos >= c.src.length) break;
    if (c.src[c.pos] === ')') { c.pos++; break; }
    if (c.src[c.pos] === ',') { c.pos++; continue; }
    args.push(parseValue(c));
  }
  return args;
}

function parseValue(c) {
  skipTrivia(c);
  const ch = c.src[c.pos];
  if (ch === undefined) throw new Error('save.lua: unexpected end of file');
  if (ch === '{') return parseTable(c);
  if (ch === '"' || ch === "'") return parseString(c);
  if (ch === '-' && c.src[c.pos + 1] !== '-') return parseNumber(c);
  if (ch === '+' || ch === '.' || (ch >= '0' && ch <= '9')) return parseNumber(c);

  const word = /^([A-Za-z_][\w.]*)/.exec(c.src.slice(c.pos));
  if (!word) throw new Error(`save.lua: unexpected '${ch}' at ${c.pos}`);
  c.pos += word[1].length;
  const name = word[1];
  if (name === 'true')  return true;
  if (name === 'false') return false;
  if (name === 'nil')   return null;

  skipTrivia(c);
  // IDENT( … ) — STRING / FLOAT / BOOLEAN / VECTOR3 / RECTANGLE
  if (c.src[c.pos] === '(') {
    const args = parseCallArgs(c);
    return args.length === 1 ? args[0] : args;
  }
  // IDENT { … } — GROUP
  if (c.src[c.pos] === '{') return parseTable(c);
  // Bare identifier (a reference we cannot resolve) — keep the name.
  return name;
}

/** Parse a whole `<MapName>_save.lua` into `{ Scenario: {...} }`-shaped data. */
function parseSaveLua(src) {
  const c = makeCtx(src);
  const out = {};
  // Top level is a sequence of `Name = value` assignments (usually just Scenario).
  for (;;) {
    skipTrivia(c);
    if (c.pos >= c.src.length) break;
    const m = /^([A-Za-z_][\w]*)\s*=/.exec(c.src.slice(c.pos));
    if (!m) break;
    c.pos += m[0].length;
    out[m[1]] = parseValue(c);
  }
  return out;
}

// ── Entity extraction from the parsed scenario ────────────────────────────────

const isVec = (v) => Array.isArray(v) && v.length >= 3 && v.every(n => typeof n === 'number');

/**
 * MasterChain markers — mass points, hydros, spawns, camera and every other
 * marker the editor writes. Keyed by name in the file; the name carries no
 * geometry, so it is kept only for the finding list.
 */
function extractMarkers(scenario) {
  const chains = scenario?.MasterChain || {};
  const out = [];
  for (const chainName of Object.keys(chains)) {
    const markers = chains[chainName]?.Markers;
    if (!markers || typeof markers !== 'object') continue;
    for (const name of Object.keys(markers)) {
      const m = markers[name];
      if (!m || typeof m !== 'object' || !isVec(m.position)) continue;
      out.push({
        name,
        chain: chainName,
        type: typeof m.type === 'string' ? m.type : '',
        resource: m.resource === true,
        prop: typeof m.prop === 'string' ? m.prop : '',
        position: [m.position[0], m.position[1], m.position[2]],
        orientation: isVec(m.orientation) ? m.orientation[1] : null,
      });
    }
  }
  return out;
}

/**
 * Army units — the civilians (`NEUTRAL_CIVILIAN` / the `ARMY_17` wreck-and-
 * civilian army) as well as anything pre-placed for a playable army.
 *
 * The nesting has two distinct shapes and mixing them up silently yields zero
 * units, which is worse than an error:
 *
 *   Armies.<NAME>.Units          → a GROUP node  (the army's root group)
 *   <group node>.Units           → a MAP of children, keyed by group/unit name
 *   <child>                      → another group node, or a leaf unit
 *   <leaf unit>                  → carries `type` + `Position`
 *
 * So the walk always steps group → map → child, and groups nest arbitrarily
 * deep (`INITIAL`, `WRECKAGE`, `CIVILIANS`, hand-made subgroups…).
 */
function extractUnits(scenario) {
  const armies = scenario?.Armies || {};
  const out = [];

  const walkGroup = (group, army, groupPath, depth) => {
    if (!group || typeof group !== 'object' || depth > 16) return;
    const children = group.Units;
    if (!children || typeof children !== 'object') return;
    for (const key of Object.keys(children)) {
      const child = children[key];
      if (!child || typeof child !== 'object') continue;
      if (typeof child.type === 'string' && isVec(child.Position)) {
        out.push({
          army,
          group: groupPath.join(' / ') || '—',
          name: key,
          type: child.type,
          position: [child.Position[0], child.Position[1], child.Position[2]],
          orientation: isVec(child.Orientation) ? child.Orientation[1] : null,
        });
        continue;
      }
      walkGroup(child, army, groupPath.concat(key), depth + 1);
    }
  };

  for (const army of Object.keys(armies)) {
    walkGroup(armies[army]?.Units, army, [], 0);
  }
  return out;
}

/**
 * The playable rectangle. Not always `AREA_1` — the editor keeps whatever the
 * mapper named the area, and real maps in the wild carry e.g. `New Area`; some
 * carry no area at all.
 */
function extractPlayable(scenario) {
  const areas = scenario?.Areas || {};
  for (const key of Object.keys(areas)) {
    const rect = areas[key]?.rectangle;
    if (Array.isArray(rect) && rect.length === 4 && rect.every(v => typeof v === 'number')) {
      return { name: key, x1: rect[0], y1: rect[1], x2: rect[2], y2: rect[3] };
    }
  }
  return null;
}

// ── Grid helpers ──────────────────────────────────────────────────────────────

// Nearest-neighbour resample of an RGBA buffer to (dstW × dstH). Same approach
// as terraintype.js: the stratum masks are authored at a lower resolution than
// the terrain grid, and the comparison needs one common grid.
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

const asBuffer = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);

// ═══════════════════════════════════════════════════════════════════════════
// symmetry-read-map
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('symmetry-read-map', withPathGuard(
  ({ mapFolderPath }) => [mapFolderPath],
  async (event, { mapFolderPath, includeMasks = true }) => {
    try {
      let entries;
      try { entries = fs.readdirSync(mapFolderPath); }
      catch (_) { return { success: false, error: `Map folder not found: ${mapFolderPath}` }; }

      const scmapName = entries.find(f => f.toLowerCase().endsWith('.scmap'));
      if (!scmapName) return { success: false, error: `No .scmap in ${mapFolderPath}` };

      const scmapPath = path.join(mapFolderPath, scmapName);
      const data = scmapUtils.readDatastream(fs.readFileSync(scmapPath));
      const [w, h] = data.size;

      // ── Stratum masks (optional — two decoded 4-channel grids are the
      //    single biggest part of the payload) ──
      let maskLow = null, maskHigh = null, maskResolution = null, maskError = null;
      if (includeMasks) {
        const decLow  = data.textureMaskLow  ? decodeDDSToRGBA(data.textureMaskLow.data)  : null;
        const decHigh = data.textureMaskHigh ? decodeDDSToRGBA(data.textureMaskHigh.data) : null;
        if (decLow && decHigh) {
          maskLow  = asBuffer(resampleRGBA(decLow.data,  decLow.width,  decLow.height,  w, h));
          maskHigh = asBuffer(resampleRGBA(decHigh.data, decHigh.width, decHigh.height, w, h));
          maskResolution = [decLow.width, decLow.height];
        } else {
          maskError = 'textureMaskLow/High could not be decoded (unsupported DDS format)';
        }
      }

      // ── _save.lua entities (best effort — a map can be checked without it) ──
      let markers = [], units = [], playable = null, saveName = null, saveError = null;
      const saveFile = entries.find(f => f.toLowerCase().endsWith('_save.lua'));
      if (!saveFile) {
        saveError = 'No _save.lua in the map folder — markers and units not checked';
      } else {
        saveName = saveFile;
        try {
          const parsed = parseSaveLua(fs.readFileSync(path.join(mapFolderPath, saveFile), 'utf8'));
          const scenario = parsed.Scenario || parsed;
          markers  = extractMarkers(scenario);
          units    = extractUnits(scenario);
          playable = extractPlayable(scenario);
        } catch (err) {
          saveError = `Could not parse ${saveFile}: ${err.message}`;
          log.warn(`[symmetry] ${saveError}`);
        }
      }

      log.info(`[symmetry] ${scmapName} — ${w}×${h}, ${data.props.length} props, ${data.decals.length} decals, ${markers.length} markers, ${units.length} units`);

      return {
        success: true,
        scmapName,
        saveName,
        saveError,
        maskError,
        version: data.version,
        size: data.size,
        heightmapScale: data.heightmapScale,
        playable,
        water: { present: data.waterSettings.waterPresent, elevation: data.waterSettings.elevation },
        // Buffers arrive renderer-side as Uint8Array.
        heightmap:          data.heightmap ? data.heightmap.data : null,
        terrainType:        data.terrainType ? data.terrainType.data : null,
        waterFoamMask:      data.waterFoamMask ? data.waterFoamMask.data : null,
        waterFlatness:      data.waterFlatness ? data.waterFlatness.data : null,
        waterDepthBiasMask: data.waterDepthBiasMask ? data.waterDepthBiasMask.data : null,
        maskLow, maskHigh, maskResolution,
        props: data.props.map(p => ({ path: p.path || '', position: p.position, scale: p.scale })),
        decals: data.decals.map(d => ({
          type: d.type,
          texture: (d.textures && d.textures[0]) || '',
          position: d.position,
          scale: d.scale,
          rotation: d.rotation,
        })),
        markers,
        units,
      };
    } catch (err) {
      log.error('[symmetry] symmetry-read-map failed:', err);
      return { success: false, error: err.message };
    }
  },
));

function register() {
  // handlers registered at module load via ipcMain.handle above
}

module.exports = { register, parseSaveLua, extractMarkers, extractUnits, extractPlayable };
