'use strict';
/**
 * texture-scanner.js — scans FAF + base-game archives for .dds textures and
 * caches the result, so the Node Editor's "Texture Import" node can browse
 * without re-reading every .scd on each open.
 *
 * Mirrors scanner.js's archive-walking pattern (same JSZip loop, same
 * getGamedataPaths() source list) but only collects texture entries instead
 * of parsing blueprints — this is a *much* cheaper pass, so it's kept as its
 * own cache/IPC surface rather than piggy-backing on runFullScan.
 *
 * Cache shape (TEXTURES_FILE):
 *   {
 *     scannedAt: ISOString,
 *     textures: [
 *       { name: 'purplecrystal07_albedo.dds',
 *         gamePath: '/env/desert/props/purplecrystal07_albedo.dds',
 *         source: 'env_desert.scd' },
 *       ...
 *     ]
 *   }
 *
 * IPC:
 *   texture-library-load  → { scanned, scannedAt?, textures }
 *   texture-library-scan  → { success, count } | { success:false, error }
 *   texture-extract       → { success, dataUrl } | { success:false, error }
 *                           (needs modules/dds.js to gain a buffer-based
 *                            decode path — see note at bottom of file)
 */

const path  = require('path');
const fs    = require('fs');
const { app, ipcMain } = require('electron');
const JSZip = require('jszip');
const { log, yieldTick } = require('./logger');
const { readSettings, getGamedataPaths } = require('./settings');

const TEXTURES_FILE = path.join(app.getPath('userData'), 'textures-cache.json');

function readTextureLibrary() {
  try {
    if (fs.existsSync(TEXTURES_FILE)) {
      return JSON.parse(fs.readFileSync(TEXTURES_FILE, 'utf8'));
    }
  } catch (e) { log.error('readTextureLibrary failed:', e); }
  return null;
}

function writeTextureLibrary(data) {
  try {
    fs.writeFileSync(TEXTURES_FILE, JSON.stringify(data, null, 2));
    log.debug('Texture cache written to disk');
  } catch (e) {
    log.error('writeTextureLibrary failed:', e);
    throw e;
  }
}

/** Walk one gamedata folder's archives, collecting every .dds entry. */
async function scanTextureFolder(gamedataFolder) {
  const out = [];
  if (!gamedataFolder || !fs.existsSync(gamedataFolder)) {
    log.warn(`scanTextureFolder: folder does not exist: ${gamedataFolder}`);
    return out;
  }

  const scdFiles = fs.readdirSync(gamedataFolder)
    .filter(f => f.endsWith('.scd') || f.endsWith('.zip') || f.endsWith('.nx2'));

  log.info(`Scanning textures in ${gamedataFolder} — ${scdFiles.length} SCD/ZIP files`);

  for (const scdFile of scdFiles) {
    await yieldTick(1);
    try {
      const buf = fs.readFileSync(path.join(gamedataFolder, scdFile));
      const zip = await JSZip.loadAsync(buf);
      for (const [filePath, file] of Object.entries(zip.files)) {
        if (file.dir) continue;
        if (!filePath.toLowerCase().endsWith('.dds')) continue;
        await yieldTick(200);
        const normPath = '/' + filePath.replace(/\\/g, '/');
        out.push({
          name: path.basename(filePath),
          gamePath: normPath,
          source: scdFile,
        });
      }
    } catch (e) {
      log.error(`scanTextureFolder: failed to read ${scdFile}:`, e);
    }
  }

  return out;
}

async function runTextureScan(settings) {
  log.info('Starting texture scan...');
  const gdPaths = getGamedataPaths(settings);
  log.info(`Texture scan — gamedata paths: ${gdPaths.join(', ') || '(none)'}`);

  const combined = [];
  const seen = new Set();
  for (const gdPath of gdPaths) {
    const found = await scanTextureFolder(gdPath);
    for (const t of found) {
      const key = t.gamePath.toLowerCase();
      if (!seen.has(key)) { seen.add(key); combined.push(t); }
    }
  }

  combined.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const cache = { scannedAt: new Date().toISOString(), textures: combined };
  writeTextureLibrary(cache);
  log.info(`Texture scan complete — ${combined.length} textures`);
  return cache;
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC
// ═══════════════════════════════════════════════════════════════════════════

ipcMain.handle('texture-library-load', async () => {
  const data = readTextureLibrary();
  if (!data) return { scanned: false, textures: [] };
  return { scanned: true, ...data };
});

ipcMain.handle('texture-library-scan', async () => {
  try {
    const settings = readSettings();
    const cache = await runTextureScan(settings);
    return { success: true, count: cache.textures.length };
  } catch (e) {
    log.error('texture-library-scan IPC failed:', e);
    return { success: false, error: e.message };
  }
});

// NEEDS modules/dds.js: 'dds-to-dataurl' currently only accepts a filesystem
// path (see PropPreviewImg.jsx / TextureEditor.jsx usage), but gamedata
// textures live *inside* the .scd/.zip archives, not as loose files. This
// handler re-opens the archive, extracts the entry to a Buffer, and needs a
// decode-from-buffer path from modules/dds.js (its current export surface
// isn't in front of me — flagging rather than guessing at its API).
ipcMain.handle('texture-extract', async (event, { source, gamePath }) => {
  try {
    const settings = readSettings();
    const gdPaths = getGamedataPaths(settings);
    const entryPath = gamePath.replace(/^\//, '');
    for (const gdPath of gdPaths) {
      const archivePath = path.join(gdPath, source);
      if (!fs.existsSync(archivePath)) continue;
      const buf = fs.readFileSync(archivePath);
      const zip = await JSZip.loadAsync(buf);
      const entry = zip.files[entryPath];
      if (!entry) continue;
      const ddsBuf = await entry.async('nodebuffer');
      // TODO: replace with real decode once modules/dds.js exposes a
      // buffer-based function, e.g. decodeDdsBufferToDataUrl(ddsBuf).
      const { decodeDdsBufferToDataUrl } = require('./dds');
      if (typeof decodeDdsBufferToDataUrl !== 'function') {
        return { success: false, error: 'modules/dds.js has no buffer-decode export yet' };
      }
      const dataUrl = await decodeDdsBufferToDataUrl(ddsBuf);
      return { success: true, dataUrl };
    }
    return { success: false, error: `texture not found: ${source}${gamePath}` };
  } catch (e) {
    log.error('texture-extract IPC failed:', e);
    return { success: false, error: e.message };
  }
});

module.exports = {
  readTextureLibrary,
  writeTextureLibrary,
  runTextureScan,
  TEXTURES_FILE,
};
