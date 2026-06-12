'use strict';
/**
 * community.js — GitHub OAuth Device Flow, PR submission, asset download.
 *
 * Covers: github-auth-status/start/poll/logout, submit-contribution-pr,
 *         contrib-set-maintainer-token, contrib-get-maintainer-token-status,
 *         contrib-load-github-data, contrib-download-asset,
 *         contrib-parse-scmskybox, open-folder, open-tool-window.
 *
 * Exports:
 *   register(deps) — registers all IPC handlers in this module
 */

const path  = require('path');
const fs    = require('fs');
const https = require('https');
const { app, ipcMain, shell, BrowserWindow } = require('electron');
const { log, bridgeRendererConsole } = require('./logger');
const { safeStorage } = require('electron');

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRIBUTIONS — GitHub OAuth Device Flow + PR Submission
// ═══════════════════════════════════════════════════════════════════════════════

// ── Config ────────────────────────────────────────────────────────────────────
// MAINTAINER_TOKEN: used for submissions from users WITHOUT a GitHub account.
// Create a fine-grained PAT at github.com/settings/tokens with:
//   - Repository: timmasalme/ForgeMapToolkit-Assets
//   - Permissions: Contents (read+write), Pull requests (read+write)
// Store it in userData/contrib_token.json (gitignored, never in source).
const CONTRIB_OWNER        = 'timmasalme';
const CONTRIB_REPO         = 'ForgeMapToolkit-Assets';
const CONTRIB_TOKEN_FILE   = path.join(app.getPath('userData'), 'contrib_token.json');
const CONTRIB_AUTH_FILE    = path.join(app.getPath('userData'), 'contrib_auth.json');
const CONTRIB_AUTH_TOKEN_BIN = path.join(app.getPath('userData'), 'contrib_auth_token.bin');
const CONTRIB_AUTH_META_FILE = path.join(app.getPath('userData'), 'contrib_auth_meta.json');
// OAuth App client_id — NOT secret, safe to hardcode.
// Register at github.com/settings/developers → New OAuth App.
const GITHUB_OAUTH_CLIENT  = 'Ov23li2lljXFXIHwQodF';

// ── safeStorage helpers ───────────────────────────────────────────────────────
// Token is stored encrypted via Electron's safeStorage (OS keychain-backed).
// Metadata (username, avatarUrl) is stored in a separate JSON file — not secret.
// Falls back gracefully to legacy contrib_auth.json on first run after update.

function _writeAuthToken(accessToken, meta) {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(accessToken);
      fs.writeFileSync(CONTRIB_AUTH_TOKEN_BIN, encrypted);
    } else {
      // Fallback: store in legacy file (better than nothing on systems without keychain)
      log.warn('[auth] safeStorage unavailable — falling back to plaintext token storage');
      fs.writeFileSync(CONTRIB_AUTH_FILE, JSON.stringify({ access_token: accessToken, ...meta, savedAt: new Date().toISOString() }, null, 2));
    }
    fs.writeFileSync(CONTRIB_AUTH_META_FILE, JSON.stringify({ ...meta, savedAt: new Date().toISOString() }, null, 2));
  } catch (e) {
    log.error('[auth] Failed to write auth token:', e);
    throw e;
  }
}

function _readAuthToken() {
  // Try new encrypted storage first
  try {
    if (fs.existsSync(CONTRIB_AUTH_TOKEN_BIN) && safeStorage.isEncryptionAvailable()) {
      const encrypted = fs.readFileSync(CONTRIB_AUTH_TOKEN_BIN);
      const access_token = safeStorage.decryptString(encrypted);
      const meta = fs.existsSync(CONTRIB_AUTH_META_FILE)
        ? JSON.parse(fs.readFileSync(CONTRIB_AUTH_META_FILE, 'utf8'))
        : {};
      return { access_token, ...meta };
    }
  } catch (e) {
    log.warn('[auth] Failed to read encrypted token, trying legacy:', e.message);
  }
  // Migrate from legacy plaintext contrib_auth.json
  try {
    if (fs.existsSync(CONTRIB_AUTH_FILE)) {
      const legacy = JSON.parse(fs.readFileSync(CONTRIB_AUTH_FILE, 'utf8'));
      if (legacy?.access_token) {
        log.info('[auth] Migrating legacy plaintext token to encrypted storage');
        _writeAuthToken(legacy.access_token, { username: legacy.username, avatarUrl: legacy.avatarUrl });
        fs.unlinkSync(CONTRIB_AUTH_FILE); // Remove plaintext file after migration
        return legacy;
      }
    }
  } catch (e) {
    log.warn('[auth] Legacy token migration failed:', e.message);
  }
  return null;
}

function _deleteAuthToken() {
  try { if (fs.existsSync(CONTRIB_AUTH_TOKEN_BIN)) fs.unlinkSync(CONTRIB_AUTH_TOKEN_BIN); } catch (_) {}
  try { if (fs.existsSync(CONTRIB_AUTH_META_FILE)) fs.unlinkSync(CONTRIB_AUTH_META_FILE); } catch (_) {}
  try { if (fs.existsSync(CONTRIB_AUTH_FILE))      fs.unlinkSync(CONTRIB_AUTH_FILE);      } catch (_) {}
}


let _devicePoll = null; // { interval, device_code }

// ── Helper: HTTPS POST/GET returning parsed JSON ──────────────────────────────
function ghRequest({ method = 'GET', hostname, path: urlPath, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = require('https').request({
      method, hostname, path: urlPath,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'ForgeMapToolkit',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`GitHub API ${res.statusCode}: ${parsed?.message || data}`));
          } else {
            resolve(parsed);
          }
        } catch {
          if (res.statusCode >= 400) {
            reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
          } else {
            resolve(data);
          }
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Like ghRequest but returns the raw response string.
// Needed for the GitHub token endpoint which may return form-encoded or JSON.
function ghRequestRaw({ method = 'POST', hostname, path: urlPath, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = require('https').request({
      method, hostname, path: urlPath,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'ForgeMapToolkit',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Helper: get the token to use for a given submission ──────────────────────
// Returns { token, authorName } — either user's OAuth token or maintainer token.
// For write operations (PR submission) the OAuth user token is always preferred
// because a maintainer PAT may lack repo-write scope for the contributions repo.
// Priority: OAuth user token → Maintainer PAT → error
function getContribToken(useGitHubAuth) {
  // Always try OAuth token first — it has repo write access
  try {
    const auth = _readAuthToken();
    if (auth?.access_token) {
      log.info('[contrib] getContribToken: using OAuth token for', auth.username);
      return { token: auth.access_token, authorName: auth.username };
    }
    log.warn('[contrib] getContribToken: no stored OAuth token');
  } catch (e) {
    log.warn('[contrib] getContribToken: no OAuth token:', e.code || e.message);
  }

  if (useGitHubAuth) {
    // User explicitly wanted GitHub auth but it wasn't connected
    throw new Error('GitHub not connected. Please reconnect in the Contributions tab.');
  }

  // Fallback: maintainer PAT — NOTE: only works if the PAT has Contents+PullRequests write scope
  // on the contributions repo. A fine-grained PAT scoped to a different repo will get 403.
  try {
    const binFile = CONTRIB_TOKEN_FILE.replace('.json', '.bin');
    if (fs.existsSync(binFile) && safeStorage.isEncryptionAvailable()) {
      const encrypted = fs.readFileSync(binFile);
      const token = safeStorage.decryptString(encrypted);
      log.warn('[contrib] getContribToken: falling back to maintainer PAT (encrypted)');
      return { token, authorName: null };
    }
    // Legacy plaintext fallback
    const stored = JSON.parse(fs.readFileSync(CONTRIB_TOKEN_FILE, 'utf8'));
    if (stored?.token) {
      log.warn('[contrib] getContribToken: falling back to maintainer PAT (plaintext legacy) — ensure it has repo write scope on ' + CONTRIB_REPO);
      return { token: stored.token, authorName: null };
    }
  } catch (_) {}

  throw new Error('No GitHub token available. Please connect your GitHub account in the Contributions tab before submitting.');
}

// ── github-auth-status ────────────────────────────────────────────────────────
ipcMain.handle('github-auth-status', async () => {
  try {
    const auth = _readAuthToken();
    if (auth?.access_token) return { connected: true, username: auth.username, avatarUrl: auth.avatarUrl || null };
  } catch (_) {}
  return { connected: false };
});

// ── github-auth-start — initiates Device Flow, returns code for user ──────────
ipcMain.handle('github-auth-start', async () => {
  try {
    const data = await ghRequest({
      method: 'POST',
      hostname: 'github.com',
      path: '/login/device/code',
      body: { client_id: GITHUB_OAUTH_CLIENT, scope: 'public_repo' },
    });
    if (!data.device_code) throw new Error(data.error_description || 'Device code request failed');

    _devicePoll = { device_code: data.device_code, interval: data.interval || 5 };
    log.info('[contrib] Device flow started, user_code:', data.user_code);
    return { user_code: data.user_code, verification_uri: data.verification_uri };
  } catch (err) {
    log.error('[contrib] github-auth-start failed:', err);
    return { error: err.message };
  }
});

// ── github-auth-poll — called repeatedly by renderer until confirmed ───────────
ipcMain.handle('github-auth-poll', async () => {
  if (!_devicePoll) return { error: 'No active device flow' };
  try {
    const raw = await ghRequestRaw({
      method: 'POST',
      hostname: 'github.com',
      path: '/login/oauth/access_token',
      body: {
        client_id: GITHUB_OAUTH_CLIENT,
        device_code: _devicePoll.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      },
    });
    // GitHub may return JSON or form-encoded — handle both
    let data;
    try { data = JSON.parse(raw); } catch (_) {
      data = Object.fromEntries(new URLSearchParams(raw));
    }
    log.debug('[contrib] github-auth-poll response:', raw.slice(0, 120));

    if (data.access_token) {
      // Fetch GitHub username + avatar
      let username = 'github-user', avatarUrl = null;
      try {
        const user = await ghRequest({
          hostname: 'api.github.com',
          path: '/user',
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        username  = user.login;
        avatarUrl = user.avatar_url || null;
      } catch (_) {}

      // Persist encrypted to disk
      _writeAuthToken(data.access_token, { username, avatarUrl });

      _devicePoll = null;
      log.info('[contrib] GitHub auth connected as:', username);
      return { confirmed: true, username, avatarUrl };
    }

    // Still waiting
    if (data.error === 'authorization_pending') return { confirmed: false };
    if (data.error === 'slow_down') {
      // GitHub requires us to back off — increase interval by 5s
      _devicePoll.interval = (_devicePoll.interval || 5) + 5;
      log.debug('[contrib] slow_down — new poll interval:', _devicePoll.interval);
      return { confirmed: false, slowDown: true, interval: _devicePoll.interval };
    }

    // Any other error (expired, denied)
    _devicePoll = null;
    return { error: data.error_description || data.error || 'Auth failed' };
  } catch (err) {
    log.error('[contrib] github-auth-poll failed:', err);
    return { error: err.message };
  }
});

// ── github-auth-logout ────────────────────────────────────────────────────────
ipcMain.handle('github-auth-logout', async () => {
  _deleteAuthToken();
  _devicePoll = null;
  log.info('[contrib] GitHub auth disconnected');
  return { success: true };
});

// ── submit-contribution-pr ────────────────────────────────────────────────────
// files: [{ path: 'skyboxes/Desert/Desert.scmskybox', data: '<base64>', encoding: 'base64' }, ...]
ipcMain.handle('submit-contribution-pr', async (event, {
  useGitHubAuth, contributorName, assetType, assetName, notes, files = [],
}) => {
  try {
    const { token, authorName } = getContribToken(useGitHubAuth);
    const displayName = authorName || contributorName || 'anonymous';
    const safeName    = assetName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const branchName  = `contributions/${displayName}-${safeName}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9\-_/]/g, '-');

    const apiHeaders  = { Authorization: `Bearer ${token}` };
    const apiBase     = `/repos/${CONTRIB_OWNER}/${CONTRIB_REPO}`;

    log.info(`[contrib] Submitting PR: ${assetType}/${assetName} by ${displayName}`);

    // 1. Get current main SHA
    const refData = await ghRequest({ hostname: 'api.github.com', path: `${apiBase}/git/ref/heads/main`, headers: apiHeaders });
    if (!refData?.object?.sha) throw new Error('Could not get main branch SHA: ' + JSON.stringify(refData));
    const baseSha = refData.object.sha;

    // 2. Upload each file as a blob
    const treeItems = await Promise.all(files.map(async f => {
      const blob = await ghRequest({
        method: 'POST', hostname: 'api.github.com',
        path: `${apiBase}/git/blobs`,
        headers: apiHeaders,
        body: { content: f.data, encoding: f.encoding || 'base64' },
      });
      if (!blob.sha) throw new Error(`Blob upload failed for ${f.path}: ${JSON.stringify(blob)}`);
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
    }));

    // 3. Create tree
    const tree = await ghRequest({
      method: 'POST', hostname: 'api.github.com',
      path: `${apiBase}/git/trees`,
      headers: apiHeaders,
      body: { base_tree: baseSha, tree: treeItems },
    });
    if (!tree.sha) throw new Error('Tree creation failed: ' + JSON.stringify(tree));

    // 4. Create commit
    const commit = await ghRequest({
      method: 'POST', hostname: 'api.github.com',
      path: `${apiBase}/git/commits`,
      headers: apiHeaders,
      body: {
        message: `contribution: ${assetType}/${assetName} by ${displayName}`,
        tree: tree.sha, parents: [baseSha],
      },
    });
    if (!commit.sha) throw new Error('Commit creation failed: ' + JSON.stringify(commit));

    // 5. Create branch
    const branchResult = await ghRequest({
      method: 'POST', hostname: 'api.github.com',
      path: `${apiBase}/git/refs`,
      headers: apiHeaders,
      body: { ref: `refs/heads/${branchName}`, sha: commit.sha },
    });
    if (!branchResult.ref) throw new Error('Branch creation failed: ' + JSON.stringify(branchResult));

    // 6. Open pull request
    const prBody = [
      `**Contributor:** ${displayName}${useGitHubAuth ? ' (GitHub verified ✓)' : ' (no GitHub account)'}`,
      `**Asset type:** ${assetType}`,
      `**Asset name:** ${assetName}`,
      notes ? `\n**Notes:**\n${notes}` : '',
    ].filter(Boolean).join('\n');

    const pr = await ghRequest({
      method: 'POST', hostname: 'api.github.com',
      path: `${apiBase}/pulls`,
      headers: apiHeaders,
      body: {
        title: `[${assetType.toUpperCase()}] ${assetName} — by ${displayName}`,
        body: prBody,
        head: branchName,
        base: 'main',
      },
    });
    if (!pr.number) throw new Error('PR creation failed: ' + JSON.stringify(pr));

    log.info(`[contrib] PR created: #${pr.number} ${pr.html_url}`);
    return { success: true, prNumber: pr.number, prUrl: pr.html_url };

  } catch (err) {
    log.error('[contrib] submit-contribution-pr failed:', err);
    // Surface a user-friendly message for the common 403 case
    const msg = err.message || '';
    const friendlyMsg = msg.includes('403') || msg.includes('personal access token')
      ? 'Permission denied. Please connect your GitHub account via the "Connect →" button and try again.'
      : msg;
    return { success: false, error: friendlyMsg };
  }
});

// ── contrib-set-maintainer-token — called once from Settings to store token ───
// The token is stored encrypted via safeStorage (same as the OAuth token).
// Metadata (login, savedAt) is kept in contrib_token.json — not secret.
ipcMain.handle('contrib-set-maintainer-token', async (event, { token }) => {
  try {
    // Verify token works before saving
    const user = await ghRequest({
      hostname: 'api.github.com', path: '/user',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!user.login) throw new Error('Token invalid or insufficient permissions');

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      fs.writeFileSync(CONTRIB_TOKEN_FILE.replace('.json', '.bin'), encrypted);
      fs.writeFileSync(CONTRIB_TOKEN_FILE, JSON.stringify({ login: user.login, savedAt: new Date().toISOString() }, null, 2));
      log.info('[contrib] Maintainer token saved (encrypted) for user:', user.login);
    } else {
      // safeStorage unavailable (e.g. headless CI) — fall back to plaintext with warning
      fs.writeFileSync(CONTRIB_TOKEN_FILE, JSON.stringify({ token, login: user.login, savedAt: new Date().toISOString() }, null, 2));
      log.warn('[contrib] safeStorage unavailable — maintainer token stored as plaintext');
    }
    return { success: true, login: user.login };
  } catch (err) {
    log.error('[contrib] set-maintainer-token failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('contrib-get-maintainer-token-status', async () => {
  try {
    const stored = JSON.parse(fs.readFileSync(CONTRIB_TOKEN_FILE, 'utf8'));
    return { configured: !!stored?.token };
  } catch (_) {
    return { configured: false };
  }
});

// ── contrib-load-github-data ──────────────────────────────────────────────────
// Reads merged + open PRs from the contributions repo and builds the
// contributors list + approved-assets list that the UI needs.

// In-memory cache: avoids hammering the API on every tab open.
// Invalidated after CACHE_TTL_MS or when force=true is passed.
const CONTRIB_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let _contribCache = null; // { data, fetchedAt }

// Helper: best available auth header.
// Priority: OAuth user token (CONTRIB_AUTH_FILE) → Maintainer PAT (CONTRIB_TOKEN_FILE) → none.
function getBestAuthHeader() {
  try {
    const auth = _readAuthToken();
    if (auth?.access_token) return { Authorization: `token ${auth.access_token}` };
  } catch (_) {}
  try {
    const stored = JSON.parse(fs.readFileSync(CONTRIB_TOKEN_FILE, 'utf8'));
    if (stored?.token) return { Authorization: `token ${stored.token}` };
  } catch (_) {}
  return {};
}

ipcMain.handle('contrib-load-github-data', async (_event, { force = false } = {}) => {
  // Serve from cache if fresh
  if (!force && _contribCache && (Date.now() - _contribCache.fetchedAt) < CONTRIB_CACHE_TTL_MS) {
    log.info('[contrib] Serving from cache');
    return _contribCache.data;
  }

  try {
    const apiBase = `/repos/${CONTRIB_OWNER}/${CONTRIB_REPO}`;
    const authHeader = getBestAuthHeader();
    if (authHeader.Authorization) log.info('[contrib] Using authenticated requests');
    else log.warn('[contrib] No token found — using unauthenticated requests (low rate limit)');

    // Fetch merged PRs (approved assets) only — open PRs are not shown
    const mergedPRs = await ghRequest({
      hostname: 'api.github.com',
      path: `${apiBase}/pulls?state=closed&per_page=100&sort=updated&direction=desc`,
      headers: authHeader,
    });

    const approvedPRs = Array.isArray(mergedPRs) ? mergedPRs.filter(pr => pr.merged_at) : [];

    // Helper: extract asset type from PR branch name or title
    function detectType(pr, files) {
      // If we have file paths, use the top-level folder — most reliable
      if (Array.isArray(files) && files.length > 0) {
        const topFolder = files[0].filename.split('/')[0].toLowerCase();
        if (topFolder === 'skyboxes') return 'skybox';
        if (topFolder === 'emitter')  return 'emitter';
        if (topFolder === 'textures') return 'texture';
        if (topFolder === 'props')    return 'prop';
      }
      // Fallback: branch name / title
      const text = `${pr.head?.ref || ''} ${pr.title || ''}`.toLowerCase();
      if (text.includes('skybox'))  return 'skybox';
      if (text.includes('emitter')) return 'emitter';
      if (text.includes('texture')) return 'texture';
      return 'prop';
    }

    // ── Helper: run async fn over array in chunks (avoids rate-limit) ───────
    async function mapChunked(arr, fn, size = 6) {
      const out = [];
      for (let i = 0; i < arr.length; i += size)
        out.push(...await Promise.all(arr.slice(i, i + size).map(fn)));
      return out;
    }

    // ── Fetch PR files for all approved PRs ───────────────────────────────────
    const prFilesAll = await mapChunked(approvedPRs, async (pr) => {
      try {
        const files = await ghRequest({
          hostname: 'api.github.com',
          path: `${apiBase}/pulls/${pr.number}/files?per_page=100`,
          headers: authHeader,
        });
        return { pr, files: Array.isArray(files) ? files : [] };
      } catch (_) { return { pr, files: [] }; }
    });

    // ── Check which asset folders still exist in the repo ─────────────────────
    // Fetch the top-level folder listing once per asset type (4 requests total)
    // instead of one request per file. A folder that was deleted by the repo
    // owner simply won't appear in the listing anymore.
    const TYPE_FOLDER = { prop: 'props', skybox: 'skyboxes', emitter: 'emitter', texture: 'textures' };
    const activeFolders = {}; // { 'props/MyProp': true, 'emitter/Fire': true, ... }

    await Promise.all(Object.values(TYPE_FOLDER).map(async (topFolder) => {
      try {
        const entries = await ghRequest({
          hostname: 'api.github.com',
          path: `${apiBase}/contents/${topFolder}`,
          headers: authHeader,
        });
        if (Array.isArray(entries)) {
          for (const e of entries) {
            if (e.type !== 'dir') continue;
            if (e.name === 'community') {
              // Recurse one level into community/ to find the actual asset folders
              try {
                const communityEntries = await ghRequest({
                  hostname: 'api.github.com',
                  path: `${apiBase}/contents/${topFolder}/community`,
                  headers: authHeader,
                });
                if (Array.isArray(communityEntries)) {
                  for (const ce of communityEntries) {
                    if (ce.type === 'dir') activeFolders[`${topFolder}/community/${ce.name}`] = true;
                  }
                }
              } catch (ce) {
                log.warn(`[contrib] Could not list "${topFolder}/community": ${ce.message}`);
              }
            } else {
              activeFolders[`${topFolder}/${e.name}`] = true;
            }
          }
        }
      } catch (e) {
        // Folder doesn't exist yet — treat as empty, no assets active
        log.warn(`[contrib] Could not list repo folder "${topFolder}": ${e.message}`);
      }
    }));

    log.info(`[contrib] Active repo folders: ${Object.keys(activeFolders).join(', ') || '(none)'}`);

    // ── Build contributor map ─────────────────────────────────────────────────
    const contribMap = {};

    function ensureContrib(login, avatarUrl) {
      if (!contribMap[login]) {
        contribMap[login] = {
          username: login,
          avatar: login.slice(0, 2).toUpperCase(),
          avatarUrl: avatarUrl || null,
          joinedAt: null,
          approved: 0,
          byType: {},
          contributions: [],
        };
      }
      return contribMap[login];
    }

    for (const { pr, files } of prFilesAll) {
      const login = pr.user?.login;
      if (!login) continue;
      const c = ensureContrib(login, pr.user?.avatar_url);
      const type = detectType(pr, files);

      // Determine the asset folder path in the repo (e.g. "emitter/sdssd" or "props/community/MyProp")
      const topFolder = TYPE_FOLDER[type] || 'props';
      const parts = files[0]?.filename?.split('/');
      let assetFolder = null;
      if (parts?.length >= 3 && parts[1] === 'community') {
        assetFolder = `${topFolder}/community/${parts[2]}`;
      } else if (parts?.length >= 2) {
        assetFolder = `${topFolder}/${parts[1]}`;
      }
      const exists = assetFolder ? !!activeFolders[assetFolder] : false;

      // Count individual items within a folder PR
      let itemCount = 1;
      if (type === 'emitter' || type === 'prop') {
        const bpCount = files.filter(f => /\.bp$/i.test(f.filename)).length;
        if (bpCount > 1) itemCount = bpCount;
      } else if (type === 'skybox') {
        const skyCount = files.filter(f => /\.scmskybox$/i.test(f.filename)).length;
        if (skyCount > 1) itemCount = skyCount;
      }

      if (exists) {
        c.approved += itemCount;
        c.byType[type] = (c.byType[type] || 0) + itemCount;
      }
      if (!c.joinedAt) c.joinedAt = pr.merged_at?.slice(0, 7) || '—';
      // Only record contributions that still exist in the repo — skip removed assets
      if (exists) {
        c.contributions.push({
          id: pr.number,
          name: pr.title || `PR #${pr.number}`,
          type,
          status: 'approved',
          date: pr.merged_at?.slice(0, 10) || '',
          size: '', tags: [],
          prUrl: pr.html_url,
        });
      }
    }

    const contributors = Object.values(contribMap);

    const RAW_BASE  = `https://raw.githubusercontent.com/${CONTRIB_OWNER}/${CONTRIB_REPO}/main`;

    function extractAssetName(pr) {
      // Branch: contributions/{author}-{assetName}-{timestamp}  (all lowercase due to submit form)
      // We can't rely on case from branch — use PR files to get the real folder name instead.
      const branch = pr.head?.ref || '';
      const m = branch.match(/^contributions\/(?:[^/]+?)-(.+?)-(\d{10,})$/);
      if (m) return m[1];
      return (pr.title || '').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    }

    // Extract preview/subProps/subEmitters from already-fetched PR files
    function extractPRMeta(pr, files) {
      try {
        if (!Array.isArray(files) || files.length === 0)
          return { preview: null, realName: null, type: detectType(pr, []) };

        const parts = files[0].filename.split('/');
        // Support community-nested layout: skyboxes/community/{name}/... or props/community/{name}/...
        const realName = (parts.length >= 3 && parts[1] === 'community') ? parts[2] : (parts.length >= 2 ? parts[1] : null);
        const type = detectType(pr, files);

        const previewFile =
          files.find(f => /\/prev\/1\.(png|jpg|jpeg)$/i.test(f.filename)) ||  // new: prev/1.png
          files.find(f => /_preview1?\.(png|jpg|jpeg)$/i.test(f.filename)) ||   // legacy
          files.find(f => /albedo/i.test(f.filename) && /\.(png|jpg|jpeg)$/i.test(f.filename));

        const extraPreviews = [
          ...files.filter(f => /\/prev\/[2-9]\.(png|jpg|jpeg)$/i.test(f.filename)),  // new: prev/2.png etc.
          ...files.filter(f => /_preview[2-9]\.(png|jpg|jpeg)$/i.test(f.filename)),     // legacy
        ].map(f => `${RAW_BASE}/${f.filename}`);

        const preview = previewFile ? `${RAW_BASE}/${previewFile.filename}` : null;

        // Sub-props (merged folder with multiple _prop.bp)
        const bpFiles = files.filter(f => /_prop\.bp$/i.test(f.filename));
        const subProps = bpFiles.length > 1
          ? bpFiles.map(f => ({ name: f.filename.split('/').pop().replace(/_prop\.bp$/i, '') }))
          : null;

        // Sub-emitters (emitter folder with multiple .bp)
        const emitterBpFiles = files.filter(f => /\.bp$/i.test(f.filename) && !/_prop\.bp$/i.test(f.filename));
        const subEmitters = emitterBpFiles.length > 1
          ? emitterBpFiles.map(f => ({ name: f.filename.split('/').pop().replace(/\.bp$/i, '') }))
          : null;

        // Sub-skyboxes (folder with multiple .scmskybox)
        const skyboxFiles = files.filter(f => /\.scmskybox$/i.test(f.filename));
        const subSkyboxes = skyboxFiles.length > 1
          ? skyboxFiles.map(f => ({ name: f.filename.split('/').pop().replace(/\.scmskybox$/i, '') }))
          : null;

        // Sub-textures (folder with multiple albedo DDS — one per texture set, name = stem without _albedo)
        const albedoFiles = files.filter(f => /_albedo\.(dds|tga)$/i.test(f.filename));
        const subTextures = albedoFiles.length > 1
          ? albedoFiles.map(f => ({ name: f.filename.split('/').pop().replace(/_albedo\.(dds|tga)$/i, '') }))
          : null;

        // Strip the repo prefix (type[/community]/assetName/) to get relative filenames
        const _prefixDepth = (parts.length >= 3 && parts[1] === 'community') ? 3 : 2;
        const _files = files.map(f => f.filename.split('/').slice(_prefixDepth).join('/'));

        if (!previewFile) log.warn(`[contrib] PR #${pr.number}: no preview — files: ${files.map(f=>f.filename).join(', ')}`);
        else log.info(`[contrib] PR #${pr.number} (${type}): preview → ${previewFile.filename}`);

        return { preview, extraPreviews, realName, subProps, subEmitters, subSkyboxes, subTextures, _files, type };
      } catch (err) {
        log.warn(`[contrib] extractPRMeta #${pr.number} failed: ${err.message}`);
        return { preview: null, realName: null, type: detectType(pr, []) };
      }
    }

    const prMeta = prFilesAll.map(({ pr, files }) => extractPRMeta(pr, files));

    const assets = approvedPRs.map((pr, i) => {
      const { preview, extraPreviews, realName, subProps, subEmitters, subSkyboxes, subTextures, _files, type } = prMeta[i] || {};
      const assetType = type || detectType(pr, []);
      const assetName = realName || extractAssetName(pr);
      const topFolder = TYPE_FOLDER[assetType] || 'props';
      const parts = prFilesAll[i]?.files[0]?.filename?.split('/');
      // Support both flat (skyboxes/name) and community-nested (skyboxes/community/name) layouts
      let assetFolder = null;
      if (parts?.length >= 3 && parts[1] === 'community') {
        assetFolder = `${topFolder}/community/${parts[2]}`;
      } else if (parts?.length >= 2) {
        assetFolder = `${topFolder}/${parts[1]}`;
      }
      const exists = assetFolder ? !!activeFolders[assetFolder] : false;
      if (!exists) return null; // Skip assets no longer in the repo
      return {
        id: pr.number,
        name: pr.title || `PR #${pr.number}`,
        type: assetType,
        status: 'approved',
        contributor: pr.user?.login || null,
        date: pr.merged_at?.slice(0, 10) || '',
        size: '', tags: [],
        preview,
        extraPreviews: extraPreviews || [],
        subProps:    subProps    || null,
        subEmitters: subEmitters || null,
        subSkyboxes: subSkyboxes || null,
        subTextures: subTextures || null,
        _files: _files || [],
        downloadUrl: pr.html_url,
        _folder: (() => {
          const fp = prFilesAll[i]?.files[0]?.filename?.split('/');
          return (fp?.length >= 3 && fp[1] === 'community') ? `${topFolder}/community` : topFolder;
        })(),
        _assetName: assetName,
      };
    }).filter(Boolean);

    log.info(`[contrib] Loaded ${contributors.length} contributors, ${assets.length} approved assets`);
    const result = { success: true, contributors, assets };
    _contribCache = { data: result, fetchedAt: Date.now() };
    return result;
  } catch (err) {
    log.error('[contrib] contrib-load-github-data failed:', err);
    return { success: false, error: err.message, contributors: [], assets: [] };
  }
});

// ── contrib-download-asset ────────────────────────────────────────────────────
// Downloads all files of an approved contribution into public/<folder>/<assetName>.
// PNGs/JPEGs are NEVER downloaded — they are preview-only.
//
// subItemFilter  — name stem for a single item in a multi-asset folder.
//   • prop:    filters by _prop.bp stem + shared textures
//   • emitter: filters by .bp stem + _normal.dds / _ramp.dds
//   • skybox:  filters by .scmskybox stem (exact filename prefix)
//   • texture: filters by _albedo stem — keeps all files whose name starts with that stem
//
// Legacy params subPropFilter / subEmitterFilter are still accepted as aliases.
ipcMain.handle('contrib-download-asset', async (event, { folder, assetName, subItemFilter, subPropFilter, subEmitterFilter }) => {
  // Normalise: accept old per-type params as well
  const subFilter = subItemFilter || subPropFilter || subEmitterFilter || null;

  try {
    const apiBase   = `/repos/${CONTRIB_OWNER}/${CONTRIB_REPO}`;
    const appRoot   = app.getAppPath();
    const destRoot  = path.join(appRoot, 'public', folder, assetName);

    const authHeader = getBestAuthHeader();

    // List all files in the asset folder
    const files = await ghRequest({
      hostname: 'api.github.com',
      path: `${apiBase}/contents/${folder}/${assetName}`,
      headers: authHeader,
    });

    if (!Array.isArray(files) || files.length === 0)
      throw new Error(`No files found in ${folder}/${assetName}`);

    fs.mkdirSync(destRoot, { recursive: true });

    // PNGs/JPEGs are preview-only — never write them to disk
    const isPreviewOnly = f => /\.(png|jpg|jpeg)$/i.test(f.name);

    let filesToDownload = files.filter(f => f.type === 'file' && f.download_url && !isPreviewOnly(f));

    if (subFilter) {
      const filterLower = subFilter.toLowerCase();

      if (folder === 'props' || folder.startsWith('props/') || subPropFilter) {
        // Props: include files that start with the stem OR are not owned by any other sub-prop
        const allSubPropPrefixes = files
          .filter(f => /_prop\.bp$/i.test(f.name))
          .map(f => f.name.replace(/_prop\.bp$/i, '').toLowerCase());
        filesToDownload = filesToDownload.filter(f => {
          const nameLower = f.name.toLowerCase();
          if (nameLower.startsWith(filterLower)) return true;
          const ownedByOther = allSubPropPrefixes.some(p => p !== filterLower && nameLower.startsWith(p));
          return !ownedByOther;
        });

      } else if (folder === 'emitter' || folder.startsWith('emitter/') || subEmitterFilter) {
        // Emitters: exact .bp + known texture suffixes
        filesToDownload = filesToDownload.filter(f => {
          const nameLower = f.name.toLowerCase();
          return nameLower === `${filterLower}.bp` ||
                 nameLower === `${filterLower}_normal.dds` ||
                 nameLower === `${filterLower}_ramp.dds`;
        });

      } else if (folder === 'skyboxes' || folder.startsWith('skyboxes/')) {
        // Skyboxes: the .scmskybox file whose stem matches
        filesToDownload = filesToDownload.filter(f =>
          f.name.toLowerCase() === `${filterLower}.scmskybox`
        );

      } else if (folder === 'textures' || folder.startsWith('textures/')) {
        // Textures: all files whose name starts with the stem (albedo, normals, etc.)
        filesToDownload = filesToDownload.filter(f =>
          f.name.toLowerCase().startsWith(filterLower)
        );
      }
    }

    // Download each file via download_url
    const https = require('https');
    function downloadFile(url, destPath) {
      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, res => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
      });
    }

    for (const f of filesToDownload) {
      const dest = path.join(destRoot, f.name);
      log.info(`[contrib] Downloading ${f.name} → ${dest}`);
      await downloadFile(f.download_url, dest);
    }

    log.info(`[contrib] Downloaded ${filesToDownload.length} files to ${destRoot}`);
    return { success: true, destPath: destRoot };
  } catch (err) {
    log.error('[contrib] contrib-download-asset failed:', err);
    return { success: false, error: err.message };
  }
});

// ── contrib-parse-scmskybox ───────────────────────────────────────────────────
// Reads a downloaded .scmskybox file from public/ and parses each value
// individually so the Skybox Generator tab can load the fields directly.
ipcMain.handle('contrib-parse-scmskybox', async (event, { folder, assetName }) => {
  try {
    const appRoot   = app.getAppPath();
    const skyboxDir = path.join(appRoot, 'public', folder, assetName);
    const scmFile   = fs.readdirSync(skyboxDir).find(f => f.endsWith('.scmskybox'));
    if (!scmFile) return { success: false, error: 'No .scmskybox file found locally' };

    const raw = fs.readFileSync(path.join(skyboxDir, scmFile), 'utf8');

    // .scmskybox files are JSON — parse directly
    let data = {};
    try {
      const parsed = JSON.parse(raw);
      data = parsed?.Data || parsed?.data || parsed || {};
    } catch (_) {
      // Fallback: Lua-like key=value line parser
      const lineRe = /^\s*(\w+)\s*=\s*(.+?)\s*,?\s*$/gm;
      let m;
      while ((m = lineRe.exec(raw)) !== null) {
        const key = m[1]; const valRaw = m[2].trim();
        if (valRaw.startsWith('{')) {
          const inner = valRaw.replace(/[{}]/g, '').trim();
          const named = {}; let hadNamed = false;
          inner.replace(/(\w+)\s*=\s*([\d.eE+\-]+)/g, (_, k, v) => { named[k] = parseFloat(v); hadNamed = true; });
          if (hadNamed) { data[key] = named; continue; }
          const nums = inner.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
          if (nums.length) { data[key] = nums; continue; }
          data[key] = valRaw;
        } else if (valRaw === 'true')  { data[key] = true;
        } else if (valRaw === 'false') { data[key] = false;
        } else if (!isNaN(parseFloat(valRaw))) { data[key] = parseFloat(valRaw);
        } else { data[key] = valRaw.replace(/^["']|["']$/g, ''); }
      }
    }

    log.info(`[contrib] Parsed .scmskybox: ${scmFile} — ${Object.keys(data).length} keys`);
    return { success: true, data, fileName: scmFile };
  } catch (err) {
    log.error('[contrib] contrib-parse-scmskybox failed:', err);
    return { success: false, error: err.message };
  }
});

// ── IPC — OPEN FOLDER IN EXPLORER ────────────────────────────────────────────
//
// Security hardening (two layers):
//   1. Allowlist check via isPathAllowed() — same roots as all file IPC handlers.
//      Prevents XSS from pointing open-folder at arbitrary locations.
//   2. Directory-only enforcement — stat() rejects executables, scripts, or files.
//      Prevents using shell.openPath() to launch arbitrary programs.
//
const { isPathAllowed } = require('./security');
const { readSettings }  = require('./settings');

ipcMain.handle('open-folder', async (event, { folderPath }) => {
  if (!folderPath || typeof folderPath !== 'string') {
    return { success: false, error: 'Invalid folderPath argument' };
  }

  const resolved = path.resolve(folderPath);

  // Layer 1 — allowlist check
  if (!isPathAllowed(resolved, readSettings)) {
    log.warn('[open-folder] Blocked path not in allowed roots:', resolved);
    return { success: false, error: 'Access denied: path not in allowed roots' };
  }

  // Layer 2 — must be a directory, not a file or executable
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      log.warn('[open-folder] Blocked non-directory path:', resolved);
      return { success: false, error: 'Access denied: path is not a directory' };
    }
  } catch (e) {
    log.warn('[open-folder] Path does not exist:', resolved);
    return { success: false, error: 'Path does not exist or is not accessible' };
  }

  try {
    await shell.openPath(resolved);
    log.info('[open-folder] Opened in Explorer:', resolved);
    return { success: true };
  } catch (e) {
    log.error('[open-folder] shell.openPath failed:', e);
    return { success: false, error: e.message };
  }
});

// ── open-tool-window ─────────────────────────────────────────────────────────
// scmap → dedicated standalone popout HTML (no React router dependency)
// other tools → hash-routed into the main React app
ipcMain.handle('open-tool-window', async (event, { tool }) => {
  try {
    // ── SCMAP: standalone mini-window ──────────────────────────────────────
    if (tool === 'scmap') {
      // Prevent opening multiple popout windows
      const existing = BrowserWindow.getAllWindows().find(w => w.getTitle().includes('SCMAP Unpack'));
      if (existing && !existing.isDestroyed()) { existing.focus(); return { success: true }; }

      const win = new BrowserWindow({
        width: 480, height: 560,
        minWidth: 380, minHeight: 440,
        resizable: true,
        backgroundColor: '#0a0a0a',
        icon: path.join(__dirname, '../public/assets/icons/App/icon.ico'),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: path.join(__dirname, '../preload.js'),
        },
        frame: true,
        titleBarStyle: 'default',
        title: 'ForgeMapToolkit — SCMAP Unpack',
        autoHideMenuBar: true,
      });

      // Load from dist/ in production, src/ in dev
      const isDev = !app.isPackaged;
      const htmlPath = isDev
        ? path.join(app.getAppPath(), 'src', 'components', 'tabs', 'Tools', 'ScmapTab', 'Pop-Out', 'scmap-popout.html')
        : path.join(app.getAppPath(), 'dist', 'scmap-popout.html');
      win.loadFile(htmlPath);
      bridgeRendererConsole(win);
      log.info('[tool-window] Opened scmap popout window');
      return { success: true };
    }

    // ── Other tools: hash-routed React app ────────────────────────────────
    const isDev  = !app.isPackaged;
    const width  = 1200;
    const height = 900;

    const win = new BrowserWindow({
      width, height,
      minWidth: 900, minHeight: 600,
      backgroundColor: '#0a0a0a',
      icon: path.join(__dirname, '../public/assets/icons/App/icon.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, '../preload.js'),
      },
      frame: true,
      titleBarStyle: 'default',
      title: `ForgeMapToolkit — ${tool.toUpperCase()}`,
    });

    const base = isDev
      ? 'http://localhost:5173'
      : `file://${path.join(app.getAppPath(), 'dist', 'index.html')}`;

    win.loadURL(`${base}#tool/${tool}`);
    bridgeRendererConsole(win);

    log.info(`[tool-window] Opened tool window: ${tool}`);
    return { success: true };
  } catch (err) {
    log.error('[tool-window] open-tool-window failed:', err);
    return { success: false, error: err.message };
  }
});



function register() {
  // handlers registered at module load time via ipcMain.handle above
}

module.exports = { register };
