/**
 * autosave-runner.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone Node.js script — no Electron dependency.
 * Called by the Windows Task Scheduler; runs, copies the map, exits.
 *
 * Usage (Task Scheduler):
 *   node "C:\path\to\electron\autosave-runner.js" "C:\path\to\userData"
 *
 * Or with the bundled node from Electron resources:
 *   "C:\path\to\app\resources\node.exe" autosave-runner.js <userData>
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Resolve userData path ──────────────────────────────────────────────────────
// Passed as first CLI argument by the Task Scheduler action.
const userDataArg = process.argv[2];
if (!userDataArg) {
  console.error('[autosave-runner] ERROR: userData path not provided as first argument.');
  process.exit(1);
}

const SETTINGS_FILE = path.join(userDataArg, 'settings.json');
const LOG_FILE      = path.join(userDataArg, 'autosave-runner.log');

// ── Tiny logger ───────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) {}
}

// ── Read settings ─────────────────────────────────────────────────────────────
let settings;
try {
  settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
} catch (e) {
  log(`ERROR: Could not read settings.json: ${e.message}`);
  process.exit(1);
}

if (!settings.autosaveEnabled) {
  log('Autosave is disabled — nothing to do.');
  process.exit(0);
}

const { mapsFolder, autosaveMapName, autosavePath, autosaveVersioned } = settings;

if (!mapsFolder || !autosaveMapName || !autosavePath) {
  log('ERROR: Autosave not fully configured (missing mapsFolder, autosaveMapName, or autosavePath).');
  process.exit(1);
}

const src = path.join(mapsFolder, autosaveMapName);
if (!fs.existsSync(src)) {
  log(`ERROR: Source folder not found: ${src}`);
  process.exit(1);
}

// ── Copy helpers ──────────────────────────────────────────────────────────────
function copyDirSync(srcDir, destParent) {
  const base   = path.basename(srcDir);
  const target = path.join(destParent, base);
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const sp = path.join(srcDir, entry.name);
    const dp = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirSync(sp, target);
    else fs.copyFileSync(sp, dp);
  }
  return target;
}

// ── Run ───────────────────────────────────────────────────────────────────────
try {
  let dest;
  if (autosaveVersioned) {
    const ts    = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const vName = `${autosaveMapName}_${ts}`;
    dest        = path.join(autosavePath, vName);
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const sp = path.join(src, entry.name);
      const dp = path.join(dest, entry.name);
      if (entry.isDirectory()) copyDirSync(sp, dest);
      else fs.copyFileSync(sp, dp);
    }
    log(`Versioned copy → ${dest}`);
  } else {
    const fixed = path.join(autosavePath, autosaveMapName);
    if (fs.existsSync(fixed)) fs.rmSync(fixed, { recursive: true, force: true });
    copyDirSync(src, autosavePath);
    dest = fixed;
    log(`Overwrite copy → ${dest}`);
  }

  // Write lastRun back to settings.json so the UI shows the correct time
  settings.autosaveLastRun = new Date().toISOString();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  log('Done — lastRun updated.');
  process.exit(0);
} catch (e) {
  log(`ERROR during copy: ${e.message}`);
  process.exit(1);
}
