'use strict';
/**
 * scmap.js — SCMAP pack/unpack IPC handlers, history, data files.
 *
 * Covers: scmap-unpack, scmap-pack, scmap-pack-folder, scmap-list,
 *         scmap-select-file, png-to-preview-dds, scmap-snapshot-folder,
 *         history-load/save, read-data-file, get-asset-base-url,
 *         load-faction-icon.
 *
 * Exports:
 *   register(deps) — registers all IPC handlers in this module
 */

const path  = require('path');
const fs    = require('fs');
const { app, ipcMain, dialog } = require('electron');
const { log } = require('./logger');
const { readSettings, SCMAP_DIR } = require('./settings');
const JSZip = require('jszip');
const scmapUtils = require('../../utils/scmap');
const { withPathGuard: _withPathGuardBase } = require('./security');

// ── sharp (optional) ─────────────────────────────────────────────────────────
let sharp;
try { sharp = require('sharp'); } catch (e) { log.warn('[scmap] sharp not installed — png-to-preview-dds unavailable:', e.message); }

// ── Helper: RGBA Buffer → uncompressed A8R8G8B8 DDS ─────────────────────────
function encodeToDDS(rgbaData, width, height) {
  const header = Buffer.alloc(128, 0);
  header.write('DDS ', 0, 'ascii');
  header.writeUInt32LE(124, 4);
  header.writeUInt32LE(0x0002100F, 8);   // DDSD_CAPS|HEIGHT|WIDTH|PITCH|PIXELFORMAT
  header.writeUInt32LE(height, 12);
  header.writeUInt32LE(width,  16);
  header.writeUInt32LE(width * 4, 20);   // pitch
  header.writeUInt32LE(0, 24);
  header.writeUInt32LE(1, 28);
  header.writeUInt32LE(32, 76);          // DDS_PIXELFORMAT size
  header.writeUInt32LE(0x41, 80);        // DDPF_RGB | DDPF_ALPHAPIXELS
  header.writeUInt32LE(0, 84);           // dwFourCC = 0 (uncompressed)
  header.writeUInt32LE(32, 88);          // 32 bpp
  header.writeUInt32LE(0x00FF0000, 92);  // R mask
  header.writeUInt32LE(0x0000FF00, 96);  // G mask
  header.writeUInt32LE(0x000000FF, 100); // B mask
  header.writeUInt32LE(0xFF000000, 104); // A mask
  header.writeUInt32LE(0x1000, 108);     // DDSCAPS_TEXTURE

  // Convert RGBA → BGRA (A8R8G8B8 little-endian)
  const pixelCount = width * height;
  const pixelData  = Buffer.alloc(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    const s = i * 4;
    pixelData[s]     = rgbaData[s + 2]; // B
    pixelData[s + 1] = rgbaData[s + 1]; // G
    pixelData[s + 2] = rgbaData[s];     // R
    pixelData[s + 3] = rgbaData[s + 3]; // A
  }
  return Buffer.concat([header, pixelData]);
}

function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

// ═══════════════════════════════════════════════════════════════════════════
// SCMAP TOOL — IPC HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

// ── scmap-unpack ─────────────────────────────────────────────────────────────
// Reads a .scmap file and extracts all components to public/scmap/<folderName>/
// The output folder name is derived from the parent folder of the .scmap file,
// which contains the map version (e.g. Hades_Dust.v0002\Hades_Dust.scmap → Hades_Dust.v0002).
// If the output folder already exists it is deleted and rewritten cleanly.
ipcMain.handle('scmap-unpack', withPathGuard(
  ({ scmapPath }) => [scmapPath],
  async (event, { scmapPath }) => {
  try {
    // Derive folder name from the parent directory (contains the version suffix)
    // e.g. C:\maps\Hades_Dust.v0002\Hades_Dust.scmap → "Hades_Dust.v0002"
    const parentFolder = path.basename(path.dirname(scmapPath));
    const mapName      = parentFolder;
    const outputFolder = path.join(SCMAP_DIR, mapName);

    log.info(`[scmap] Unpacking ${scmapPath} → ${outputFolder}`);

    if (fs.existsSync(outputFolder)) {
      // Windows can fail rmSync with ENOTEMPTY even with { force: true } when another
      // process (e.g. the map editor) recently held a handle on a file in the folder.
      // Workaround: delete files individually bottom-up, then retry the folder itself.
      function rmRecursive(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) rmRecursive(full);
          else fs.unlinkSync(full);
        }
        fs.rmdirSync(dir);
      }
      let cleared = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          rmRecursive(outputFolder);
          cleared = true;
          break;
        } catch (e) {
          log.warn(`[scmap] rmRecursive attempt ${attempt + 1} failed (${e.code}), retrying...`);
          await new Promise(r => setTimeout(r, 300));
        }
      }
      if (!cleared) throw new Error(`Could not delete old unpack folder: ${outputFolder}`);
      log.info(`[scmap] Cleared old unpack folder: ${outputFolder}`);
      // Extra pause — Windows releases the path lock asynchronously after rmdir
      await new Promise(r => setTimeout(r, 500));
    }

    let mkdirOk = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        fs.mkdirSync(outputFolder, { recursive: true });
        mkdirOk = true;
        break;
      } catch (e) {
        if ((e.code === 'EPERM' || e.code === 'EACCES' || e.code === 'ENOENT') && attempt < 19) {
          log.warn(`[scmap] mkdir attempt ${attempt + 1} failed (${e.code}), retrying...`);
          await new Promise(r => setTimeout(r, 300));
        } else {
          throw e;
        }
      }
    }
    if (!mkdirOk) throw new Error(`Could not create output folder: ${outputFolder}`);

    const buf  = fs.readFileSync(scmapPath);
    const data = scmapUtils.readDatastream(buf);

    const progress = [];
    scmapUtils.exportScmapData(data, outputFolder, (msg) => {
      progress.push(msg);
      log.debug(`[scmap] ${msg}`);
      event.sender.send('scmap-progress', msg);
    });

    log.info(`[scmap] Unpack complete → ${outputFolder}`);

    return { success: true, outputFolder, mapName };
  } catch (err) {
    log.error('[scmap] scmap-unpack failed:', err);
    return { success: false, error: err.message };
  }
}));

// ── scmap-pack ───────────────────────────────────────────────────────────────
// Reads an unpacked folder from public/scmap/<mapName>/ and writes a .scmap.
// Accepts two calling conventions:
//   1. { mapName, outputPath }          — legacy / manual invocation
//   2. { unpackFolder, scmapPath }      — MapResizer flow (passes paths directly)
// In convention 2, mapName is derived from the scmapPath parent folder so the
// copy-back logic can still locate the versioned map directory in mapsFolder.
ipcMain.handle('scmap-pack', withPathGuard(
  ({ unpackFolder, scmapPath, mapName }) => {
    const settings = readSettings();
    const paths = [];
    if (unpackFolder) paths.push(unpackFolder);
    if (scmapPath)    paths.push(scmapPath);
    // mapName-based pack: resolve the expected output path for guard check
    if (mapName && settings.mapsFolder) {
      const versionedName = /\.v\d+$/i.test(mapName) ? mapName : `${mapName}.v0001`;
      paths.push(path.join(settings.mapsFolder, versionedName));
    }
    return paths;
  },
  async (event, { mapName, outputPath, unpackFolder, scmapPath }) => {
  try {
    // ── Derive mapName if not explicitly provided ─────────────────────────────
    if (!mapName) {
      if (scmapPath) {
        // parent dir of the .scmap file is the versioned folder, e.g. "Helheim.v0002"
        mapName = path.basename(path.dirname(scmapPath));
      } else if (unpackFolder) {
        mapName = path.basename(unpackFolder);
      } else {
        throw new Error('scmap-pack: must provide mapName or scmapPath/unpackFolder');
      }
    }

    // Strip both .scmap suffix and any .vNNNN version suffix to get the bare map name
    const baseMapName = mapName.replace(/\.scmap$/i, '').replace(/\.v\d+$/i, ''); // e.g. "Helheim"

    // ── Resolve input folder ──────────────────────────────────────────────────
    // If the caller already knows the unpacked folder, use it directly.
    // Otherwise search SCMAP_DIR for a matching directory (legacy behaviour).
    const scmapDir = SCMAP_DIR;
    let inputFolder;
    if (unpackFolder) {
      inputFolder = unpackFolder;
    } else {
      const candidates = fs.existsSync(scmapDir)
        ? fs.readdirSync(scmapDir, { withFileTypes: true })
            .filter(e => e.isDirectory() && new RegExp('^' + baseMapName + '(\\.v\\d+)?(\\.scmap)?$', 'i').test(e.name))
            .sort((a, b) => b.name.localeCompare(a.name)) // prefer highest version
        : [];
      inputFolder = candidates.length > 0
        ? path.join(scmapDir, candidates[0].name)
        : path.join(scmapDir, mapName.endsWith('.scmap') ? mapName : mapName + '.scmap'); // fallback
    }

    // ── Resolve destination ───────────────────────────────────────────────────
    // Priority: explicit outputPath → original scmapPath → packed subfolder
    const dest = outputPath || scmapPath || path.join(scmapDir, 'packed', `${baseMapName}.scmap`);

    log.info(`[scmap] Packing ${inputFolder} → ${dest}`);

    const allFiles = fs.readdirSync(inputFolder).filter(f => f !== '_origin.json');
    log.info(`[scmap] Folder contents: ${allFiles.join(', ')}`);

    fs.mkdirSync(path.dirname(dest), { recursive: true });

    const buf = scmapUtils.writeDatastream(inputFolder);
    fs.writeFileSync(dest, buf);

    log.info(`[scmap] Pack complete → ${dest} (${buf.length} bytes)`);

    // ── Copy back to original map folder ──────────────────────────────────
    // mapName + mapsFolder from settings is all we need.
    // Find the versioned folder: <mapsFolder>/<baseMapName>.v0001/ (or .v0002 etc.)
    let originalPath = null;
    try {
      const settings = readSettings();
      if (settings.mapsFolder) {
        const entries = fs.readdirSync(settings.mapsFolder, { withFileTypes: true });
        const versionedDir = entries
          .filter(e => e.isDirectory() && new RegExp('^' + baseMapName + '\.v\\d+$', 'i').test(e.name))
          .sort((a, b) => b.name.localeCompare(a.name))[0];
        if (versionedDir) {
          originalPath = path.join(settings.mapsFolder, versionedDir.name, `${baseMapName}.scmap`);
        }
      }
    } catch (e) {
      log.warn('[scmap] Could not resolve original path from settings:', e.message);
    }

    if (originalPath) {
      fs.copyFileSync(dest, originalPath);
      log.info(`[scmap] Copied back → ${originalPath}`);
    } else {
      log.warn(`[scmap] mapsFolder not set or map folder not found — packed file NOT copied back`);
    }

    return { success: true, outputPath: dest, originalPath, bytes: buf.length };
  } catch (err) {
    log.error('[scmap] scmap-pack failed:', err);
    return { success: false, error: err.message };
  }
}));

// ── scmap-pack-folder ────────────────────────────────────────────────────────
// Packs an arbitrary folder (from the popout drag-and-drop) into a .scmap file.
// The output is written next to the source folder as <folderName>.scmap
ipcMain.handle('scmap-pack-folder', withPathGuard(
  ({ folderPath }) => [folderPath],
  async (event, { folderPath }) => {
  try {
    const folderName  = path.basename(folderPath);
    const baseMapName = folderName.replace(/\.scmap$/i, '');
    const dest        = path.join(path.dirname(folderPath), 'packed', `${baseMapName}.scmap`);

    log.info(`[scmap] pack-folder: ${folderPath} → ${dest}`);

    const allFiles = fs.readdirSync(folderPath).filter(f => f !== '_origin.json');
    log.info(`[scmap] Folder contents: ${allFiles.join(', ')}`);

    fs.mkdirSync(path.dirname(dest), { recursive: true });

    const buf = scmapUtils.writeDatastream(folderPath);
    fs.writeFileSync(dest, buf);

    log.info(`[scmap] pack-folder complete → ${dest} (${buf.length} bytes)`);

    return { success: true, outputPath: dest, bytes: buf.length };
  } catch (err) {
    log.error('[scmap] scmap-pack-folder failed:', err);
    return { success: false, error: err.message };
  }
}));

// ── scmap-list ───────────────────────────────────────────────────────────────
// Lists unpacked maps in SCMAP_DIR that still exist in mapsFolder
ipcMain.handle('scmap-list', async () => {
  try {
    const scmapDir = SCMAP_DIR;
    fs.mkdirSync(scmapDir, { recursive: true });

    const settings = readSettings();
    const mapsFolder = settings?.mapsFolder || null;

    const entries = fs.readdirSync(scmapDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .filter(e => {
        if (!mapsFolder) return true; // no filter possible without mapsFolder
        return fs.existsSync(path.join(mapsFolder, e.name));
      })
      .map(e => {
        try {
          const mtime = fs.statSync(path.join(scmapDir, e.name)).mtimeMs;
          return { name: e.name, mtime };
        } catch (_) {
          return { name: e.name, mtime: 0 };
        }
      });
    return { success: true, maps: entries };
  } catch (err) {
    return { success: false, error: err.message, maps: [] };
  }
});

// ── scmap-select-file ────────────────────────────────────────────────────────
// Opens a file picker for .scmap files
ipcMain.handle('scmap-select-file', async () => {
  const result = await dialog.showOpenDialog({
    title:       'Select .scmap file',
    filters:     [{ name: 'Supreme Commander Map', extensions: ['scmap'] }],
    properties:  ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  return { canceled: false, path: result.filePaths[0], filePath: result.filePaths[0] };
});

ipcMain.handle('png-to-preview-dds', async (event, { pngPath, destPath }) => {
  try {
    if (!sharp) throw new Error('sharp is not available — run: npm install sharp');

    // Guard: both paths must be absolute and within safe locations.
    // pngPath must exist; destPath must share the same parent directory
    // to prevent writing outside temp/app-controlled folders.
    const resolvedPng  = path.resolve(pngPath);
    const resolvedDest = path.resolve(destPath);
    const pngDir  = path.dirname(resolvedPng);
    const destDir = path.dirname(resolvedDest);
    if (pngDir !== destDir) {
      log.warn(`[png-to-preview-dds] Rejected: pngPath and destPath must be in the same directory. png="${resolvedPng}" dest="${resolvedDest}"`);
      return { success: false, error: 'pngPath and destPath must be in the same directory' };
    }
    if (!fs.existsSync(resolvedPng)) {
      return { success: false, error: `Source PNG not found: ${resolvedPng}` };
    }

    // Read PNG and extract raw RGBA pixels
    const pngBuffer = fs.readFileSync(resolvedPng);
    const { data, info } = await sharp(pngBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Reuse the existing encodeToDDS helper already defined in main.js
    const ddsBuffer = encodeToDDS(data, info.width, info.height);

    fs.mkdirSync(require('path').dirname(resolvedDest), { recursive: true });
    fs.writeFileSync(resolvedDest, ddsBuffer);

    log.info(`png-to-preview-dds: wrote ${info.width}x${info.height} DDS → ${resolvedDest}`);
    return { success: true, width: info.width, height: info.height };
  } catch (e) {
    log.error('png-to-preview-dds failed:', e.message);
    return { success: false, error: e.message };
  }
});


ipcMain.handle('scmap-snapshot-folder', withPathGuard(
  ({ folderPath }) => [folderPath],
  async (event, { folderPath }) => {
  try {
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: `Folder not found: ${folderPath}` };
    }

    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const files = {};

    const BINARY_EXTS = new Set(['.dds', '.raw', '.png', '.jpg', '.jpeg', '.bmp', '.tga']);

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      const fullPath = path.join(folderPath, name);
      const ext = path.extname(name).toLowerCase();

      try {
        const stat = fs.statSync(fullPath);
        if (BINARY_EXTS.has(ext)) {
          files[name] = { size: stat.size, binary: true };
        } else {
          const content = fs.readFileSync(fullPath, 'utf8');
          files[name] = { size: stat.size, binary: false, content };
        }
      } catch (e) {
        log.warn(`[scmap-snapshot] Could not read ${name}: ${e.message}`);
        files[name] = { size: 0, binary: ext !== '.lua', error: e.message };
      }
    }

    const snapshot = {
      files,
      timestamp: new Date().toISOString(),
      folderPath,
    };

    log.debug(`[scmap-snapshot] Snapshotted ${Object.keys(files).length} files in ${folderPath}`);
    return { success: true, snapshot };
  } catch (err) {
    log.error('[scmap-snapshot] scmap-snapshot-folder failed:', err);
    return { success: false, error: err.message };
  }
}));


const HISTORY_FILE = path.join(app.getPath('userData'), 'scmap-history.json');

ipcMain.handle('history-load', async () => {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return { data: {} };
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    return { data: JSON.parse(raw) };
  } catch (e) {
    console.warn('[history-load] Failed:', e.message);
    return { data: {} };
  }
});

ipcMain.handle('history-save', async (_event, { data }) => {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data), 'utf8');
    return { success: true };
  } catch (e) {
    console.warn('[history-save] Failed:', e.message);
    return { success: false, error: e.message };
  }
});

// ─── IPC handler: read-data-file ─────────────────────────────────────────────
// Add this in your main process (e.g. ipc-handlers.js or main.js)
// It reads a JSON file from <app root>/data/<name> and returns the parsed object.

ipcMain.handle('read-data-file', async (_event, { name }) => {
  try {
    const filePath = path.join(app.getAppPath(), 'data', name);
    log.debug(`read-data-file: ${filePath}`);
    const raw  = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return { success: true, data };
  } catch (e) {
    log.warn(`read-data-file failed (${name}): ${e.message}`);
    return { success: false, error: e.message };
  }
});

// ─── IPC handler: get-asset-base-url ─────────────────────────────────────────
// Returns the file:// base URL for dist/assets so renderer can build icon paths
ipcMain.handle('get-asset-base-url', async () => {
  const distPath = path.join(app.getAppPath(), 'dist');
  return { baseUrl: 'file:///' + distPath.split('\\').join('/') };
});

// ─── IPC handler: load-faction-icon ──────────────────────────────────────────
// Reads an SVG from public/assets/factions/<name>.svg and returns it as a
// base64 data URL so the renderer can display it in file:// context.
ipcMain.handle('load-faction-icon', async (_event, { name }) => {
  try {
    const safeName = (name || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const filePath = path.join(app.getAppPath(), 'public', 'assets', 'factions', `${safeName}.svg`);
    if (!fs.existsSync(filePath)) {
      log.debug(`load-faction-icon: not found: ${filePath}`);
      return { success: false };
    }
    const raw  = fs.readFileSync(filePath);
    const b64  = raw.toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${b64}`;
    return { success: true, dataUrl };
  } catch (e) {
    log.warn(`load-faction-icon failed (${name}): ${e.message}`);
    return { success: false, error: e.message };
  }
});



function register() {
  // handlers registered at module load time via ipcMain.handle above
}

module.exports = { register };
