/**
 * preload.js — Secure IPC bridge
 *
 * Replaces nodeIntegration:true + contextIsolation:false.
 * Exposes ONLY the channels the renderer actually uses, nothing more.
 *
 * Security fix #1 (Critical): XSS can no longer escalate to RCE because
 * the renderer has zero access to Node.js APIs directly.
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');

// ─── Allowed IPC channels ────────────────────────────────────────────────────
// Only channels listed here can be called from the renderer.
// Any call to an unlisted channel is silently dropped.

const INVOKE_CHANNELS = new Set([
  'autosave-run-now',
  'backup-file',
  'check-update',
  'civilians-load-presets',
  'civilians-save-presets',
  'contrib-download-asset',
  'contrib-load-github-data',
  'copy-file',
  'dds-to-dataurl',
  'dds-url-to-dataurl',
  'delete-file',
  'download-file',
  'ensure-dir',
  'generate-prop-files',
  'get-asset-base-url',
  'load-faction-icon',
  'github-auth-logout',
  'github-auth-poll',
  'github-auth-start',
  'github-auth-status',
  'guide-asset-list',
  'history-load',
  'history-save',
  'library-load',
  'library-scan',
  'list-dir',
  'load-config',
  'load-image',
  'make-map-adaptive',
  'mr-duplicate-map-version',
  'mr-find-scmap',
  'mr-scale-save-lua',
  'mr-scale-scmap',
  'mr-update-scenario-lua',
  'open-external',
  'open-folder',
  'open-log-window',
  'open-tool-window',
  'png-to-preview-dds',
  'preview-image-step',
  'preview-render',
  'read-file',
  'read-guide',
  'read-guide-asset',
  'read-map-info',
  'resolve-prop-to-emit',
  'save-blueprint',
  'save-config',
  'save-custom-prop',
  'save-custom-prop-folder',
  'save-guide',
  'save-generated-file',
  'scan-global-props',
  'scan-map-emitters',
  'scan-map-props',
  'scmap-list',
  'scmap-pack',
  'scmap-pack-folder',
  'scmap-select-file',
  'scmap-select-folder',
  'scmap-snapshot-folder',
  'scmap-unpack',
  'settings-get-version',
  'settings-load',
  'settings-pick-file',
  'settings-pick-folder',
  'settings-save',
  'skybox-library-fetch',
  'skybox-library-load',
  'submit-contribution-pr',
  'write-file',
  'bridge-connect',
  'bridge-disconnect',
  'bridge-send-snapshot',
  'read-footer-article',
  'cli-exec',
  'cli-abort',
]);

const SEND_CHANNELS = new Set([
  'set-log-level',
]);

const LISTEN_CHANNELS = new Set([
  'app-error',
  'dds-to-dataurl',
  'library-scan-complete',
  'library-scan-started',
  'scmap-progress',
  'settings-updated',
  'bridge-state-changed',
  'cli-output',
]);

// ─── Expose secure API to renderer ──────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Invoke an IPC handler in the main process and await the result.
   * Only channels in INVOKE_CHANNELS are permitted.
   */
  invoke: (channel, ...args) => {
    if (!INVOKE_CHANNELS.has(channel)) {
      console.error(`[preload] Blocked invoke on unlisted channel: "${channel}"`);
      return Promise.reject(new Error(`Channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  /**
   * Send a fire-and-forget message to the main process.
   * Only channels in SEND_CHANNELS are permitted.
   */
  send: (channel, ...args) => {
    if (!SEND_CHANNELS.has(channel)) {
      console.error(`[preload] Blocked send on unlisted channel: "${channel}"`);
      return;
    }
    ipcRenderer.send(channel, ...args);
  },

  /**
   * Subscribe to events pushed from the main process.
   * Only channels in LISTEN_CHANNELS are permitted.
   * Returns an unsubscribe function.
   */
  on: (channel, listener) => {
    if (!LISTEN_CHANNELS.has(channel)) {
      console.error(`[preload] Blocked on() for unlisted channel: "${channel}"`);
      return () => {};
    }
    const wrapped = (_event, ...args) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },

  /**
   * Subscribe to a one-time event from the main process.
   */
  once: (channel, listener) => {
    if (!LISTEN_CHANNELS.has(channel)) {
      console.error(`[preload] Blocked once() for unlisted channel: "${channel}"`);
      return;
    }
    ipcRenderer.once(channel, (_event, ...args) => listener(...args));
  },

  /**
   * Remove all listeners for a channel (used during React cleanup).
   */
  removeAllListeners: (channel) => {
    if (!LISTEN_CHANNELS.has(channel)) return;
    ipcRenderer.removeAllListeners(channel);
  },

  /**
   * Get the file system path for a File object (used in drag-and-drop).
   */
  getPathForFile: (file) => webUtils.getPathForFile(file),
});