'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
// guides-downloads.js — IPC handlers for downloadable guide files
//
// Fetches a manifest from GitHub and downloads individual files via
// dialog.showSaveDialog.
//
// Register in main.js:  require('./modules/guides-downloads');
// ═══════════════════════════════════════════════════════════════════════════════

const { ipcMain, dialog } = require('electron');
const path  = require('path');
const fs    = require('fs');
const https = require('https');

const { log } = require('./logger');

const ASSETS_RAW      = 'https://raw.githubusercontent.com/ForgeMapToolKit/ForgeMapToolkit-Assets/main';
const DOWNLOADS_BASE  = `${ASSETS_RAW}/guides/downloads`;
const MANIFEST_URL    = `${DOWNLOADS_BASE}/manifest.json`;

// ═══════════════════════════════════════════════════════════════════════════════
// Shared HTTP helper — same retry + backoff logic as guides.js
// ═══════════════════════════════════════════════════════════════════════════════

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function httpsGetBuffer(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await _httpsGetOnce(url);
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(500 * Math.pow(2, attempt)); // 500ms → 1s → 2s
    }
  }
}

function _httpsGetOnce(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ForgeMapToolkit' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return _httpsGetOnce(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode === 404) {
        return reject(Object.assign(new Error(`Not found: ${url}`), { code: 'NOT_FOUND' }));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Path safety — rejects traversal attempts before touching the filesystem
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates a repo-relative path from the renderer.
 * Returns the cleaned path string if safe, or null if suspicious.
 * Does NOT resolve to an absolute path — this is used for URL construction,
 * not filesystem access. Filesystem writes go through showSaveDialog.
 */
function safeRepoPath(userPath) {
  if (typeof userPath !== 'string' || !userPath.trim()) return null;
  // Decode percent-encoding and strip null bytes
  let p;
  try { p = decodeURIComponent(userPath.replace(/\0/g, '')); } catch { return null; }
  // Normalise backslashes
  p = p.replace(/\\/g, '/');
  // Reject any traversal sequences after normalisation
  if (p.includes('../') || p.startsWith('/') || /^[a-zA-Z]:/.test(p)) return null;
  return p;
}

// ── In-memory preview cache ───────────────────────────────────────────────────
// Previews are small images fetched once per session; no need to hit GitHub twice.
const previewCache = new Map();

// ── guide-downloads-manifest ──────────────────────────────────────────────────
ipcMain.removeHandler('guide-downloads-manifest');
ipcMain.handle('guide-downloads-manifest', async () => {
  try {
    log.info('[guide-downloads] Fetching manifest:', MANIFEST_URL);
    const buf  = await httpsGetBuffer(MANIFEST_URL);
    const list = JSON.parse(buf.toString('utf8'));
    log.info(`[guide-downloads] Manifest loaded — ${list.length} items`);
    return { success: true, items: list };
  } catch (e) {
    log.error('[guide-downloads] manifest fetch failed:', e.message);
    return { success: false, error: e.message };
  }
});

// ── guide-downloads-preview ───────────────────────────────────────────────────
// Fetches a preview image from GitHub and returns it as a base64 data-URL.
// Results are cached in memory for the session lifetime.
// Args: { previewPath }  — repo-relative path, e.g. "water-ramp/preview.png"
ipcMain.removeHandler('guide-downloads-preview');
ipcMain.handle('guide-downloads-preview', async (_event, { previewPath }) => {
  const safe = safeRepoPath(previewPath);
  if (!safe) return null;

  // Return cached result if available
  if (previewCache.has(safe)) return previewCache.get(safe);

  const url = `${DOWNLOADS_BASE}/${safe}`;
  try {
    const buf  = await httpsGetBuffer(url);
    const ext  = path.extname(safe).toLowerCase().slice(1);
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[ext] ?? 'image/png';
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    previewCache.set(safe, dataUrl);
    return dataUrl;
  } catch (e) {
    log.warn('[guide-downloads] preview fetch failed:', safe, e.message);
    previewCache.set(safe, null); // cache the failure too — don't hammer GitHub
    return null;
  }
});

// ── guide-downloads-save ──────────────────────────────────────────────────────
// Downloads a single file from GitHub and saves it via showSaveDialog.
// Args: { filePath, defaultName }
//   filePath    — repo-relative path, e.g. "water-ramp/water_ramp.dds"
//   defaultName — suggested filename in the save dialog
ipcMain.removeHandler('guide-downloads-save');
ipcMain.handle('guide-downloads-save', async (_event, { filePath, defaultName }) => {
  const safe = safeRepoPath(filePath);
  if (!safe) return { success: false, error: 'Invalid path' };

  const safeName = path.basename(defaultName || safe);
  const url = `${DOWNLOADS_BASE}/${safe}`;

  const ext = path.extname(safeName).slice(1);
  const { filePath: saveTo, canceled } = await dialog.showSaveDialog({
    title: 'Save file',
    defaultPath: safeName,
    filters: [
      { name: ext.toUpperCase() + ' File', extensions: [ext] },
      { name: 'All Files',                 extensions: ['*']  },
    ],
  });

  if (canceled || !saveTo) return { success: false, canceled: true };

  try {
    log.info('[guide-downloads] Downloading:', url, '→', saveTo);
    const buf = await httpsGetBuffer(url);
    fs.writeFileSync(saveTo, buf);
    log.info('[guide-downloads] Saved:', saveTo);
    return { success: true, path: saveTo };
  } catch (e) {
    log.error('[guide-downloads] download failed:', e.message);
    return { success: false, error: e.message };
  }
});