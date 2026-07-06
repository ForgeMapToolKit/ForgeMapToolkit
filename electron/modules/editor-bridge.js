'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
// electron/modules/editor-bridge.js
//
// Named Pipe client — ForgeMapToolkit ↔ FAF Map Editor Live Bridge.
// Runs entirely in the Main Process. The Renderer never touches net directly.
//
// State machine (§5.6):
//   disconnected → connecting → (mismatch | live) → disconnected
//
// IPC channels exposed (registered at bottom, called from preload allowlist):
//   INVOKE  'bridge-connect'          { mapName } → void   (start / restart)
//   INVOKE  'bridge-disconnect'       ()          → void
//   INVOKE  'bridge-send-snapshot'    { payload } → void
//   LISTEN  'bridge-state-changed'    { state, loadedMap? }
// ═══════════════════════════════════════════════════════════════════════════════

const net      = require('net');
const { ipcMain, BrowserWindow } = require('electron');
const { log } = require('./logger');

const PIPE_PATH      = '\\\\.\\pipe\\ForgeMapToolkit.EditorBridge';
const RECONNECT_MS   = 2000;
const MAX_MSG_BYTES  = 1_048_576; // 1 MB sanity cap

// ── State ────────────────────────────────────────────────────────────────────

/** @type {'disconnected'|'connecting'|'mismatch'|'live'} */
let state        = 'disconnected';
let currentMap   = '';          // mapName sent with bridge-connect
let loadedMap    = '';          // mapName the Editor reports
let socket       = null;        // active net.Socket
let reconnTimer  = null;        // setTimeout handle for reconnect loop
let intentional  = false;       // true when bridge-disconnect was called

// Framing state
let recvBuf      = Buffer.alloc(0);

// ── Helpers ──────────────────────────────────────────────────────────────────

function setState(next, extra = {}) {
  state = next;
  broadcast('bridge-state-changed', { state, loadedMap: extra.loadedMap ?? loadedMap });
}

function broadcast(channel, payload) {
  BrowserWindow.getAllWindows().forEach(w => {
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
  });
}

// ── Framing — encode ─────────────────────────────────────────────────────────

function encodeMessage(obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  const prefix = Buffer.allocUnsafe(4);
  prefix.writeUInt32LE(body.length, 0);
  return Buffer.concat([prefix, body]);
}

// ── Framing — decode (streaming) ────────────────────────────────────────────
// Called each time socket emits 'data'. Appends to recvBuf and dispatches
// every complete message. Handles fragmentation and message coalescing.

function onData(chunk) {
  recvBuf = Buffer.concat([recvBuf, chunk]);

  while (recvBuf.length >= 4) {
    const msgLen = recvBuf.readUInt32LE(0);

    if (msgLen === 0 || msgLen > MAX_MSG_BYTES) {
      log.error('[EditorBridge] Implausible message length', msgLen, '— resetting connection');
      cleanup(false);
      scheduleReconnect();
      return;
    }

    if (recvBuf.length < 4 + msgLen) break; // wait for more data

    const body = recvBuf.slice(4, 4 + msgLen).toString('utf8');
    recvBuf    = recvBuf.slice(4 + msgLen);

    try {
      dispatchMessage(JSON.parse(body));
    } catch (e) {
      log.error('[EditorBridge] Failed to parse message:', e.message);
    }
  }
}

// ── Message dispatch ─────────────────────────────────────────────────────────

function dispatchMessage(msg) {
  log.debug('[EditorBridge] Received message:', JSON.stringify(msg));

  switch (msg.type) {
    case 'handshake.response':
      loadedMap = msg.loadedMap ?? '';
      if (msg.ok) {
        log.info('[EditorBridge] Handshake OK — map:', loadedMap);
        setState('live', { loadedMap });
      } else {
        log.warn('[EditorBridge] Handshake mismatch — editor has:', loadedMap, 'expected:', currentMap);
        setState('mismatch', { loadedMap });
      }
      break;

    case 'map.mismatch':
      loadedMap = msg.loadedMap ?? '';
      log.warn('[EditorBridge] Map mismatch reported by editor:', loadedMap);
      setState('mismatch', { loadedMap });
      break;

    default:
      log.warn('[EditorBridge] Unknown message type:', msg.type, '— full payload:', JSON.stringify(msg));
  }
}

// ── Connect ──────────────────────────────────────────────────────────────────

function connect(mapName) {
  if (socket) cleanup(false); // drop existing socket before reconnecting

  currentMap  = mapName;
  intentional = false;
  loadedMap   = '';
  setState('connecting');
  log.info('[EditorBridge] Connecting to pipe for map:', mapName);

  const s = net.connect(PIPE_PATH);
  socket = s;

  s.on('connect', () => {
    log.debug('[EditorBridge] Pipe socket connected, sending handshake.request');
    recvBuf = Buffer.alloc(0);
    send({ type: 'handshake.request', mapName: currentMap });
  });

  s.on('data', chunk => {
    onData(chunk);
  });

  s.on('error', err => {
    log.warn('[EditorBridge] Socket error:', err.code, '|', err.message);
    cleanup(false);
    if (!intentional) {
      setState('disconnected');
      scheduleReconnect();
    }
  });

  s.on('close', () => {
    cleanup(false);
    if (!intentional) {
      setState('disconnected');
      scheduleReconnect();
    }
  });
}

// ── Send ─────────────────────────────────────────────────────────────────────

function send(obj) {
  if (!socket || socket.destroyed) return;
  try {
    socket.write(encodeMessage(obj));
  } catch (e) {
    log.error('[EditorBridge] Send failed:', e.message);
  }
}

// ── Cleanup / Disconnect ─────────────────────────────────────────────────────

function cleanup(setDisconnected = true) {
  clearTimeout(reconnTimer);
  reconnTimer = null;

  if (socket) {
    socket.removeAllListeners();
    socket.destroy();
    socket = null;
  }

  recvBuf = Buffer.alloc(0);

  if (setDisconnected) {
    loadedMap = '';
    setState('disconnected');
  }
}

function scheduleReconnect() {
  if (intentional || reconnTimer) return;
  reconnTimer = setTimeout(() => {
    reconnTimer = null;
    if (!intentional && currentMap) connect(currentMap);
  }, RECONNECT_MS);
}

// ── IPC Registration ─────────────────────────────────────────────────────────

function register() {
  // Start / restart the bridge for a given mapName
  ipcMain.handle('bridge-connect', (_event, { mapName } = {}) => {
    log.debug('[EditorBridge] bridge-connect IPC received, mapName =', mapName);
    if (!mapName) return;
    intentional = false;
    connect(mapName);
  });

  // Graceful disconnect — stops reconnect loop
  ipcMain.handle('bridge-disconnect', () => {
    log.debug('[EditorBridge] bridge-disconnect IPC received');
    intentional = true;
    cleanup(true);
  });

  // Push a skybox snapshot to the Editor (only when live)
  ipcMain.handle('bridge-send-snapshot', (_event, { mapName, payload } = {}) => {
    if (state !== 'live') return;
    send({ type: 'skybox.snapshot', mapName, payload });
  });
}

module.exports = { register };
