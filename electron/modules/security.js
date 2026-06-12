'use strict';
/**
 * security.js — Path allowlist + IPC guard helpers.
 *
 * Exports:
 *   isPathAllowed(targetPath)                  — returns true when path is in an allowed root
 *   withPathGuard(pathExtractor, handler)       — wraps an IPC handler with path validation
 */

const path = require('path');
const { app } = require('electron');

// ── Static allowed roots (never change at runtime) ────────────────────────────
const _STATIC_ALLOWED_ROOTS = [
  app.getPath('userData'), // app's own data directory
  app.getPath('temp'),     // OS temp folder (preview render output)
  app.getAppPath(),        // app bundle root — allows reading bundled assets (e.g. public/emitter/*.bp)
];

/**
 * Returns true if `targetPath` is inside one of the allowed roots.
 *
 * Allowed roots:
 *   Static:  userData, temp, appPath (bundle root — for reading bundled assets like public/emitter/)
 *   Dynamic: mapsFolder, fafPath, faInstallPath, backupFolder,
 *            emitterBpFolder, autosavePath  (read fresh from settings each call)
 *
 * Path traversal (../../etc/passwd) is blocked because path.resolve()
 * normalises the path before the startsWith() check.
 *
 * @param {string} targetPath
 * @param {() => object} readSettingsFn  — zero-arg function that returns the current settings object
 * @returns {boolean}
 */
function isPathAllowed(targetPath, readSettingsFn) {
  if (!targetPath || typeof targetPath !== 'string') return false;
  const normalised = path.resolve(targetPath);

  // Static roots
  for (const root of _STATIC_ALLOWED_ROOTS) {
    const resolved = path.resolve(root);
    if (normalised.startsWith(resolved + path.sep) || normalised === resolved)
      return true;
  }

  // Dynamic roots from settings (loaded fresh — settings may change at runtime)
  try {
    const s = readSettingsFn();
    const dynamicRoots = [
      s.mapsFolder,
      s.fafPath,
      s.faInstallPath,
      s.backupFolder,
      s.emitterBpFolder,
      s.autosavePath,
      s.customPropsFolder,
      s.skyboxFolderPath,
    ].filter(Boolean);

    for (const root of dynamicRoots) {
      const resolved = path.resolve(root);
      if (normalised.startsWith(resolved + path.sep) || normalised === resolved)
        return true;
    }
  } catch (_) {}

  return false;
}

/**
 * Wraps an IPC handler with path validation.
 *
 * Usage:
 *   ipcMain.handle('write-file', withPathGuard(
 *     ({ filePath }) => [filePath],
 *     async (event, { filePath, content }) => { ... }
 *   ));
 *
 * @param {(args: object) => string[]} pathExtractor  — extracts paths from IPC args
 * @param {Function}                  handler         — the actual IPC handler
 * @param {() => object}              readSettingsFn  — settings reader (injected)
 * @param {{ warn: Function }}        log             — logger (injected)
 * @returns {Function}
 */
function withPathGuard(pathExtractor, handler, readSettingsFn, log) {
  return async (event, args) => {
    const paths = pathExtractor(args).filter(Boolean);
    for (const p of paths) {
      if (!isPathAllowed(p, readSettingsFn)) {
        log.warn('[security] Blocked file operation on disallowed path:', p);
        return { success: false, error: `Access denied: path not in allowed roots — ${p}` };
      }
    }
    return handler(event, args);
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = { isPathAllowed, withPathGuard };
