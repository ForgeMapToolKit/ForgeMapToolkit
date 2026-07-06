#!/usr/bin/env node
'use strict';
/**
 * fmt-cli.js — ForgeMapToolkit Headless CLI
 *
 * One-shot:  fmt <command> [args]
 * REPL:      fmt  (no arguments)
 *
 * Commands:
 *   unpack  <map-name> [--out <dir>]
 *   repack  <map-name> [--out <output.scmap>]
 *   resize  <map-name> <target-size> [options]
 *   preview <map-name> <resolution> [options]
 *
 * Examples:
 *   fmt unpack blackstar.v0004
 *   fmt unpack blackstar.v0004 --out ./tmp/blackstar
 *   fmt repack blackstar.v0004
 *   fmt repack blackstar.v0004 --out ./custom/output.scmap
 *   fmt resize blackstar.v0004 1024
 *   fmt resize blackstar.v0004 1024 --no-new-version --no-props
 *   fmt preview blackstar.v0004 1024
 *   fmt preview blackstar.v0004 2048 --no-props --no-decals
 *
 * Environment:
 *   FMT_USER_DATA   Overrides the userData path (default: platform-specific)
 */

const path      = require('path');
const fs        = require('fs');
const readline  = require('readline');
const { execFile, spawn } = require('child_process');

const scmapUtils = require('../utils/scmap');
const {
  findScmap,
  duplicateMapVersion,
  scaleScmap,
  scaleSaveLua,
  updateScenarioLua,
} = require('./modules/map-resizer');
const { SCMAP_DIR, readSettings } = require('./modules/settings');

// ── Version ───────────────────────────────────────────────────────────────────
let _version = '0.1.0';
try { _version = require('../package.json').version; } catch (_) {}

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',  bold:   '\x1b[1m',  dim:    '\x1b[2m',
  cyan:   '\x1b[36m', yellow: '\x1b[33m', green:  '\x1b[32m',
  red:    '\x1b[31m', gray:   '\x1b[90m', white:  '\x1b[37m',
};
const col  = (code, str) => `${code}${str}${C.reset}`;
const print = (msg)  => console.log(col(C.gray,  msg));
const ok    = (msg)  => console.log(col(C.green, '✔ ') + msg);
const warn  = (msg)  => console.log(col(C.yellow,'⚠ ') + msg);
const err   = (msg)  => console.error(col(C.red, '✖ ') + msg);

// ── Settings helpers ──────────────────────────────────────────────────────────

function getSettings() {
  const s = readSettings();
  return s;
}

/**
 * Resolve a map folder from a short name like "blackstar.v0004".
 * Adds .v0001 suffix if no version is present.
 * Returns { mapFolder, bareMapName, scmapPath, scenarioPath }
 */
function resolveMap(mapName) {
  const s          = getSettings();
  const mapsFolder = s.mapsFolder;
  if (!mapsFolder) throw new Error('mapsFolder not configured. Set it in FMT Settings → Game Paths.');

  const versionedName = /\.v\d{4}$/.test(mapName) ? mapName : `${mapName}.v0001`;
  const bareMapName   = versionedName.replace(/\.v\d+$/, '');
  const mapFolder     = path.join(mapsFolder, versionedName);

  if (!fs.existsSync(mapFolder)) throw new Error(`Map folder not found: ${mapFolder}`);

  const scmapPath    = path.join(mapFolder, `${bareMapName}.scmap`);
  const scenarioPath = path.join(mapFolder, `${bareMapName}_scenario.lua`);

  if (!fs.existsSync(scmapPath)) throw new Error(`.scmap not found: ${scmapPath}`);

  return { mapFolder, bareMapName, scmapPath, scenarioPath, versionedName };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARG PARSER
// ═══════════════════════════════════════════════════════════════════════════════

function parseArgs(argv) {
  const args  = argv;
  const pos   = [];
  const flags = {};
  let cmd     = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (key.startsWith('no-')) {
        flags[key.slice(3)] = false;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else if (cmd === null) {
      cmd = a;
    } else {
      pos.push(a);
    }
  }

  return { cmd, pos, flags };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

// ── UNPACK ────────────────────────────────────────────────────────────────────

async function cmdUnpack(pos, flags) {
  const mapName = pos[0];
  if (!mapName) throw new Error('Usage: unpack <map-name> [--out <dir>]');

  const { scmapPath, bareMapName } = resolveMap(mapName);

  const outputDir = flags.out
    ? path.resolve(flags.out)
    : path.join(SCMAP_DIR, bareMapName);

  print(`[unpack] ${scmapPath}`);
  print(`[unpack] → ${outputDir}`);

  if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const buf  = fs.readFileSync(scmapPath);
  const data = scmapUtils.readDatastream(buf);
  scmapUtils.exportScmapData(data, outputDir, msg => process.stdout.write(`  ${msg}\n`));

  ok(`Unpacked → ${outputDir}`);
}

// ── REPACK ────────────────────────────────────────────────────────────────────

async function cmdRepack(pos, flags) {
  const mapName = pos[0];
  if (!mapName) throw new Error('Usage: repack <map-name> [--out <output.scmap>]');

  const { scmapPath, bareMapName, mapFolder } = resolveMap(mapName);

  const unpackDir = flags.from
    ? path.resolve(flags.from)
    : path.join(SCMAP_DIR, bareMapName);

  if (!fs.existsSync(unpackDir)) throw new Error(`Unpack dir not found: ${unpackDir}\nRun 'unpack ${mapName}' first.`);

  const absOut = flags.out ? path.resolve(flags.out) : scmapPath;

  print(`[repack] ${unpackDir}`);
  print(`[repack] → ${absOut}`);

  const outBuf = scmapUtils.writeDatastream(unpackDir);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, outBuf);

  ok(`Repacked — ${(outBuf.length / 1024).toFixed(1)} KB → ${absOut}`);
}

// ── RESIZE ────────────────────────────────────────────────────────────────────

const VALID_SIZES = new Set([128, 256, 512, 1024, 2048, 4096]);

async function cmdResize(pos, flags) {
  const mapName    = pos[0];
  const targetSize = parseInt(pos[1], 10);

  if (!mapName || isNaN(targetSize))
    throw new Error('Usage: resize <map-name> <target-size> [options]');
  if (!VALID_SIZES.has(targetSize))
    throw new Error(`Invalid target size: ${targetSize}. Valid: ${[...VALID_SIZES].join(', ')}`);

  const { mapFolder } = resolveMap(mapName);

  const opts = {
    newVersion:    flags['new-version'] !== false,
    scaleProps:    flags.props          !== false,
    scaleDecals:   flags.decals         !== false,
    scaleMarkers:  flags.markers        !== false,
    scaleAreas:    flags.areas          !== false,
    scaleTextures: flags.textures       !== false,
    scaleSkybox:   flags.skybox         !== false,
    scaleFog:      flags.fog            !== false,
  };

  print(`[resize] ${mapFolder}`);
  print(`[resize] target: ${targetSize}`);

  const scenarioFile = fs.readdirSync(mapFolder).find(f => f.toLowerCase().endsWith('_scenario.lua'));
  if (!scenarioFile) throw new Error('_scenario.lua not found in map folder');

  const scenSrc   = fs.readFileSync(path.join(mapFolder, scenarioFile), 'utf8');
  const sizeMatch = scenSrc.match(/size\s*=\s*\{\s*(\d+)\s*,\s*(\d+)\s*\}/);
  if (!sizeMatch) throw new Error('Could not read current map size from _scenario.lua');

  const fromSize = parseInt(sizeMatch[1], 10);
  if (fromSize === targetSize) throw new Error(`Map is already ${targetSize} — nothing to do.`);

  const factor = targetSize / fromSize;
  print(`[resize] ${fromSize} → ${targetSize} (×${factor})`);

  let activeFolder = mapFolder;
  if (opts.newVersion) {
    print('[resize] Creating new version…');
    const dupRes = await duplicateMapVersion(mapFolder);
    if (!dupRes.success) throw new Error(`Duplicate failed: ${dupRes.error}`);
    activeFolder = dupRes.newMapFolder;
    print(`[resize] New version: ${dupRes.newVersionName}`);
  }

  const findRes = await findScmap(activeFolder);
  if (!findRes.success) throw new Error(`Find scmap failed: ${findRes.error}`);

  const unpackDir = path.join(SCMAP_DIR, path.basename(activeFolder));
  print('[resize] Unpacking scmap…');
  if (fs.existsSync(unpackDir)) fs.rmSync(unpackDir, { recursive: true, force: true });
  fs.mkdirSync(unpackDir, { recursive: true });

  const buf  = fs.readFileSync(findRes.scmapPath);
  const data = scmapUtils.readDatastream(buf);
  scmapUtils.exportScmapData(data, unpackDir, () => {});

  print('[resize] Scaling scmap data…');
  const scaleRes = await scaleScmap({
    unpackFolder: unpackDir, fromSize, toSize: targetSize, factor,
    scaleProps: opts.scaleProps, scaleDecals: opts.scaleDecals,
    scaleTextures: opts.scaleTextures, scaleSkybox: opts.scaleSkybox, scaleFog: opts.scaleFog,
  });
  if (!scaleRes.success) throw new Error(`scaleScmap failed: ${scaleRes.error}`);

  print('[resize] Repacking scmap…');
  const outBuf = scmapUtils.writeDatastream(unpackDir);
  fs.writeFileSync(findRes.scmapPath, outBuf);

  print('[resize] Scaling save.lua…');
  const saveRes = await scaleSaveLua({
    mapFolder: activeFolder, factor, toSize: targetSize,
    scaleMarkers: opts.scaleMarkers, scaleAreas: opts.scaleAreas,
  });
  if (!saveRes.success) throw new Error(`scaleSaveLua failed: ${saveRes.error}`);

  print('[resize] Updating scenario.lua…');
  const scenRes = await updateScenarioLua({ mapFolder: activeFolder, toSize: targetSize, factor });
  if (!scenRes.success) throw new Error(`updateScenarioLua failed: ${scenRes.error}`);

  ok(`Done — ${activeFolder}`);
  print(`  props scaled:   ${scaleRes.propsScaled}`);
  print(`  decals scaled:  ${scaleRes.decalsScaled}`);
  print(`  markers scaled: ${saveRes.markersScaled}`);
  print(`  areas scaled:   ${saveRes.areasScaled}`);
}

// ── PREVIEW ───────────────────────────────────────────────────────────────────

const VALID_PREVIEW_SIZES = new Set([512, 1024, 2048, 4096]);
const { execFileSync } = require('child_process');

async function cmdPreview(pos, flags) {
  const mapName    = pos[0];
  const resolution = parseInt(pos[1], 10);

  if (!mapName || isNaN(resolution))
    throw new Error('Usage: preview <map-name> <resolution> [--no-props]');
  if (!VALID_PREVIEW_SIZES.has(resolution))
    throw new Error(`Invalid resolution: ${resolution}. Valid: ${[...VALID_PREVIEW_SIZES].join(', ')}`);

  const s = getSettings();
  if (!s.editorPath)          throw new Error('editorPath not configured. Set it in FMT Settings → Game Paths.');
  if (!fs.existsSync(s.editorPath)) throw new Error(`Editor not found: ${s.editorPath}`);

  const { scmapPath, scenarioPath, bareMapName } = resolveMap(mapName);
  const renderProps = flags.props !== false;

  // ── Step 0 — Write registry so editor finds gamedata ─────────────────────────
  const REG_KEY    = 'HKCU\\Software\\Unity\\UnityEditor\\Forged Alliance Forever\\FAF Map Editor';
  const toUnix     = p => (p || '').replace(/\\/g, '/').replace(/\/?$/, '/');
  const regEntries = [
    ['InstallationPath', toUnix(s.faInstallPath)],
    ['FafDataPath',      toUnix(s.fafPath)],
    ['MapsPath',         toUnix(s.mapsFolder)],
  ];
  for (const [name, value] of regEntries) {
    if (!value || value === '/') continue;
    try {
      execFileSync('reg', ['add', REG_KEY, '/v', name, '/t', 'REG_SZ', '/d', value, '/f'], { windowsHide: true });
      print(`[preview] registry: ${name} = ${value}`);
    } catch (e) { warn(`[preview] registry write failed for ${name}: ${e.message}`); }
  }

  // ── Step 1 — Unpack ───────────────────────────────────────────────────────────
  const unpackDir = path.join(SCMAP_DIR, bareMapName + '_preview_tmp');
  print('[preview] Unpacking scmap…');
  if (fs.existsSync(unpackDir)) fs.rmSync(unpackDir, { recursive: true, force: true });
  fs.mkdirSync(unpackDir, { recursive: true });

  const buf  = fs.readFileSync(scmapPath);
  const data = scmapUtils.readDatastream(buf);
  scmapUtils.exportScmapData(data, unpackDir, () => {});

  // ── Step 2 — Optionally strip props ──────────────────────────────────────────
  let scenarioBackup = null;
  if (!renderProps) {
    scenarioBackup = fs.readFileSync(scenarioPath, 'utf8');
    const stripped = scenarioBackup.replace(/(\bProps\s*=\s*)\{[^}]*\}/gs, '$1{}');
    fs.writeFileSync(scenarioPath, stripped, 'utf8');
    print('[preview] Props stripped from scenario for render');
  }
  const restoreScenario = () => {
    if (scenarioBackup !== null) {
      try { fs.writeFileSync(scenarioPath, scenarioBackup, 'utf8'); } catch (_) {}
      scenarioBackup = null;
    }
  };

  // ── Step 3 — Render ──────────────────────────────────────────────────────────
  // Correct CLI: -renderPreviewImage <width> <height> <scenarioPath> <outputPngPath>
  const editorDir = path.dirname(s.editorPath);
  const pngPath   = path.join(unpackDir, `preview_${resolution}x${resolution}.png`);
  const ddsPath   = path.join(unpackDir, 'previewImage.dds');

  if (fs.existsSync(pngPath)) { try { fs.unlinkSync(pngPath); } catch (_) {} }

  print(`[preview] Launching Map Editor (${resolution}×${resolution})…`);
  print('[preview] This may take 10–60 seconds…');

  const finalPng = await new Promise(resolve => {
    const child = execFile(
      s.editorPath,
      ['-renderPreviewImage', String(resolution), String(resolution), scenarioPath, pngPath],
      { cwd: editorDir, windowsHide: true },
    );
    child.stdout?.on('data', d => print(`  [editor] ${d.toString().trim()}`));
    child.stderr?.on('data', d => print(`  [editor] ${d.toString().trim()}`));

    let resolved = false;
    const done = p => {
      if (!resolved) {
        resolved = true;
        clearInterval(poll);
        clearTimeout(hard);
        clearTimeout(postExit);
        resolve(p);
      }
    };

    const poll = setInterval(() => { if (fs.existsSync(pngPath)) { print('[preview] PNG detected'); done(pngPath); } }, 500);
    let postExit = null;
    child.on('close', code => {
      print(`[preview] Editor closed — code: ${code}`);
      if (resolved) return;
      postExit = setTimeout(() => { if (!resolved) { warn('[preview] PNG did not appear within 10 s after editor exit'); done(null); } }, 10_000);
    });
    child.on('error', e => { warn(`[preview] spawn error: ${e.message}`); done(null); });
    const hard = setTimeout(() => { warn('[preview] 120 s timeout'); try { child.kill(); } catch (_) {} done(null); }, 120_000);
  });

  restoreScenario();

  if (!finalPng) {
    fs.rmSync(unpackDir, { recursive: true, force: true });
    throw new Error(`Editor ran but PNG was not written.\nCheck editorPath / faInstallPath / fafPath in FMT Settings.`);
  }

  await new Promise(r => setTimeout(r, 300));

  // ── Step 4 — PNG → DDS ───────────────────────────────────────────────────────
  print('[preview] Converting PNG → DDS…');
  try {
    const sharp = require('sharp');
    const { data: pixels, info } = await sharp(finalPng).raw().toBuffer({ resolveWithObject: true });
    fs.writeFileSync(ddsPath, Buffer.concat([buildDdsHeader(info.width, info.height), pixels]));
    fs.unlinkSync(finalPng);
    print('[preview] PNG → DDS done');
  } catch (e) {
    fs.rmSync(unpackDir, { recursive: true, force: true });
    if (e.code === 'MODULE_NOT_FOUND')
      throw new Error('sharp is not installed. Run "npm install sharp" in the project folder.');
    throw new Error(`PNG → DDS failed: ${e.message}`);
  }

  // ── Step 5 — Repack ──────────────────────────────────────────────────────────
  print('[preview] Repacking scmap…');
  const outBuf = scmapUtils.writeDatastream(unpackDir);
  fs.writeFileSync(scmapPath, outBuf);
  fs.rmSync(unpackDir, { recursive: true, force: true });

  ok(`Preview updated — ${scmapPath}`);
  print(`  Resolution: ${resolution}×${resolution}`);
  print(`  Props rendered: ${renderProps}`);
}

/**
 * Build a minimal uncompressed RGBA DDS header (128 bytes).
 */
function buildDdsHeader(width, height) {
  const buf = Buffer.alloc(128, 0);
  buf.writeUInt32LE(0x20534444, 0);  // magic 'DDS '
  buf.writeUInt32LE(124,         4);  // dwSize
  buf.writeUInt32LE(0x0002100F, 8);  // dwFlags: caps|height|width|pitch|pixelformat
  buf.writeUInt32LE(height,     12);
  buf.writeUInt32LE(width,      16);
  buf.writeUInt32LE(width * 4,  20);  // dwPitchOrLinearSize
  // pixel format at offset 76
  buf.writeUInt32LE(32,         76);  // pfSize
  buf.writeUInt32LE(0x41,       80);  // pfFlags: RGBA
  buf.writeUInt32LE(32,         88);  // pfRGBBitCount
  buf.writeUInt32LE(0x00FF0000, 92);  // R mask
  buf.writeUInt32LE(0x0000FF00, 96);  // G mask
  buf.writeUInt32LE(0x000000FF, 100); // B mask
  buf.writeUInt32LE(0xFF000000, 104); // A mask
  buf.writeUInt32LE(0x1000,     108); // dwCaps: TEXTURE
  return buf;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELP
// ═══════════════════════════════════════════════════════════════════════════════

function printHelp() {
  const h = s => col(C.cyan + C.bold, s);
  const f = s => col(C.yellow, s);
  const d = s => col(C.gray, s);

  console.log(`
${h('COMMANDS')}

  ${f('unpack')} <map-name> [--out <dir>]
      Extract a map's .scmap file into its components.
      Map name: "blackstar.v0004" or just "blackstar" (assumes .v0001).
      Default output: FMT userData/scmap/<mapname>/

  ${f('repack')} <map-name> [--out <output.scmap>]
      Pack extracted components back into the map's .scmap.
      Default: overwrites the original .scmap in the map folder.

  ${f('resize')} <map-name> <size> [options]
      Scale a map to a new size (128 / 256 / 512 / 1024 / 2048 / 4096).
      ${d('Options (all enabled by default):')}
        --no-new-version    Overwrite original (no v000N backup)
        --no-props          Skip prop scaling
        --no-decals         Skip decal scaling
        --no-markers        Skip marker scaling
        --no-areas          Skip area scaling
        --no-textures       Skip terrain texture scaling
        --no-skybox         Skip skybox scaling
        --no-fog            Skip fog-of-war scaling

  ${f('preview')} <map-name> <resolution> [options]
      Render a preview image and embed it into the map's .scmap.
      Resolutions: 512 / 1024 / 2048 / 4096
      ${d('Options:')}
        --no-props          Render without props
        --no-decals         Render without decals

${h('REPL COMMANDS')}

  ${f('/help')}              Show this help
  ${f('/clear')}             Clear the terminal
  ${f('/exit')}  ${f('/quit')}      Exit the REPL

${h('ENVIRONMENT')}

  FMT_USER_DATA   Override the userData path (default: platform-specific)

${h('NOTES')}

  mapsFolder and editorPath are read from your FMT settings automatically.
  Configure them in the app under ${d('Settings → Game Paths')}.
`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPATCH
// ═══════════════════════════════════════════════════════════════════════════════

async function dispatch(cmd, pos, flags) {
  switch (cmd) {
    case 'unpack':  await cmdUnpack(pos, flags);  break;
    case 'repack':  await cmdRepack(pos, flags);  break;
    case 'resize':  await cmdResize(pos, flags);  break;
    case 'preview': await cmdPreview(pos, flags); break;
    default: throw new Error(`Unknown command: "${cmd}"  —  type /help for valid commands`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPL
// ═══════════════════════════════════════════════════════════════════════════════

function printBanner() {
  const line = '─'.repeat(44);
  console.log(col(C.cyan,  `╭${line}╮`));
  console.log(col(C.cyan,  '│') + col(C.bold, `   ForgeMapToolkit  CLI  v${_version}`.padEnd(44)) + col(C.cyan, '│'));
  console.log(col(C.cyan,  `╰${line}╯`));
  console.log(col(C.gray,  '  Type /help for available commands.\n'));
}

async function startRepl() {
  printBanner();

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    prompt: col(C.cyan, 'fmt') + col(C.gray, ' › '),
  });

  rl.prompt();

  rl.on('line', async line => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    if (input === '/exit' || input === '/quit') {
      console.log(col(C.gray, 'Goodbye.'));
      rl.close(); process.exit(0);
    }
    if (input === '/help')  { printHelp();                              rl.prompt(); return; }
    if (input === '/clear') { process.stdout.write('\x1b[2J\x1b[0f'); printBanner(); rl.prompt(); return; }

    const tokens   = input.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const unquoted = tokens.map(t => t.replace(/^"|"$/g, ''));
    const { cmd, pos, flags } = parseArgs(unquoted);

    if (!cmd) { rl.prompt(); return; }

    try   { await dispatch(cmd, pos, flags); }
    catch (e) { err(e.message); }

    rl.prompt();
  });

  rl.on('close', () => process.exit(0));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const { cmd, pos, flags } = parseArgs(process.argv.slice(2));

  if (cmd) {
    if (flags.help || flags.h) { printHelp(); process.exit(0); }
    try   { await dispatch(cmd, pos, flags); }
    catch (e) { err(e.message); process.exit(1); }
    return;
  }

  if (flags.help || flags.h) { printHelp(); process.exit(0); }

  startRepl();
}

main();
