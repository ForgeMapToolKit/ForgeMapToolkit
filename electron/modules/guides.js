'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
// guides.js — IPC handlers for local guide files
//
// Guides are stored as self-contained .html files in src/guides/content/.
// The editor writes Markdown; on save the main process converts it to HTML
// and inlines all :::html asset ::: blocks directly.
//
// Asset loading strategy (read-guide-asset):
//   1. Local disk  — src/guides/assets/<path>  (dev + packaged if bundled)
//   2. Disk cache  — userData/guide_asset_cache/<path>  (persisted across launches)
//   3. GitHub Raw  — ForgeMapToolkit-Assets/guides/assets/<path>  (always available)
// ═══════════════════════════════════════════════════════════════════════════════

const { ipcMain, dialog, app } = require('electron');
const path   = require('path');
const fs     = require('fs');
const https  = require('https');
const crypto = require('crypto');
const hljs   = require('highlight.js');

const CONTENT_ROOT = path.join(__dirname, '../../src/guides/content');
const ASSETS_ROOT  = path.join(__dirname, '../../src/guides/assets');

// Persistent on-disk cache for GitHub-fetched assets.
// Stored in userData so it survives app updates and is writable in packaged builds.
const ASSET_CACHE_ROOT = path.join(app.getPath('userData'), 'guide_asset_cache');

const ASSETS_RAW_BASE = 'https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main/guides/assets';

// ═══════════════════════════════════════════════════════════════════════════════
// Path safety — used everywhere a user-supplied path touches the filesystem
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve a user-supplied relative path safely inside a trusted root.
 * Returns the absolute path if it stays inside root, otherwise null.
 * Handles URL-encoded traversal (%2e%2e), backslashes, and null bytes.
 */
function safeResolve(root, userPath) {
  if (typeof userPath !== 'string') return null;
  // Strip null bytes, decode percent-encoding, normalise backslashes
  const decoded = decodeURIComponent(userPath.replace(/\0/g, '')).replace(/\\/g, '/');
  const resolved = path.resolve(root, decoded);
  // Reject if the resolved path escapes the root
  if (!resolved.startsWith(path.resolve(root) + path.sep) &&
      resolved !== path.resolve(root)) return null;
  return resolved;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP helper — retry up to 3× with exponential backoff
// ═══════════════════════════════════════════════════════════════════════════════

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function httpsGetBuffer(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await _httpsGetOnce(url);
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(500 * Math.pow(2, attempt)); // 500ms → 1s → 2s
    }
  }
}

function _httpsGetOnce(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ForgeMapToolkit' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return _httpsGetOnce(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode === 404) {
        return reject(Object.assign(new Error(`Asset not found: ${url}`), { code: 'NOT_FOUND' }));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Asset cache — stored in userData/guide_asset_cache/<assetPath>
// ═══════════════════════════════════════════════════════════════════════════════

function readCachedAsset(assetPath) {
  const p = safeResolve(ASSET_CACHE_ROOT, assetPath);
  if (!p || !fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

function writeCachedAsset(assetPath, buf) {
  try {
    const p = safeResolve(ASSET_CACHE_ROOT, assetPath);
    if (!p) return;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, buf);
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Unified asset resolver — local → cache → GitHub Raw
// ═══════════════════════════════════════════════════════════════════════════════

async function resolveAssetBuffer(assetPath) {
  // 1. Local disk
  const localPath = safeResolve(ASSETS_ROOT, assetPath);
  if (localPath && fs.existsSync(localPath)) return fs.readFileSync(localPath);

  // 2. userData disk cache
  const cached = readCachedAsset(assetPath);
  if (cached) return cached;

  // 3. GitHub Raw
  const url = `${ASSETS_RAW_BASE}/${assetPath.replace(/\\/g, '/')}`;
  const buf = await httpsGetBuffer(url);
  writeCachedAsset(assetPath, buf);
  return buf;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Synchronous helpers for the Markdown → HTML converter
// (Only reads from local disk — converter runs at save time in dev)
// ═══════════════════════════════════════════════════════════════════════════════

function readAsset(assetPath) {
  const filePath = safeResolve(ASSETS_ROOT, assetPath);
  if (!filePath || !fs.existsSync(filePath)) return null;
  return { filePath, ext: path.extname(filePath).toLowerCase().slice(1) };
}

function assetToDataUrl(assetPath) {
  const asset = readAsset(assetPath);
  if (!asset) return null;
  const { filePath, ext } = asset;
  const mimeMap = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', mov: 'video/quicktime',
  };
  const mime = mimeMap[ext];
  if (!mime) return null;
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function assetToSvg(assetPath) {
  const asset = readAsset(assetPath);
  if (!asset || asset.ext !== 'svg') return null;
  return fs.readFileSync(asset.filePath, 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Markdown → HTML conversion
// ═══════════════════════════════════════════════════════════════════════════════

function isBlockStart(line) {
  if (/^#{1,6} /.test(line))  return true;
  if (/^> /.test(line))       return true;
  if (/^```/.test(line))      return true;
  if (/^\|/.test(line))       return true;
  if (/^[-*] /.test(line))    return true;
  if (/^\d+\. /.test(line))   return true;
  if (/^---+\s*$/.test(line)) return true;
  return false;
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const lang = line.slice(3).trim().toLowerCase();
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      const rawCode = codeLines.join('\n');
      let highlighted;
      try {
        highlighted = lang && hljs.getLanguage(lang)
          ? hljs.highlight(rawCode, { language: lang }).value
          : hljs.highlightAuto(rawCode).value;
      } catch (_) {
        highlighted = escHtml(rawCode);
      }
      const langClass = lang ? ` language-${escHtml(lang)}` : '';
      out.push(`<pre class="gs-md-pre"><code class="gs-md-code hljs${langClass}">${highlighted}</code></pre>`);
      continue;
    }

    if (/^\|/.test(line) && i + 1 < lines.length && /^\|[-\s|:]+\|/.test(lines[i + 1])) {
      const headers = line.split('|').slice(1, -1).map(c => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()));
        i++;
      }
      let table = '<div class="gs-md-table-wrap"><table class="gs-md-table">';
      table += '<thead class="gs-md-thead"><tr class="gs-md-tr">';
      headers.forEach(h => { table += `<th class="gs-md-th">${inlineHtml(h)}</th>`; });
      table += '</tr></thead><tbody>';
      rows.forEach(r => {
        table += '<tr class="gs-md-tr">';
        r.forEach(c => { table += `<td class="gs-md-td">${inlineHtml(c)}</td>`; });
        table += '</tr>';
      });
      table += '</tbody></table></div>';
      out.push(table);
      continue;
    }

    if (/^> /.test(line)) {
      const bqLines = [];
      while (i < lines.length && /^> /.test(lines[i])) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      out.push(`<blockquote class="gs-md-blockquote">${inlineHtml(bqLines.join(' '))}</blockquote>`);
      continue;
    }

    const hMatch = line.match(/^(#{1,3}) (.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      out.push(`<h${level} class="gs-md-h${level}">${inlineHtml(hMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      out.push('<hr class="gs-md-hr" />');
      i++;
      continue;
    }

    if (/^[-*] /.test(line)) {
      out.push('<ul class="gs-md-ul">');
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        out.push(`<li class="gs-md-li">${inlineHtml(lines[i].slice(2))}</li>`);
        i++;
      }
      out.push('</ul>');
      continue;
    }

    if (/^\d+\. /.test(line)) {
      out.push('<ol class="gs-md-ol">');
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        out.push(`<li class="gs-md-li">${inlineHtml(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i++;
      }
      out.push('</ol>');
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      out.push(`<p class="gs-md-p">${inlineHtml(paraLines.join(' '))}</p>`);
    } else {
      i++;
    }
  }

  return out.join('\n');
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineHtml(str) {
  const slots = [];
  const protect = (html) => { const i = slots.length; slots.push(html); return `\x00SLOT${i}\x00`; };

  str = str.replace(/`([^`]+)`/g, (_, c) => {
    if (c.startsWith('§') && c.endsWith('§') && c.length > 2)
      return protect(`<code class="gs-md-code-hl">${escHtml(c.slice(1, -1))}</code>`);
    return protect(`<code class="gs-md-code-inline">${escHtml(c)}</code>`);
  });

  str = str.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const pctMatch = alt.match(/\|\|(\d+)$/);
    const widthPct = pctMatch ? parseInt(pctMatch[1], 10) : null;
    const cleanAlt = alt.replace(/\|\|\d+$/, '').replace('{video}', '').trim();
    const resolvedSrc = (!src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('blob:'))
      ? `${ASSETS_RAW_BASE}/${src.replace(/\\/g, '/')}`
      : src;
    const styleAttr = widthPct ? ` style="max-width:${widthPct}%"` : ' style="max-width:100%"';
    return protect(`<img class="gs-md-img" src="${resolvedSrc}" alt="${escHtml(cleanAlt)}"${styleAttr}>`);
  });

  str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) =>
    protect(`<a class="gs-md-link" href="${escHtml(href)}" onclick="if(window.electronAPI){event.preventDefault();window.electronAPI.invoke('open-external','${escHtml(href)}')}else{window.open('${escHtml(href)}','_blank')}">${escHtml(text)}</a>`)
  );

  str = escHtml(str);
  str = str.replace(/==([^=]+)==/g, '<code class="gs-md-code-hl">$1</code>');
  str = str.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong class="gs-md-strong"><em class="gs-md-em">$1</em></strong>');
  str = str.replace(/___([^_]+)___/g,        '<strong class="gs-md-strong"><em class="gs-md-em">$1</em></strong>');
  str = str.replace(/\*\*([^*]+)\*\*/g,      '<strong class="gs-md-strong">$1</strong>');
  str = str.replace(/__([^_]+)__/g,          '<strong class="gs-md-strong">$1</strong>');
  str = str.replace(/\*([^*]+)\*/g,          '<em class="gs-md-em">$1</em>');
  str = str.replace(/(?<![_])_([^_]+)_(?![_])/g, '<em class="gs-md-em">$1</em>');
  str = str.replace(/~~([^~]+)~~/g,          '<del>$1</del>');
  str = str.replace(/\x00SLOT(\d+)\x00/g, (_, i) => slots[+i]);
  return str;
}

// ── Custom block processors ───────────────────────────────────────────────────

function processComparisons(html, resolveAsset) {
  const buildBlock = (globalPct, inner) => {
    // Normalize asterisks back to underscores (Markdown italic escaping artefact)
    inner = inner.replace(/\*+/g, '_');

    let rows;
    if (inner.includes('\n')) {
      // Multiline: one image per line
      rows = inner.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const parts = l.split('|').map(s => s.trim());
        return { src: parts[0], label: parts[1] ?? '', widthPct: parts[2] ? parseInt(parts[2], 10) : null };
      });
    } else {
      // Single-line: split on image path boundaries
      rows = inner.split(/(?=\S+\.(?:png|jpg|jpeg|gif|webp|svg)\b)/i)
        .map(p => p.trim()).filter(Boolean).map(p => {
          const parts = p.split('|').map(s => s.trim());
          return { src: parts[0], label: parts[1] ?? '', widthPct: parts[2] ? parseInt(parts[2], 10) : null };
        });
    }

    let out = '<div class="gs-comparison">';
    rows.forEach(({ src, label, widthPct }) => {
      const effectivePct = widthPct ?? globalPct ?? null;
      const itemStyle = effectivePct ? ` style="max-width:${effectivePct}%"` : '';
      const dataUrl = resolveAsset(src);
      const imgTag = dataUrl
        ? `<img class="gs-md-img" src="${dataUrl}" alt="${escHtml(label)}" style="max-width:100%" />`
        : `<span style="color:#f87171;font-size:11px">Missing: ${escHtml(src)}</span>`;
      out += `<div class="gs-comparison-item"${itemStyle}>${imgTag}${label ? `<div class="gs-comparison-label">${escHtml(label)}</div>` : ''}</div>`;
    });
    out += '</div>';
    return out;
  };

  // Multiline: :::comparison [pct]\n...\n:::
  html = html.replace(/:::comparison(?:\s+(\d+))?\s*\r?\n([\s\S]*?)\r?\n:::/g, (_, pct, inner) =>
    buildBlock(pct ? parseInt(pct, 10) : null, inner)
  );
  // Single-line fallback: :::comparison [pct] img1.png | cap1 img2.png | cap2 :::
  html = html.replace(/:::comparison(?:\s+(\d+))?\s+(.+?)\s*:::/g, (_, pct, inner) =>
    buildBlock(pct ? parseInt(pct, 10) : null, inner)
  );
  return html;
}

function processNavStyles(html) {
  return html.replace(/:::navigationStyle\r?\n([\s\S]*?)\r?\n:::/g, (_, inner) => {
    const lines = inner.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines[0] ?? '';
    const body  = lines.slice(1).join(' ');
    return `<div class="gs-nav-style-block">${title ? `<span class="gs-nav-style-title">${escHtml(title)}</span>` : ''}${body ? `<span class="gs-nav-style-body">${escHtml(body)}</span>` : ''}</div>`;
  });
}

function processDownloads(html) {
  return html.replace(/::download\s+([^\s:]+)\s*::/g, (_, id) =>
    `<div class="gs-download-placeholder" data-id="${escHtml(id.trim())}" style="padding:12px 16px;background:rgba(200,111,255,0.05);border:1px solid rgba(200,111,255,0.15);border-radius:8px;font-size:12px;color:rgba(255,255,255,0.4);margin:12px 0">Download: ${escHtml(id.trim())}</div>`
  );
}

function processHtmlBlocks(html, resolveHtmlAsset) {
  return html.replace(/:::html\s+([^\s:]+)\s*:::/g, (_, assetPath) => {
    const content = resolveHtmlAsset(assetPath.trim());
    if (!content) {
      return `<div style="padding:12px 16px;background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);border-radius:6px;font-size:12px;color:#f87171;margin:12px 0">Could not inline HTML widget: <code>${escHtml(assetPath)}</code></div>`;
    }
    return `<div class="gs-html-embed-wrap" data-src="${escHtml(assetPath.trim())}"><div class="gs-html-embed">${content}</div></div>`;
  });
}

function processImages(html, resolveAsset) {
  return html.replace(/<img([^>]*?)src="([^"]+)"([^>]*?)>/g, (match, pre, src, post) => {
    if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:')) return match;
    const resolved = resolveAsset(src);
    if (!resolved) return match;
    return `<img${pre}src="${resolved}"${post}>`;
  });
}

function protectHtmlBlocks(text, slots) {
  const BLOCK_TAGS = ['div','style','script','section','article','aside',
                      'header','footer','nav','figure','details','summary'];
  const tagPattern = BLOCK_TAGS.join('|');
  const openRe  = new RegExp(`^<(${tagPattern})[\\s>]`, 'i');

  const lines = text.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(openRe);

    if (m) {
      const tagName = m[1].toLowerCase();
      let depth = 0;
      let j = i;
      const block = [];

      while (j < lines.length) {
        const l = lines[j];
        const openCount  = (l.match(new RegExp(`<${tagName}[\\s>]`, 'gi')) || []).length;
        const closeCount = (l.match(new RegExp(`</${tagName}>`, 'gi')) || []).length;
        block.push(l);
        depth += openCount - closeCount;
        j++;
        if (depth <= 0) break;
      }

      const idx = slots.length;
      slots.push(block.join('\n'));
      out.push(`\x00HTML${idx}\x00`);
      i = j;
    } else {
      out.push(line);
      i++;
    }
  }

  return out.join('\n');
}

function convertMarkdownToGuideHtml(mdContent) {
  let text = mdContent;

  const resolveAsset = (src) => {
    if (!src) return null;
    if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:')) return src;
    return `${ASSETS_RAW_BASE}/${src.replace(/\\/g, '/')}`;
  };

  const resolveHtmlAsset = (assetPath) => {
    const asset = readAsset(assetPath);
    if (!asset || (asset.ext !== 'html' && asset.ext !== 'htm')) return null;
    return fs.readFileSync(asset.filePath, 'utf-8');
  };

  text = processComparisons(text, resolveAsset);
  text = processNavStyles(text);
  text = processHtmlBlocks(text, resolveHtmlAsset);
  text = processDownloads(text);
  text = text.replace(/==([^=\n]+)==/g, (_, t) => `\`§${t}§\``);

  const htmlSlots = [];
  text = protectHtmlBlocks(text, htmlSlots);

  let body = mdToHtml(text);
  body = body.replace(/\x00HTML(\d+)\x00/g, (_, idx) => htmlSlots[+idx]);
  body = body.replace(/<p[^>]*>\s*\x00HTML(\d+)\x00\s*<\/p>/g, (_, idx) => htmlSlots[+idx]);
  body = processImages(body, resolveAsset);

  return body;
}

function wrapGuideHtml(bodyHtml, title = '') {
  let hlCss = '';
  try {
    const cssPath = require.resolve('highlight.js/styles/github-dark.css');
    hlCss = `<style>${fs.readFileSync(cssPath, 'utf-8')}</style>\n`;
  } catch (_) {}

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="guide-format" content="forge-map-toolkit-v1">
<title>${escHtml(title)}</title>
<link rel="icon" href="https://timmasalme.github.io/ForgeMapToolkit-Assets/img/favicon.ico">
<link rel="stylesheet" href="https://timmasalme.github.io/ForgeMapToolkit-Assets/guides/assets/guide-standalone.css">
${hlCss}</head>
<body class="gs-guide-body">
${bodyHtml}
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IPC HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

// ── read-guide ────────────────────────────────────────────────────────────────
ipcMain.removeHandler('read-guide');
ipcMain.handle('read-guide', (_event, htmlFile) => {
  if (typeof htmlFile !== 'string') return null;
  const filePath = safeResolve(CONTENT_ROOT, htmlFile);
  if (!filePath) return null;
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8');
  return null;
});

// ── save-guide ────────────────────────────────────────────────────────────────
ipcMain.removeHandler('save-guide');
ipcMain.handle('save-guide', async (_event, { mdContent, title = '' }) => {
  const slug = title.trim()
    ? title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : 'new-guide';

  if (!fs.existsSync(CONTENT_ROOT)) fs.mkdirSync(CONTENT_ROOT, { recursive: true });

  const { filePath: absPath, canceled } = await dialog.showSaveDialog({
    title: 'Save Guide',
    defaultPath: path.join(CONTENT_ROOT, `${slug}.html`),
    filters: [{ name: 'HTML Guide', extensions: ['html'] }],
  });

  if (canceled || !absPath) return { success: false, canceled: true };

  // Verify the chosen path stays inside CONTENT_ROOT
  const rel = path.relative(CONTENT_ROOT, absPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { success: false, error: 'Save location must be inside the guides/content folder.' };
  }

  try {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    const bodyHtml = convertMarkdownToGuideHtml(mdContent);
    const fullHtml = wrapGuideHtml(bodyHtml, title);
    fs.writeFileSync(absPath, fullHtml, 'utf-8');
    return { success: true, path: rel };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── read-guide-asset ──────────────────────────────────────────────────────────
// Local → disk cache → GitHub Raw.
// Returns null on failure — GuideImage handles the error state gracefully.
ipcMain.removeHandler('read-guide-asset');
ipcMain.handle('read-guide-asset', async (_event, assetPath) => {
  if (typeof assetPath !== 'string') return null;

  // Reject any traversal attempt before touching the filesystem
  const safe = safeResolve(ASSETS_ROOT, assetPath);
  if (!safe) return null;

  const ext = path.extname(assetPath).toLowerCase().slice(1);

  const mimeMap = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
    mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', mov: 'video/quicktime',
    html: 'text/html', htm: 'text/html',
  };

  if (!mimeMap[ext]) return null;

  try {
    const buf = await resolveAssetBuffer(assetPath);
    if (!buf) return null;

    if (ext === 'svg')  return { type: 'svg',   content: buf.toString('utf-8') };
    if (ext === 'html' || ext === 'htm') return { type: 'html', content: buf.toString('utf-8') };
    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
      return { type: 'video', src: `data:${mimeMap[ext]};base64,${buf.toString('base64')}` };
    }
    return { type: 'img', src: `data:${mimeMap[ext]};base64,${buf.toString('base64')}` };
  } catch (e) {
    console.warn(`[read-guide-asset] Failed to load "${assetPath}": ${e.message}`);
    return null;
  }
});

// ── guide-asset-cache-clear ───────────────────────────────────────────────────
ipcMain.removeHandler('guide-asset-cache-clear');
ipcMain.handle('guide-asset-cache-clear', () => {
  try {
    if (fs.existsSync(ASSET_CACHE_ROOT)) {
      fs.rmSync(ASSET_CACHE_ROOT, { recursive: true, force: true });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── guide-asset-list ──────────────────────────────────────────────────────────
// Returns a flat array of all repo-relative asset paths under ASSETS_ROOT.
// Used by the editor PathInput autocomplete. Only reads local disk — fast and
// synchronous. Returns [] if the assets folder doesn't exist yet.
ipcMain.removeHandler('guide-asset-list');
ipcMain.handle('guide-asset-list', () => {
  const results = [];
  const walk = (dir, base) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const entry of entries) {
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), rel);
      } else {
        results.push(rel);
      }
    }
  };
  if (fs.existsSync(ASSETS_ROOT)) walk(ASSETS_ROOT, '');
  return results;
});