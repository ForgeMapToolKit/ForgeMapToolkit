'use strict';
/**
 * dev-server.js — the single source of truth for the Vite dev server address.
 *
 * The port used to be written out as a literal in eight places: vite.config.js
 * (server.port and hmr.port), main.js (loadURL plus three CSP directives),
 * community.js (the pop-out window base) and package.json. They all have to
 * agree — Electron hard-loads this origin, and the dev CSP allow-lists exactly
 * this origin and its HMR websocket, so a single stale copy breaks the app in a
 * way that looks like a bug in the renderer rather than a mismatched number.
 *
 * Why not Vite's default 5173: that is *everyone's* default. Two Vite projects
 * open at once and the second one either fails to bind or, worse, the Electron
 * shell loads the other project's frontend and throws errors that make no sense
 * in this codebase. 5273 is ours.
 *
 * package.json's `electron:dev` script carries the one unavoidable duplicate —
 * `wait-on` takes a URL and cannot require a module. If you change the port
 * here, change it there too; nothing else needs touching.
 */

const DEV_PORT   = 5273;
const DEV_ORIGIN = `http://localhost:${DEV_PORT}`;
const DEV_WS     = `ws://localhost:${DEV_PORT}`;

module.exports = { DEV_PORT, DEV_ORIGIN, DEV_WS };
