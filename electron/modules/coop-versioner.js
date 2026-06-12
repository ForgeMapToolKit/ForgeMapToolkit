'use strict';
/**
 * coop-versioner.js — Co-Op Mission Versioning IPC Handler
 *
 * Fixes the version path problem for co-op missions:
 * Unlike FAF maps, co-op missions live as "base" maps (no v0001 suffix).
 * The deployment script adds the version suffix to folder names, but
 * custom textures embedded in the .scmap binary cannot be fixed with
 * simple string replacement — the binary must be re-written byte-by-byte
 * following the exact .scmap format.
 *
 * This module:
 *  1. Reads all .lua files and does string-replace for path versioning.
 *  2. Reads the .scmap binary and rewrites it with corrected paths,
 *     following the same byte-by-byte format as the GDScript reference.
 *
 * IPC Channels:
 *   coop-version-fix   (invoke) — runs the full versioning fix
 *   coop-progress      (push)   — progress updates to renderer
 */

const path    = require('path');
const fs      = require('fs');
const { app, ipcMain } = require('electron');
const { log } = require('./logger');
const { readSettings } = require('./settings');

// ═══════════════════════════════════════════════════════════════════════════════
// SCMAP BINARY PARSER — JavaScript port of the GDScript reference implementation
// ═══════════════════════════════════════════════════════════════════════════════

const SCMAP_HEADER = Buffer.from([
  0x4D, 0x61, 0x70, 0x1A, // "Map\x1A"
  0x02, 0x00, 0x00, 0x00, // 2
  0xED, 0xFE, 0xEF, 0xBE, // 0xBEEFFEED (little-endian)
  0x02, 0x00, 0x00, 0x00, // 2
]);

class ScmapReader {
  constructor(buffer) {
    this.buf = buffer;
    this.pos = 0;
  }
  readUInt32() {
    const v = this.buf.readUInt32LE(this.pos);
    this.pos += 4;
    return v;
  }
  readFloat() {
    const v = this.buf.readFloatLE(this.pos);
    this.pos += 4;
    return v;
  }
  readUInt8() {
    return this.buf[this.pos++];
  }
  readUInt16() {
    const v = this.buf.readUInt16LE(this.pos);
    this.pos += 2;
    return v;
  }
  readBytes(n) {
    const slice = this.buf.slice(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }
  readNullString() {
    let start = this.pos;
    while (this.pos < this.buf.length && this.buf[this.pos] !== 0) this.pos++;
    const str = this.buf.slice(start, this.pos).toString('utf8');
    this.pos++; // skip null terminator
    return str;
  }
  readSizedString() {
    const len = this.readUInt32();
    const str = this.buf.slice(this.pos, this.pos + len).toString('ascii');
    this.pos += len;
    return str;
  }
  remaining() {
    return this.buf.length - this.pos;
  }
}

class ScmapWriter {
  constructor() {
    this.chunks = [];
  }
  writeBytes(buf) {
    this.chunks.push(buf instanceof Buffer ? buf : Buffer.from(buf));
  }
  writeUInt32(v) {
    const b = Buffer.allocUnsafe(4);
    b.writeUInt32LE(v, 0);
    this.chunks.push(b);
  }
  writeFloat(v) {
    const b = Buffer.allocUnsafe(4);
    b.writeFloatLE(v, 0);
    this.chunks.push(b);
  }
  writeUInt8(v) {
    this.chunks.push(Buffer.from([v]));
  }
  writeUInt16(v) {
    const b = Buffer.allocUnsafe(2);
    b.writeUInt16LE(v, 0);
    this.chunks.push(b);
  }
  writeNullString(str) {
    this.chunks.push(Buffer.from(str, 'utf8'));
    this.chunks.push(Buffer.from([0]));
  }
  writeSizedString(str) {
    const strBuf = Buffer.from(str, 'ascii');
    this.writeUInt32(strBuf.length);
    this.chunks.push(strBuf);
  }
  toBuffer() {
    return Buffer.concat(this.chunks);
  }
}

/**
 * If path starts with /maps/<mapName>/... (case-insensitive),
 * inserts the version suffix into the map folder segment.
 */
function addVersionToMapPath(p, versionSuffix) {
  if (!versionSuffix) return p;
  const lower = p.toLowerCase();
  const parts = lower.split('/').filter(Boolean);
  // Expected: ["maps", "map_name", "env", ...]
  if (parts.length < 3 || parts[0] !== 'maps') return p;
  // Rebuild preserving original casing for all parts except [1]
  const origParts = p.split('/').filter(Boolean);
  origParts[1] = origParts[1] + versionSuffix;
  return '/' + origParts.join('/');
}

function transferNullString(reader, writer, versionSuffix) {
  let s = reader.readNullString();
  if (versionSuffix) s = addVersionToMapPath(s, versionSuffix);
  writer.writeNullString(s);
}

function transferIntSizedChunk(reader, writer) {
  const len = reader.readUInt32();
  writer.writeUInt32(len);
  if (len > 0) writer.writeBytes(reader.readBytes(len));
}

/**
 * Main .scmap binary patcher.
 * Reads inputBuffer, rewrites all embedded path strings with versionSuffix appended,
 * returns the patched Buffer.
 */
function patchScmapPaths(inputBuffer, mapVersion) {
  const reader = new ScmapReader(inputBuffer);
  const writer = new ScmapWriter();

  const vStr = mapVersion >= 0 ? `.v${String(mapVersion).padStart(4, '0')}` : '';

  // Header (16 bytes)
  const header = reader.readBytes(16);
  if (!header.equals(SCMAP_HEADER)) {
    throw new Error('Invalid .scmap header — not a Supreme Commander map file.');
  }
  writer.writeBytes(header);

  // float sizeX, sizeY + 6 null padding bytes = 14 bytes
  writer.writeBytes(reader.readBytes(14));

  // Preview image chunk
  transferIntSizedChunk(reader, writer);

  // Version, width, height, heightScale
  const version    = reader.readUInt32();
  const width      = reader.readUInt32();
  const height     = reader.readUInt32();
  const heightScale = reader.readFloat();
  writer.writeUInt32(version);
  writer.writeUInt32(width);
  writer.writeUInt32(height);
  writer.writeFloat(heightScale);

  // Heightmap: (w+1)*(h+1)*2 bytes
  const heightmapLen = (width + 1) * (height + 1) * 2;
  writer.writeBytes(reader.readBytes(heightmapLen));
  if (version >= 56) {
    // 1 null padding byte after heightmap
    reader.readUInt8();
    writer.writeUInt8(0);
  }

  // Shader name (no path fixup)
  transferNullString(reader, writer, '');
  // Editor bg path, skycube path
  for (let i = 0; i < 2; i++) transferNullString(reader, writer, vStr);

  // Cube maps
  if (version >= 56) {
    const numCubemaps = reader.readUInt32();
    writer.writeUInt32(numCubemaps);
    for (let i = 0; i < numCubemaps; i++) {
      transferNullString(reader, writer, '');   // name
      transferNullString(reader, writer, vStr); // path
    }
  } else {
    transferNullString(reader, writer, vStr); // single path
  }

  // Lighting data: 23 floats × 4 bytes
  writer.writeBytes(reader.readBytes(23 * 4));

  // Water settings: 1 flag byte + 23 floats
  writer.writeBytes(reader.readBytes(1 + 23 * 4));
  // 2 water texture paths
  for (let i = 0; i < 2; i++) transferNullString(reader, writer, vStr);
  writer.writeBytes(reader.readBytes(16)); // 4 floats
  // 4 wave textures (each: 8 bytes + path)
  for (let i = 0; i < 4; i++) {
    writer.writeBytes(reader.readBytes(8));
    transferNullString(reader, writer, vStr);
  }

  // Wave structs
  {
    const waveCount = reader.readUInt32();
    writer.writeUInt32(waveCount);
    for (let i = 0; i < waveCount; i++) {
      transferNullString(reader, writer, ''); // texture name
      transferNullString(reader, writer, ''); // ramp name
      writer.writeBytes(reader.readBytes(17 * 4));
    }
  }

  if (version < 56) {
    // "No Tileset" string
    transferNullString(reader, writer, '');
    const tileCount = reader.readUInt32();
    writer.writeUInt32(tileCount); // always 6
    for (let i = 0; i < tileCount; i++) {
      transferNullString(reader, writer, vStr);
      transferNullString(reader, writer, vStr);
      writer.writeBytes(reader.readBytes(2 * 4)); // 2 floats scale
    }
  } else {
    // Minimap data: 6 floats
    writer.writeBytes(reader.readBytes(6 * 4));
  }

  // Unknown value for version > 56
  if (version > 56) writer.writeBytes(reader.readBytes(4));

  // 19 textures (path + float)
  for (let i = 0; i < 19; i++) {
    transferNullString(reader, writer, vStr);
    writer.writeFloat(reader.readFloat());
  }

  // 2 unknown values
  writer.writeBytes(reader.readBytes(8));

  // Decals
  {
    const decalCount = reader.readUInt32();
    writer.writeUInt32(decalCount);
    for (let i = 0; i < decalCount; i++) {
      writer.writeBytes(reader.readBytes(8)); // id + type
      const numTextures = reader.readUInt32();
      writer.writeUInt32(numTextures);
      for (let j = 0; j < numTextures; j++) {
        // Decal paths are size-prefixed, not null-terminated
        let s = reader.readSizedString();
        s = addVersionToMapPath(s, vStr);
        writer.writeSizedString(s);
      }
      writer.writeBytes(reader.readBytes(12 * 4)); // 11 floats + 1 int
    }
  }

  // Decal groups
  {
    const groupCount = reader.readUInt32();
    writer.writeUInt32(groupCount);
    for (let i = 0; i < groupCount; i++) {
      writer.writeUInt32(reader.readUInt32()); // id
      transferNullString(reader, writer, '');  // name
      const numDecals = reader.readUInt32();
      writer.writeUInt32(numDecals);
      if (numDecals > 0) writer.writeBytes(reader.readBytes(numDecals * 4));
    }
  }

  // int width + height (second occurrence)
  writer.writeBytes(reader.readBytes(8));

  // Normal maps
  {
    const nmCount = reader.readUInt32();
    writer.writeUInt32(nmCount);
    for (let i = 0; i < nmCount; i++) transferIntSizedChunk(reader, writer);
  }

  if (version < 56) writer.writeUInt32(reader.readUInt32()); // unknown

  // Texture masks low
  transferIntSizedChunk(reader, writer);
  // Texture masks high
  if (version >= 56) transferIntSizedChunk(reader, writer);

  // Water maps
  {
    const wmCount = reader.readUInt32();
    writer.writeUInt32(wmCount);
    for (let i = 0; i < wmCount; i++) transferIntSizedChunk(reader, writer);
  }

  // 3 half-size masks (water foam, flatness, depth bias)
  const halfSize = Math.floor(width / 2) * Math.floor(height / 2);
  for (let i = 0; i < 3; i++) writer.writeBytes(reader.readBytes(halfSize));

  // Terrain types
  writer.writeBytes(reader.readBytes(width * height));

  if (version <= 52) writer.writeUInt16(reader.readUInt16());

  // Version 60+ skybox
  if (version >= 60) {
    writer.writeBytes(reader.readBytes(16 * 4));
    transferNullString(reader, writer, vStr); // albedo
    transferNullString(reader, writer, vStr); // glow

    // Planets
    const planetCount = reader.readUInt32();
    writer.writeUInt32(planetCount);
    for (let i = 0; i < planetCount; i++) writer.writeBytes(reader.readBytes(10 * 4));

    // Sky mid color + cloud data
    writer.writeBytes(reader.readBytes(3 + 4 * 4));
    transferNullString(reader, writer, vStr); // cloud texture

    // Cloud layers
    const cloudCount = reader.readUInt32();
    writer.writeUInt32(cloudCount);
    for (let i = 0; i < cloudCount; i++) writer.writeBytes(reader.readBytes(5 * 4));

    // One extra float
    writer.writeFloat(reader.readFloat());
  }

  // Props
  {
    const propCount = reader.readUInt32();
    writer.writeUInt32(propCount);
    for (let i = 0; i < propCount; i++) {
      transferNullString(reader, writer, vStr); // bp path
      writer.writeBytes(reader.readBytes(15 * 4)); // 15 floats of prop data
    }
  }

  // Copy any remaining bytes (future format extensions)
  if (reader.remaining() > 0) {
    writer.writeBytes(reader.readBytes(reader.remaining()));
  }

  return writer.toBuffer();
}

// ═══════════════════════════════════════════════════════════════════════════════
// LUA STRING REPLACEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Replaces all occurrences of /maps/<baseMapName>/ with /maps/<baseMapName><versionSuffix>/
 * in a lua file string (case-insensitive search, preserves original path casing).
 */
function patchLuaContent(content, baseMapName, versionSuffix) {
  // Match /maps/<baseMapName>/ case-insensitively, replace folder name part
  const escapedName = baseMapName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(/maps/${escapedName})(/)`, 'gi');
  return content.replace(re, `$1${versionSuffix}$2`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND PROGRESS HELPER
// ═══════════════════════════════════════════════════════════════════════════════

let _mainWindow = null;

function sendProgress(msg, percent) {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send('coop-progress', { msg, percent });
  }
  log.info(`[coop-versioner] ${msg}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// IPC HANDLER: coop-version-fix
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('coop-version-fix', async (event, { mapFolderName, mapVersion }) => {
  try {
    const settings = readSettings();
    if (!settings.mapsFolder) {
      throw new Error('Maps folder is not configured. Please set it in Settings first.');
    }

    const mapsDir  = settings.mapsFolder;
    const mapDir   = path.join(mapsDir, mapFolderName);

    if (!fs.existsSync(mapDir)) {
      throw new Error(`Map folder not found: "${mapFolderName}" in ${mapsDir}`);
    }

    const versionNumber = parseInt(mapVersion, 10);
    if (isNaN(versionNumber) || versionNumber < 1) {
      throw new Error(`Invalid version number: "${mapVersion}". Must be a positive integer.`);
    }

    const versionSuffix = `.v${String(versionNumber).padStart(4, '0')}`;
    const outputFolderName = mapFolderName + versionSuffix;
    const outputDir = path.join(mapsDir, outputFolderName);

    sendProgress(`Starting versioning: ${mapFolderName} → ${outputFolderName}`, 0);

    // ── Step 1: Copy the entire map folder to the versioned output folder ─────
    if (fs.existsSync(outputDir)) {
      sendProgress(`Removing existing output folder: ${outputFolderName}`, 5);
      fs.rmSync(outputDir, { recursive: true, force: true });
    }

    sendProgress('Copying map folder…', 10);
    copyDirSync(mapDir, outputDir);
    sendProgress('Copy complete.', 30);

    // ── Step 2: Find all files in the output folder ───────────────────────────
    const allFiles = [];
    function collectFiles(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectFiles(full);
        else allFiles.push(full);
      }
    }
    collectFiles(outputDir);

    const luaFiles   = allFiles.filter(f => f.toLowerCase().endsWith('.lua'));
    const scmapFiles = allFiles.filter(f => f.toLowerCase().endsWith('.scmap'));

    sendProgress(`Found ${luaFiles.length} Lua file(s), ${scmapFiles.length} .scmap file(s).`, 35);

    // ── Step 3: Patch Lua files ───────────────────────────────────────────────
    let luaDone = 0;
    for (const luaPath of luaFiles) {
      const content = fs.readFileSync(luaPath, 'utf8');
      const patched = patchLuaContent(content, mapFolderName, versionSuffix);
      if (patched !== content) {
        fs.writeFileSync(luaPath, patched, 'utf8');
        log.info(`[coop-versioner] Patched Lua: ${path.relative(outputDir, luaPath)}`);
      }
      luaDone++;
      const pct = 35 + Math.floor((luaDone / luaFiles.length) * 30);
      sendProgress(`Patching Lua (${luaDone}/${luaFiles.length}): ${path.basename(luaPath)}`, pct);
    }

    // ── Step 4: Patch .scmap binary files ────────────────────────────────────
    let scmapDone = 0;
    for (const scmapPath of scmapFiles) {
      sendProgress(`Patching .scmap binary: ${path.basename(scmapPath)}`, 65 + Math.floor((scmapDone / Math.max(scmapFiles.length, 1)) * 25));
      const inputBuffer = fs.readFileSync(scmapPath);
      const patched     = patchScmapPaths(inputBuffer, versionNumber);
      fs.writeFileSync(scmapPath, patched);
      log.info(`[coop-versioner] Patched .scmap: ${path.relative(outputDir, scmapPath)} (${inputBuffer.length} → ${patched.length} bytes)`);
      scmapDone++;
    }

    // ── Step 5: Rename internal folder name references in .scmap filename ─────
    // Some missions use the map folder name as part of the .scmap filename itself.
    // Rename <mapFolderName>.scmap → <mapFolderName><versionSuffix>.scmap if found.
    for (const scmapPath of scmapFiles) {
      const dir      = path.dirname(scmapPath);
      const basename = path.basename(scmapPath, '.scmap');
      if (basename.toLowerCase() === mapFolderName.toLowerCase()) {
        const newPath = path.join(dir, basename + versionSuffix + '.scmap');
        fs.renameSync(scmapPath, newPath);
        log.info(`[coop-versioner] Renamed .scmap file: ${path.basename(scmapPath)} → ${path.basename(newPath)}`);
      }
    }

    sendProgress(`Done! Output folder: ${outputFolderName}`, 100);

    return {
      ok: true,
      outputFolder: outputFolderName,
      luaPatched:   luaFiles.length,
      scmapPatched: scmapFiles.length,
    };

  } catch (err) {
    log.error(`[coop-versioner] Error: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

// ─── Keep a reference to the main window for progress push messages ──────────
// Called from main.js after window creation.
function setMainWindow(win) {
  _mainWindow = win;
}

// ─── Simple synchronous directory copy ───────────────────────────────────────
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

module.exports = { setMainWindow };
