'use strict';
/**
 * cli-runner.js — in-app terminal bridge to the real `fmt` CLI (electron/cli.js).
 *
 * Exposes:
 *   cli-exec   { input: string } → { success, error? }
 *   cli-abort  {}                → { success }
 *
 * Pushes events on 'cli-output': { type: 'stdout'|'stderr'|'info'|'error', text, ts }
 *
 * Doesn't reimplement any command logic — cli.js already has a complete,
 * correct implementation (unpack/repack/resize/preview + /help), used
 * identically by the standalone `fmt` script and this in-app terminal.
 * We just tokenize the typed line the same way the real REPL does, dispatch
 * into cli.js, and forward whatever it would have printed to the renderer
 * instead of stdout.
 */

const { ipcMain, BrowserWindow } = require('electron');
const { log } = require('./logger');
const cli = require('../cli.js');

// ── helpers ───────────────────────────────────────────────────────────────────

function getWebContents() {
  const wins = BrowserWindow.getAllWindows();
  return wins.length ? wins[0].webContents : null;
}

function push(wc, type, text) {
  if (!wc || wc.isDestroyed()) return;
  wc.send('cli-output', { type, text, ts: Date.now() });
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const stripAnsi = s => String(s).replace(ANSI_RE, '');

const HEADING_RE = /\x1b\[36m\x1b\[1m/; // C.cyan + C.bold
const FLAG_RE    = /\x1b\[33m/;         // C.yellow
const ACCENT_RE  = /\x1b\[36m/;         // C.cyan allein

function classify(raw, isError) {
  if (isError)              return 'error';
  if (raw.includes('✔'))    return 'ok';
  if (raw.includes('⚠'))    return 'warn';
  if (HEADING_RE.test(raw)) return 'heading';
  if (FLAG_RE.test(raw))    return 'flag';
  if (ACCENT_RE.test(raw))  return 'accent';
  return 'stdout';
}

async function withStreamedConsole(wc, fn) {
  const originalLog   = console.log;
  const originalError = console.error;

  // WICHTIG: erst in Zeilen zerlegen, DANN pro Zeile klassifizieren.
  // printHelp() z.B. ist ein einziger console.log-Aufruf mit einem
  // mehrzeiligen, gemischt eingefärbten Block — als Ganzes klassifiziert
  // würde eine einzelne Cyan-Überschrift den kompletten Block einfärben.
const emit = (fn, isError) => (...args) => {
  const raw = args.join(' ');
  raw.split('\n').forEach(line => {
    // roh weitergeben, NICHT strippen — Anser macht die Feinfärbung im Client
    fn(wc, classify(line, isError), line);
  });
};

  console.log   = emit(push, false);
  console.error = emit(push, true);

  try { return await fn(); }
  finally { console.log = originalLog; console.error = originalError; }
}

// Tokenize exactly like cli.js's own REPL (quoted-string aware).
function tokenize(input) {
  const tokens   = input.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return tokens.map(t => t.replace(/^"|"$/g, ''));
}

// ── cli-exec ──────────────────────────────────────────────────────────────────

ipcMain.handle('cli-exec', async (_event, { input }) => {
  const wc = getWebContents();
  const trimmed = (input || '').trim();
  if (!trimmed) return { success: true };

  try {
    if (trimmed === '/help') {
      await withStreamedConsole(wc, async () => cli.printHelp());
      return { success: true };
    }

    const { cmd, pos, flags } = cli.parseArgs(tokenize(trimmed));
    if (!cmd) return { success: true };

    await withStreamedConsole(wc, () => cli.dispatch(cmd, pos, flags));
    return { success: true };

  } catch (e) {
    push(wc, 'error', `✖ ${e.message}`);
    log.error('[cli-runner] command failed:', e);
    return { success: false, error: e.message };
  }
});

// ── cli-abort ─────────────────────────────────────────────────────────────────

ipcMain.handle('cli-abort', async () => {
  const child = cli.getActiveChild();
  if (child) {
    try { child.kill(); } catch (_) {}
    cli.setActiveChild(null);
    return { success: true };
  }
  return { success: false, error: 'No active process' };
});

function register() { /* handlers registered above at module load */ }
module.exports = { register };
