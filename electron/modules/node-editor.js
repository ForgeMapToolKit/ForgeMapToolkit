'use strict';
/**
 * node-editor.js — IPC for the Node Editor's SupCom-aware source nodes and its
 * disk-backed projects.
 *
 * Source nodes — the renderer can't do these for itself:
 *   node-editor-read-skybox  — pull the `skyBox` block out of an unpacked map's
 *                              data.lua (horizon/mid/zenith colours + the atlas
 *                              and cirrus texture paths).
 *   node-editor-load-texture — resolve a game texture path and decode it to RGBA.
 *   node-editor-list-assets  — index the stock .dds textures in gamedata.
 *
 * Projects — a project is a folder of named `.fmtgraph` documents (tabs):
 *   node-editor-list-projects, -create-project, -load-project,
 *   -save-graph, -delete-graph.
 *
 * Reuses existing infrastructure rather than reimplementing it:
 * utils/scmap.parseLuaDataFile, dds-decode.decodeDDSToRGBA and
 * settings.getGamedataPaths (the same .scd search props.js does).
 */

const path  = require('path');
const fs    = require('fs');
const { ipcMain } = require('electron');
const JSZip = require('jszip');
const { log } = require('./logger');
const { readSettings, SCMAP_DIR, USER_DATA, getGamedataPaths } = require('./settings');
const { withPathGuard: _withPathGuardBase } = require('./security');
const { parseLuaDataFile } = require('../../utils/scmap');
const { decodeDDSToRGBA } = require('./dds-decode');

function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

// parseLuaDataFile hands Lua arrays back 1-indexed ({1:r,2:g,3:b}) — normalise.
function luaArray(v) {
  if (!v || typeof v !== 'object') return [];
  if (Array.isArray(v)) return v;
  const out = [];
  for (let i = 1; v[i] !== undefined; i++) out.push(v[i]);
  return out;
}

const to255 = (n) => Math.max(0, Math.min(255, Math.round((Number(n) || 0) * 255)));
function rgbToHex(luaColor) {
  const [r, g, b] = luaArray(luaColor);
  return '#' + [r, g, b].map(v => to255(v).toString(16).padStart(2, '0')).join('');
}

const isAbsolute = (p) => /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\');

// ── Projects ─────────────────────────────────────────────────────────────
// A project is just a folder of `<tabLabel>.fmtgraph` files under here — same
// "the document is the truth" idea as a lone .fmtgraph (NODE_EDITOR_PLAN §1),
// just one folder holding several named documents (EnvCube / CirrusLayer /
// WaterRamp / …) instead of one.
const NODE_EDITOR_PROJECTS_DIR = path.join(USER_DATA, 'node-editor-projects');

// Names come straight from user input (project name, tab label) and become
// path segments — strip path separators/traversal chars and reject "." / "..".
function sanitizeName(name) {
  const clean = String(name || '').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 64);
  return (clean === '.' || clean === '..' || clean === '') ? '' : clean;
}

ipcMain.handle('node-editor-list-projects', async () => {
  try {
    fs.mkdirSync(NODE_EDITOR_PROJECTS_DIR, { recursive: true });
    const projects = fs.readdirSync(NODE_EDITOR_PROJECTS_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => a.localeCompare(b));
    return { success: true, projects };
  } catch (err) {
    log.warn('[node-editor] list-projects failed:', err.message);
    return { success: false, error: err.message, projects: [] };
  }
});

ipcMain.handle('node-editor-create-project', async (event, { name } = {}) => {
  try {
    const clean = sanitizeName(name);
    if (!clean) return { success: false, error: 'invalid project name' };
    const dir = path.join(NODE_EDITOR_PROJECTS_DIR, clean);
    if (fs.existsSync(dir)) return { success: false, error: `project "${clean}" already exists` };
    fs.mkdirSync(dir, { recursive: true });
    return { success: true, name: clean };
  } catch (err) {
    log.warn('[node-editor] create-project failed:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('node-editor-load-project', async (event, { name } = {}) => {
  try {
    const clean = sanitizeName(name);
    const dir = path.join(NODE_EDITOR_PROJECTS_DIR, clean);
    if (!clean || !fs.existsSync(dir)) return { success: false, error: `project "${name}" not found` };
    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.fmtgraph'));
    const tabs = [];
    for (const f of files) {
      try {
        const graph = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        tabs.push({ label: f.slice(0, -'.fmtgraph'.length), graph });
      } catch (err) {
        log.warn(`[node-editor] skipping corrupt tab file ${f}:`, err.message);
      }
    }
    tabs.sort((a, b) => a.label.localeCompare(b.label));
    return { success: true, name: clean, tabs };
  } catch (err) {
    log.warn('[node-editor] load-project failed:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('node-editor-save-graph', async (event, { project, label, graph } = {}) => {
  try {
    const cleanProject = sanitizeName(project);
    const cleanLabel = sanitizeName(label);
    if (!cleanProject) return { success: false, error: 'invalid project name' };
    if (!cleanLabel) return { success: false, error: 'invalid tab name' };
    const dir = path.join(NODE_EDITOR_PROJECTS_DIR, cleanProject);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${cleanLabel}.fmtgraph`), JSON.stringify(graph, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    log.warn('[node-editor] save-graph failed:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('node-editor-delete-graph', async (event, { project, label } = {}) => {
  try {
    const cleanProject = sanitizeName(project);
    const cleanLabel = sanitizeName(label);
    if (!cleanProject || !cleanLabel) return { success: false, error: 'invalid project/tab name' };
    const file = path.join(NODE_EDITOR_PROJECTS_DIR, cleanProject, `${cleanLabel}.fmtgraph`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return { success: true };
  } catch (err) {
    log.warn('[node-editor] delete-graph failed:', err.message);
    return { success: false, error: err.message };
  }
});

// sky.fx's Cirrus struct is {frequency:float2, speed, direction:float2} per
// layer — direction is a raw vector there (the shader normalizes it itself);
// the node editor's Cirrus node takes an angle instead (a slider is easier to
// hand-tune than two coupled numbers), so convert once here.
function cirrusLayersOf(sky) {
  return luaArray(sky.cirrusLayers).slice(0, 4).map((l) => {
    const [fx, fy] = luaArray(l.frequency);
    const [dx, dy] = luaArray(l.direction);
    return {
      freqX: Number(fx) || 0,
      freqY: Number(fy) || 0,
      dirDeg: (Math.atan2(Number(dy) || 0, Number(dx) || 1) * 180) / Math.PI,
      speed: Number(l.speed) || 0,
    };
  });
}

// SkyboxGenerator's own dome-mesh formula (Configuration.jsx DomePreview /
// utils.js buildSkyboxLuaBlock's `scale = mapSize * 2.288` default): the dome's
// vertex rings run from horizonHeight up to horizonHeight + sphereLerp*scale —
// that top ring is the dome's real apex height. `scale`/`subHeight` are read
// straight off the map's own skyBox block when present (the authoritative,
// already-tuned values); mapSize (from data.lua's own `size` field — no need
// for a separate _scenario.lua read) only backstops `scale` for a skybox that
// was never actually configured.
function apexHeightOf(sky, mapSize) {
  const subHeight = Number(sky.subHeight) || 1.2566;
  const scale = Number(sky.scale) || (mapSize || 1024) * 2.288;
  const horizonHeight = Number(sky.horizonHeight) || 0;
  const sphereLerp = Math.max(0, Math.min(1, 1 - (subHeight * 2) / Math.PI));
  return horizonHeight + sphereLerp * scale;
}

// ── node-editor-read-skybox ─────────────────────────────────────────────────
// mapName = folder under SCMAP_DIR (an unpacked map, e.g. "helheim.v0002").
ipcMain.handle('node-editor-read-skybox', async (event, { mapName } = {}) => {
  try {
    if (!mapName) return { success: false, error: 'no map selected' };
    const dataLua = path.join(SCMAP_DIR, mapName, 'data.lua');
    if (!fs.existsSync(dataLua)) return { success: false, error: `data.lua not found for "${mapName}"` };

    const data = parseLuaDataFile(fs.readFileSync(dataLua, 'utf8'));
    const sky = data?.skyBox;
    if (!sky) return { success: false, error: 'no skyBox block in data.lua' };

    const mapSize = Number(luaArray(data.size)[0]) || 1024;
    const horizonHeight = Number(sky.horizonHeight) || 0;
    const zenithHeight = Number(sky.zenithHeight) || 0;

    return {
      success: true,
      skybox: {
        horizon: rgbToHex(sky.horizonColor),
        // midColor is a dead field — the real skybox shader never reads it
        // (only horizon/zenith drive the in-game gradient), so it's not
        // surfaced here at all; don't wire it back into a node param.
        zenith:           rgbToHex(sky.zenithColor),
        horizonHeight,
        zenithHeight,
        apexHeight:       apexHeightOf(sky, mapSize),
        mapSize,
        albedo:           sky.albedo || '',
        glow:             sky.glow || '',
        cirrusTexture:    sky.cirrusTexture || '',
        cirrusColor:      rgbToHex(sky.cirrusColor),
        cirrusMultiplier: Number(sky.cirrusMultiplier) || 0,
        cirrusLayers:     cirrusLayersOf(sky),
        planets:          luaArray(sky.planets).length,
      },
      // Useful neighbours for texture nodes.
      cubeMap: (luaArray(data.cubeMaps)[0] || {}).path || data.skyCubePath || '',
    };
  } catch (err) {
    log.warn('[node-editor] read-skybox failed:', err.message);
    return { success: false, error: err.message };
  }
});

// ── Texture resolution ──────────────────────────────────────────────────────
// Game paths look like "/textures/environment/foo.dds" (inside a gamedata .scd)
// or "/maps/<map>/env/skybox/bar.dds" (next to the map). Absolute paths are
// allowed too, gated by the standard path guard.
const _scdCache = new Map(); // scdFile -> JSZip

async function loadZip(file) {
  if (_scdCache.has(file)) return _scdCache.get(file);
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  _scdCache.set(file, zip);
  return zip;
}

async function resolveTexture(texturePath, settings, mapName) {
  const p = String(texturePath || '').replace(/\\/g, '/').trim();
  if (!p) return null;

  if (isAbsolute(p)) return fs.existsSync(p) ? fs.readFileSync(p) : null;

  const rel = p.replace(/^\/+/, '');
  const candidates = [];

  const mapsMatch = /^maps\/([^/]+)\/(.+)$/i.exec(rel);
  if (mapsMatch) {
    const [, mName, rest] = mapsMatch;
    candidates.push(path.join(SCMAP_DIR, mName, rest));
    if (settings.mapsFolder) candidates.push(path.join(settings.mapsFolder, mName, rest));
  }
  if (mapName) {
    candidates.push(path.join(SCMAP_DIR, mapName, rel));
    if (settings.mapsFolder) candidates.push(path.join(settings.mapsFolder, mapName, rel));
  }
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return fs.readFileSync(c); } catch (_) {}
  }

  // Fall back to the gamedata archives (env.scd / textures.scd first).
  for (const gd of getGamedataPaths(settings)) {
    const gdDir = fs.existsSync(path.join(gd, 'gamedata')) ? path.join(gd, 'gamedata') : gd;
    let files = [];
    try {
      files = fs.readdirSync(gdDir).filter(f => /\.(scd|zip|nx2)$/i.test(f));
    } catch (_) { continue; }
    const ordered = [
      ...files.filter(f => /^(env|textures)\./i.test(f)),
      ...files.filter(f => !/^(env|textures)\./i.test(f)),
    ];
    for (const f of ordered) {
      try {
        const zip = await loadZip(path.join(gdDir, f));
        const key = Object.keys(zip.files).find(k => k.toLowerCase() === rel.toLowerCase());
        if (key) return await zip.files[key].async('nodebuffer');
      } catch (_) { /* try the next archive */ }
    }
  }
  return null;
}

// ── node-editor-load-texture ────────────────────────────────────────────────
ipcMain.handle('node-editor-load-texture', withPathGuard(
  ({ texturePath }) => (isAbsolute(String(texturePath || '').replace(/\\/g, '/')) ? [texturePath] : []),
  async (event, { texturePath, mapName } = {}) => {
    try {
      const settings = readSettings();
      const buf = await resolveTexture(texturePath, settings, mapName);
      if (!buf) return { success: false, error: `texture not found: ${texturePath}` };
      if (!/\.dds$/i.test(String(texturePath))) {
        return { success: false, error: 'only .dds textures are supported' };
      }
      const img = decodeDDSToRGBA(buf);
      if (!img?.data) return { success: false, error: 'unsupported DDS format (decode returned null)' };
      return {
        success: true,
        width: img.width,
        height: img.height,
        // base64 keeps the IPC payload compact and structured-clone friendly.
        rgba: Buffer.from(img.data).toString('base64'),
      };
    } catch (err) {
      log.warn('[node-editor] load-texture failed:', err.message);
      return { success: false, error: err.message };
    }
  },
));

// ── node-editor-list-assets ─────────────────────────────────────────────────
// Browse the stock game textures (waterramps, cirrus, envcubes …) so the Import
// node can offer them instead of making you know the paths by heart. Results
// are the in-game paths, i.e. exactly what load-texture takes.
const _assetIndex = new Map(); // gdDir -> string[] of "/textures/..." paths

async function indexGamedata(gdDir) {
  if (_assetIndex.has(gdDir)) return _assetIndex.get(gdDir);
  const out = [];
  let files = [];
  try {
    files = fs.readdirSync(gdDir).filter(f => /\.(scd|zip|nx2)$/i.test(f));
  } catch (_) { _assetIndex.set(gdDir, out); return out; }
  for (const f of files) {
    try {
      const zip = await loadZip(path.join(gdDir, f));
      for (const k of Object.keys(zip.files)) {
        if (/\.dds$/i.test(k) && !zip.files[k].dir) out.push('/' + k.replace(/^\/+/, ''));
      }
    } catch (_) { /* skip unreadable archive */ }
  }
  _assetIndex.set(gdDir, out);
  return out;
}

ipcMain.handle('node-editor-list-assets', async (event, { filter = '', limit = 400 } = {}) => {
  try {
    const settings = readSettings();
    const needle = String(filter || '').toLowerCase();
    const seen = new Set();
    const hits = [];
    for (const gd of getGamedataPaths(settings)) {
      const gdDir = fs.existsSync(path.join(gd, 'gamedata')) ? path.join(gd, 'gamedata') : gd;
      for (const p of await indexGamedata(gdDir)) {
        if (needle && !p.toLowerCase().includes(needle)) continue;
        const key = p.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push(p);
        if (hits.length >= limit) break;
      }
      if (hits.length >= limit) break;
    }
    hits.sort((a, b) => a.localeCompare(b));
    return { success: true, assets: hits };
  } catch (err) {
    log.warn('[node-editor] list-assets failed:', err.message);
    return { success: false, error: err.message, assets: [] };
  }
});

function register() {
  // handlers registered at module load time via ipcMain.handle above
}

module.exports = { register, resolveTexture };
