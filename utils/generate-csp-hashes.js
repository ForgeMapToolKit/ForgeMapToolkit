'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
// scripts/generate-csp-hashes.js
//
// Scans ALL inline <script> blocks from two sources:
//
//   1. Guide HTML files  — src/guides/content/**/*.html
//   2. Standalone popout HTML files — any *.html file under src/ that lives
//      outside of the guides/content tree (e.g. scmap-popout.html, future
//      tool popouts, etc.)
//
// Computes their SHA-256 hashes and writes them into main.js between the
// __GUIDE_HASHES_START__ / __GUIDE_HASHES_END__ markers.
//
// Usage:  node scripts/generate-csp-hashes.js
// ═══════════════════════════════════════════════════════════════════════════════

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const CONTENT_ROOT  = path.join(__dirname, '../src/guides/content');
const SRC_ROOT      = path.join(__dirname, '../src');
const MAIN_JS       = path.join(__dirname, '../electron/main.js');

// ── Collect SHA-256 hashes of all inline <script> blocks in a directory ───────
function collectInlineScripts(dir, labelRoot) {
  const hashes = new Set();

  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.html?$/i.test(entry.name)) continue;

      const html = fs.readFileSync(full, 'utf-8');

      // Only inline <script> tags (no src attribute)
      const re = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
      let m;
      while ((m = re.exec(html)) !== null) {
        const content = m[1];
        if (!content.trim()) continue;

        const hash   = crypto.createHash('sha256').update(content).digest('base64');
        const token  = `'sha256-${hash}'`;

        if (!hashes.has(token)) {
          hashes.add(token);
          console.log(`  + ${path.relative(labelRoot, full)}`);
          console.log(`    sha256-${hash}`);
        }
      }
    }
  };

  walk(dir);
  return hashes;
}

// ── Write hashes into main.js between markers ─────────────────────────────────
function patchMainJs(hashes) {
  const START    = '// __GUIDE_HASHES_START__';
  const END      = '// __GUIDE_HASHES_END__';
  const BLOCK_RE = new RegExp(`${START}[\\s\\S]*?${END}`);

  let main = fs.readFileSync(MAIN_JS, 'utf-8');

  if (!main.includes(START) || !main.includes(END)) {
    console.error('\nERROR: Markers not found in main.js!');
    console.error('Add these two lines manually in main.js (before installCSP):');
    console.error(`\n${START}\nconst GUIDE_SCRIPT_HASHES = [];\n${END}\n`);
    process.exit(1);
  }

  const replacement =
    `${START}\n` +
    `const GUIDE_SCRIPT_HASHES = ${JSON.stringify([...hashes], null, 2)};\n` +
    `${END}`;

  main = main.replace(BLOCK_RE, replacement);
  fs.writeFileSync(MAIN_JS, main, 'utf-8');
}

// ── Main ──────────────────────────────────────────────────────────────────────
const allHashes = new Set();

// 1. Guide HTML files
console.log(`\nScanning guides: ${CONTENT_ROOT}\n`);
console.log('── Guide inline scripts ─────────────────────────────────────────');
if (!fs.existsSync(CONTENT_ROOT)) {
  console.warn('  WARN: content folder not found — skipping guides.');
} else {
  for (const h of collectInlineScripts(CONTENT_ROOT, CONTENT_ROOT)) allHashes.add(h);
}

// 2. Standalone popout HTML files (everything under src/ except guides/content)
console.log(`\nScanning popouts: ${SRC_ROOT}\n`);
console.log('── Standalone popout inline scripts ─────────────────────────────');
const GUIDES_REL = path.relative(SRC_ROOT, CONTENT_ROOT);
function walkPopouts(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel  = path.relative(SRC_ROOT, full);
    // Skip the guides/content subtree — already handled above
    if (rel.startsWith(GUIDES_REL)) continue;
    if (entry.isDirectory()) { walkPopouts(full); continue; }
    if (!/\.html?$/i.test(entry.name)) continue;

    const html = fs.readFileSync(full, 'utf-8');
    const re   = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const content = m[1];
      if (!content.trim()) continue;
      const hash  = crypto.createHash('sha256').update(content).digest('base64');
      const token = `'sha256-${hash}'`;
      if (!allHashes.has(token)) {
        allHashes.add(token);
        console.log(`  + ${rel}`);
        console.log(`    sha256-${hash}`);
      }
    }
  }
}
walkPopouts(SRC_ROOT);

console.log(`\n  ${allHashes.size} unique inline script hash(es) found in total.\n`);

console.log('── Patching main.js ─────────────────────────────────────────────');
patchMainJs(allHashes);
console.log('  main.js patched successfully ✓\n');
