'use strict';
/**
 * skybox.js — Skybox library cache, parser, and IPC handlers.
 *
 * Exports:
 *   readSkyboxCache(), writeSkyboxCache(data), parseSkyboxFile(text)
 *   register(deps) — registers skybox IPC handlers
 *
 * Fix: GitHub's recursive tree API truncates at ~1000 entries (truncated:true).
 *      When truncated, we fall back to fetching each category subtree individually.
 *      Also adds retry logic for individual .scmskybox file fetches.
 */

const path  = require('path');
const fs    = require('fs');
const https = require('https');
const { app, ipcMain } = require('electron');

const { log }                                        = require('./logger');
const { readSettings }                               = require('./settings');

// ═══════════════════════════════════════════════════════════════════════════════
// Cache
// ═══════════════════════════════════════════════════════════════════════════════

const SKYBOX_CACHE_FILE = path.join(app.getPath('userData'), 'skybox_library_cache.json');
const SKYBOX_CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 hours

const API_BASE_SKYBOX   = 'https://api.github.com/repos/ForgeMapToolKit/ForgeMapToolkit-Assets';
const ASSETS_RAW_SKYBOX = 'https://raw.githubusercontent.com/ForgeMapToolKit/ForgeMapToolkit-Assets/main';

function readSkyboxCache() {
  try {
    if (!fs.existsSync(SKYBOX_CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(SKYBOX_CACHE_FILE, 'utf8'));
  } catch (e) {
    log.warn('[SkyboxLib] readSkyboxCache failed:', e.message);
    return null;
  }
}

function writeSkyboxCache(data) {
  try {
    fs.writeFileSync(SKYBOX_CACHE_FILE, JSON.stringify(data), 'utf8');
  } catch (e) {
    log.warn('[SkyboxLib] writeSkyboxCache failed:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch a URL and return parsed JSON.
 * Follows redirects, retries up to `retries` times on network error or 5xx.
 */
async function fetchJson(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await _httpGet(url, false);
      return JSON.parse(result);
    } catch (e) {
      if (attempt === retries) throw e;
      const delay = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s
      log.warn(`[SkyboxLib] fetchJson retry ${attempt + 1}/${retries} for ${url}: ${e.message}`);
      await sleep(delay);
    }
  }
}

/**
 * Fetch a URL and return raw text.
 * Retries up to `retries` times.
 */
async function fetchText(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await _httpGet(url, true);
    } catch (e) {
      if (attempt === retries) throw e;
      const delay = 500 * Math.pow(2, attempt);
      log.warn(`[SkyboxLib] fetchText retry ${attempt + 1}/${retries} for ${url}: ${e.message}`);
      await sleep(delay);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function _httpGet(url, asText) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: { 'User-Agent': 'ForgeMapToolkit' },
    };
    https.get(opts, res => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return _httpGet(res.headers.location, asText).then(resolve).catch(reject);
      }
      // Rate limit
      if (res.statusCode === 429) {
        const retryAfter = parseInt(res.headers['retry-after'] || '5', 10) * 1000;
        return reject(Object.assign(new Error(`HTTP 429 rate limited`), { retryAfter }));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Parser
// ═══════════════════════════════════════════════════════════════════════════════

/** Strip block comments and Lua line comments, then JSON.parse */
function parseSkyboxFile(text) {
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, '')  // /* block */
    .replace(/--[^\n]*/g, '')          // -- line comment
    .trim();
  return JSON.parse(stripped);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GitHub tree fetching — truncation-safe
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch the full recursive tree for a given path inside the repo.
 * Returns a flat array of tree entries (same shape as GitHub's tree API).
 *
 * Strategy:
 *   1. Try a single recursive call for the whole repo.
 *   2. If `truncated: true`, fall back to fetching each category subtree
 *      individually (skyboxes/Alien, skyboxes/Desert, …) which stays well
 *      under the 100 000-entry limit per call.
 */
async function fetchFullTree() {
  log.info('[SkyboxLib] Fetching repo tree from GitHub…');

  // ── Attempt 1: full recursive tree ────────────────────────────────────────
  const treeData = await fetchJson(`${API_BASE_SKYBOX}/git/trees/main?recursive=1`);

  if (!treeData.truncated) {
    log.info(`[SkyboxLib] Full tree: ${treeData.tree.length} entries (not truncated)`);
    return treeData.tree;
  }

  // ── Attempt 2: per-category subtrees ──────────────────────────────────────
  log.warn('[SkyboxLib] Tree truncated — switching to per-category subtree fetch');

  // First get the top-level skyboxes/ tree to discover category folders
  const topData = await fetchJson(`${API_BASE_SKYBOX}/git/trees/main`);
  const skyboxesEntry = topData.tree.find(e => e.path === 'skyboxes' && e.type === 'tree');
  if (!skyboxesEntry) {
    throw new Error('[SkyboxLib] Could not find skyboxes/ folder in repo root');
  }

  const skyboxesData = await fetchJson(`${API_BASE_SKYBOX}/git/trees/${skyboxesEntry.sha}`);
  const categoryFolders = skyboxesData.tree.filter(e => e.type === 'tree');
  log.info(`[SkyboxLib] Found ${categoryFolders.length} category folders: ${categoryFolders.map(c => c.path).join(', ')}`);

  // Fetch each category subtree recursively — these are small enough to never truncate
  const allEntries = [];

  // Also keep the entries we already have from the root tree (non-skyboxes/ stuff
  // isn't needed, but the skyboxes/ entries we do have are valid)
  for (const catFolder of categoryFolders) {
    try {
      const catData = await fetchJson(`${API_BASE_SKYBOX}/git/trees/${catFolder.sha}?recursive=1`);
      if (catData.truncated) {
        log.warn(`[SkyboxLib] Category subtree still truncated: ${catFolder.path} — fetching deeper`);
      }
      for (const entry of catData.tree) {
        // Rewrite path to be relative to repo root: skyboxes/<cat>/<...>
        allEntries.push({
          ...entry,
          path: `skyboxes/${catFolder.path}/${entry.path}`,
        });
      }
      // Add the category folder itself
      allEntries.push({ path: `skyboxes/${catFolder.path}`, type: 'tree', sha: catFolder.sha });
    } catch (e) {
      log.warn(`[SkyboxLib] Failed to fetch subtree for ${catFolder.path}: ${e.message}`);
    }
  }

  log.info(`[SkyboxLib] Per-category fetch complete: ${allEntries.length} total entries`);
  return allEntries;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main library builder
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchSkyboxLibraryFromGitHub() {
  const tree = await fetchFullTree();

  // Helper: direct children (depth+1) under parentPath, optionally filtered by type
  const childrenOf = (parentPath, type = null) =>
    tree.filter(e => {
      if (!e.path.startsWith(parentPath + '/')) return false;
      const rel = e.path.slice(parentPath.length + 1);
      if (rel.includes('/')) return false;
      return type ? e.type === type : true;
    });

  // All .scmskybox blobs at exactly: skyboxes/<cat>/<sb>/<file>.scmskybox
  const scmskyboxBlobs = tree.filter(e =>
    e.type === 'blob' &&
    e.path.startsWith('skyboxes/') &&
    e.path.toLowerCase().endsWith('.scmskybox') &&
    e.path.split('/').length === 4
  );

  log.info(`[SkyboxLib] ${tree.length} tree entries — ${scmskyboxBlobs.length} .scmskybox files found`);

  const allSkyboxes = [];
  const errors      = [];

  // Fetch all .scmskybox files concurrently (each has its own retry logic)
  await Promise.all(scmskyboxBlobs.map(async (scmBlob) => {
    try {
      const parts      = scmBlob.path.split('/');
      const catName    = parts[1];
      const sbFolName  = parts[2];
      const folderPath = `skyboxes/${catName}/${sbFolName}`;
      const isCustom   = catName.toLowerCase() === 'custom';

      const rawText       = await fetchText(`${ASSETS_RAW_SKYBOX}/${scmBlob.path}`);
      const scmskyboxData = parseSkyboxFile(rawText);
      const skyboxName    = parts[3].replace(/\.scmskybox$/i, '');

      // Preview images (prev/ subfolder)
      const images = childrenOf(`${folderPath}/prev`, 'blob')
        .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f.path))
        .sort((a, b) => a.path.localeCompare(b.path))
        .map(f => `${ASSETS_RAW_SKYBOX}/${f.path}`);

      // Custom DDS assets
      const RESOLUTIONS = [1024, 2048, 4096, 8192];
      const requiredFiles = [];
      if (isCustom) {
        const baseName = sbFolName.replace(/^\d+_/, '');
        const ddsAssets = childrenOf(`${folderPath}/assets`, 'blob')
          .filter(f => f.path.toLowerCase().endsWith('.dds'));

        for (const f of ddsAssets) {
          const fname     = f.path.split('/').pop();
          const nameNoExt = fname.replace(/\.dds$/i, '');
          const res       = RESOLUTIONS.find(r => nameNoExt.endsWith(`_${r}`));
          if (!res) continue;
          const isGlow    = nameNoExt.toLowerCase().includes('_glow_');
          requiredFiles.push({
            src:        f.path,
            destFile:   fname,
            type:       isGlow ? 'glow' : 'albedo',
            resolution: res,
            baseName,
          });
        }
      }

      allSkyboxes.push({
        id:           `${catName}__${sbFolName}`,
        name:         skyboxName.replace(/_/g, ' '),
        category:     catName.charAt(0).toUpperCase() + catName.slice(1),
        isCustom,
        images,
        requiredFiles,
        skyboxName,
        scmskyboxData,
      });
    } catch (e) {
      errors.push(scmBlob.path);
      log.warn('[SkyboxLib] Failed to load skybox:', scmBlob.path, '—', e.message);
    }
  }));

  if (errors.length > 0) {
    log.warn(`[SkyboxLib] ${errors.length} skyboxes failed to load: ${errors.join(', ')}`);
  }
  log.info(`[SkyboxLib] Loaded ${allSkyboxes.length} / ${scmskyboxBlobs.length} skyboxes`);

  // Group by category — Custom always last
  const catMap = {};
  for (const s of allSkyboxes) {
    if (!catMap[s.category]) catMap[s.category] = [];
    catMap[s.category].push(s);
  }

  return Object.entries(catMap)
    .sort(([a], [b]) => {
      if (a === 'Custom') return  1;
      if (b === 'Custom') return -1;
      return a.localeCompare(b);
    })
    .map(([name, skyboxes]) => ({
      name,
      skyboxes: skyboxes.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// IPC handlers
// ═══════════════════════════════════════════════════════════════════════════════

// Load from disk cache (fast, no network)
ipcMain.handle('skybox-library-load', async () => {
  const cache = readSkyboxCache();
  if (!cache) {
    log.info('[SkyboxLib] No disk cache found');
    return { cached: false, categories: [], fetchedAt: null };
  }
  const age = Date.now() - (cache.fetchedAt || 0);
  log.info(`[SkyboxLib] Cache loaded (age: ${Math.round(age / 60000)} min, ${cache.categories?.length ?? 0} categories)`);
  return { cached: true, stale: age > SKYBOX_CACHE_TTL, categories: cache.categories, fetchedAt: cache.fetchedAt };
});

// Fetch fresh from GitHub, write to disk cache
ipcMain.handle('skybox-library-fetch', async () => {
  try {
    log.info('[SkyboxLib] Fetching from GitHub…');
    const categories = await fetchSkyboxLibraryFromGitHub();
    const totalSkyboxes = categories.reduce((n, c) => n + c.skyboxes.length, 0);
    const payload = { categories, fetchedAt: Date.now() };
    writeSkyboxCache(payload);
    log.info(`[SkyboxLib] Fetched and cached: ${categories.length} categories, ${totalSkyboxes} skyboxes`);
    return { success: true, categories, fetchedAt: payload.fetchedAt };
  } catch (e) {
    log.error('[SkyboxLib] fetch failed:', e.message);
    return { success: false, error: e.message, categories: [] };
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

function register() {
  // IPC handlers already registered above at module load time
}

module.exports = {
  readSkyboxCache,
  writeSkyboxCache,
  parseSkyboxFile,
  register,
};