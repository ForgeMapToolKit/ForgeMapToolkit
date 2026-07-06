// ── Dev-only browser fallback for the Electron IPC bridge ──────────────────
// The app is Electron-first and talks to the main process via
// window.electronAPI (injected by the preload). Some modules call it at
// import time (e.g. tab files), so when the app is opened in a plain browser
// (Vite preview for visual checks) the import chain throws before anything
// mounts. This shim provides safe no-op defaults. It MUST be imported before
// any app module. Under Electron the preload has already set window.electronAPI,
// so this guard is skipped entirely.
if (!window.electronAPI) {
  const defaults = {
    'settings-get-version': '0.0.0-dev',
    'settings-load': { firstRun: false, atmosphereQuality: 'performant' },
    'library-load': { emitters: [], props: [], units: [], scanned: false },
    'check-update': null,
  };
  window.electronAPI = {
    invoke: (channel) => Promise.resolve(channel in defaults ? defaults[channel] : null),
    on: () => {},
    removeAllListeners: () => {},
  };
}
