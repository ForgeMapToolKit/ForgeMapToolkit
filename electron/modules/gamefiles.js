'use strict';
/**
 * gamefiles.js — one way to read a file out of a Supreme Commander installation.
 *
 * A game path (`/env/Evergreen/props/Rock01_lod0.scm`) can live in three places,
 * and which one wins depends on context: a map's own folder shadows the stock
 * asset of the same name, and the stock asset itself sits inside a `.scd` — a
 * plain ZIP — rather than loose on disk.
 *
 *   resolveGameFile('/units/UEL0201/UEL0201_lod0.scm', settings, null,
 *                   { prefer: ['units.'] })   → Buffer | null
 *
 * `prefer` only reorders the archive search. Props live in `env.scd`, units in
 * `units.scd`, textures in `textures.scd`; naming the likely one first turns a
 * scan of every archive into a single hit. It is a hint, never a filter — an
 * asset that has been moved is still found, just later.
 *
 * This duplicates logic that already exists twice in this folder
 * (`file-ipc.js` getScdZip / `node-editor.js` resolveTexture), each with its own
 * ZIP cache. Those two are left alone here because they work; new callers use
 * this module so the count stops at three and can come down later.
 */

const path  = require('path');
const fs    = require('fs');
const JSZip = require('jszip');
const { log } = require('./logger');
const { SCMAP_DIR, getGamedataPaths } = require('./settings');

const isAbsolute = (p) => /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\');

// Archives are opened once per session and keyed by mtime, so a re-scan after
// the user patches their install picks the new file up without a restart.
const _zipCache = new Map(); // absolute .scd path -> { zip, mtime }

async function loadZip(file) {
  const mtime = fs.statSync(file).mtimeMs;
  const hit = _zipCache.get(file);
  if (hit && hit.mtime === mtime) return hit.zip;
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  _zipCache.set(file, { zip, mtime });
  return zip;
}

/** The gamedata archives of one install root, likely candidates first. */
function archivesIn(installRoot, prefer) {
  const dir = fs.existsSync(path.join(installRoot, 'gamedata'))
    ? path.join(installRoot, 'gamedata')
    : installRoot;
  let files = [];
  try {
    files = fs.readdirSync(dir).filter(f => /\.(scd|zip|nx2)$/i.test(f));
  } catch (_) { return []; }

  const isPreferred = (f) => prefer.some(p => f.toLowerCase().startsWith(p.toLowerCase()));
  return [
    ...files.filter(isPreferred),
    ...files.filter(f => !isPreferred(f)),
  ].map(f => path.join(dir, f));
}

/**
 * Read a game asset by its in-game path.
 *
 * @param {string} filePath   `/env/…/x.scm`, or an absolute path on disk
 * @param {object} settings   the settings object (for mapsFolder + install roots)
 * @param {string|null} mapName  when set, that map's folder is searched first
 * @param {{prefer?: string[]}} opts  archive-name prefixes to try first
 * @returns {Promise<Buffer|null>}  null when the asset is nowhere to be found
 */
async function resolveGameFile(filePath, settings, mapName = null, opts = {}) {
  const prefer = opts.prefer || [];
  const p = String(filePath || '').replace(/\\/g, '/').trim();
  if (!p) return null;

  if (isAbsolute(p)) {
    try { return fs.existsSync(p) ? fs.readFileSync(p) : null; } catch (_) { return null; }
  }

  const rel = p.replace(/^\/+/, '');

  // 1. Loose on disk, next to a map. `/maps/<name>/…` names its own map;
  //    otherwise the caller's current map is the one that may shadow.
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

  // 2. Loose on disk inside the install (modded/unpacked installs).
  for (const root of getGamedataPaths(settings)) {
    const loose = path.join(root, rel.replace(/\//g, path.sep));
    try { if (fs.existsSync(loose)) return fs.readFileSync(loose); } catch (_) {}
  }

  // 3. The gamedata archives.
  for (const root of getGamedataPaths(settings)) {
    for (const archive of archivesIn(root, prefer)) {
      try {
        const zip = await loadZip(archive);
        const key = Object.keys(zip.files).find(k =>
          k.replace(/\\/g, '/').toLowerCase() === rel.toLowerCase());
        if (key && !zip.files[key].dir) return await zip.files[key].async('nodebuffer');
      } catch (e) {
        log.warn(`[gamefiles] unreadable archive ${path.basename(archive)}: ${e.message}`);
      }
    }
  }

  return null;
}

module.exports = { resolveGameFile, isAbsolute };
