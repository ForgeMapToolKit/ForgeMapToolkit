// scripts/ipc-count.mjs
import { readdirSync, readFileSync } from 'fs';

const files = readdirSync('electron/modules').filter(f => f.endsWith('.js'));
const handlers = new Set();
let modsWithHandlers = 0;
for (const f of files) {
  const hits = [...readFileSync(`electron/modules/${f}`, 'utf8')
    .matchAll(/ipcMain\.handle\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  if (hits.length) modsWithHandlers++;
  hits.forEach(h => handlers.add(h));
}

const pre = readFileSync('electron/preload.js', 'utf8');
const block = pre.match(/INVOKE_CHANNELS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
if (!block) throw new Error('INVOKE_CHANNELS block not found — adjust the pattern');
const allow = new Set([...block[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]));

const missing = [...handlers].filter(c => !allow.has(c)).sort();
console.log(`${handlers.size} handlers / ${modsWithHandlers} modules / ${handlers.size - missing.length} allowlisted / ${allow.size} in allowlist`);
console.log(`not allowlisted (${missing.length}):\n  ${missing.join('\n  ')}`);