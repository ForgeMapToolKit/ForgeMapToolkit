'use strict';
/**
 * logger.js — Session-based file logger with IPC forwarding.
 *
 * Exports:
 *   log            — { debug, info, warn, error } convenience object
 *   LOG_FILE       — path to the current session log file
 *   yieldTick()    — event-loop yield helper for heavy loops
 *   bridgeRendererConsole(win) — hooks console + network events on a BrowserWindow
 *   instrumentIpc(ipcMain)     — wraps ipcMain.handle / .on with automatic logging
 *   registerIpc(ipcMain, openLogWindowFn) — registers the four logger IPC handlers
 */

const path        = require('path');
const fs          = require('fs');
let _app = null;
let _BrowserWindow = null;
try {
  const electron = require('electron');
  _app           = electron.app;
  _BrowserWindow = electron.BrowserWindow;
} catch (_) {}


// ── Log levels ────────────────────────────────────────────────────────────────
const LOG_LEVELS = { all: 0, debug: 1, info: 2, warn: 3, error: 4, off: 99 };
let currentLogLevel = 'all';

// ── In-memory ring-buffer (max 50 000 lines) ──────────────────────────────────
const logBuffer = [];

// ── Session log folder — keeps last 15 sessions automatically ────────────────
function resolveLogDir() {
  if (_app) {
    try { return path.join(_app.getPath('userData'), 'logs'); } catch (_) {}
  }
  // Headless-Fallback: FMT_USER_DATA env oder plattformspezifisch
  const base = process.env.FMT_USER_DATA
    || (process.platform === 'win32'
        ? require('path').join(process.env.APPDATA || require('os').homedir(), 'AppData', 'Roaming', 'ForgeMapToolkit')
        : require('path').join(require('os').homedir(), '.config', 'ForgeMapToolkit'));
  return path.join(base, 'logs');
}
const LOG_DIR = resolveLogDir();
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (_) {}

// Prune: delete oldest files when >= 15 already exist
try {
  const MAX_SESSIONS = 15;
  const existing = fs.readdirSync(LOG_DIR)
    .filter(f => f.endsWith('.txt'))
    .map(f => ({ f, t: fs.statSync(path.join(LOG_DIR, f)).mtimeMs }))
    .sort((a, b) => a.t - b.t); // oldest first
  if (existing.length >= MAX_SESSIONS) {
    existing.slice(0, existing.length - MAX_SESSIONS + 1).forEach(({ f }) => {
      try { fs.unlinkSync(path.join(LOG_DIR, f)); } catch (_) {}
    });
  }
} catch (_) {}

const _sessionTs = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
const LOG_FILE   = path.join(LOG_DIR, _sessionTs + '.txt');
const logStream  = fs.createWriteStream(LOG_FILE, { flags: 'w' });

// ── Serialisation helper ──────────────────────────────────────────────────────
function serialize(a) {
  if (a === null)      return 'null';
  if (a === undefined) return 'undefined';
  if (a instanceof Error)
    return `${a.name}: ${a.message}\n    Stack: ${a.stack || '(no stack)'}`;
  if (typeof a === 'object') {
    try { return JSON.stringify(a, null, 0); } catch { return '[Unserializable Object]'; }
  }
  return String(a);
}

// ── Core log function ─────────────────────────────────────────────────────────
function appLog(level, ...args) {
  if ((LOG_LEVELS[level] ?? 0) < (LOG_LEVELS[currentLogLevel] ?? 0)) return;

  const msg  = args.map(serialize).join(' ');
  const line = { time: new Date().toISOString(), level, msg };

  logBuffer.push(line);
  if (logBuffer.length > 50000) logBuffer.shift();

  // Write to disk
  const levelPad = level.toUpperCase().padEnd(5);
  logStream.write(`[${line.time}] [${levelPad}] ${msg}\n`);

  // Forward to all open renderer windows (incl. log window)
for (const win of (_BrowserWindow?.getAllWindows() ?? [])) {

    try { if (!win.isDestroyed()) win.webContents.send('log-line', line); } catch (_) {}
  }

  // Mirror to terminal
  const fn = level === 'error' ? console.error
           : level === 'warn'  ? console.warn
           : level === 'debug' ? console.debug
           : console.log;
  fn(`[${levelPad}]`, msg);
}

// ── Public convenience object ─────────────────────────────────────────────────
const log = {
  debug: (...a) => appLog('debug', ...a),
  info:  (...a) => appLog('info',  ...a),
  warn:  (...a) => appLog('warn',  ...a),
  error: (...a) => appLog('error', ...a),
};

// ── Yield helper — let the event-loop breathe during heavy loops ──────────────
function yieldTick(yieldEvery = 50) {
  yieldTick._counter = (yieldTick._counter || 0) + 1;
  if (yieldTick._counter % yieldEvery === 0) {
    return new Promise(resolve => setImmediate(resolve));
  }
  return Promise.resolve();
}

// ── IPC auto-instrumentation ──────────────────────────────────────────────────
/**
 * Wraps ipcMain.handle and ipcMain.on so every call/response/error
 * is logged automatically. Call this ONCE, before any handler is registered.
 */
function instrumentIpc(ipcMain) {
  // Save a reference to the real emitter methods BEFORE wrapping.
  // registerIpc() uses _rawOn to register log-plumbing channels so they
  // are never intercepted by the logging wrapper.
  const _origHandle = ipcMain.handle.bind(ipcMain);
  const _origOn     = ipcMain.on.bind(ipcMain);

  // Expose raw on() for internal use (log-plumbing channels)
  ipcMain._rawOn = _origOn;

  ipcMain.handle = (channel, handler) => {
    return _origHandle(channel, async (event, ...args) => {
      const start  = Date.now();
      const argStr = args.length ? JSON.stringify(args).slice(0, 300) : '(no args)';
      log.debug(`IPC ▶ ${channel}`, argStr);
      try {
        const result = await handler(event, ...args);
        const ms     = Date.now() - start;
        const resStr = result !== undefined ? JSON.stringify(result).slice(0, 300) : '(void)';
        log.debug(`IPC ◀ ${channel} [${ms}ms]`, resStr);
        return result;
      } catch (err) {
        log.error(`IPC ✗ ${channel} threw:`, err);
        throw err;
      }
    });
  };

  ipcMain.on = (channel, handler) => {
    // Skip log-plumbing channels to prevent infinite loops
    if (['log-line', 'log-request-history', 'set-log-level'].includes(channel))
      return _origOn(channel, handler);
    return _origOn(channel, (event, ...args) => {
      const argStr = args.length ? JSON.stringify(args).slice(0, 300) : '(no args)';
      log.debug(`IPC (on) ▶ ${channel}`, argStr);
      try {
        handler(event, ...args);
      } catch (err) {
        log.error(`IPC (on) ✗ ${channel} threw:`, err);
      }
    });
  };
}

// ── Renderer console bridge ───────────────────────────────────────────────────
/**
 * Hooks console messages, network events, and crash handlers on a BrowserWindow.
 * Call once after each window is created.
 */
function bridgeRendererConsole(win) {
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const lvl = level === 3 ? 'error' : level === 2 ? 'warn' : level === 1 ? 'info' : 'debug';
    const src = sourceId ? ` [${sourceId}:${line}]` : '';
    appLog(lvl, `[renderer]${src} ${message}`);
  });

  win.webContents.session.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
    if (details.statusCode >= 400) {
      log.warn(`[net] ${details.statusCode} ${details.method} ${details.url}`);
    } else {
      log.debug(`[net] ${details.statusCode} ${details.method} ${details.url}`);
    }
  });

  win.webContents.session.webRequest.onErrorOccurred({ urls: ['*://*/*'] }, (details) => {
    log.error(`[net-error] ${details.error} ${details.url}`);
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('[renderer] render-process-gone:', JSON.stringify(details));
  });

  win.webContents.on('unresponsive', () => {
    log.warn('[renderer] window became unresponsive');
  });

  win.webContents.on('responsive', () => {
    log.info('[renderer] window responsive again');
  });

  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    log.error(`[renderer] did-fail-load: ${desc} (${code}) — ${url}`);
  });
}

// ── Process-level crash handlers ──────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  log.error('UNCAUGHT EXCEPTION:', err);
  try { logStream.write(`[FATAL] ${err.stack}\n`); } catch (_) {}
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('app-error', {
        title:   'Unexpected Error',
        message: err.message || String(err),
        type:    'error',
      });
    }
  } catch (_) {}
});

process.on('unhandledRejection', (reason) => {
  log.error('UNHANDLED REJECTION:', reason instanceof Error ? reason : String(reason));
  const msg = reason instanceof Error
    ? reason.message
    : (typeof reason === 'string' ? reason : JSON.stringify(reason));
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('app-error', {
        title:   'Unexpected Error',
        message: msg || 'Unhandled rejection',
        type:    'error',
      });
    }
  } catch (_) {}
});

// ── IPC handler registration ──────────────────────────────────────────────────
/**
 * Registers the four logger-related IPC channels.
 * @param {Electron.IpcMain} ipcMain
 * @param {() => void} openLogWindowFn  — callback that opens/focuses the log window
 */
function registerIpc(ipcMain, openLogWindowFn) {
  // Retrieve the original (un-instrumented) ipcMain.on if instrumentIpc has
  // already wrapped it. The wrapper skips 'log-request-history' via _origOn,
  // but to be 100% safe we always register log-plumbing channels on the real
  // emitter so there is zero risk of the wrapper interfering.
  const _rawOn = ipcMain._rawOn ?? ipcMain.on.bind(ipcMain);

  _rawOn('set-log-level', (_event, level) => {
    if (LOG_LEVELS[level] !== undefined) {
      currentLogLevel = level;
      log.info(`Log level changed to: ${level}`);
    } else {
      log.warn(`Unknown log level requested: ${level}`);
    }
  });

  _rawOn('log-request-history', (event) => {
    log.debug('[logger] log-request-history received — sending', logBuffer.length, 'lines');
    event.sender.send('log-history', logBuffer);
  });

  ipcMain.handle('open-log-window',   () => openLogWindowFn());
  ipcMain.handle('get-log-file-path', () => LOG_FILE);
}

// ── Exports ───────────────────────────────────────────────────────────────────
function setLogLevel(level) {
  if (LOG_LEVELS[level] !== undefined) {
    currentLogLevel = level;
  }
}

module.exports = {
  log,
  LOG_FILE,
  LOG_LEVELS,
  logBuffer,
  yieldTick,
  instrumentIpc,
  bridgeRendererConsole,
  registerIpc,
  setLogLevel,
};
