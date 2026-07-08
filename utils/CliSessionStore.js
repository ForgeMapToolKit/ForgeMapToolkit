// utils/CliSessionStore.js
//
// Persistiert CLI-Terminal-Sessions über App-Neustarts hinweg — gleiches
// Muster wie ScmapHistoryTracker.js (IPC load/save + In-Memory-Cache).
// Dieses Modul fasst das Dateisystem selbst nicht an, sondern spricht nur
// die 'cli-session-*' IPC-Kanäle an. Die Main-Process-Handler dafür liegen
// in cli-session-store.main.js — die müssen im Hauptprozess registriert
// werden, siehe Kommentar am Ende dieser Datei.

const MAX_SESSIONS = 50;

let listCache = null; // In-Memory-Liste (Metadaten, keine lines), wie bei ScmapHistoryTracker

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Liste aller gespeicherten Sessions (Metadaten only, ohne lines),
 * neueste zuerst. Wird gecacht, bis invalidate() aufgerufen wird.
 */
async function listSessions() {
  if (listCache) return listCache;
  try {
    listCache = await window.electronAPI.invoke('cli-session-list');
  } catch (e) {
    console.warn('[CliSessionStore] listSessions failed:', e);
    listCache = [];
  }
  return listCache;
}

/** Volle Session inkl. lines für die Wiedergabe im Terminal. */
async function loadSession(id) {
  try {
    return await window.electronAPI.invoke('cli-session-load', { id });
  } catch (e) {
    console.warn('[CliSessionStore] loadSession failed:', e);
    return null;
  }
}

/**
 * Speichert/überschreibt die aktuelle Session. Wird nach jedem Command und
 * zusätzlich als Fallback bei 'beforeunload' aufgerufen — nicht erst beim
 * sauberen Beenden, damit ein Crash die Session nicht verschluckt.
 */
async function saveSession(id, lines, startedAt) {
  const firstEcho = lines.find(l => l.type === 'echo');
  const meta = {
    id,
    startedAt,
    endedAt: new Date().toISOString(),
    lineCount: lines.length,
    preview: firstEcho ? firstEcho.text.replace(/^>\s*/, '').slice(0, 60) : '(leer)',
  };
  try {
    await window.electronAPI.invoke('cli-session-save', { meta, lines });
    if (listCache) {
      listCache = [meta, ...listCache.filter(s => s.id !== id)].slice(0, MAX_SESSIONS);
    }
  } catch (e) {
    console.warn('[CliSessionStore] saveSession failed:', e);
  }
}

function invalidateCache() {
  listCache = null;
}

export { createSessionId, listSessions, loadSession, saveSession, invalidateCache, MAX_SESSIONS };
