'use strict';

const path = require('path');
const fs   = require('fs/promises');
const { ipcMain, app } = require('electron');

// ═══════════════════════════════════════════════════════════════════════════
// footer-content -- IPC handler backing FooterContentViewer's in-app reads.
//
// NOTE: the existing 'read-guide' handler this is meant to mirror (Phase-0
// open question in the roadmap) wasn't available while writing this -- once
// you can point me at electron/modules/<whatever-read-guide-lives-in>.js,
// reconcile CONTENT_ROOT resolution and the guard below against it so both
// handlers follow the same convention. Until then this stands on its own.
//
// FooterContentViewer.jsx invokes this channel with:
//   `${contentRoot}/${slug}.html`            (contentRoot defaults to 'footer')
// e.g. "footer/changelog.html" -- note this does NOT include the "/content"
// segment that the component's own dev fetch-fallback path uses
// (`/footer/content/<slug>.html`, see the heads-up below getContentRoot).
// Rather than parse that prefix and hope it lines up with where files
// actually live, this handler ignores everything except the final path
// segment. The renderer process is not a trusted source for filesystem
// paths regardless of prefix, so only the basename is trusted, and only if
// it matches SLUG_RX -- a valid slug is letters, digits and hyphens
// followed by ".html". Anything else (e.g. a traversal attempt like
// "../../../etc/passwd.html") fails the regex before fs is touched.
// ═══════════════════════════════════════════════════════════════════════════

const SLUG_RX = /^[a-z0-9][a-z0-9-]*\.html$/i;

// footer/content/ -- the single source of truth, at the repo root (not
// under public/). You write the fragments directly here.
//
// Heads-up, not yet acted on: FooterContentViewer.jsx's dev-mode fallback
// (used when window.electronAPI isn't present) does a plain HTTP fetch of
// `/footer/content/<slug>.html`. With Vite, that path resolves against the
// public/ directory -- since this content no longer lives there, that one
// fallback branch won't find anything in a non-Electron dev context. The
// IPC path here (Electron, which is the primary path) is unaffected. Flag
// for you to decide: leave the fetch fallback as dead code, point it at a
// small Vite static-serve alias for footer/content/, or drop it entirely.
function getContentRoot() {
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath();
  return path.join(base, 'footer', 'content');
}

async function readFooterArticle(_event, requestedPath) {
  if (typeof requestedPath !== 'string' || !requestedPath) return null;

  const slug = path.basename(requestedPath);
  if (!SLUG_RX.test(slug)) {
    console.warn('[footer-content] rejected non-slug path:', requestedPath);
    return null;
  }

  const contentRoot = getContentRoot();
  const filePath = path.join(contentRoot, slug);

  // Belt-and-suspenders: the regex above already rules out traversal, but
  // confirm the resolved path still lives under contentRoot before any fs
  // call -- same spirit as read-guide's guard, even without its exact code.
  if (!filePath.startsWith(contentRoot + path.sep)) {
    console.warn('[footer-content] resolved path escaped content root:', filePath);
    return null;
  }

  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[footer-content] failed to read', filePath, err);
    }
    return null;
  }
}

function registerFooterContentHandlers() {
  ipcMain.handle('read-footer-article', readFooterArticle);
}

module.exports = { registerFooterContentHandlers };
