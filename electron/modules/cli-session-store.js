'use strict';
/**
 * cli-session-store.js — persistence for saved CLI terminal sessions.
 *
 * Exposes:
 *   cli-session-list  {}              → [{ id, startedAt, endedAt, lineCount, preview }]  (newest first, no `lines`)
 *   cli-session-load  { id }          → { id, startedAt, endedAt, lineCount, preview, lines } | null
 *   cli-session-save  { meta, lines } → true
 *
 * Backs onto a single cli-sessions.json in app.getPath('userData'), capped
 * at MAX_SESSIONS entries (oldest dropped first). Same shape of module as
 * cli-runner.js: handlers register themselves at require-time, register()
 * is just the hook main.js's module loader calls.
 */

const fs = require('fs/promises');
const path = require('path');
const { app, ipcMain } = require('electron');
const { log } = require('./logger');

const MAX_SESSIONS = 50;
const filePath = () => path.join(app.getPath('userData'), 'cli-sessions.json');

// ── helpers ───────────────────────────────────────────────────────────────────

async function readAll() {
  try {
    const raw = await fs.readFile(filePath(), 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code !== 'ENOENT') log.error('[cli-session-store] readAll failed:', e);
    return [];
  }
}

async function writeAll(sessions) {
  await fs.writeFile(filePath(), JSON.stringify(sessions, null, 2), 'utf-8');
}

// ── cli-session-list ──────────────────────────────────────────────────────────

ipcMain.handle('cli-session-list', async () => {
  const sessions = await readAll();
  return sessions
    .map(({ lines, ...meta }) => meta) // strip lines — the picker only needs metadata
    .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt));
});

// ── cli-session-load ──────────────────────────────────────────────────────────

ipcMain.handle('cli-session-load', async (_event, { id }) => {
  const sessions = await readAll();
  return sessions.find(s => s.id === id) || null;
});

// ── cli-session-save ──────────────────────────────────────────────────────────

ipcMain.handle('cli-session-save', async (_event, { meta, lines }) => {
  try {
    const sessions = await readAll();
    const next = [{ ...meta, lines }, ...sessions.filter(s => s.id !== meta.id)]
      .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))
      .slice(0, MAX_SESSIONS);
    await writeAll(next);
    return true;
  } catch (e) {
    log.error('[cli-session-store] save failed:', e);
    return false;
  }
});

function register() { /* handlers registered above at module load */ }
module.exports = { register };
