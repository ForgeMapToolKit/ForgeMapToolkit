'use strict';
/**
 * biome.js — Biome Changer: read a map's look, and apply a look-only patch.
 *
 *   biome-read-state  Read every field a biome is made of straight out of a
 *                     packed .scmap — stratum textures/normals, water, lighting,
 *                     skybox, minimap colours, and the prop inventory grouped by
 *                     env family. No unpack needed to analyse a map.
 *   biome-apply       Patch those fields inside an already-unpacked map folder.
 *                     The caller runs scmap-unpack before and scmap-pack after —
 *                     the same proven cycle the water patch and the terrainType
 *                     writer use.
 *
 * Division of labour, mirroring terraintype.js: the *decisions* — which preset,
 * which role sits on which layer, which prop becomes which — are made renderer
 * side in Shared/MapLogic/biomeLogic.js. This module receives an already-resolved
 * patch and does nothing but validate and write it. It never reads a preset and
 * has no opinion about what "autumn" means.
 *
 * The key whitelists below are the contract, not a convenience: **a biome changes
 * how a map looks, never its geometry or gameplay.** Water elevations, skybox
 * dome geometry, minimap contour interval and the terrain shader are therefore
 * not patchable through here, however complete a preset claims to be. Those
 * belong to the map, and a look preset that moved them would silently break
 * spawn balance or the mask blend.
 *
 * Props live in props*.lua after an unpack (exportScmapData splits them out of
 * data.lua), so the prop remap patches those files, not data.lua.
 *
 * Exports (headless-usable, no Electron needed):
 *   readBiomeState({ scmapPath })
 *   applyBiomePatch({ unpackFolder, patch, dryRun })
 *   register() — registers the two IPC handlers
 */

const path = require('path');
const fs   = require('fs');
const { log } = require('./logger');
const { readSettings } = require('./settings');
const scmapUtils = require('../../utils/scmap');

let _ipcMain = null;
try { _ipcMain = require('electron').ipcMain; } catch (_) { /* headless */ }

const { withPathGuard: _withPathGuardBase } = require('./security');
function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

// ═══════════════════════════════════════════════════════════════════════════
// THE PATCHABLE SURFACE — what a biome may and may not touch
// ═══════════════════════════════════════════════════════════════════════════

// value kinds: 'f' float · 's' string · 'v2'/'v3'/'v4' vector · 'hex4' 8-char hex
const WATER_KEYS = {
  surfaceColor:      'v3',
  colorLerp:         'v2',
  refractionScale:   'f',
  fresnelBias:       'f',
  fresnelPower:      'f',
  unitReflection:    'f',
  skyReflection:     'f',
  sunShininess:      'f',
  sunStrength:       'f',
  sunDirection:      'v3',
  sunColor:          'v3',
  sunReflection:     'f',
  sunGlow:           'f',
  texPathCubeMap:    's',
  texPathWaterRamp:  's',
  waveNormalRepeats: 'v4',
};
// Deliberately absent: waterPresent, elevation, elevationDeep, elevationAbyss.
// Those are the map's water *level*, not its look — moving them re-floods the
// terrain and invalidates every spawn and mex the author placed.

const LIGHTING_KEYS = {
  lightingMultiplier: 'f',
  sunDirection:       'v3',
  sunAmbience:        'v3',
  sunColor:           'v3',
  shadowFillColor:    'v3',
  specularColor:      'v4',
  bloom:              'f',
  fogColor:           'v3',
  fogStart:           'f',
  fogEnd:             'f',
};

const SKYBOX_KEYS = {
  horizonColor:        'v3',
  zenithColor:         'v3',
  midColor:            'v3',   // stored as three bytes 0..255, see coerceMidColor
  cirrusColor:         'v3',
  cirrusMultiplier:    'f',
  cirrusTexture:       's',
  albedo:              's',
  glow:                's',
  decalGlowMultiplier: 'f',
};
// Absent: position, scale, horizonHeight, subHeight, subDivAx, subDivHeight,
// zenithHeight, planets. Dome geometry scales with map size (map-resizer.js owns
// it) and planets are hand-placed content.

// Top-level look strings that ride along with the sky.
const ENV_KEYS = {
  backgroundPath: 's',
  skyCubePath:    's',
};
// Absent: shaderPath. The terrain shader decides how the stratum masks blend;
// swapping it would change the map's texture layout, not its palette.

const MINIMAP_KEYS = {
  miniMapDeepWaterColor: 'hex4',
  miniMapContourColor:   'hex4',
  miniMapShoreColor:     'hex4',
  miniMapLandStartColor: 'hex4',
  miniMapLandEndColor:   'hex4',
};
// Absent: miniMapContourInterval — a reading aid tied to the map's height range.

const TEXTURE_SLOTS = 10;  // textures[0..9]: lower, stratum 0-7, macro
const NORMAL_SLOTS  = 9;   // normals[0..8]:  lower, stratum 0-7
const WAVE_TEXTURES = 4;

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function toVec(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') {
    return Object.keys(val).map(Number).sort((a, b) => a - b).map(k => val[k]);
  }
  return null;
}

/** Coerce one incoming value to the shape the scmap writer expects, or throw. */
function coerceValue(kind, value, where) {
  switch (kind) {
    case 'f': {
      const n = typeof value === 'string' ? Number(value) : value;
      if (!isNum(n)) throw new Error(`${where}: expected a number, got ${JSON.stringify(value)}`);
      return n;
    }
    case 's': {
      if (typeof value !== 'string') throw new Error(`${where}: expected a string path`);
      // Game paths only. No drive letters, no traversal — these end up in a file
      // the game loads, and a patch is not a place to reach outside the VFS.
      if (/^[a-zA-Z]:/.test(value) || value.includes('..')) {
        throw new Error(`${where}: expected a game path like /env/…, got "${value}"`);
      }
      return value;
    }
    case 'v2': case 'v3': case 'v4': {
      const want = Number(kind.slice(1));
      const vec  = toVec(value);
      if (!vec || vec.length !== want) throw new Error(`${where}: expected ${want} numbers`);
      const out = vec.map(n => (typeof n === 'string' ? Number(n) : n));
      if (!out.every(isNum)) throw new Error(`${where}: vector holds a non-number`);
      return out;
    }
    case 'hex4': {
      if (typeof value !== 'string' || !/^[0-9a-fA-F]{8}$/.test(value)) {
        throw new Error(`${where}: expected 8 hex digits (rrggbbaa), got ${JSON.stringify(value)}`);
      }
      return value.toLowerCase();
    }
    default:
      throw new Error(`${where}: unknown value kind ${kind}`);
  }
}

/** Apply a whitelisted flat block onto a target object. Returns changed keys. */
function applyBlock(target, incoming, whitelist, label) {
  const changed = [];
  if (!incoming || typeof incoming !== 'object') return changed;

  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === undefined) continue;      // absent = leave alone
    const kind = whitelist[key];
    if (!kind) throw new Error(`${label}.${key} is not a patchable biome field`);
    target[key] = coerceValue(kind, value, `${label}.${key}`);
    changed.push(key);
  }
  return changed;
}

// skyBox.midColor is three bytes (0..255) in the binary, unlike every other
// colour here, which is a float triple. Accept either and normalise to bytes.
function coerceMidColor(value) {
  const vec = coerceValue('v3', value, 'skybox.midColor');
  const asBytes = vec.every(n => n >= 0 && n <= 1)
    ? vec.map(n => Math.round(n * 255))
    : vec.map(n => Math.round(n));
  return asBytes.map(n => Math.max(0, Math.min(255, n)));
}

// ═══════════════════════════════════════════════════════════════════════════
// READ — the map's current biome, straight out of the packed .scmap
// ═══════════════════════════════════════════════════════════════════════════

/** Pick only the whitelisted keys out of a parsed block, vectors normalised. */
function pickBlock(source, whitelist) {
  const out = {};
  if (!source) return out;
  for (const [key, kind] of Object.entries(whitelist)) {
    const v = source[key];
    if (v === undefined || v === null) continue;
    out[key] = (kind === 'v2' || kind === 'v3' || kind === 'v4') ? toVec(v) : v;
  }
  return out;
}

/** Env family of a prop blueprint path: /env/<family>/props/… → '<family>'. */
function familyOfPropPath(p) {
  const parts = String(p || '').replace(/\\/g, '/').split('/').filter(Boolean);
  const i = parts.findIndex(seg => seg.toLowerCase() === 'env');
  if (i === -1 || !parts[i + 1] || parts[i + 1].toLowerCase().endsWith('.bp')) return null;
  return parts[i + 1].toLowerCase();
}

async function readBiomeState({ scmapPath }) {
  const buf  = fs.readFileSync(scmapPath);
  const data = scmapUtils.readDatastream(buf);

  // Prop inventory: one row per distinct blueprint, plus a family roll-up. The
  // per-path counts are what the swap plan is built from renderer side.
  const byPath  = new Map();
  const byFamily = new Map();
  for (const prop of (data.props || [])) {
    const p   = prop.path || '';
    const key = p.toLowerCase();
    const row = byPath.get(key);
    if (row) row.count++;
    else byPath.set(key, { path: p, count: 1, family: familyOfPropPath(p) });
    const fam = familyOfPropPath(p) || 'unknown';
    byFamily.set(fam, (byFamily.get(fam) || 0) + 1);
  }

  return {
    success: true,
    size:    data.size,
    version: data.version,
    shaderPath:     data.shaderPath || '',
    backgroundPath: data.backgroundPath || '',
    skyCubePath:    data.skyCubePath || '',
    textures: (data.textures || []).map(t => ({ path: t.path || '', scale: t.scale })),
    normals:  (data.normals  || []).map(t => ({ path: t.path || '', scale: t.scale })),
    water:    pickBlock(data.waterSettings, WATER_KEYS),
    // Water levels are read (the UI shows them as context) but not patchable.
    waterLevels: {
      waterPresent:   !!data.waterSettings?.waterPresent,
      elevation:      data.waterSettings?.elevation,
      elevationDeep:  data.waterSettings?.elevationDeep,
      elevationAbyss: data.waterSettings?.elevationAbyss,
    },
    waveTextures: (data.waterSettings?.waveTextures || []).map(wt => ({
      path: wt.path || '', movement: toVec(wt.movement),
    })),
    lighting: pickBlock(data.lightingSettings, LIGHTING_KEYS),
    skybox:   data.skyBox ? pickBlock(data.skyBox, SKYBOX_KEYS) : null,
    minimap:  pickBlock(data, MINIMAP_KEYS),
    props: {
      total:    (data.props || []).length,
      byPath:   [...byPath.values()].sort((a, b) => b.count - a.count),
      byFamily: [...byFamily.entries()].map(([family, count]) => ({ family, count }))
                  .sort((a, b) => b.count - a.count),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// APPLY — patch an unpacked map folder
// ═══════════════════════════════════════════════════════════════════════════

function arrayToLuaObj(arr) {
  const obj = {};
  arr.forEach((v, i) => { obj[i + 1] = v; });
  return obj;
}

/** Patch textures[]/normals[] in place from a sparse [{index, path?, scale?}]. */
function applySlotList(target, incoming, slots, label) {
  const changed = [];
  if (!Array.isArray(incoming)) return changed;

  for (const entry of incoming) {
    if (!entry || typeof entry !== 'object') continue;
    const idx = Number(entry.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= slots) {
      throw new Error(`${label}: index ${entry.index} outside 0..${slots - 1}`);
    }
    const slot = target[idx];
    if (!slot) throw new Error(`${label}[${idx}]: the map has no such slot`);
    if (entry.path !== undefined && entry.path !== null) {
      slot.path = coerceValue('s', entry.path, `${label}[${idx}].path`);
    }
    if (entry.scale !== undefined && entry.scale !== null) {
      const scale = coerceValue('f', entry.scale, `${label}[${idx}].scale`);
      if (scale < 0) throw new Error(`${label}[${idx}].scale: must not be negative`);
      // scale 0 means "layer unused" in FA and is preserved deliberately —
      // map-resizer.js relies on the same convention.
      slot.scale = scale;
    }
    changed.push(idx);
  }
  return changed;
}

/** The prop files an unpacked folder actually keeps its props in. */
function findPropFiles(unpackFolder) {
  const entries = fs.readdirSync(unpackFolder);
  const numbered = entries
    .filter(e => /^props\d+\.lua$/i.test(e))
    .sort((a, b) => (parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10)));
  const single = entries.filter(e => /^props\.lua$/i.test(e));
  // Both can coexist (props.lua = original, propsN.lua = toolkit additions) and
  // readFolderFiles concatenates them, so patch every file that exists.
  return [...single, ...numbered].map(name => path.join(unpackFolder, name));
}

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') {
    const keys = Object.keys(val).map(Number).filter(n => !isNaN(n) && n >= 1).sort((a, b) => a - b);
    return keys.map(k => val[k]);
  }
  return [];
}

/**
 * Remap and/or drop prop blueprint paths across every props file. `remap` and
 * `drop` are keyed by lowercased source path — the same normalisation the read
 * side reports, so the renderer never has to worry about casing.
 */
function applyPropPatch(unpackFolder, propPatch, dataLua, dryRun) {
  const remap = propPatch?.remap || {};
  const drop  = new Set((propPatch?.drop || []).map(p => String(p).toLowerCase()));

  for (const [from, to] of Object.entries(remap)) {
    coerceValue('s', to, `props.remap["${from}"]`);
  }

  const files = findPropFiles(unpackFolder);
  let remapped = 0, dropped = 0, total = 0;

  const patchList = (arr) => {
    const out = [];
    for (const prop of arr) {
      total++;
      const key = String(prop?.path || '').toLowerCase();
      if (drop.has(key)) { dropped++; continue; }
      const to = remap[key];
      if (to && to !== prop.path) { out.push({ ...prop, path: to }); remapped++; }
      else out.push(prop);
    }
    return out;
  };

  if (files.length === 0) {
    // No split files — props (if any) sit in data.lua.
    const arr = toArray(dataLua.props);
    if (arr.length === 0) return { remapped: 0, dropped: 0, total: 0, files: 0 };
    const next = patchList(arr);
    if (!dryRun) dataLua.props = arrayToLuaObj(next);
    return { remapped, dropped, total, files: 0 };
  }

  for (const file of files) {
    const parsed = scmapUtils.parseLuaDataFile(fs.readFileSync(file, 'utf8'));
    const next   = patchList(toArray(parsed));
    if (!dryRun) fs.writeFileSync(file, scmapUtils.luaSerialize(arrayToLuaObj(next)), 'utf8');
  }
  return { remapped, dropped, total, files: files.length };
}

/**
 * Apply a resolved biome patch to an unpacked map folder.
 *
 * Every field is optional and `null`/absent means "leave this alone" — that is
 * what makes a half-filled preset safe to apply. An unknown key is an error, not
 * a silent no-op, because a typo in a preset must not read as success.
 */
async function applyBiomePatch({ unpackFolder, patch, dryRun = false }) {
  const dataLuaPath = path.join(unpackFolder, 'data.lua');
  if (!fs.existsSync(dataLuaPath)) {
    return { success: false, error: `data.lua not found in ${unpackFolder}` };
  }
  if (!patch || typeof patch !== 'object') {
    return { success: false, error: 'No patch supplied' };
  }

  const data = scmapUtils.parseLuaDataFile(fs.readFileSync(dataLuaPath, 'utf8'));
  const report = { textures: [], normals: [], water: [], lighting: [], skybox: [], env: [], minimap: [], props: null };

  // ── textures / normals ────────────────────────────────────────────────────
  const textures = toArray(data.textures);
  const normals  = toArray(data.normals);
  if (textures.length !== TEXTURE_SLOTS || normals.length !== NORMAL_SLOTS) {
    return {
      success: false,
      error: `unexpected layer counts — ${textures.length} textures / ${normals.length} normals `
           + `(expected ${TEXTURE_SLOTS} / ${NORMAL_SLOTS})`,
    };
  }
  report.textures = applySlotList(textures, patch.textures, TEXTURE_SLOTS, 'textures');
  report.normals  = applySlotList(normals,  patch.normals,  NORMAL_SLOTS,  'normals');
  data.textures = arrayToLuaObj(textures);
  data.normals  = arrayToLuaObj(normals);

  // ── water (look only; levels are not in WATER_KEYS) ───────────────────────
  if (patch.water) {
    if (!data.waterSettings) return { success: false, error: 'data.lua has no waterSettings block' };
    const { waveTextures, ...flat } = patch.water;
    report.water = applyBlock(data.waterSettings, flat, WATER_KEYS, 'water');

    if (Array.isArray(waveTextures)) {
      const existing = toArray(data.waterSettings.waveTextures);
      if (existing.length !== WAVE_TEXTURES) {
        return { success: false, error: `waveTextures: map has ${existing.length}, expected ${WAVE_TEXTURES}` };
      }
      waveTextures.forEach((wt, i) => {
        if (!wt) return;
        if (wt.path != null) existing[i].path = coerceValue('s', wt.path, `water.waveTextures[${i}].path`);
        if (wt.movement != null) existing[i].movement = coerceValue('v2', wt.movement, `water.waveTextures[${i}].movement`);
        report.water.push(`waveTextures[${i}]`);
      });
      data.waterSettings.waveTextures = arrayToLuaObj(existing);
    }
  }

  // ── lighting ──────────────────────────────────────────────────────────────
  if (patch.lighting) {
    if (!data.lightingSettings) return { success: false, error: 'data.lua has no lightingSettings block' };
    report.lighting = applyBlock(data.lightingSettings, patch.lighting, LIGHTING_KEYS, 'lighting');
  }

  // ── skybox (v60 only) + the two env look paths ─────────────────────────────
  if (patch.skybox) {
    if (!data.skyBox) {
      return { success: false, error: `this map has no skybox block (scmap version ${data.version}) — turn the Skybox channel off` };
    }
    const { midColor, ...flat } = patch.skybox;
    report.skybox = applyBlock(data.skyBox, flat, SKYBOX_KEYS, 'skybox');
    if (midColor != null) {
      data.skyBox.midColor = arrayToLuaObj(coerceMidColor(midColor));
      report.skybox.push('midColor');
    }
  }
  if (patch.env) report.env = applyBlock(data, patch.env, ENV_KEYS, 'env');

  // ── minimap colours ───────────────────────────────────────────────────────
  if (patch.minimap) report.minimap = applyBlock(data, patch.minimap, MINIMAP_KEYS, 'minimap');

  // ── props ─────────────────────────────────────────────────────────────────
  if (patch.props) report.props = applyPropPatch(unpackFolder, patch.props, data, dryRun);

  const touched = report.textures.length + report.normals.length + report.water.length
                + report.lighting.length + report.skybox.length + report.env.length
                + report.minimap.length
                + ((report.props?.remapped || 0) + (report.props?.dropped || 0) > 0 ? 1 : 0);

  if (!dryRun) {
    fs.writeFileSync(dataLuaPath, scmapUtils.luaSerialize(data), 'utf8');
    log.info(`[biome] patched ${dataLuaPath} — ${report.textures.length} textures, `
           + `${report.normals.length} normals, ${report.water.length} water, `
           + `${report.lighting.length} lighting, ${report.skybox.length} skybox, `
           + `${report.minimap.length} minimap, props ${report.props?.remapped ?? 0} remapped / `
           + `${report.props?.dropped ?? 0} dropped`);
  }

  return { success: true, dryRun, touched, report };
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC
// ═══════════════════════════════════════════════════════════════════════════

function register() {
  if (!_ipcMain) return;

  _ipcMain.handle('biome-read-state', withPathGuard(
    ({ scmapPath }) => [scmapPath],
    async (event, { scmapPath }) => {
      try {
        return await readBiomeState({ scmapPath });
      } catch (err) {
        log.error('[biome] biome-read-state failed:', err);
        return { success: false, error: err.message };
      }
    },
  ));

  _ipcMain.handle('biome-apply', withPathGuard(
    ({ unpackFolder }) => [unpackFolder],
    async (event, { unpackFolder, patch, dryRun }) => {
      try {
        return await applyBiomePatch({ unpackFolder, patch, dryRun });
      } catch (err) {
        log.error('[biome] biome-apply failed:', err);
        return { success: false, error: err.message };
      }
    },
  ));
}

module.exports = {
  register,
  readBiomeState,
  applyBiomePatch,
  WATER_KEYS, LIGHTING_KEYS, SKYBOX_KEYS, ENV_KEYS, MINIMAP_KEYS,
};
