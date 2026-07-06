'use strict';
/**
 * settings.js — App settings, autosave, and their IPC handlers.
 *
 * Exports:
 *   SETTINGS_FILE, LIBRARIES_FILE, CIVILIANS_FILE, SCMAP_DIR, GITHUB_REPO
 *   readSettings(), writeSettings(s)
 *   scheduleAutosave(settings)
 *   copyDirSync(src, dest)
 *   getRunnerPath(), getNodeExe(), getGamedataPaths(settings)
 *   register(deps) — registers all settings + autosave IPC handlers
 *
 * Headless-compatible: wenn Electron nicht verfügbar ist, wird app.getPath('userData')
 * durch einen plattformspezifischen Fallback ersetzt. Explizit überschreibbar via
 * Umgebungsvariable FMT_USER_DATA.
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ═══════════════════════════════════════════════════════════════════════════════
// ELECTRON SHIM
// Lädt Electron-Deps nur wenn verfügbar. Im CLI-Kontext sind sie null.
// ═══════════════════════════════════════════════════════════════════════════════

let _app        = null;
let _ipcMain    = null;
let _dialog     = null;
let _BrowserWindow = null;

try {
  const electron  = require('electron');
  _app            = electron.app;
  _ipcMain        = electron.ipcMain;
  _dialog         = electron.dialog;
  _BrowserWindow  = electron.BrowserWindow;
} catch (_) {
  // Läuft headless — Electron nicht verfügbar
}

// userData-Pfad: explizite Env-Var > Electron > plattformspezifischer Fallback
function resolveUserDataPath() {
  if (process.env.FMT_USER_DATA) return process.env.FMT_USER_DATA;
  if (_app) {
    try { return _app.getPath('userData'); } catch (_) {}
  }
  // Plattform-Fallback (spiegelt Electrons Standardverhalten)
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ForgeMapToolkit');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'ForgeMapToolkit');
  }
  return path.join(os.homedir(), '.config', 'ForgeMapToolkit');
}

const { log, yieldTick, LOG_LEVELS } = require('./logger');
const JSZip = require('jszip');

// ═══════════════════════════════════════════════════════════════════════════════
// FILE PATHS
// ═══════════════════════════════════════════════════════════════════════════════

const USER_DATA      = resolveUserDataPath();
const SETTINGS_FILE  = path.join(USER_DATA, 'settings.json');
const LIBRARIES_FILE = path.join(USER_DATA, 'libraries.json');
const CIVILIANS_FILE = path.join(USER_DATA, 'civilians_custom_presets.json');
const SCMAP_DIR      = path.join(USER_DATA, 'scmap');
const GITHUB_REPO    = 'timmasalme/ForgeMapToolkit';

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS = {
  faInstallPath:        '',
  fafPath:              '',
  mapsFolder:           '',
  mapName:              '',
  emitterBpFolder:      '',
  backupEnabled:        false,
  backupFolder:         '',
  maxBackups:           20,
  defaultMapSize:       '512',
  startTab:             null,
  defaultExportFormat:  'script',
  generateReadme:       true,
  defaultDecimalCoords: 2,
  defaultDecimalHeading:2,
  maxWorkers:           4,
  hardwareAccel:        true,
  logLevel:             'all',
  devTools:             false,
  firstRun:             true,
  appVersion:           (_app ? _app.getVersion() : '0.0.0'),
  // Autosave
  autosaveEnabled:      false,
  autosaveInterval:     15,
  autosaveMapName:      '',
  autosavePath:         '',
  autosaveVersioned:    false,
  autosaveLastRun:      null,
};

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      log.debug('Settings loaded from disk');
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) { log.error('readSettings failed:', e); }
  log.info('No settings file found — using defaults');
  return { ...DEFAULT_SETTINGS };
}

function writeSettings(s) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
    log.debug('Settings written to disk');
  } catch (e) {
    log.error('writeSettings failed:', e);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOSAVE
// ═══════════════════════════════════════════════════════════════════════════════

let _autosaveTimer = null;

function copyDirSync(src, dest) {
  const base   = path.basename(src);
  const target = path.join(dest, base);
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, path.dirname(destPath));
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  return target;
}

async function runAutosave() {
  const s = readSettings();
  if (!s.autosaveEnabled || !s.mapsFolder || !s.autosaveMapName || !s.autosavePath) {
    log.debug('[autosave] skipped — not fully configured');
    return;
  }

  const src = path.join(s.mapsFolder, s.autosaveMapName);
  if (!fs.existsSync(src)) {
    log.warn(`[autosave] source folder not found: ${src}`);
    return;
  }

  try {
    let dest = s.autosavePath;
    if (s.autosaveVersioned) {
      const ts    = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const vName = `${s.autosaveMapName}_${ts}`;
      dest        = path.join(s.autosavePath, vName);
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const sp = path.join(src, entry.name);
        const dp = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDirSync(sp, dest);
        else fs.copyFileSync(sp, dp);
      }
      log.info(`[autosave] versioned copy → ${dest}`);
    } else {
      const fixed = path.join(s.autosavePath, s.autosaveMapName);
      if (fs.existsSync(fixed)) fs.rmSync(fixed, { recursive: true, force: true });
      copyDirSync(src, s.autosavePath);
      log.info(`[autosave] copy → ${fixed}`);
    }

    const updated = { ...s, autosaveLastRun: new Date().toISOString() };
    writeSettings(updated);
    notifyRenderer('autosave-complete', { success: true, ts: updated.autosaveLastRun });
  } catch (e) {
    log.error('[autosave] failed:', e);
    notifyRenderer('autosave-complete', { success: false, error: e.message });
    notifyRenderer('app-error', { title: 'Autosave Failed', message: e.message, type: 'error' });
  }
}

function scheduleAutosave(settings) {
  if (_autosaveTimer) { clearInterval(_autosaveTimer); _autosaveTimer = null; }
  if (!settings.autosaveEnabled || !settings.autosaveInterval) return;

  const intervalMs = settings.autosaveInterval * 60 * 1000;

  if (settings.autosaveLastRun) {
    const elapsed = Date.now() - new Date(settings.autosaveLastRun).getTime();
    if (elapsed >= intervalMs) {
      log.info(`[autosave] catch-up: ${Math.round(elapsed / 60000)} min since last run`);
      runAutosave();
    }
  }

  _autosaveTimer = setInterval(() => {
    log.debug('[autosave] interval fired');
    runAutosave();
  }, intervalMs);

  log.info(`[autosave] scheduled every ${settings.autosaveInterval} min`);
}

// ── Windows Task Scheduler ────────────────────────────────────────────────────

const TASK_NAME = 'ForgeMapToolkit_Autosave';

function getRunnerPath() {
  const appPath = _app ? _app.getAppPath() : path.resolve(__dirname, '..');
  return path.join(appPath, 'utils', 'autosave-runner.js');
}

function getNodeExe() {
  const resourcesPath = _app ? (process.resourcesPath || '') : '';
  const bundled = path.join(resourcesPath, 'node.exe');
  if (bundled && fs.existsSync(bundled)) return bundled;
  return 'node';
}

async function syncAutosaveTask(settings) {
  if (!_app) return; // Nicht verfügbar im headless-Modus
  const { execFile }      = require('child_process');
  const { promisify }     = require('util');
  const execFileAsync     = promisify(execFile);

  const fullyConfigured = settings.autosaveEnabled
    && settings.mapsFolder
    && settings.autosaveMapName
    && settings.autosavePath;

  if (!fullyConfigured) {
    try {
      await execFileAsync('schtasks.exe', ['/Delete', '/TN', TASK_NAME, '/F'], { windowsHide: true });
      log.info('[autosave-task] removed');
    } catch (_) {}
    return;
  }

  const nodeExe     = getNodeExe();
  const runner      = getRunnerPath();
  const userData    = USER_DATA;
  const intervalMin = Math.max(1, Math.round(settings.autosaveInterval || 15));

  const args = [
    '/Create', '/F',
    '/TN', TASK_NAME,
    '/SC', 'MINUTE',
    '/MO', String(intervalMin),
    '/TR', `"${nodeExe}" "${runner}" "${userData}"`,
  ];

  try {
    await execFileAsync('schtasks.exe', args, { windowsHide: true });
    log.info(`[autosave-task] registered — every ${intervalMin} min`);
  } catch (e) {
    log.error('[autosave-task] register failed:', e.message);
  }
}

// ── Helpers (werden von anderen Modulen genutzt) ──────────────────────────────

function getGamedataPaths(settings) {
  const paths = [];
  if (settings.faInstallPath) paths.push(settings.faInstallPath);
  if (settings.fafPath)       paths.push(settings.fafPath);
  return paths;
}

function notifyRenderer(channel, data) {
  if (!_BrowserWindow) return;
  try {
    for (const win of _BrowserWindow.getAllWindows()) {
      try { if (!win.isDestroyed()) win.webContents.send(channel, data); } catch (_) {}
    }
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// IPC HANDLERS — nur registrieren wenn Electron verfügbar
// ═══════════════════════════════════════════════════════════════════════════════

function register(deps) {
  if (!_ipcMain) return; // headless — keine IPC-Handler registrieren

  _ipcMain.handle('settings-load', async () => readSettings());

  _ipcMain.handle('settings-save', async (event, newSettings) => {
    try {
      const old = readSettings();
      writeSettings(newSettings);

      if (newSettings.logLevel && LOG_LEVELS[newSettings.logLevel] !== undefined) {
        log.info(`Log level set to: ${newSettings.logLevel}`);
      }

      scheduleAutosave(newSettings);
      syncAutosaveTask(newSettings).catch(e => log.warn('[autosave-task] sync failed:', e.message));

      const pathKeys     = ['faInstallPath', 'fafPath', 'emitterBpFolder'];
      const pathsChanged = pathKeys.some(k => old[k] !== newSettings[k]);
      const hasValidPath = newSettings.faInstallPath || newSettings.fafPath;

      if (deps && pathsChanged && hasValidPath) {
        log.info('Paths changed — triggering auto-scan');
        notifyRenderer('library-scan-started', {});
        const existing   = deps.readLibraries();
        const customTags = existing?.customEmitterTags || {};
        deps.runFullScan(newSettings, customTags)
          .then(libs => notifyRenderer('library-scan-complete', {
            success: true,
            counts: { emitters: libs.emitters.length, props: libs.props.length, units: libs.units.length },
          }))
          .catch(e => {
            log.error('Auto-scan failed:', e);
            notifyRenderer('library-scan-complete', { success: false, error: e.message });
          });
      }

      for (const win of (_BrowserWindow?.getAllWindows() || [])) {
        try { if (!win.isDestroyed()) win.webContents.send('settings-updated', newSettings); } catch (_) {}
      }

      return { success: true };
    } catch (e) {
      log.error('settings-save failed:', e);
      return { success: false, error: e.message };
    }
  });

  _ipcMain.handle('settings-pick-folder', async (event, { title, defaultPath } = {}) => {
    const opts = { title: title || 'Select Folder', properties: ['openDirectory'] };
    if (defaultPath) opts.defaultPath = defaultPath;
    const { filePaths } = await _dialog.showOpenDialog(opts);
    if (filePaths?.length) return { success: true, path: filePaths[0] };
    return { success: false };
  });

  _ipcMain.handle('settings-get-version', async () => _app?.getVersion() ?? '0.0.0');

  _ipcMain.handle('autosave-run-now', async () => {
    await runAutosave();
    return { success: true };
  });

  _ipcMain.handle('autosave-get-status', async () => {
    const s = readSettings();
    return {
      enabled:   s.autosaveEnabled  || false,
      lastRun:   s.autosaveLastRun  || null,
      mapName:   s.autosaveMapName  || '',
      interval:  s.autosaveInterval || 15,
      versioned: s.autosaveVersioned || false,
    };
  });

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

module.exports = {
  SETTINGS_FILE,
  LIBRARIES_FILE,
  CIVILIANS_FILE,
  SCMAP_DIR,
  GITHUB_REPO,
  USER_DATA,
  readSettings,
  writeSettings,
  scheduleAutosave,
  copyDirSync,
  getRunnerPath,
  getNodeExe,
  getGamedataPaths,
  register,
};
