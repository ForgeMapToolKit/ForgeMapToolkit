'use strict';
/**
 * preview.js — Preview image rendering, map duplication, adaptive map helper.
 *
 * Covers: mr-duplicate-map-version, make-map-adaptive,
 *         preview-render, preview-replace-dds.
 *
 * Exports:
 *   register(deps) — registers all IPC handlers in this module
 */

const path  = require('path');
const fs    = require('fs');
const { app, ipcMain, dialog } = require('electron');
const { log } = require('./logger');
const { readSettings, SCMAP_DIR } = require('./settings');
const scmapUtils = require('../../utils/scmap');
const { execFile, execFileSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════════
// PREVIEW IMAGE — IPC HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

// ── mr-duplicate-map-version ─────────────────────────────────────────────────
// Duplicates a map folder to the next available version number.
// e.g. Tartaron.v0006 → Tartaron.v0007 (skips existing versions)
//
// Args: { mapFolder }  — absolute path to the source map folder
// Returns: { success, newMapFolder, newVersionName } | { success: false, error }

ipcMain.handle('mr-duplicate-map-version', async (event, { mapFolder }) => {
  try {
    if (!fs.existsSync(mapFolder)) {
      return { success: false, error: `Map folder not found: ${mapFolder}` };
    }

    const parent   = path.dirname(mapFolder);
    const basename = path.basename(mapFolder); // e.g. "Tartaron.v0006"

    // Extract base name and current version number
    const vMatch = basename.match(/^(.+)\.v(\d{4})$/i);
    if (!vMatch) {
      return { success: false, error: `Cannot parse version from folder name: ${basename}` };
    }

    const baseName   = vMatch[1];           // "Tartaron"
    let   nextVersion = parseInt(vMatch[2], 10) + 1; // 7

    // Find the next version number that doesn't already exist
    let newFolderName, newMapFolder;
    for (let i = 0; i < 100; i++) {
      newFolderName = `${baseName}.v${String(nextVersion + i).padStart(4, '0')}`;
      newMapFolder  = path.join(parent, newFolderName);
      if (!fs.existsSync(newMapFolder)) break;
    }

    log.info(`[mr-duplicate-map-version] Copying ${mapFolder} → ${newMapFolder}`);

    // Recursive copy
    function copyRecursive(src, dest) {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath  = path.join(src,  entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }

    copyRecursive(mapFolder, newMapFolder);

    // ── Patch versioned strings inside all Lua files ──────────────────────────
    // The Lua files contain:
    //   1. map_version = N          → increment to next version number
    //   2. "/maps/BaseName.vOLDN/…" → replace with new version folder name
    //      (both single- and double-quoted path strings)
    //
    // The editor ("File / Save as new version") does exactly this — it bumps
    // map_version and rewrites every in-file path that contains the old version
    // folder. We replicate that behaviour here.

    const oldVersionTag = basename;         // e.g. "Tartaron.v0006"
    const newVersionTag = newFolderName;    // e.g. "Tartaron.v0007"
    const newVersionNum = nextVersion;      // integer, e.g. 7

    // Case-insensitive, handles both / and \ path separators in strings
    const oldTagEscaped = oldVersionTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pathRe = new RegExp(oldTagEscaped, 'gi');

    let luaPatched = 0;
    function patchLuaFiles(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          patchLuaFiles(full);
        } else if (entry.name.toLowerCase().endsWith('.lua')) {
          let text = fs.readFileSync(full, 'utf8');
          let changed = false;

          // 1. Replace all occurrences of the old version folder name in paths
          const patched = text.replace(pathRe, newVersionTag);
          if (patched !== text) { text = patched; changed = true; }

          // 2. Increment map_version = N  (only in _scenario.lua files)
          if (entry.name.toLowerCase().endsWith('_scenario.lua')) {
            const mapVerPatched = text.replace(
              /(\bmap_version\s*=\s*)(\d+)/,
              (m, pre, val) => `${pre}${newVersionNum}`
            );
            if (mapVerPatched !== text) { text = mapVerPatched; changed = true; }
          }

          if (changed) {
            fs.writeFileSync(full, text, 'utf8');
            luaPatched++;
            log.info(`[mr-duplicate-map-version] Patched: ${full}`);
          }
        }
      }
    }
    patchLuaFiles(newMapFolder);
    log.info(`[mr-duplicate-map-version] Patched ${luaPatched} lua file(s): ${oldVersionTag} → ${newVersionTag}, map_version → ${newVersionNum}`);

    log.info(`[mr-duplicate-map-version] Done → ${newMapFolder}`);
    return { success: true, newMapFolder, newVersionName: newFolderName };

  } catch (e) {
    log.error('[mr-duplicate-map-version] failed:', e);
    return { success: false, error: e.message };
  }
});

// ── make-map-adaptive ─────────────────────────────────────────────────────────
// Renames a map folder and all its files/Lua references to include the
// "adaptive_" prefix required for FAF to recognise it as an Adaptive Map.
//
// e.g. tartaron.v0006 → adaptive_tartaron.v0006
//
// Args: { mapFolder }  — absolute path to the existing map folder
// Returns: { success, alreadyAdaptive?, newMapFolder, newFolderName,
//            renamedFiles, patchedFiles } | { success: false, error }

ipcMain.handle('make-map-adaptive', async (event, { mapFolder }) => {
  try {
    // ── 0. Validate input ────────────────────────────────────────────────────
    if (!mapFolder || !fs.existsSync(mapFolder)) {
      return { success: false, error: `Map folder not found: ${mapFolder}` };
    }

    const parent   = path.dirname(mapFolder);
    const basename = path.basename(mapFolder); // e.g. "tartaron.v0006"

    // ── 1. Parse folder name — must end with .vNNNN ──────────────────────────
    const vMatch = basename.match(/^(.+)(\.v\d{4})$/i);
    if (!vMatch) {
      return { success: false, error: `Cannot parse version suffix from folder name: ${basename}` };
    }

    const rawMapName    = vMatch[1];   // "tartaron"
    const versionSuffix = vMatch[2];   // ".v0006"

    // ── 2. Already adaptive? Nothing to do ───────────────────────────────────
    if (rawMapName.toLowerCase().startsWith('adaptive_')) {
      log.info(`[make-map-adaptive] Already has adaptive_ prefix: ${basename}`);
      return { success: true, alreadyAdaptive: true, newMapFolder: mapFolder, renamedFiles: [], patchedFiles: [] };
    }

    const oldMapName    = rawMapName;                      // "tartaron"
    const newMapName    = 'adaptive_' + rawMapName;        // "adaptive_tartaron"
    const oldFolderName = basename;                        // "tartaron.v0006"
    const newFolderName = newMapName + versionSuffix;      // "adaptive_tartaron.v0006"
    const newMapFolder  = path.join(parent, newFolderName);

    log.info(`[make-map-adaptive] ${oldFolderName} → ${newFolderName}`);
    log.info(`[make-map-adaptive] map base: "${oldMapName}" → "${newMapName}"`);

    if (fs.existsSync(newMapFolder)) {
      return { success: false, error: `Target folder already exists: ${newMapFolder}` };
    }

    // Escape for use in RegExp
    function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    const oldFolderRe = new RegExp(escRe(oldFolderName), 'gi');

    // ── 3. Patch text content of every .lua file BEFORE renaming ─────────────
    const patchedFiles = [];

    // fileNameRe matches oldMapName when preceded by / ' " or whitespace,
    // but NOT when already preceded by 'adaptive_' (the new prefix) —
    // this prevents Step A's result from being double-prefixed by Step B.
    // We include 'adaptive_' as an optional negative lookahead via a two-pass
    // approach: capture 2 chars before the separator so we can inspect context.
    const fileNameRe = new RegExp('([/\'"\\s])(' + escRe(oldMapName) + ')', 'gi');

    function patchTextFile(full, lname) {
      let text   = fs.readFileSync(full, 'utf8');
      const orig = text;

      // Step A: replace folder-level references (includes version suffix)
      text = text.replace(oldFolderRe, newFolderName);

      // Step B: replace bare map-name prefixes after / or quote in paths.
      // After Step A, newMapName already appears wherever the old folder was.
      // To prevent double-prefixing ("adaptive_adaptive_Tartaron"), we temporarily
      // swap out all newMapName occurrences with a placeholder, run the replacement
      // on what remains (the truly un-prefixed oldMapName occurrences), then restore.
      const placeholder = '\x00ADAPTIVE_PLACEHOLDER\x00';
      const newNameRe   = new RegExp(escRe(newMapName), 'gi');
      text = text.replace(newNameRe, placeholder);
      text = text.replace(fileNameRe, (m, prefix, _name) => prefix + newMapName);
      text = text.replace(/\x00ADAPTIVE_PLACEHOLDER\x00/g, newMapName);

      // Step C: fix the display `name = "…"` field in _scenario.lua.
      // Result should be e.g. "Adaptive Tartaron" — capitalised, no underscore.
      // Always rewrite so that a previously partial patch ("adaptive_Tartaron")
      // also gets cleaned up.
      if (lname && lname.endsWith('_scenario.lua')) {
        text = text.replace(
          /(\bname\s*=\s*)(["'])([^"']+)\2/,
          (match, pre, q, displayName) => {
            const stripped = displayName
              .replace(/^adaptive[_\s]+/i, '') // remove any existing adaptive_ / "adaptive " prefix
              .replace(/_/g, ' ')              // replace remaining underscores with spaces
              .replace(/^\w/, c => c.toUpperCase()); // capitalise first letter
            return `${pre}${q}Adaptive ${stripped}${q}`;
          }
        );
        // Step D: ensure AdaptiveMap = true is present in ScenarioInfo
        if (!text.includes('AdaptiveMap')) {
          text = text.replace(
            /(map_version\s*=\s*\d+\s*,)/,
            '$1\n    AdaptiveMap = true,'
          );
        }
      }

      if (text !== orig) {
        fs.writeFileSync(full, text, 'utf8');
        patchedFiles.push(full);
        log.info(`[make-map-adaptive] patched: ${path.relative(mapFolder, full)}`);
      }
    }

    function patchAllFiles(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { patchAllFiles(full); continue; }
        const lname = entry.name.toLowerCase();
        // Patch .lua files everywhere in the map folder.
        // Also patch .bp files — these use Lua syntax and can contain map-specific
        // paths (e.g. RampTexture = '/maps/Tartaron.v0006/env/decals/...') that
        // cause missing-texture bugs if left unrenamed after an adaptive_ rename.
        if (lname.endsWith('.lua') || lname.endsWith('.bp')) {
          patchTextFile(full, lname);
        }
      }
    }

    patchAllFiles(mapFolder);
    log.info(`[make-map-adaptive] patched ${patchedFiles.length} file(s)`);

    // ── 3b. Patch path strings embedded in the .scmap binary ─────────────────
    // The .scmap format stores strings with a length-prefix (int32 LE).
    // A naive binary string-replace would leave the length-prefix pointing at the
    // old byte count, corrupting every offset that follows (ACCESS_VIOLATION on load).
    //
    // Correct approach: use scmapUtils to parse the binary into structured data,
    // do plain string replacements on the text fields inside that structure, then
    // serialise back to a valid .scmap with all length-prefixes recomputed.
    {
      const entries   = fs.readdirSync(mapFolder);
      const scmapFile = entries.find(f => f.toLowerCase().endsWith('.scmap'));
      if (scmapFile) {
        const scmapPath = path.join(mapFolder, scmapFile);
        try {
          // ── 1. Parse the binary into a JS data structure ──────────────────
          const rawBuf = fs.readFileSync(scmapPath);
          const data   = scmapUtils.readDatastream(rawBuf);

          // ── 2. Walk every string field and replace old name references ────
          let patchCount = 0;

          function patchString(s) {
            if (typeof s !== 'string') return s;
            const before = s;
            let out = s.replace(oldFolderRe, newFolderName);
            out = out.replace(fileNameRe, (m, prefix, _name) => prefix + newMapName);
            if (out !== before) patchCount++;
            return out;
          }

          function walkAndPatch(obj) {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj === 'string') return patchString(obj);
            if (Array.isArray(obj)) return obj.map(walkAndPatch);
            if (typeof obj === 'object') {
              for (const key of Object.keys(obj)) obj[key] = walkAndPatch(obj[key]);
              return obj;
            }
            return obj;
          }

          walkAndPatch(data);

          if (patchCount > 0) {
            // ── 3. Export patched data to a temp folder, then pack back ──────
            const tmpFolder = path.join(SCMAP_DIR, '__adaptive_patch_tmp__');
            if (fs.existsSync(tmpFolder)) {
              const rmRec = d => {
                for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                  const f = path.join(d, e.name);
                  e.isDirectory() ? rmRec(f) : fs.unlinkSync(f);
                }
                fs.rmdirSync(d);
              };
              rmRec(tmpFolder);
            }
            fs.mkdirSync(tmpFolder, { recursive: true });
            scmapUtils.exportScmapData(data, tmpFolder, () => {});

            // ── 4. Serialise back — scmapUtils recomputes all length-prefixes
            const packedBuf = scmapUtils.writeDatastream(tmpFolder);
            fs.writeFileSync(scmapPath, packedBuf);

            try {
              const rmRec = d => {
                for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                  const f = path.join(d, e.name);
                  e.isDirectory() ? rmRec(f) : fs.unlinkSync(f);
                }
                fs.rmdirSync(d);
              };
              rmRec(tmpFolder);
            } catch (_) { /* non-fatal */ }

            log.info(`[make-map-adaptive] patched .scmap via unpack/pack: ${patchCount} string(s) in ${scmapFile}`);
            patchedFiles.push(scmapPath);
          } else {
            log.debug(`[make-map-adaptive] .scmap: no path strings referencing ${oldFolderName} found`);
          }
        } catch (e) {
          log.warn(`[make-map-adaptive] .scmap structured patch failed (non-fatal): ${e.message}`);
        }
      }
    }

    // ── 4. Rename files inside the folder BEFORE renaming the folder ──────────
    const renamedFiles = [];

    function renameFilesInDir(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { renameFilesInDir(full); continue; }
        if (entry.name.toLowerCase().startsWith(oldMapName.toLowerCase())) {
          const newName = newMapName + entry.name.slice(oldMapName.length);
          const newFull = path.join(dir, newName);
          fs.renameSync(full, newFull);
          renamedFiles.push({ old: path.relative(mapFolder, full), new: path.relative(mapFolder, newFull) });
          log.info(`[make-map-adaptive] renamed file: ${entry.name} → ${newName}`);
        }
      }
    }

    renameFilesInDir(mapFolder);
    log.info(`[make-map-adaptive] renamed ${renamedFiles.length} file(s)`);

    // ── 5. Rename the map folder itself ──────────────────────────────────────
    // Windows can hold a transient handle on the directory (e.g. Explorer thumbnail
    // cache, recent file-reads) and return EPERM even when no file is explicitly open.
    // Retry up to 10x with 300 ms gaps before giving up.
    {
      let folderRenamed = false;
      let lastErr;
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          fs.renameSync(mapFolder, newMapFolder);
          folderRenamed = true;
          break;
        } catch (e) {
          lastErr = e;
          if ((e.code === 'EPERM' || e.code === 'EACCES') && attempt < 9) {
            log.warn(`[make-map-adaptive] folder rename attempt ${attempt + 1} failed (${e.code}), retrying in 300 ms...`);
            await new Promise(r => setTimeout(r, 300));
          } else {
            throw e;
          }
        }
      }
      if (!folderRenamed) throw lastErr;
    }
    log.info(`[make-map-adaptive] renamed folder: ${oldFolderName} → ${newFolderName}`);

    log.info(`[make-map-adaptive] Done → ${newMapFolder}`);
    return {
      success: true,
      alreadyAdaptive: false,
      newMapFolder,
      newFolderName,
      renamedFiles,
      patchedFiles: patchedFiles.map(f => {
        // After renaming, mapFolder no longer exists — use newMapFolder as base
        const base = fs.existsSync(newMapFolder) ? newMapFolder : mapFolder;
        return path.relative(base, f);
      }),
    };

  } catch (e) {
    log.error('[make-map-adaptive] failed:', e);
    return { success: false, error: e.message };
  }
});

// ── preview-render ────────────────────────────────────────────────────────────
// Calls FAForeverMapEditor.exe with CLI args documented by FAF:
//   -renderPreviewImage <width> <height> <scenarioPath> <outputPngPath>
//
// The editor writes the PNG and exits quickly. We must NOT block on execFile
// completing — instead we fire it and immediately start polling for the PNG.
//
// Args: { editorPath, width, height, scenarioPath, outputFolder }
// Returns: { success, pngPath } | { success: false, error }

ipcMain.handle('preview-render', async (event, { editorPath, width, height, scenarioPath, outputFolder, renderProps = true }) => {
  try {
    if (!fs.existsSync(editorPath)) {
      return { success: false, error: `Editor not found: ${editorPath}` };
    }
    if (!fs.existsSync(scenarioPath)) {
      return { success: false, error: `Scenario file not found: ${scenarioPath}` };
    }
    if (!outputFolder) {
      return { success: false, error: 'outputFolder is required' };
    }

    fs.mkdirSync(outputFolder, { recursive: true });

    // ── Write FAF Map Editor PlayerPrefs to registry before launching ──────────
    // The editor stores its paths via Unity PlayerPrefs (Windows registry).
    // Since ForceQuit() skips the normal Unity shutdown, PlayerPrefs are never
    // written by the editor itself. We write them here so the editor can always
    // find gamedata/env.scd and load the map successfully.
    const settings = readSettings();
    const REG_KEY  = 'HKCU\\Software\\Unity\\UnityEditor\\Forged Alliance Forever\\FAF Map Editor';
    const toUnixSlash = (p) => (p || '').replace(/\\/g, '/').replace(/\/?$/, '/');
    const regEntries = [
      ['InstallationPath', toUnixSlash(settings.faInstallPath)],
      ['FafDataPath',      toUnixSlash(settings.fafPath)],
      ['MapsPath',         toUnixSlash(settings.mapsFolder)],
    ];
    for (const [name, value] of regEntries) {
      if (!value || value === '/') continue;
      try {
        execFileSync('reg', ['add', REG_KEY, '/v', name, '/t', 'REG_SZ', '/d', value, '/f']);
        log.info(`[preview-render] registry: ${name} = ${value}`);
      } catch (regErr) {
        log.warn(`[preview-render] could not write registry key ${name}:`, regErr.message);
      }
    }
    // ───────────────────────────────────────────────────────────────────────────

    const editorDir  = path.dirname(editorPath);
    const pngPath    = path.join(outputFolder, `preview_${width}x${height}.png`);

    // Delete any stale PNG from a previous run so we don't confuse it with a
    // freshly rendered one.
    if (fs.existsSync(pngPath)) {
      try { fs.unlinkSync(pngPath); } catch (_) {}
    }

    // ── Optionally strip props from scenario before render ───────────────────
    // If renderProps === false, we temporarily blank out the Props table in the
    // _scenario.lua so the editor renders the map without any props.
    // The original file is restored after the render completes (or fails).
    let scenarioBackup = null;
    if (!renderProps && fs.existsSync(scenarioPath)) {
      try {
        scenarioBackup = fs.readFileSync(scenarioPath, 'utf8');
        // Replace the Props = { ... } block with an empty table.
        // Handles both  Props = { ... }  and  Props = {}  spanning multiple lines.
        const stripped = scenarioBackup.replace(
          /(\bProps\s*=\s*)\{[^}]*\}/gs,
          '$1{}'
        );
        fs.writeFileSync(scenarioPath, stripped, 'utf8');
        log.info('[preview-render] props stripped from scenario for render');
      } catch (stripErr) {
        log.warn('[preview-render] could not strip props:', stripErr.message);
        scenarioBackup = null; // don't attempt restore if write failed
      }
    }

    const restoreScenario = () => {
      if (scenarioBackup !== null) {
        try {
          fs.writeFileSync(scenarioPath, scenarioBackup, 'utf8');
          log.info('[preview-render] scenario restored after render');
        } catch (e) {
          log.error('[preview-render] failed to restore scenario:', e.message);
        }
        scenarioBackup = null;
      }
    };
    // ─────────────────────────────────────────────────────────────────────────

    log.info(`[preview-render] calling: "${editorPath}" -renderPreviewImage ${width} ${height} "${scenarioPath}" "${pngPath}"`);

    let stdout_buf = '', stderr_buf = '';

    // Spawn WITHOUT a completion callback so child.on('close') fires immediately
    // when the process exits — not after Node finishes buffering all stdout/stderr.
    // Unity's ForceQuit() terminates the process synchronously, but File.WriteAllBytes
    // may still be in-flight when 'close' fires, so we keep polling for up to 10 s
    // after exit instead of giving up after a single check.
    //
    // windowsHide: true  — suppresses the console window on Windows so the editor
    //   launches in the background without stealing focus or flashing on screen.
    const child = execFile(
      editorPath,
      ['-renderPreviewImage', String(width), String(height), scenarioPath, pngPath],
      { cwd: editorDir, windowsHide: true },
    );
    child.stdout?.on('data', (d) => { stdout_buf += d; log.info('[preview-render] stdout:', String(d).slice(0, 400)); });
    child.stderr?.on('data', (d) => { stderr_buf += d; log.warn('[preview-render] stderr:', String(d).slice(0, 400)); });
    log.info(`[preview-render] editor PID: ${child.pid} — polling for PNG...`);

    const finalPng = await new Promise((resolve) => {
      let resolved = false;
      const done = (p) => {
        if (!resolved) {
          resolved = true;
          watcher?.close();
          clearInterval(pollInterval);
          clearTimeout(hardTimer);
          clearTimeout(postExitTimer);
          resolve(p);
        }
      };

      // Check immediately in case the editor was very fast.
      if (fs.existsSync(pngPath)) { done(pngPath); return; }

      // fs.watch for instant notification when the PNG appears.
      let watcher;
      try {
        watcher = fs.watch(outputFolder, (ev, filename) => {
          if (filename && filename.toLowerCase().endsWith('.png') && fs.existsSync(pngPath)) {
            log.info('[preview-render] fs.watch detected PNG');
            done(pngPath);
          }
        });
        watcher.on('error', () => {});
      } catch (_) {}

      // Fallback poll every 500 ms (covers cases where fs.watch misses events).
      const pollInterval = setInterval(() => {
        if (fs.existsSync(pngPath)) {
          log.info('[preview-render] poll detected PNG');
          done(pngPath);
        }
      }, 500);

      // ── React when the editor process closes ────────────────────────────────
      // Unity ForceQuit() kills the process, but File.WriteAllBytes() runs on a
      // thread and may finish slightly after the process handle closes.
      // We therefore keep polling for up to 10 s after exit before giving up.
      let postExitTimer = null;
      child.on('close', (code, signal) => {
        log.info(`[preview-render] editor closed — code: ${code}, signal: ${signal}`);
        if (resolved) return;
        // Already polling via setInterval — just set a deadline for post-exit window.
        postExitTimer = setTimeout(() => {
          if (!resolved) {
            log.warn(`[preview-render] PNG did not appear within 10 s of editor exit — failing`);
            done(null);
          }
        }, 10_000);
      });

      child.on('error', (err) => {
        log.error('[preview-render] spawn error:', err.message);
        done(null);
      });

      // Hard safety timeout — only reached if close event never fires (frozen editor).
      const hardTimer = setTimeout(() => {
        log.warn('[preview-render] 120 s hard timeout — killing frozen editor');
        try { child.kill(); } catch (_) {}
        done(null);
      }, 120_000);
    });

    if (!finalPng) {
      restoreScenario();
      log.error('[preview-render] PNG never appeared. stdout:', stdout_buf.slice(0, 600));
      log.error('[preview-render] stderr:', stderr_buf.slice(0, 400));
      return {
        success: false,
        error: `Editor ran but PNG was not written to: ${pngPath}\n\nstdout: ${stdout_buf.slice(0, 300)}`,
      };
    }

    // Brief pause to ensure the OS has fully flushed the file before we read it.
    await new Promise(r => setTimeout(r, 300));
    restoreScenario();
    log.info(`[preview-render] PNG ready: ${finalPng} (${fs.statSync(finalPng).size} bytes)`);
    return { success: true, pngPath: finalPng };

  } catch (e) {
    log.error('[preview-render] failed:', e);
    try { restoreScenario(); } catch (_) {}
    return { success: false, error: e.message };
  }
});


// ── preview-replace-dds ───────────────────────────────────────────────────────
// Replaces the previewImage file inside an unpacked scmap folder with a new DDS.
//
// Args: { unpackFolder, newDdsPath }
// Returns: { success } | { success: false, error }

ipcMain.handle('preview-replace-dds', async (event, { unpackFolder, newDdsPath }) => {
  try {
    if (!fs.existsSync(unpackFolder)) {
      return { success: false, error: `Unpack folder not found: ${unpackFolder}` };
    }
    if (!fs.existsSync(newDdsPath)) {
      return { success: false, error: `New DDS not found: ${newDdsPath}` };
    }

    // Remove any existing previewImage file (with or without extension)
    const entries = fs.readdirSync(unpackFolder);
    const oldFile = entries.find(e => e.toLowerCase().startsWith('previewimage'));
    if (oldFile) {
      fs.unlinkSync(path.join(unpackFolder, oldFile));
      log.info(`[preview-replace] Deleted old: ${oldFile}`);
    }

    // Write new DDS — scmap.js getFile() picks up previewImage.dds automatically
    const dest = path.join(unpackFolder, 'previewImage.dds');
    fs.copyFileSync(newDdsPath, dest);
    log.info(`[preview-replace] Written: ${dest}`);

    return { success: true };
  } catch (e) {
    log.error('[preview-replace-dds] failed:', e);
    return { success: false, error: e.message };
  }
});


// ── preview-image-step ────────────────────────────────────────────────────────
// Orchestrates each individual step of the preview-image pipeline.
// The renderer calls this once per step (unpack, render, convert, replace, pack).
//
// Args:  { step, mapName, width, height, editorPath, mapsFolder }
// Returns: { ok: true } | { ok: false, error: string }

ipcMain.handle('preview-image-step', async (event, { step, mapName, width, height, editorPath, mapsFolder }) => {
  try {
    // ── Normalise map name: append .v0001 if no version suffix ───────────────
    const versionedName = /\.v\d+$/i.test(mapName) ? mapName : `${mapName}.v0001`;
    const mapFolder     = path.join(mapsFolder, versionedName);

    if (!fs.existsSync(mapFolder)) {
      return { ok: false, error: `Map folder not found: ${mapFolder}` };
    }

    // ── Locate the .scmap file ────────────────────────────────────────────────
    const scmapFiles = fs.readdirSync(mapFolder).filter(f => f.toLowerCase().endsWith('.scmap'));
    if (!scmapFiles.length) {
      return { ok: false, error: `No .scmap file found in: ${mapFolder}` };
    }
    const scmapPath    = path.join(mapFolder, scmapFiles[0]);
    const unpackFolder = path.join(SCMAP_DIR, versionedName);
    const tempFolder   = path.join(app.getPath('temp'), 'fmtk-preview-render');

    if (step === 'unpack') {
      // ── Step 1: unpack .scmap ─────────────────────────────────────────────
      const res = await ipcMain.emit
        ? await new Promise((resolve) => {
            ipcMain.emit('scmap-unpack', { reply: resolve }, { scmapPath });
          })
        : null;

      // Directly call the scmapUtils unpack logic instead of re-invoking IPC
      const unpackResult = await (async () => {
        const folderName = versionedName;
        const outFolder  = path.join(SCMAP_DIR, folderName);
        if (fs.existsSync(outFolder)) fs.rmSync(outFolder, { recursive: true, force: true });
        fs.mkdirSync(outFolder, { recursive: true });
        const raw  = fs.readFileSync(scmapPath);
        const data = scmapUtils.parseScmap(raw);
        scmapUtils.exportScmapData(data, outFolder);
        log.info(`[preview-image-step:unpack] Unpacked to: ${outFolder}`);
        return { ok: true };
      })();
      return unpackResult;

    } else if (step === 'render') {
      // ── Step 2: render PNG via Map Editor ────────────────────────────────
      if (!editorPath || !fs.existsSync(editorPath)) {
        return { ok: false, error: `Map Editor not found: ${editorPath || '(not set)'}` };
      }
      // Find the scenario file
      const scenarioFile = fs.readdirSync(mapFolder).find(f => f.toLowerCase().endsWith('_scenario.lua'));
      if (!scenarioFile) {
        return { ok: false, error: `No _scenario.lua found in: ${mapFolder}` };
      }
      const scenarioPath = path.join(mapFolder, scenarioFile);
      fs.mkdirSync(tempFolder, { recursive: true });

      const renderResult = await new Promise(resolve => {
        ipcMain.handle._called = true;
        // Directly call the preview-render logic via shared IPC
        const fakeEvent = {};
        const handler = ipcMain._events?.['preview-render'];
        if (typeof handler === 'function') {
          handler(fakeEvent, { editorPath, width, height, scenarioPath, outputFolder: tempFolder })
            .then(r => resolve(r?.success ? { ok: true } : { ok: false, error: r?.error || 'render failed' }))
            .catch(e => resolve({ ok: false, error: e.message }));
        } else {
          // Fallback: spawn directly
          const pngPath = path.join(tempFolder, `preview_${width}x${height}.png`);
          if (fs.existsSync(pngPath)) { try { fs.unlinkSync(pngPath); } catch (_) {} }
          const child = execFile(editorPath, ['-renderPreviewImage', String(width), String(height), scenarioPath, pngPath], { windowsHide: true });
          const pollInterval = setInterval(() => {
            if (fs.existsSync(pngPath)) { clearInterval(pollInterval); clearTimeout(timer); resolve({ ok: true }); }
          }, 500);
          const timer = setTimeout(() => { clearInterval(pollInterval); child.kill(); resolve({ ok: false, error: 'Render timed out (120 s)' }); }, 120_000);
          child.on('error', e => { clearInterval(pollInterval); clearTimeout(timer); resolve({ ok: false, error: e.message }); });
        }
      });
      return renderResult;

    } else if (step === 'convert') {
      // ── Step 3: convert PNG → DDS ─────────────────────────────────────────
      const pngPath  = path.join(tempFolder, `preview_${width}x${height}.png`);
      const destPath = path.join(tempFolder, `preview_${width}x${height}.dds`);
      if (!fs.existsSync(pngPath)) {
        return { ok: false, error: `Rendered PNG not found: ${pngPath}` };
      }
      // Delegate to the png-to-preview-dds handler
      const handlers = ipcMain.rawListeners('png-to-preview-dds');
      if (handlers.length) {
        const r = await handlers[0]({}, { pngPath, destPath });
        return r?.success ? { ok: true } : { ok: false, error: r?.error || 'convert failed' };
      }
      return { ok: false, error: 'png-to-preview-dds handler not registered' };

    } else if (step === 'replace') {
      // ── Step 4: replace previewImage.dds in unpacked folder ───────────────
      const ddsPath = path.join(tempFolder, `preview_${width}x${height}.dds`);
      if (!fs.existsSync(ddsPath)) {
        return { ok: false, error: `Converted DDS not found: ${ddsPath}` };
      }
      // Remove old preview file and copy new one
      const entries  = fs.readdirSync(unpackFolder);
      const oldFile  = entries.find(f => f.toLowerCase().startsWith('previewimage'));
      if (oldFile) {
        fs.unlinkSync(path.join(unpackFolder, oldFile));
        log.info(`[preview-image-step:replace] Removed old: ${oldFile}`);
      }
      const dest = path.join(unpackFolder, 'previewImage.dds');
      fs.copyFileSync(ddsPath, dest);
      log.info(`[preview-image-step:replace] Injected: ${dest}`);
      return { ok: true };

    } else if (step === 'pack') {
      // ── Step 5: repack .scmap ─────────────────────────────────────────────
      const handlers = ipcMain.rawListeners('scmap-pack');
      if (handlers.length) {
        const r = await handlers[0]({}, { mapName: versionedName, _caller: 'preview-image-step' });
        // Cleanup temp folder
        try { fs.rmSync(tempFolder, { recursive: true, force: true }); } catch (_) {}
        return r?.success ? { ok: true } : { ok: false, error: r?.error || 'pack failed' };
      }
      return { ok: false, error: 'scmap-pack handler not registered' };

    } else {
      return { ok: false, error: `Unknown step: ${step}` };
    }
  } catch (e) {
    log.error(`[preview-image-step:${step}] failed:`, e);
    return { ok: false, error: e.message };
  }
});


function register() {
  // handlers registered at module load time via ipcMain.handle above
}

module.exports = { register };
