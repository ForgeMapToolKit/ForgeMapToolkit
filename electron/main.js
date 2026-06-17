'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
// main.js — Electron entry point
// ═══════════════════════════════════════════════════════════════════════════════

const { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem, safeStorage } = require('electron');
const path = require('path');
const fs   = require('fs');
const https  = require('https');
const JSZip = require('jszip');
const scmapUtils = require('../utils/scmap');

// ── Logger ZUERST laden ───────────────────────────────────────────────────────
const {
  log, LOG_FILE, LOG_LEVELS, logBuffer, yieldTick, instrumentIpc, bridgeRendererConsole,
  registerIpc: registerLoggerIpc,
  setLogLevel,
} = require('./modules/logger');

// ── instrumentIpc VOR allen anderen require() aufrufen ────────────────────────
// Alle Side-Effect-Module rufen ipcMain.handle/on beim require() auf.
// instrumentIpc() muss den Wrapper VORHER setzen, sonst werden diese
// Handler nie geloggt → Logger zeigt keine Einträge.
instrumentIpc(ipcMain);

// ── Restliche Module ──────────────────────────────────────────────────────────
const { isPathAllowed, withPathGuard: _withPathGuardBase } = require('./modules/security');

const {
  SETTINGS_FILE, LIBRARIES_FILE, CIVILIANS_FILE, SCMAP_DIR, GITHUB_REPO,
  readSettings, writeSettings, scheduleAutosave,
  copyDirSync, getRunnerPath, getNodeExe, getGamedataPaths,
} = require('./modules/settings');

const { readLibraries, writeLibraries, runFullScan, notifyRenderer } = require('./modules/scanner');
const { readSkyboxCache, writeSkyboxCache, parseSkyboxFile }         = require('./modules/skybox');

// Side-effect modules — registrieren IPC-Handler beim require()
require('./modules/file-ipc');
require('./modules/props');
require('./modules/community');
require('./modules/scmap');
require('./modules/map-resizer');
require('./modules/preview');

// ── withPathGuard: inject readSettings + log ──────────────────────────────────
function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WINDOW
// ═══════════════════════════════════════════════════════════════════════════════

let mainWindow;
let logWindow = null;
let splashWindow = null;

// ── Splash screen — created as early as possible, immediately when app is ready.
// Fires before whenReady().then(...) so the splash appears before any heavy
// initialisation (CSP, settings, module requires, etc.)
app.once('ready', () => {
  splashWindow = new BrowserWindow({
    width: 1200,
    height: 600,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: path.join(__dirname, '../public/assets/icons/App/icon.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
});

function createWindow() {
  log.info('Creating main window');

  const splash = splashWindow;

  // ── Main window — hidden until ready ─────────────────────────────────────
  mainWindow = new BrowserWindow({
    width: 1600, height: 1000,
    minWidth: 1200, minHeight: 800,
    backgroundColor: '#0a0a0a',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: true,
    titleBarStyle: 'default',
    icon: path.join(__dirname, '../public/assets/icons/App/icon.ico'),
  });

  bridgeRendererConsole(mainWindow);

  if (process.env.NODE_ENV === 'development') {
    log.info('Loading dev server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    log.info('Loading production build:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // DevTools open on launch ONLY if the user enabled it (Settings → Developer
  // → "Open DevTools on Launch"). Off by default, so the app never starts with
  // them open in dev or prod; F12 toggles them anytime.
  try {
    if (readSettings().devTools) mainWindow.webContents.openDevTools();
  } catch (_) { /* settings not readable — leave DevTools closed */ }

  // When the main window is ready, close splash and show main
  mainWindow.once('ready-to-show', () => {
    log.info('Main window ready — closing splash');
    setTimeout(() => {
      if (splash && !splash.isDestroyed()) splash.close();
      splashWindow = null;
      mainWindow.show();
      mainWindow.focus();
    }, 300);
  });

  mainWindow.on('closed', () => {
    log.info('Main window closed');
    mainWindow = null;
  });

  // ── Dev hotkeys ───────────────────────────────────────────────────────────
  // F5            → Reload
  // Ctrl+F5       → Force reload (hard reload, clears cache)
  // F12           → Toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;

    if (input.key === 'F5' && ctrl) {
      event.preventDefault();
      mainWindow.webContents.reloadIgnoringCache();
      log.debug('[hotkey] Ctrl+F5 — force reload');
    } else if (input.key === 'F5') {
      event.preventDefault();
      mainWindow.webContents.reload();
      log.debug('[hotkey] F5 — reload');
    } else if (input.key === 'F12') {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
      log.debug('[hotkey] F12 — toggle DevTools');
    }
  });
}

function openLogWindow() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus();
    return;
  }

  // Resolve preload path robustly — works in both dev and packaged builds.
  // __dirname may point to an asar archive in production; app.getAppPath()
  // always returns the real filesystem root of the app bundle.
  const preloadPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'electron', 'log-preload.js')
    : path.join(__dirname, 'log-preload.js');

  log.info('[log-window] preload path:', preloadPath);

  logWindow = new BrowserWindow({
    width: 1000,
    height: 680,
    title: 'Application Log',
    backgroundColor: '#0f1117',
    icon: path.join(__dirname, '../public/assets/icons/App/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  // Bridge renderer console so any errors in log-window.html appear in CMD
  bridgeRendererConsole(logWindow);

  logWindow.loadFile(path.join(__dirname, 'log-window.html'));

  // ── DO NOT send log-history here via did-finish-load ──────────────────────
  // did-finish-load fires before the renderer script has run and registered
  // its ipcRenderer.on('log-history') listener — the message would be dropped.
  // log-window.html calls window.logBridge.requestHistory() itself at the end
  // of its script, after all listeners are set up. That send triggers the
  // 'log-request-history' handler in registerIpc() which replies correctly.

  logWindow.on('closed', () => { logWindow = null; });
}

// __GUIDE_HASHES_START__
const GUIDE_SCRIPT_HASHES = [
  "'sha256-SkyHWqt/tu92X+9LTbZZPWihvymkUPvIH7Ar4pQy1Zw='"
];
// __GUIDE_HASHES_END__

// ─── Content Security Policy ───────────────────────────────────────────────────
// Applied to every response served to the renderer via onHeadersReceived.
//
// Directives:
//   default-src 'none'          — deny everything not explicitly listed
//   script-src  'self'          — only bundled JS (Vite build); no eval, no inline
//   style-src   'self' 'unsafe-inline'
//                               — Vite injects styles via <style> tags at runtime;
//                                 unsafe-inline is required for that to work.
//                                 Inline SVG data-URIs in CSS are covered by style-src.
//   img-src     'self' data: https://raw.githubusercontent.com https://avatars.githubusercontent.com
//                               — local assets + base64 previews (data:) +
//                                 GitHub raw assets (unit/prop/skybox previews) +
//                                 GitHub avatar images shown in the Community tab
//   connect-src 'self'          — no renderer-initiated fetch/XHR to external hosts;
//                                 all GitHub API calls go through the main process via IPC
//   font-src    'self'          — local fonts only
//   object-src  'none'          — block <object>/<embed>/<applet>
//   base-uri    'self'          — prevent base-tag hijacking
//   form-action 'none'          — no form submissions
//   frame-src   'none'          — no iframes
//
// NOTE: In development (NODE_ENV=development) the app loads from http://localhost:5173.
//       We relax connect-src and script-src to allow the Vite dev server + HMR websocket.

function installCSP() {
  const { session } = require('electron');
  const isDev = process.env.NODE_ENV === 'development';

  const devExtra = isDev
    ? " http://localhost:5173 ws://localhost:5173"
    : "";

  // In dev, Vite injects an inline React-refresh preamble. A script-src that
  // lists hashes makes browsers IGNORE 'unsafe-inline', so dev gets its own
  // hash-free policy that allows inline + eval + the dev server. Production
  // stays strict and hash-pinned.
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173"
    : `script-src 'self' 'sha256-2HCWXB1O/5LE2p1N3Wn6PZFyo3spKmW14WEJ3CeciXA=' ${GUIDE_SCRIPT_HASHES.join(' ')}`;

  const CSP = [
    "default-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https://raw.githubusercontent.com https://avatars.githubusercontent.com",
    "media-src 'self' data:",
    `connect-src 'self'${devExtra}`,
    "font-src 'self' https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-src 'none'",
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP],
      },
    });
  });

  log.info('[CSP] Content-Security-Policy installed' + (isDev ? ' (dev mode — eval + localhost allowed)' : ''));
}

// ─── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  const startSettings = readSettings();
  if (startSettings?.logLevel && LOG_LEVELS[startSettings.logLevel] !== undefined) {
    setLogLevel(startSettings.logLevel);
  }

  log.info(`\u2550\u2550\u2550 App started \u2014 v${app.getVersion()} \u2014 log level: ${startSettings?.logLevel ?? 'all'} \u2550\u2550\u2550`);
  log.info(`Platform: ${process.platform} ${process.arch} | Node: ${process.version} | Electron: ${process.versions.electron}`);
  log.info(`userData: ${app.getPath('userData')}`);
  log.info(`Log file: ${LOG_FILE}`);

  installCSP();
  createWindow();
  registerLoggerIpc(ipcMain, openLogWindow);

  const s = readSettings();
  if (s.autosaveEnabled) scheduleAutosave(s);

  setTimeout(async () => {
    const settings = readSettings();
    if (!fs.existsSync(LIBRARIES_FILE)) {
      const hasPath = settings.faInstallPath || settings.fafPath;
      if (hasPath) {
        log.info('No libraries.json found \u2014 running startup auto-scan');
        notifyRenderer('library-scan-started', {});
        try {
          const libs = await runFullScan(settings, {});
          notifyRenderer('library-scan-complete', {
            success: true,
            counts: { emitters: libs.emitters.length, props: libs.props.length, units: libs.units.length },
          });
        } catch (e) {
          log.error('Startup auto-scan failed:', e);
          notifyRenderer('library-scan-complete', { success: false, error: e.message });
        }
      } else {
        log.info('Startup auto-scan skipped \u2014 no game paths configured yet');
      }
    } else {
      log.debug('Library cache exists \u2014 skipping startup scan');
    }
  }, 1500);

  const defaultMenu = Menu.getApplicationMenu();
  if (defaultMenu) {
    const helpItem = defaultMenu.items.find(i => i.role === 'help' || i.label === 'Help');
    if (helpItem && helpItem.submenu) {
      helpItem.submenu.append(new MenuItem({ type: 'separator' }));
      helpItem.submenu.append(new MenuItem({ label: 'Show Log', click: () => openLogWindow() }));
    } else {
      defaultMenu.append(new MenuItem({
        label: 'Help',
        submenu: [{ label: 'Show Log', click: () => openLogWindow() }],
      }));
    }
    Menu.setApplicationMenu(defaultMenu);
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });
app.on('before-quit', () => { log.info('App quitting'); });
