'use strict';
/**
 * cli-runner.js — Structured CLI command runner with streaming output.
 *
 * Exposes two IPC handlers:
 *   cli-run    { command, mapName, width?, height? } → { success, pngPath? }
 *   cli-abort  {}                                    → { success }
 *
 * Pushes events on 'cli-output': { type: 'stdout'|'stderr'|'info'|'error', text, ts }
 *
 * Automatically writes FAF Map Editor registry keys before any render command
 * so the editor can locate gamedata/env.scd regardless of whether it was
 * previously launched through the UI.
 */

const path     = require('path');
const fs       = require('fs');
const { execFile, execFileSync } = require('child_process');
const { ipcMain, BrowserWindow } = require('electron');
const { log }  = require('./logger');
const { readSettings } = require('./settings');

// ── helpers ───────────────────────────────────────────────────────────────────

function getWebContents() {
  const wins = BrowserWindow.getAllWindows();
  return wins.length ? wins[0].webContents : null;
}

function push(wc, type, text) {
  if (!wc || wc.isDestroyed()) return;
  wc.send('cli-output', { type, text, ts: Date.now() });
}

function writeRegistryKeys(settings, wc) {
  const REG_KEY = 'HKCU\\Software\\Unity\\UnityEditor\\Forged Alliance Forever\\FAF Map Editor';
  const toUnix  = p => (p || '').replace(/\\/g, '/').replace(/\/?$/, '/');
  const entries = [
    ['InstallationPath', toUnix(settings.faInstallPath)],
    ['FafDataPath',      toUnix(settings.fafPath)],
    ['MapsPath',         toUnix(settings.mapsFolder)],
  ];
  for (const [name, value] of entries) {
    if (!value || value === '/') continue;
    try {
      execFileSync('reg', ['add', REG_KEY, '/v', name, '/t', 'REG_SZ', '/d', value, '/f']);
      push(wc, 'info', `  [reg] ${name} = ${value}`);
    } catch (e) {
      push(wc, 'stderr', `  [reg] WARN: could not write ${name}: ${e.message}`);
    }
  }
}

// ── state ─────────────────────────────────────────────────────────────────────

let activeChild = null;

// ── cli-run ───────────────────────────────────────────────────────────────────

ipcMain.handle('cli-run', async (_event, { command, mapName, width = 1024, height = 1024 }) => {
  const wc       = getWebContents();
  const settings = readSettings();
  const { mapsFolder = '', editorPath = '' } = settings;

  const versionedName = /\.v\d+$/i.test(mapName) ? mapName : `${mapName}.v0001`;
  const bareMapName   = versionedName.replace(/\.v\d+$/i, '');
  const mapFolder     = path.join(mapsFolder, versionedName);

  push(wc, 'info', `▶ ${command.toUpperCase()}  ${versionedName}`);

  try {
    // ── render ──────────────────────────────────────────────────────────────
    if (command === 'render') {
      if (!editorPath || !fs.existsSync(editorPath)) {
        push(wc, 'error', `✗ Editor not found: ${editorPath || '(not configured)'}`);
        return { success: false, error: 'Editor path not configured' };
      }
      if (!fs.existsSync(mapFolder)) {
        push(wc, 'error', `✗ Map folder not found: ${mapFolder}`);
        return { success: false, error: `Map folder not found: ${mapFolder}` };
      }

      const scenarioFile = fs.readdirSync(mapFolder)
        .find(f => f.toLowerCase().endsWith('_scenario.lua'));
      if (!scenarioFile) {
        push(wc, 'error', `✗ No _scenario.lua found in ${mapFolder}`);
        return { success: false, error: 'No _scenario.lua found' };
      }

      const scenarioPath = path.join(mapFolder, scenarioFile);
      const pngPath      = path.join(mapFolder, `preview_${width}x${height}.png`);
      if (fs.existsSync(pngPath)) { try { fs.unlinkSync(pngPath); } catch (_) {} }

      push(wc, 'info', `  Writing registry keys so editor can locate gamedata...`);
      writeRegistryKeys(settings, wc);
      push(wc, 'info', `  Registry ready.`);
      push(wc, 'info', `  Scenario : ${scenarioPath}`);
      push(wc, 'info', `  Output   : ${pngPath}`);
      push(wc, 'info', `  Size     : ${width}×${height}`);
      push(wc, 'info', '');

      const result = await new Promise(resolve => {
        let resolved = false;
        const done = (ok, err) => {
          if (resolved) return;
          resolved = true;
          activeChild = null;
          resolve({ ok, err });
        };

        const child = execFile(
          editorPath,
          ['-renderPreviewImage', String(width), String(height), scenarioPath, pngPath],
          { cwd: path.dirname(editorPath), windowsHide: true },
        );
        activeChild = child;

        child.stdout?.on('data', d => push(wc, 'stdout', String(d).trimEnd()));
        child.stderr?.on('data', d => push(wc, 'stderr', String(d).trimEnd()));

        let postExitTimer = null;
        child.on('close', (code, signal) => {
          push(wc, 'info', `  Editor closed — code: ${code ?? '—'}, signal: ${signal ?? '—'}`);
          if (resolved) return;
          const poll = setInterval(() => {
            if (fs.existsSync(pngPath)) {
              clearInterval(poll);
              clearTimeout(postExitTimer);
              done(true, null);
            }
          }, 500);
          postExitTimer = setTimeout(() => {
            clearInterval(poll);
            done(false, 'PNG did not appear within 10 s of editor exit');
          }, 10_000);
        });

        child.on('error', e => done(false, e.message));

        // hard safety timeout
        setTimeout(() => {
          try { child.kill(); } catch (_) {}
          done(false, '120 s hard timeout');
        }, 120_000);
      });

      if (!result.ok) {
        push(wc, 'error', `✗ Render failed: ${result.err}`);
        return { success: false, error: result.err };
      }

      push(wc, 'info', `✓ PNG ready: ${pngPath}`);
      return { success: true, pngPath };
    }

    // ── unpack ───────────────────────────────────────────────────────────────
    if (command === 'unpack') {
      const scmapFile = fs.existsSync(mapFolder)
        ? fs.readdirSync(mapFolder).find(f => f.toLowerCase().endsWith('.scmap'))
        : null;
      if (!scmapFile) {
        push(wc, 'error', `✗ No .scmap found in: ${mapFolder}`);
        return { success: false, error: 'No .scmap found' };
      }
      const scmapPath = path.join(mapFolder, scmapFile);
      push(wc, 'info', `  Source: ${scmapPath}`);

      const { readSettings: _rs, SCMAP_DIR } = require('./settings');
      const scmapUtils = require('../../utils/scmap');
      const outFolder  = path.join(SCMAP_DIR, versionedName);
      if (fs.existsSync(outFolder)) fs.rmSync(outFolder, { recursive: true, force: true });
      fs.mkdirSync(outFolder, { recursive: true });

      const raw  = fs.readFileSync(scmapPath);
      const data = scmapUtils.parseScmap(raw);
      scmapUtils.exportScmapData(data, outFolder);

      push(wc, 'info', `✓ Unpacked to: ${outFolder}`);
      return { success: true, outputFolder: outFolder };
    }

    // ── pack ─────────────────────────────────────────────────────────────────
    if (command === 'pack') {
      const { SCMAP_DIR } = require('./settings');
      const scmapUtils    = require('../../utils/scmap');
      const unpackFolder  = path.join(SCMAP_DIR, versionedName);
      const scmapDest     = path.join(mapFolder, `${bareMapName}.scmap`);

      if (!fs.existsSync(unpackFolder)) {
        push(wc, 'error', `✗ Unpacked folder not found: ${unpackFolder}`);
        return { success: false, error: `Unpacked folder not found: ${unpackFolder}` };
      }

      push(wc, 'info', `  Source : ${unpackFolder}`);
      push(wc, 'info', `  Target : ${scmapDest}`);

      const packed = scmapUtils.writeDatastream(unpackFolder);
      fs.writeFileSync(scmapDest, packed);

      push(wc, 'info', `✓ Packed: ${scmapDest}`);
      return { success: true, scmapPath: scmapDest };
    }

    push(wc, 'error', `✗ Unknown command: ${command}`);
    return { success: false, error: `Unknown command: ${command}` };

  } catch (e) {
    push(wc, 'error', `✗ ${e.message}`);
    log.error('[cli-runner] command failed:', e);
    return { success: false, error: e.message };
  }
});

// ── cli-abort ─────────────────────────────────────────────────────────────────

ipcMain.handle('cli-abort', async () => {
  if (activeChild) {
    try { activeChild.kill(); } catch (_) {}
    activeChild = null;
    return { success: true };
  }
  return { success: false, error: 'No active process' };
});

function register() { /* handlers registered above at module load */ }
module.exports = { register };
