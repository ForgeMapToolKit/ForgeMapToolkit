'use strict';
/**
 * file-ipc.js — Generic file operation IPC handlers.
 *
 * Covers: save-blueprint, save-generated-file, load-image, save-config,
 *         load-config, backup-file, civilians-load/save-presets, check-update,
 *         open-external, write-file, read-file, read-file-base64, ensure-dir,
 *         list-dir, download-file, copy-file, delete-file,
 *         resolve-prop-to-emit, read-scenario-size, read-map-info,
 *         read-guide, read-footer-article.
 *
 * Exports:
 *   register(deps) — registers all IPC handlers in this module
 */

const path  = require('path');
const fs    = require('fs');
const https = require('https');
const { app, ipcMain, dialog, shell } = require('electron');
const JSZip = require('jszip');

const { log }                                                        = require('./logger');
const { withPathGuard: _withPathGuardBase }                          = require('./security');
const { readSettings, CIVILIANS_FILE, GITHUB_REPO, getGamedataPaths } = require('./settings');

function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

// ═══════════════════════════════════════════════════════════════════════════════
// IPC — FILE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('save-blueprint', async (event, content) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Save Blueprint',
    defaultPath: 'map_blueprint.lua',
    filters: [{ name: 'Lua Files', extensions: ['lua'] }, { name: 'All Files', extensions: ['*'] }],
  });
  if (filePath) {
    try {
      fs.writeFileSync(filePath, content);
      log.info('Blueprint saved:', filePath);
      return { success: true, path: filePath };
    } catch (e) {
      log.error('save-blueprint failed:', e);
      return { success: false, error: e.message };
    }
  }
  return { success: false };
});

ipcMain.handle('save-generated-file', async (event, { fileName, content }) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Save Generated File',
    defaultPath: fileName || 'output.lua',
    filters: [{ name: 'Lua Files', extensions: ['lua'] }, { name: 'All Files', extensions: ['*'] }],
  });
  if (filePath) {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      log.info('Generated file saved:', filePath);
      return { success: true, path: filePath };
    } catch (e) {
      log.error('save-generated-file failed:', e);
      return { success: false, error: e.message };
    }
  }
  return { success: false };
});

ipcMain.handle('load-image', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Select Map Preview Image',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
    properties: ['openFile'],
  });
  if (filePaths?.length) {
    try {
      const data = fs.readFileSync(filePaths[0]);
      const ext  = path.extname(filePaths[0]).slice(1);
      log.info('Image loaded:', filePaths[0]);
      return { success: true, data: `data:image/${ext};base64,${data.toString('base64')}` };
    } catch (e) {
      log.error('load-image failed:', e);
      return { success: false, error: e.message };
    }
  }
  return { success: false };
});

ipcMain.handle('save-config', async (event, config) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Save Configuration', defaultPath: 'map_config.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
  });
  if (filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
      log.info('Config saved:', filePath);
      return { success: true, path: filePath };
    } catch (e) {
      log.error('save-config failed:', e);
      return { success: false, error: e.message };
    }
  }
  return { success: false };
});

ipcMain.handle('load-config', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Load Configuration',
    filters: [{ name: 'JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
    properties: ['openFile'],
  });
  if (filePaths?.length) {
    try {
      const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
      log.info('Config loaded:', filePaths[0]);
      return { success: true, data };
    } catch (e) {
      log.error('load-config failed:', e);
      return { success: false, error: e.message };
    }
  }
  return { success: false };
});

// ═══════════════════════════════════════════════════════════════════════════════
// IPC — BACKUP
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('backup-file', async (event, { sourcePath, content }) => {
  try {
    const settings = readSettings();
    if (!settings.backupEnabled || !settings.backupFolder) {
      log.debug('Backup skipped — disabled or no folder set');
      return { success: false, reason: 'disabled' };
    }

    const ts       = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = sourcePath ? path.basename(sourcePath, path.extname(sourcePath)) : 'backup';
    const ext      = sourcePath ? path.extname(sourcePath) : '.lua';
    const dest     = path.join(settings.backupFolder, `${baseName}_${ts}${ext}`);

    fs.mkdirSync(settings.backupFolder, { recursive: true });
    fs.writeFileSync(dest, content);
    log.info('Backup created:', dest);

    if (settings.maxBackups > 0) {
      const files = fs.readdirSync(settings.backupFolder)
        .filter(f => f.startsWith(baseName))
        .sort();
      while (files.length > settings.maxBackups) {
        const removed = files.shift();
        fs.unlinkSync(path.join(settings.backupFolder, removed));
        log.debug('Old backup removed:', removed);
      }
    }

    return { success: true, path: dest };
  } catch (e) {
    log.error('backup-file failed:', e);
    return { success: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// IPC — CIVILIANS PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('civilians-load-presets', async () => {
  try {
    if (fs.existsSync(CIVILIANS_FILE)) {
      const presets = JSON.parse(fs.readFileSync(CIVILIANS_FILE, 'utf8'));
      log.debug(`Civilians presets loaded: ${presets.length} entries`);
      return presets;
    }
    return [];
  } catch (e) {
    log.error('civilians-load-presets failed:', e);
    return [];
  }
});

ipcMain.handle('civilians-save-presets', async (event, presets) => {
  try {
    fs.writeFileSync(CIVILIANS_FILE, JSON.stringify(presets, null, 2));
    log.info(`Civilians presets saved: ${presets.length} entries`);
    return { success: true };
  } catch (e) {
    log.error('civilians-save-presets failed:', e);
    return { success: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// IPC — UPDATE CHECK
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('check-update', async () => {
  log.info('Checking for updates from GitHub:', GITHUB_REPO);
  return new Promise(resolve => {
    const req = https.get({
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: { 'User-Agent': 'forgemaptoolkit' },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          const latest = r.tag_name?.replace(/^v/, '') ?? null;
          log.info(`Update check result — latest: ${latest}, current: ${app.getVersion()}`);
          resolve({ latestVersion: latest, downloadUrl: r.html_url ?? null, currentVersion: app.getVersion() });
        } catch (e) {
          log.error('check-update parse error:', e);
          resolve({ latestVersion: null, error: 'parse error' });
        }
      });
    });
    req.on('error', e => {
      log.error('check-update network error:', e);
      resolve({ latestVersion: null, error: e.message });
    });
    req.setTimeout(5000, () => {
      log.warn('check-update timed out');
      req.destroy();
      resolve({ latestVersion: null, error: 'timeout' });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IPC — MISC
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('open-external', async (event, url) => {
  const { shell } = require('electron');
  // Security fix: only allow http/https URLs — prevents opening executables
  let parsed;
  try { parsed = new URL(url); } catch { return { success: false, error: 'Invalid URL' }; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    log.warn('[open-external] Blocked non-http(s) URL:', url);
    return { success: false, error: 'Only https/http URLs are allowed' };
  }
  log.info('Opening external URL:', url);
  await shell.openExternal(url);
  return { success: true };
});

// ═══════════════════════════════════════════════════════════════════════════════
// IPC — GUIDE MARKDOWN
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('read-guide', async (event, mdFile) => {
  // Sanitise: only allow simple filenames — no path traversal
  if (!mdFile || /[/\\]/.test(mdFile) || !mdFile.endsWith('.md')) {
    log.warn('[read-guide] Blocked unsafe mdFile:', mdFile);
    return null;
  }
  const guidesDir = path.join(app.getAppPath(), 'src', 'guides', 'content');
  const filePath  = path.join(guidesDir, mdFile);
  // Double-check resolved path is still inside guidesDir
  if (!filePath.startsWith(guidesDir)) {
    log.warn('[read-guide] Path traversal attempt:', filePath);
    return null;
  }
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    log.warn('[read-guide] File not found:', filePath);
    return null;
  }
});

// ── read-footer-article ───────────────────────────────────────────────────────
// Reads a pre-rendered HTML article from src/components/Core/Footer/content/.
// Mirrors the security model of 'read-guide': only bare filenames allowed,
// no path separators, must end in .html.
//
// Args:    htmlFile  — bare filename, e.g. 'about-fmt.html'
// Returns: string (file contents) | null (not found or blocked)
ipcMain.handle('read-footer-article', async (event, htmlFile) => {
  // Sanitise: only simple filenames — no path traversal
  if (!htmlFile || /[/\\]/.test(htmlFile) || !htmlFile.endsWith('.html')) {
    log.warn('[read-footer-article] Blocked unsafe htmlFile:', htmlFile);
    return null;
  }

  const contentDir = path.join(
    app.getAppPath(),
    'src', 'components', 'Core', 'Footer', 'content'
  );
  const filePath = path.join(contentDir, htmlFile);

  // Double-check resolved path is still inside contentDir
  if (!filePath.startsWith(contentDir)) {
    log.warn('[read-footer-article] Path traversal attempt:', filePath);
    return null;
  }

  try {
    const text = fs.readFileSync(filePath, 'utf8');
    log.debug('[read-footer-article] Loaded:', filePath);
    return text;
  } catch (e) {
    log.warn('[read-footer-article] File not found:', filePath);
    return null;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// IPC — TREEMAP FILE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('write-file', withPathGuard(
  ({ filePath }) => [filePath],
  async (event, { filePath, content }) => {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      log.debug('File written:', filePath);
      return { success: true };
    } catch (e) {
      log.error('write-file failed:', filePath, e);
      return { success: false, error: e.message };
    }
  }
));

ipcMain.handle('read-file', withPathGuard(
  ({ path: filePath }) => [filePath],
  async (event, { path: filePath }) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return { success: true, content };
    } catch (e) {
      log.error('read-file failed:', filePath, e);
      return { success: false, error: e.message };
    }
  }
));

ipcMain.handle('read-file-base64', withPathGuard(
  ({ path: filePath }) => [filePath],
  async (event, { path: filePath }) => {
    try {
      const content = fs.readFileSync(filePath).toString('base64');
      return { success: true, content };
    } catch (e) {
      log.error('read-file-base64 failed:', filePath, e);
      return { success: false, error: e.message };
    }
  }
));
// ── resolve-prop-to-emit ──────────────────────────────────────────────────────
// Given a game-path ending in _prop.bp (e.g. /env/Desert/Props/Emitters/Foo_prop.bp),
// finds the sibling _script.lua inside the SCD archives, parses the first
// CreateEmitterAtBone call, and returns the _emit.bp game-path.
//
// Args:    { propGamePath }   — game-path as stored in emitterPaths, leading slash OK
// Returns: { success, emitPath }  |  { success: false, error }
// Persistent disk cache: prop gamePath -> emit gamePath
// Stored in userData/prop_emit_cache.json — survives app restarts
const PROP_EMIT_CACHE_FILE = path.join(app.getPath('userData'), 'prop_emit_cache.json');
let _propEmitCache = {};
try {
  if (fs.existsSync(PROP_EMIT_CACHE_FILE)) {
    _propEmitCache = JSON.parse(fs.readFileSync(PROP_EMIT_CACHE_FILE, 'utf8'));
    log.info(`[resolve-prop-to-emit] Loaded disk cache: ${Object.keys(_propEmitCache).length} entries`);
  }
} catch (_) {}

function savePropEmitCache() {
  try { fs.writeFileSync(PROP_EMIT_CACHE_FILE, JSON.stringify(_propEmitCache, null, 2)); } catch (_) {}
}

// Session-level ZIP cache — avoids reloading env.scd multiple times per session
const _scdZipCache = {};
async function getScdZip(scdPath) {
  const mtime = fs.statSync(scdPath).mtimeMs;
  if (_scdZipCache[scdPath] && _scdZipCache[scdPath].mtime === mtime) {
    return _scdZipCache[scdPath].zip;
  }
  const buf = fs.readFileSync(scdPath);
  const zip = await JSZip.loadAsync(buf);
  _scdZipCache[scdPath] = { zip, mtime };
  return zip;
}

ipcMain.handle('resolve-prop-to-emit', async (event, { propGamePath }) => {
  try {
    const settings     = readSettings();
    const gamedataDirs = getGamedataPaths(settings);

    if (gamedataDirs.length === 0) {
      return { success: false, error: 'No gamedata folder configured.' };
    }

    // Check disk cache first
    const cacheKey = propGamePath.toLowerCase();
    if (_propEmitCache[cacheKey]) {
      log.info(`[resolve-prop-to-emit] Cache hit: ${propGamePath} -> ${_propEmitCache[cacheKey]}`);
      return { success: true, emitPath: _propEmitCache[cacheKey] };
    }

    const normalized  = propGamePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const scriptInZip = normalized.replace(/_prop\.bp$/i, '_script.lua');

    log.info(`[resolve-prop-to-emit] Looking for: ${scriptInZip}`);

    // Check the SCD that matches the path prefix first (env/... -> env.scd)
    const preferredScd = normalized.split('/')[0].toLowerCase() + '.scd';

    for (const gamedataDir of gamedataDirs) {
      if (!fs.existsSync(gamedataDir)) continue;

      const allScd = fs.readdirSync(gamedataDir)
        .filter(f => f.endsWith('.scd') || f.endsWith('.zip') || f.endsWith('.nx2'));

      const ordered = [
        ...allScd.filter(f => f.toLowerCase() === preferredScd),
        ...allScd.filter(f => f.toLowerCase() !== preferredScd),
      ];

      for (const scdFile of ordered) {
        const scdPath = path.join(gamedataDir, scdFile);
        try {
          const zip = await getScdZip(scdPath);

          const entry = Object.entries(zip.files).find(([p]) =>
            p.replace(/\\/g, '/').toLowerCase() === scriptInZip.toLowerCase()
          );

          if (!entry) continue;

          const luaContent = await entry[1].async('string');
          log.info(`[resolve-prop-to-emit] Found script in ${scdFile}`);

          const match = luaContent.match(/CreateEmitterAtBone\s*\([^,]+,[^,]+,[^,]+,\s*['"]([^'"]+_emit\.bp)['"]/i);
          if (!match) {
            return { success: false, error: `No CreateEmitterAtBone(_emit.bp) in script.\n\n${luaContent.slice(0, 400)}` };
          }

          const emitPath = match[1].startsWith('/') ? match[1] : '/' + match[1];
          log.info(`[resolve-prop-to-emit] Resolved: ${propGamePath} -> ${emitPath}`);
          _propEmitCache[cacheKey] = emitPath;
          savePropEmitCache();
          return { success: true, emitPath };

        } catch (zipErr) {
          log.warn(`[resolve-prop-to-emit] Could not read ${scdFile}:`, zipErr.message);
        }
      }
    }

    return { success: false, error: `No _script.lua found for "${propGamePath}".` };
  } catch (e) {
    log.error('[resolve-prop-to-emit] failed:', e);
    return { success: false, error: e.message };
  }
});

// ── read-scenario-size ────────────────────────────────────────────────────────
// Reads the scenario.lua from a map folder and extracts size = {W, H}.
// Returns { success, width, height } where width/height are in scmap units.
ipcMain.handle('read-scenario-size', withPathGuard(
  ({ mapFolderPath }) => [mapFolderPath],
  async (event, { mapFolderPath }) => {
  try {
    // Find the scenario lua file (named *_scenario.lua)
    const entries = fs.readdirSync(mapFolderPath);
    const scenarioFile = entries.find(f => f.toLowerCase().endsWith('_scenario.lua'));
    if (!scenarioFile) {
      return { success: false, error: 'No _scenario.lua found in map folder' };
    }
    const luaContent = fs.readFileSync(path.join(mapFolderPath, scenarioFile), 'utf8');
    // Extract size = {W, H}
    const match = luaContent.match(/size\s*=\s*\{\s*(\d+)\s*,\s*(\d+)\s*\}/);
    if (!match) {
      return { success: false, error: 'Could not parse size from scenario.lua' };
    }
    const width  = parseInt(match[1]);
    const height = parseInt(match[2]);
    log.info(`[skybox] read-scenario-size: ${scenarioFile} → ${width}×${height}`);
    return { success: true, width, height };
  } catch (err) {
    log.error('[skybox] read-scenario-size failed:', err.message);
    return { success: false, error: err.message };
  }
}));

// ── read-map-info ─────────────────────────────────────────────────────────────
// Reads save.lua and extracts RECTANGLE(x1, y1, x2, y2) — the playable area.
// x2-x1 == y2-y1 == map size in scmap units (1024 = 20km, 512 = 10km, etc.)
// Returns { success, mapSize, km, x1, y1, x2, y2 }
ipcMain.handle('read-map-info', withPathGuard(
  ({ mapFolderPath }) => [mapFolderPath],
  async (event, { mapFolderPath }) => {
  try {
    let entries;
    try { entries = fs.readdirSync(mapFolderPath); }
    catch (_) {
      log.debug(`[map-info] folder not found: ${mapFolderPath}`);
      return { success: false, error: 'Map folder not found' };
    }
    const saveFile = entries.find(f => f.toLowerCase().endsWith('_save.lua'));
    if (!saveFile) {
      log.debug(`[map-info] no _save.lua in ${mapFolderPath}`);
      return { success: false, error: 'No _save.lua found in map folder' };
    }
    const lua = fs.readFileSync(path.join(mapFolderPath, saveFile), 'utf8');
    // RECTANGLE( x1, y1, x2, y2 ) — tolerates spaces and integer or float values
    const m = lua.match(/RECTANGLE\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
    if (!m) {
      log.debug(`[map-info] no RECTANGLE in ${saveFile}`);
      return { success: false, error: 'No RECTANGLE found in _save.lua' };
    }
    const x1 = parseFloat(m[1]), y1 = parseFloat(m[2]);
    const x2 = parseFloat(m[3]), y2 = parseFloat(m[4]);
    // Map size = x1 + x2 (the rectangle is inset from both edges by x1):
    //   RECTANGLE(  0,   0, 1024, 1024) → 0    + 1024 = 1024
    //   RECTANGLE(128, 128,  896,  896) → 128  +  896 = 1024
    //   RECTANGLE( 64,  64,  448,  448) → 64   +  448 = 512
    const mapSize = Math.round(x1 + x2);
    const playableSize = Math.round(x2 - x1); // actual playable units
    const km      = (mapSize / 51.2).toFixed(1);
    const playableKm = (playableSize / 51.2).toFixed(1);
    log.info(`[map-info] ${saveFile} → RECTANGLE(${x1},${y1},${x2},${y2}) mapSize=${mapSize} (${km} km), playable=${playableSize} (${playableKm} km)`);
    return { success: true, mapSize, km, playableSize, playableKm, x1, y1, x2, y2 };
  } catch (err) {
    log.debug('[map-info] read-map-info failed:', err.message);
    return { success: false, error: err.message };
  }
}));



ipcMain.handle('ensure-dir', withPathGuard(
  ({ dirPath }) => [dirPath],
  async (event, { dirPath }) => {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      log.debug('Directory ensured:', dirPath);
      return { success: true };
    } catch (e) {
      log.error('ensure-dir failed:', dirPath, e);
      return { success: false, error: e.message };
    }
  }
));

ipcMain.handle('list-dir', withPathGuard(
  ({ dirPath }) => [dirPath],
  async (event, { dirPath }) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      log.debug(`list-dir: ${dirPath} — ${entries.length} entries`);
      return {
        success: true,
        entries: entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() })),
      };
    } catch (e) {
      log.error('list-dir failed:', dirPath, e);
      return { success: false, error: e.message };
    }
  }
));

// ═══════════════════════════════════════════════════════════════════════════════
// IPC — DOWNLOAD FILE FROM URL → LOCAL PATH
// Used by SkyboxGeneratorTab to download required DDS/texture files from
// the GitHub Assets repo into the map folder when applying a library skybox.
// ═══════════════════════════════════════════════════════════════════════════════
ipcMain.handle('download-file', withPathGuard(
  ({ dest }) => [dest],
  async (event, { url, dest }) => {
    // Security: only allow https downloads
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        log.warn('[security] download-file blocked non-https URL:', url);
        return { success: false, error: 'Only https URLs are allowed for downloads' };
      }
    } catch {
      return { success: false, error: 'Invalid URL' };
    }

    try {
      // Ensure destination directory exists
      fs.mkdirSync(path.dirname(dest), { recursive: true });

      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);

        const doGet = (targetUrl) => {
          const urlObj = new URL(targetUrl);
          const opts = {
            hostname: urlObj.hostname,
            path:     urlObj.pathname + urlObj.search,
            headers:  { 'User-Agent': 'ForgeMapToolkit' },
          };
          https.get(opts, res => {
            // Follow redirects (GitHub raw sometimes redirects)
            if (res.statusCode === 301 || res.statusCode === 302) {
              return doGet(res.headers.location);
            }
            if (res.statusCode !== 200) {
              file.destroy();
              return reject(new Error(`HTTP ${res.statusCode} for ${targetUrl}`));
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
            file.on('error', reject);
          }).on('error', reject);
        };

        doGet(url);
      });

      log.info(`download-file: ${url} → ${dest}`);
      return { success: true };
    } catch (e) {
      log.error('download-file failed:', url, '→', dest, e);
      return { success: false, error: e.message };
    }
  }
));

ipcMain.handle('copy-file', withPathGuard(
  ({ src, dest }) => [src, dest],
  async (event, { src, dest }) => {
    try {
      fs.copyFileSync(src, dest);
      log.debug('File copied:', src, '→', dest);
      return { success: true };
    } catch (e) {
      log.error('copy-file failed:', src, '→', dest, e);
      return { success: false, error: e.message };
    }
  }
));

ipcMain.handle('delete-file', withPathGuard(
  ({ filePath }) => [filePath],
  async (event, { filePath }) => {
    try {
      fs.unlinkSync(filePath);
      log.debug('File deleted:', filePath);
      return { success: true };
    } catch (e) {
      log.warn('delete-file failed (non-fatal):', filePath, e.message);
      return { success: false, error: e.message };
    }
  }
));



/**
 * Register all file-operation IPC handlers.
 */
function register() {
  // handlers registered at module load time via ipcMain.handle above
}

module.exports = { register };
