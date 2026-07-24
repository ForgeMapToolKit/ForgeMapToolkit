'use strict';
/**
 * props.js — DDS codec, prop/emitter map-scanning, custom-prop generation.
 *
 * Covers: dds-to-dataurl, dds-url-to-dataurl, scan-map-props,
 *         scan-map-emitters, generate-prop-files, scan-global-props,
 *         save-custom-prop, save-custom-prop-folder.
 *
 * Exports:
 *   register(deps) — registers all IPC handlers in this module
 */

const path  = require('path');
const fs    = require('fs');
const http  = require('http');
const https = require('https');
const { app, ipcMain } = require('electron');
const JSZip = require('jszip');
const { log, yieldTick } = require('./logger');
const { readSettings, getGamedataPaths } = require('./settings');
const { withPathGuard: _withPathGuardBase } = require('./security');

function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

// Lokale Kopie — vermeidet circular dependency mit scanner.js
function tagEmitter(name) {
  const n = name.toLowerCase();
  const tags = [];
  if (/uef|uel|ueb|ues|uea/.test(n))           tags.push('uef');
  if (/cybran|url|urb|urs|ura/.test(n))         tags.push('cybran');
  if (/aeon|ual|uab|uas|uaa/.test(n))           tags.push('aeon');
  if (/seraphim|sera|xsl|xsb|xss|xsa/.test(n)) tags.push('seraphim');
  if (/\bweather\b/.test(n))                   tags.push('weather');
  return tags;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IPC — MAP CUSTOM PROPS SCANNER
// Scans mapsFolder/mapName.v0001/env/props/**/*.bp
// ── Helper: decode an uncompressed DDS (A8R8G8B8/BGRA) to PNG Buffer ────────
// ── Pure-JS DDS decoder: supports DXT1/BC1, DXT3/BC2, DXT5/BC3, ATI2/BC5, uncompressed ──
function decodeDXT1Block(src, offset, rgba, bx, by, w) {
  const c0 = src.readUInt16LE(offset), c1 = src.readUInt16LE(offset + 2);
  const r0=(c0>>11&31)*255/31|0, g0=(c0>>5&63)*255/63|0, b0=(c0&31)*255/31|0;
  const r1=(c1>>11&31)*255/31|0, g1=(c1>>5&63)*255/63|0, b1=(c1&31)*255/31|0;
  const cr=[r0,r1,0,0], cg=[g0,g1,0,0], cb=[b0,b1,0,0], ca=[255,255,255,255];
  if (c0 > c1) {
    cr[2]=(2*r0+r1)/3|0; cg[2]=(2*g0+g1)/3|0; cb[2]=(2*b0+b1)/3|0;
    cr[3]=(r0+2*r1)/3|0; cg[3]=(g0+2*g1)/3|0; cb[3]=(b0+2*b1)/3|0;
  } else {
    cr[2]=(r0+r1)/2|0; cg[2]=(g0+g1)/2|0; cb[2]=(b0+b1)/2|0;
    cr[3]=0; cg[3]=0; cb[3]=0; ca[3]=0;
  }
  const bits = src.readUInt32LE(offset + 4);
  for (let py=0; py<4; py++) for (let px=0; px<4; px++) {
    const x=bx+px, y=by+py; if (x>=w) continue;
    const idx=(bits>>(2*(py*4+px)))&3, p=(y*w+x)*4;
    rgba[p]=cr[idx]; rgba[p+1]=cg[idx]; rgba[p+2]=cb[idx]; rgba[p+3]=ca[idx];
  }
}
function decodeDXT3Block(src, offset, rgba, bx, by, w) {
  const alphaLo=src.readUInt32LE(offset), alphaHi=src.readUInt32LE(offset+4);
  decodeDXT1Block(src, offset+8, rgba, bx, by, w);
  for (let py=0; py<4; py++) for (let px=0; px<4; px++) {
    const x=bx+px, y=by+py; if (x>=w) continue;
    const i=py*4+px, word=i<8?alphaLo:alphaHi, shift=(i%8)*4;
    rgba[(y*w+x)*4+3]=((word>>shift)&0xF)*17;
  }
}
function decodeDXT5Block(src, offset, rgba, bx, by, w) {
  const a0=src[offset], a1=src[offset+1];
  const ab=Buffer.from([src[offset+2],src[offset+3],src[offset+4],src[offset+5],src[offset+6],src[offset+7]]);
  const at=[a0,a1,0,0,0,0,0,0];
  if (a0>a1){for(let i=2;i<8;i++)at[i]=((8-i)*a0+(i-1)*a1)/7|0;}
  else{for(let i=2;i<6;i++)at[i]=((6-i)*a0+(i-1)*a1)/5|0;at[6]=0;at[7]=255;}
  decodeDXT1Block(src, offset+8, rgba, bx, by, w);
  let bits=0n;
  for(let i=5;i>=0;i--) bits=(bits<<8n)|BigInt(ab[i]);
  for(let py=0;py<4;py++) for(let px=0;px<4;px++){
    const x=bx+px, y=by+py; if(x>=w) continue;
    const i=py*4+px;
    rgba[(y*w+x)*4+3]=at[Number((bits>>(BigInt(i)*3n))&7n)];
  }
}
async function decodeDDSToPNG(ddsBuffer) {
  if (ddsBuffer.length < 128 || ddsBuffer.toString('ascii', 0, 4) !== 'DDS ') return null;
  const height = ddsBuffer.readUInt32LE(12);
  const width  = ddsBuffer.readUInt32LE(16);
  const pitchOrLinear = ddsBuffer.readUInt32LE(20);
  const fourCC = ddsBuffer.readUInt32LE(84);
  const pfFlags = ddsBuffer.readUInt32LE(80);
  const rgba = Buffer.alloc(width * height * 4, 0);

  // Uncompressed BGRA/BGR/BGRA (pfFlags & 0x40 = RGB, & 0x1 = alpha)
  if (fourCC === 0) {
    const bpp = ddsBuffer.readUInt32LE(88); // bit count
    const bytes = bpp / 8;
    for (let i = 0; i < width * height; i++) {
      const s = 128 + i * bytes;
      rgba[i*4]   = ddsBuffer[s+2] ?? 0;  // R (from B)
      rgba[i*4+1] = ddsBuffer[s+1] ?? 0;  // G
      rgba[i*4+2] = ddsBuffer[s]   ?? 0;  // B (from R)
      rgba[i*4+3] = bytes >= 4 ? (ddsBuffer[s+3] ?? 255) : 255;
    }
    if (!sharp) return null;
    return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  }

  const fourCCStr = Buffer.from([
    fourCC&0xFF, (fourCC>>8)&0xFF, (fourCC>>16)&0xFF, (fourCC>>24)&0xFF
  ]).toString('ascii');

  if (fourCCStr === 'DXT1') {
    const bw=Math.ceil(width/4), bh=Math.ceil(height/4);
    for (let by=0;by<bh;by++) for (let bx=0;bx<bw;bx++)
      decodeDXT1Block(ddsBuffer, 128+(by*bw+bx)*8, rgba, bx*4, by*4, width);
  } else if (fourCCStr === 'DXT3') {
    const bw=Math.ceil(width/4), bh=Math.ceil(height/4);
    for (let by=0;by<bh;by++) for (let bx=0;bx<bw;bx++)
      decodeDXT3Block(ddsBuffer, 128+(by*bw+bx)*16, rgba, bx*4, by*4, width);
  } else if (fourCCStr === 'DXT5') {
    const bw=Math.ceil(width/4), bh=Math.ceil(height/4);
    for (let by=0;by<bh;by++) for (let bx=0;bx<bw;bx++)
      decodeDXT5Block(ddsBuffer, 128+(by*bw+bx)*16, rgba, bx*4, by*4, width);
  } else if (fourCCStr === 'ATI2' || fourCCStr === 'BC5S') {
    // ATI2/BC5: two BC4 channels (R=X, G=Y normal map) — decode as RG, B=0
    const bw=Math.ceil(width/4), bh=Math.ceil(height/4);
    for (let by=0;by<bh;by++) for (let bx=0;bx<bw;bx++) {
      const off=128+(by*bw+bx)*16;
      // Channel R (X)
      const r0=ddsBuffer[off],r1=ddsBuffer[off+1];
      const rb=ddsBuffer.slice(off+2,off+8);
      const rt=[r0,r1,0,0,0,0,0,0];
      if(r0>r1){for(let i=2;i<8;i++)rt[i]=((8-i)*r0+(i-1)*r1)/7|0;}
      else{for(let i=2;i<6;i++)rt[i]=((6-i)*r0+(i-1)*r1)/5|0;rt[6]=0;rt[7]=255;}
      // Channel G (Y)
      const g0=ddsBuffer[off+8],g1=ddsBuffer[off+9];
      const gb=ddsBuffer.slice(off+10,off+16);
      const gt=[g0,g1,0,0,0,0,0,0];
      if(g0>g1){for(let i=2;i<8;i++)gt[i]=((8-i)*g0+(i-1)*g1)/7|0;}
      else{for(let i=2;i<6;i++)gt[i]=((6-i)*g0+(i-1)*g1)/5|0;gt[6]=0;gt[7]=255;}
      let rbits=0n; for(let i=5;i>=0;i--) rbits=(rbits<<8n)|BigInt(rb[i]);
      let gbits=0n; for(let i=5;i>=0;i--) gbits=(gbits<<8n)|BigInt(gb[i]);
      for(let py=0;py<4;py++) for(let px=0;px<4;px++){
        const x=bx+px,y=by+py; if(x>=width) continue;
        const i=py*4+px, p=(y*width+x)*4;
        rgba[p]  =rt[Number((rbits>>(BigInt(i)*3n))&7n)];
        rgba[p+1]=gt[Number((gbits>>(BigInt(i)*3n))&7n)];
        rgba[p+2]=128; rgba[p+3]=255;
      }
    }
  } else {
    log.warn(`[decodeDDSToPNG] unsupported fourCC: "${fourCCStr}" (0x${fourCC.toString(16)})`);
    return null;
  }

  if (!sharp) return null;
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// ── IPC: local DDS file → base64 PNG data URL (for renderer preview) ─────────
ipcMain.handle('dds-to-dataurl', withPathGuard(
  ({ filePath }) => [filePath],
  async (event, { filePath }) => {
  try {
    log.debug(`[dds-to-dataurl] requested: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      log.warn(`[dds-to-dataurl] file not found: ${filePath}`);
      return { success: false, error: 'File not found: ' + filePath };
    }
    const ddsBuf = fs.readFileSync(filePath);
    log.debug(`[dds-to-dataurl] read ${ddsBuf.length} bytes, header: ${ddsBuf.toString('ascii',0,4)}`);
    const pngBuf = await decodeDDSToPNG(ddsBuf);
    if (!pngBuf) {
      log.warn(`[dds-to-dataurl] decodeDDSToPNG returned null for: ${filePath}`);
      return { success: false, error: 'Unsupported DDS format' };
    }
    log.debug(`[dds-to-dataurl] success, png size: ${pngBuf.length}`);
    return { success: true, dataUrl: 'data:image/png;base64,' + pngBuf.toString('base64') };
  } catch (err) {
    log.error('dds-to-dataurl:', err.message);
    return { success: false, error: err.message };
  }
}));

// ── dds-url-to-dataurl — fetch a remote DDS and convert to PNG data URL ───────
const _ddsUrlCache = {}; // in-memory cache, cleared on restart
ipcMain.handle('dds-url-to-dataurl', async (event, { url }) => {
  try {
    if (_ddsUrlCache[url]) return { success: true, dataUrl: _ddsUrlCache[url] };
    log.debug(`[dds-url-to-dataurl] fetching: ${url}`);
    const ddsBuf = await new Promise((resolve, reject) => {
      const https = require('https');
      https.get(url, res => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });
    const pngBuf = await decodeDDSToPNG(ddsBuf);
    if (!pngBuf) return { success: false, error: 'Unsupported DDS format' };
    const dataUrl = 'data:image/png;base64,' + pngBuf.toString('base64');
    _ddsUrlCache[url] = dataUrl;
    return { success: true, dataUrl };
  } catch (err) {
    log.warn(`[dds-url-to-dataurl] failed: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// Pairs each .bp with a matching .dds (albedo) in the same folder
// Returns props with file:// previewUrl for local DDS-converted preview
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('scan-map-props', withPathGuard(
  ({ mapsFolder }) => [mapsFolder],
  async (event, { mapsFolder, mapName }) => {
  try {
    function walkDir(dir, results = []) {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walkDir(full, results);
          else results.push(full);
        }
      } catch (e) { log.warn('scan-map-props walkDir error:', e.message); }
      return results;
    }

    const props = [];

    // ── 1. Map-specific custom props ─────────────────────────────────────────
    if (mapsFolder && mapName) {
      const finalName    = /\.v\d{4}$/.test(mapName) ? mapName : mapName + '.v0001';
      const envPropsRoot = path.join(mapsFolder, finalName, 'env', 'props');

      if (fs.existsSync(envPropsRoot)) {
        const allFiles = walkDir(envPropsRoot);
        const bpFiles  = allFiles.filter(f => f.toLowerCase().endsWith('.bp') && !f.toLowerCase().endsWith('_emit.bp'));
        const ddsFiles = new Set(allFiles.filter(f => f.toLowerCase().endsWith('.dds')).map(f => f.replace(/\\/g, '/').toLowerCase()));

        log.info(`scan-map-props: ${bpFiles.length} .bp files, ${ddsFiles.size} .dds files in ${envPropsRoot}`);

        for (const bpPath of bpFiles) {
          const bpName   = path.basename(bpPath, '.bp');
          const propName = bpName.replace(/_prop$/i, '');
          const bpDir    = path.dirname(bpPath);
          const relPath  = '/' + path.relative(path.join(mapsFolder, finalName), bpPath).replace(/\\/g, '/');

          const parts    = relPath.split('/').filter(Boolean);
          const propsIdx = parts.findIndex(p => p.toLowerCase() === 'props');
          const typeFolder = propsIdx !== -1 && parts[propsIdx + 1] && !parts[propsIdx + 1].endsWith('.bp')
            ? parts[propsIdx + 1].toLowerCase() : 'misc';

          let reclaimMass = null, reclaimEnergy = null, reclaimTime = null, matchedDds = null;
          const lodPreviewUrls = {};
          try {
            const bpContent = fs.readFileSync(bpPath, 'utf8');
            const massMatch   = bpContent.match(/ReclaimMassMax\s*=\s*([\d.]+)/);
            const energyMatch = bpContent.match(/ReclaimEnergyMax\s*=\s*([\d.]+)/);
            const timeMatch   = bpContent.match(/ReclaimTime\s*=\s*([\d.]+)/);
            if (massMatch)   reclaimMass   = parseFloat(massMatch[1]);
            if (energyMatch) reclaimEnergy = parseFloat(energyMatch[1]);
            if (timeMatch)   reclaimTime   = parseFloat(timeMatch[1]);

            const albedoMatch = bpContent.match(/AlbedoName\s*=\s*['"]([^'"]+\.dds)['"]/i);
            if (albedoMatch) {
              const albedoBase    = albedoMatch[1].replace(/\\/g, '/').split('/').pop();
              const sameFolderDds = path.join(bpDir, albedoBase).replace(/\\/g, '/').toLowerCase();
              log.debug(`[dds-match] bp=${bpName} albedo=${albedoBase} key=${sameFolderDds}`);
              if (ddsFiles.has(sameFolderDds)) {
                matchedDds = path.join(bpDir, albedoBase);
                log.debug(`[dds-match] HIT: ${matchedDds}`);
              } else {
                const found = [...ddsFiles].find(f => path.basename(f) === albedoBase.toLowerCase());
                if (found) { matchedDds = found; log.debug(`[dds-match] HIT basename: ${matchedDds}`); }
                else log.debug(`[dds-match] MISS — sample ddsFiles: ${[...ddsFiles].slice(0,2).join(' | ')}`);
              }
            } else {
              log.debug(`[dds-match] bp=${bpName} — no AlbedoName in BP`);
            }
            if (!matchedDds) {
              const fallback = path.join(bpDir, propName + '_albedo.dds').replace(/\\/g, '/').toLowerCase();
              if (ddsFiles.has(fallback)) { matchedDds = fallback; log.debug(`[dds-match] HIT fallback: ${matchedDds}`); }
            }

            // Collect LOD-specific albedo DDS files (e.g. _LOD2_albedo.dds, _lod2_albedo.dds)
            // Strategy 1: parse AlbedoName entries in BP content
            const allAlbedoMatches = [...bpContent.matchAll(/AlbedoName\s*=\s*['"]([^'"]*\.dds)['"]/gi)];
            for (const m of allAlbedoMatches) {
              const filename = m[1].replace(/\\/g, '/').split('/').pop();
              const lodAlbMatch = filename.match(/_LOD(\d+)_albedo\.dds$/i);
              if (lodAlbMatch) {
                const lodN = lodAlbMatch[1];
                const lodDdsKey = path.join(bpDir, filename).replace(/\\/g, '/').toLowerCase();
                const lodDdsPath = ddsFiles.has(lodDdsKey)
                  ? path.join(bpDir, filename)
                  : [...ddsFiles].find(f => path.basename(f) === filename.toLowerCase());
                if (lodDdsPath && !lodPreviewUrls[lodN]) {
                  lodPreviewUrls[lodN] = 'file:///' + lodDdsPath.replace(/\\/g, '/').replace(/^\//, '');
                }
              }
            }
            // Strategy 2: scan disk files directly -- catches legacy _lod2_ (lowercase) names
            // and any LOD DDS not referenced by AlbedoName in the BP
            const bpDirKeyLower = bpDir.replace(/\\/g, '/').toLowerCase();
            for (const ddsKey of ddsFiles) {
              if (!ddsKey.startsWith(bpDirKeyLower + '/')) continue;
              const base = path.basename(ddsKey);
              const diskLodMatch = base.match(/_lod(\d+)_albedo\.dds$/i);
              if (diskLodMatch) {
                const lodN = diskLodMatch[1];
                if (!lodPreviewUrls[lodN]) {
                  lodPreviewUrls[lodN] = 'file:///' + ddsKey.replace(/^\//, '');
                  log.debug('[lod-scan] disk hit LOD' + lodN + ': ' + ddsKey);
                }
              }
            }
          } catch (e) { log.warn(`scan-map-props: parse error for ${bpName}: ${e.message}`); }

          const previewUrl = matchedDds
            ? 'file:///' + matchedDds.replace(/\\/g, '/').replace(/^\//, '')
            : null;

          props.push({
            id: bpName, name: propName, gamePath: relPath,
            source: 'map-custom', biome: 'custom', propType: typeFolder,
            previewUrl,
            lodPreviewUrls: Object.keys(lodPreviewUrls).length > 0 ? lodPreviewUrls : undefined,
            reclaimMass: reclaimMass || null, reclaimEnergy: reclaimEnergy || null, reclaimTime: reclaimTime || null,
            isGroup: relPath.toLowerCase().includes('/groups/'),
            isCustom: true,
          });
        }
        log.info(`scan-map-props: found ${props.filter(p => p.source === 'map-custom').length} map props`);
      } else {
        log.info(`scan-map-props: no env/props folder at ${envPropsRoot}`);
      }
    }

    // ── 2. Bundled toolkit props from public/props/<Biome>/ ───────────────────
    // Structure: public/props/<BiomeName>/<propname>_prop.bp + <propname>_albedo.dds
    const publicPropsRoot = path.join(app.getAppPath(), 'public', 'props');
    if (fs.existsSync(publicPropsRoot)) {
      let subfolders = [];
      try {
        subfolders = fs.readdirSync(publicPropsRoot, { withFileTypes: true }).filter(e => e.isDirectory());
      } catch (e) { log.warn('scan-map-props: cannot read public/props subfolders:', e.message); }

      for (const sub of subfolders) {
        const subDir = path.join(publicPropsRoot, sub.name);
        const biome  = sub.name.toLowerCase();
        const allFiles = walkDir(subDir);
        const bpFiles  = allFiles.filter(f => f.toLowerCase().endsWith('.bp') && !f.toLowerCase().endsWith('_emit.bp'));
        const ddsFiles = new Set(allFiles.filter(f => f.toLowerCase().endsWith('.dds')).map(f => f.replace(/\\/g, '/').toLowerCase()));

        log.info(`scan-map-props: toolkit biome "${sub.name}" -> ${bpFiles.length} props`);

        for (const bpPath of bpFiles) {
          await yieldTick(20);
          const bpName   = path.basename(bpPath, '.bp');
          const propName = bpName.replace(/_prop$/i, '');
          const bpDir    = path.dirname(bpPath);

          let reclaimMass = null, reclaimEnergy = null, reclaimTime = null, matchedDds = null;
          try {
            const bpContent = fs.readFileSync(bpPath, 'utf8');
            const massMatch   = bpContent.match(/ReclaimMassMax\s*=\s*([\d.]+)/);
            const energyMatch = bpContent.match(/ReclaimEnergyMax\s*=\s*([\d.]+)/);
            const timeMatch   = bpContent.match(/ReclaimTime\s*=\s*([\d.]+)/);
            if (massMatch)   reclaimMass   = parseFloat(massMatch[1]);
            if (energyMatch) reclaimEnergy = parseFloat(energyMatch[1]);
            if (timeMatch)   reclaimTime   = parseFloat(timeMatch[1]);

            const albedoMatch = bpContent.match(/AlbedoName\s*=\s*['"]([^'"]+\.dds)['"]/i);
            if (albedoMatch) {
              const albedoBase    = albedoMatch[1].replace(/\\/g, '/').split('/').pop();
              const sameFolderDds = path.join(bpDir, albedoBase).replace(/\\/g, '/').toLowerCase();
              if (ddsFiles.has(sameFolderDds)) {
                matchedDds = path.join(bpDir, albedoBase);
              } else {
                const found = [...ddsFiles].find(f => path.basename(f) === albedoBase.toLowerCase());
                if (found) matchedDds = found;
              }
            }
            if (!matchedDds) {
              const fallback = path.join(bpDir, propName + '_albedo.dds').toLowerCase();
              if (ddsFiles.has(fallback)) matchedDds = fallback;
            }
          } catch (e) { log.warn(`scan-map-props toolkit: parse error for ${bpName}: ${e.message}`); }

          const previewUrl = matchedDds
            ? 'file:///' + matchedDds.replace(/\\/g, '/').replace(/^\//, '')
            : null;

          props.push({
            id: `toolkit__${biome}__${bpName}`, name: propName, gamePath: bpName + '.bp',
            source: 'toolkit', biome, propType: biome,
            previewUrl,
            reclaimMass: reclaimMass || null, reclaimEnergy: reclaimEnergy || null, reclaimTime: reclaimTime || null,
            isGroup: bpName.toLowerCase().includes('group'),
            isCustom: true,
          });
        }
      }
      log.info(`scan-map-props: ${props.filter(p => p.source === 'toolkit').length} toolkit props loaded`);
    } else {
      log.info(`scan-map-props: public/props folder not found at ${publicPropsRoot}`);
    }

    return { success: true, props };
  } catch (e) {
    log.error('scan-map-props failed:', e);
    return { success: false, error: e.message, props: [] };
  }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// IPC — MAP CUSTOM EMITTERS SCANNER
// Scans two sources and merges results:
//   1. mapsFolder/mapName.v0001/**/*_emit.bp  (map-specific custom emitters)
//   2. <app>/public/emitter/<SubFolder>/*.bp  (bundled toolkit emitters, category = subfolder name)
// No previews for emitters
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('scan-map-emitters', withPathGuard(
  ({ mapsFolder }) => [mapsFolder],
  async (event, { mapsFolder, mapName }) => {
  try {
    function walkDir(dir, results = []) {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walkDir(full, results);
          else results.push(full);
        }
      } catch (e) { log.warn('scan-map-emitters walkDir error:', e.message); }
      return results;
    }

    const emitters = [];

    // ── 1. Map-specific custom emitters ──────────────────────────────────────
    if (mapsFolder && mapName) {
      const finalName = /\.v\d{4}$/.test(mapName) ? mapName : mapName + '.v0001';
      const mapRoot   = path.join(mapsFolder, finalName);

      if (fs.existsSync(mapRoot)) {
        const emitFiles = walkDir(mapRoot).filter(f => f.toLowerCase().endsWith('_emit.bp'));
        log.info(`scan-map-emitters: ${emitFiles.length} _emit.bp files in ${mapRoot}`);

        for (const bpPath of emitFiles) {
          const bpName  = path.basename(bpPath, '.bp');
          const relPath = '/' + path.relative(mapRoot, bpPath).replace(/\\/g, '/');

          // Derive category from subfolder closest to the file
          const parts    = relPath.split('/').filter(Boolean);
          const emitIdx  = parts.findIndex(p => p.toLowerCase().includes('emitter'));
          const category = emitIdx !== -1 && parts[emitIdx + 1] && !parts[emitIdx + 1].endsWith('.bp')
            ? parts[emitIdx + 1].toLowerCase()
            : parts.length > 1 ? parts[parts.length - 2].toLowerCase() : 'misc';

          emitters.push({
            id:       bpName,
            name:     bpName,
            gamePath: `/maps/${finalName}${relPath}`,
            relPath,
            source:   'map-custom',
            category,
            isCustom: true,
            tags:     ['custom', ...tagEmitter(bpName)],
          });
        }
      } else {
        log.info(`scan-map-emitters: map folder not found: ${mapRoot}`);
      }
    }

    // ── 2. Bundled toolkit emitters from public/emitter ───────────────────────
    const publicEmitterRoot = path.join(app.getAppPath(), 'public', 'emitter');
    if (fs.existsSync(publicEmitterRoot)) {
      let subfolders = [];
      try {
        subfolders = fs.readdirSync(publicEmitterRoot, { withFileTypes: true })
          .filter(e => e.isDirectory());
      } catch (e) {
        log.warn('scan-map-emitters: cannot read public/emitter subfolders:', e.message);
      }

      if (subfolders.length === 0) {
        // Flat layout — no subfolders, treat all .bp files as category 'misc'
        let bpFiles = [];
        try { bpFiles = fs.readdirSync(publicEmitterRoot).filter(f => f.toLowerCase().endsWith('.bp')); }
        catch (e) { log.warn('scan-map-emitters: flat read failed:', e.message); }

        for (const fname of bpFiles) {
          const bpName = path.basename(fname, '.bp');
          emitters.push({
            id:         `toolkit__misc__${bpName}`,
            name:       bpName,
            gamePath:   fname,
            publicPath: path.join(publicEmitterRoot, fname),
            source:     'toolkit',
            category:   'misc',
            isCustom:   true,
            tags:       ['custom', ...tagEmitter(bpName)],
          });
        }
      } else {
        for (const sub of subfolders) {
          const subDir   = path.join(publicEmitterRoot, sub.name);
          const category = sub.name.toLowerCase();
          const bpFiles  = walkDir(subDir).filter(f => f.toLowerCase().endsWith('.bp'));

          log.info(`scan-map-emitters: toolkit category "${sub.name}" -> ${bpFiles.length} files`);

          for (const bpPath of bpFiles) {
            const bpName  = path.basename(bpPath, '.bp');
            // Relative path from public/emitter/ root, e.g. "dust/subtype/smoke_emit.bp"
            const relFromRoot = path.relative(publicEmitterRoot, bpPath).replace(/\\/g, '/');
            emitters.push({
              id:         `toolkit__${category}__${bpName}`,
              name:       bpName,
              // gamePath holds the relative path used to build the in-game /maps/... path
              gamePath:   relFromRoot,
              // publicPath is the absolute fs path — used by handleGenerate to copy the file
              publicPath: bpPath,
              source:     'toolkit',
              category,
              isCustom:   true,
              tags:       ['custom', ...tagEmitter(bpName)],
            });
          }
        }
      }

      log.info(`scan-map-emitters: ${emitters.filter(e => e.source === 'toolkit').length} toolkit emitters loaded`);
    } else {
      log.info(`scan-map-emitters: public/emitter folder not found at ${publicEmitterRoot}`);
    }

    return { success: true, emitters };
  } catch (e) {
    log.error('scan-map-emitters failed:', e);
    return { success: false, error: e.message, emitters: [] };
  }
}));

// npm install sharp  (only dependency needed)
let sharp;
try { sharp = require('sharp'); } catch(e) { console.warn('sharp not installed:', e.message); }

// ── Helper: download a URL to Buffer ────────────────────────────────────────
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Helper: RGBA Buffer → DDS (uncompressed A8R8G8B8) ───────────────────────
// No external package needed. Supreme Commander reads uncompressed DDS fine.
function encodeToDDS(rgbaData, width, height) {
  const header = Buffer.alloc(128, 0);
  header.write('DDS ', 0, 'ascii');
  header.writeUInt32LE(124, 4);
  // dwFlags: DDSD_CAPS | DDSD_HEIGHT | DDSD_WIDTH | DDSD_PITCH | DDSD_PIXELFORMAT
  header.writeUInt32LE(0x0002100F, 8);
  header.writeUInt32LE(height, 12);
  header.writeUInt32LE(width, 16);
  header.writeUInt32LE(width * 4, 20);   // pitch = width * 4 bytes
  header.writeUInt32LE(0, 24);
  header.writeUInt32LE(1, 28);
  // DDS_PIXELFORMAT at offset 76
  header.writeUInt32LE(32, 76);
  header.writeUInt32LE(0x41, 80);        // DDPF_RGB | DDPF_ALPHAPIXELS
  header.writeUInt32LE(0, 84);           // dwFourCC = 0 (uncompressed)
  header.writeUInt32LE(32, 88);          // 32 bits per pixel
  header.writeUInt32LE(0x00FF0000, 92);  // R mask
  header.writeUInt32LE(0x0000FF00, 96);  // G mask
  header.writeUInt32LE(0x000000FF, 100); // B mask
  header.writeUInt32LE(0xFF000000, 104); // A mask
  header.writeUInt32LE(0x1000, 108);     // DDSCAPS_TEXTURE

  // Convert RGBA → BGRA (A8R8G8B8 in little-endian = BGRA byte order)
  const pixelCount = width * height;
  const pixelData  = Buffer.alloc(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    const s = i * 4;
    pixelData[s]     = rgbaData[s + 2]; // B
    pixelData[s + 1] = rgbaData[s + 1]; // G
    pixelData[s + 2] = rgbaData[s];     // R
    pixelData[s + 3] = rgbaData[s + 3]; // A
  }
  return Buffer.concat([header, pixelData]);
}

// ── Helper: apply image adjustments with sharp ───────────────────────────────
// adj: {
//   hue: number,          // -180 to +180, default 0
//   saturation: number,   // 0-200, default 100
//   brightness: number,   // 0-200, default 100
//   contrast: number,     // 0-200, default 100
//   gamma: number,        // 10-300, default 100  (100 = no change, <100 = brighter, >100 = darker)
//   tint: { r, g, b, opacity } | null,   // opacity 0-100
//   selectiveColor: {
//     enabled: bool,
//     targetHue: number,   // 0-360 center hue to target
//     hueRange: number,    // 0-180 tolerance around targetHue
//     hueShift: number,    // -180 to +180
//     satShift: number,    // -100 to +100
//     briShift: number,    // -100 to +100
//   } | null,
//   selection: {
//     enabled: bool,
//     x: number, y: number, w: number, h: number,  // 0.0-1.0 normalized to image size
//   } | null,
// }
// Returns { data: Buffer<RGBA>, width, height }
async function applyAdjustments(pngBuffer, adj) {
  if (!sharp) throw new Error('sharp not installed. Run: npm install sharp');

  // ── Get raw RGBA pixels ───────────────────────────────────────────────────
  const { data: rawData, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixels = Buffer.from(rawData); // mutable copy

  // ── Precompute selection mask ─────────────────────────────────────────────
  // sel: normalized 0-1 rect → pixel bounds
  const sel = adj.selection?.enabled ? adj.selection : null;
  const selX0 = sel ? Math.round(sel.x * width)              : 0;
  const selY0 = sel ? Math.round(sel.y * height)             : 0;
  const selX1 = sel ? Math.round((sel.x + sel.w) * width)    : width;
  const selY1 = sel ? Math.round((sel.y + sel.h) * height)   : height;

  const inSelection = (px, py) => {
    if (!sel) return true;
    return px >= selX0 && px < selX1 && py >= selY0 && py < selY1;
  };

  // ── Helper: RGB ↔ HSL ─────────────────────────────────────────────────────
  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        default: h = ((r - g) / d + 4) / 6;
      }
    }
    return [h * 360, s * 100, l * 100];
  };

  const hslToRgb = (h, s, l) => {
    h /= 360; s /= 100; l /= 100;
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1/3) * 255),
      Math.round(hue2rgb(p, q, h)       * 255),
      Math.round(hue2rgb(p, q, h - 1/3) * 255),
    ];
  };

  const clamp = (v, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, Math.round(v)));

  // ── Precompute global adjustments (applied to all pixels in selection) ────
  const doHueSat   = adj.hue !== 0 || adj.saturation !== 100;
  const doBri      = adj.brightness !== 100;
  const doCon      = adj.contrast !== 100;
  const doGamma    = adj.gamma !== undefined && adj.gamma !== 100;
  const doTint     = adj.tint && adj.tint.opacity > 0;
  const doSelColor = adj.selectiveColor?.enabled;

  const conFactor  = doCon   ? (adj.contrast   / 100) : 1;
  const conOffset  = doCon   ? 128 * (1 - conFactor)  : 0;
  const gammaVal   = doGamma ? (adj.gamma / 100)       : 1;
  // Gamma: value > 1 → darker, < 1 → brighter  (standard photographic convention)
  const gammaExp   = doGamma ? (1 / gammaVal)          : 1;

  const tintR      = doTint ? adj.tint.r   : 0;
  const tintG      = doTint ? adj.tint.g   : 0;
  const tintB      = doTint ? adj.tint.b   : 0;
  const tintA      = doTint ? (adj.tint.opacity / 100) : 0;

  // Precompute gamma LUT for speed
  const gammaLUT = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    gammaLUT[i] = doGamma ? clamp(Math.pow(i / 255, gammaExp) * 255) : i;
  }

  // ── Per-pixel loop ─────────────────────────────────────────────────────────
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = (py * width + px) * 4;
      if (!inSelection(px, py)) continue;

      let r = pixels[idx],
          g = pixels[idx + 1],
          b = pixels[idx + 2];
      // alpha untouched throughout

      // 1. Hue + Saturation shift (HSL space)
      if (doHueSat) {
        let [h, s, l] = rgbToHsl(r, g, b);
        h = ((h + adj.hue) % 360 + 360) % 360;
        s = clamp(s * (adj.saturation / 100), 0, 100);
        [r, g, b] = hslToRgb(h, s, l);
      }

      // 2. Brightness
      if (doBri) {
        const f = adj.brightness / 100;
        r = clamp(r * f); g = clamp(g * f); b = clamp(b * f);
      }

      // 3. Contrast
      if (doCon) {
        r = clamp(r * conFactor + conOffset);
        g = clamp(g * conFactor + conOffset);
        b = clamp(b * conFactor + conOffset);
      }

      // 4. Gamma
      if (doGamma) {
        r = gammaLUT[r]; g = gammaLUT[g]; b = gammaLUT[b];
      }

      // 5. Tint (color overlay, alpha-blend)
      if (doTint) {
        r = clamp(r * (1 - tintA) + tintR * tintA);
        g = clamp(g * (1 - tintA) + tintG * tintA);
        b = clamp(b * (1 - tintA) + tintB * tintA);
      }

      // 6. Selective Color — only affect pixels whose hue is within range
      if (doSelColor) {
        const sc   = adj.selectiveColor;
        const [h, s, l] = rgbToHsl(r, g, b);
        const hueDiff = Math.abs(((h - sc.targetHue + 180 + 360) % 360) - 180);
        if (hueDiff <= sc.hueRange) {
          const strength = 1 - hueDiff / sc.hueRange; // fade at edges
          const newH = ((h + sc.hueShift * strength) % 360 + 360) % 360;
          const newS = clamp(s + sc.satShift * strength, 0, 100);
          const newL = clamp(l + sc.briShift * strength * 0.5, 0, 100);
          [r, g, b] = hslToRgb(newH, newS, newL);
        }
      }

      pixels[idx]     = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
    }
  }

  return { data: pixels, width, height };
}

// ── Helper: determine source file paths for a prop ───────────────────────────
// Given the prop's gamePath like "/env/Lava/props/Trees/Rock01_prop.bp",
// and a game install path, find the actual files.
// Returns { bp, scm, albedoPng, albedoDds } (may be null if not found)
function resolveSourceFiles(prop, gameInstallPath) {
  // prop.gamePath is like /env/Lava/props/Trees/Rock01_prop.bp
  // prop.sourceFiles may already be set by library-scan
  if (prop.sourceFiles) return prop.sourceFiles;

  const gamePath = prop.gamePath || prop.id || '';
  const bpPath = gamePath.startsWith('/') ? gamePath.slice(1) : gamePath;

  // Derive texture path from bp path
  // Convention: Rock01_prop.bp → Rock01_Albedo.dds  (or _albedo.dds, _Diffuse.dds)
  const bpName = path.basename(bpPath, '_prop.bp').replace(/_prop$/, '');
  const bpDir  = path.dirname(bpPath);

  const candidates = [
    `${bpName}_Albedo.dds`,
    `${bpName}_albedo.dds`,
    `${bpName}_Diffuse.dds`,
    `${bpName}_diffuse.dds`,
    `${bpName}.dds`,
  ];

  return {
    bp:  path.join(gameInstallPath, bpPath),
    scm: path.join(gameInstallPath, bpPath.replace('_prop.bp', '_prop.scm').replace('.bp', '.scm')),
    albedoCandidates: candidates.map(c => path.join(gameInstallPath, bpDir, c)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: patch AlbedoName entries in a .bp file block-by-block.
//
// Problem: A BP file contains multiple LOD blocks, e.g.:
//   { AlbedoName = 'oak01_Group2_LOD2_albedo.dds', LODCutoff = 750, ... }
//   { AlbedoName = 'Oak01_albedo.dds', LODCutoff = 30, NormalsName = '...', ... }
//
// Simple regex replacement fails because:
//   - A LOD2 block may NOT have "_LOD2_" in its original AlbedoName (the name
//     already IS the lod0 name, just referenced again from the lower-quality block).
//   - After patching the main albedo globally, LOD2 blocks end up with the wrong name.
//
// Fix: parse each { } block individually. For each block:
//   1. Detect whether it belongs to a LOD2+ entry by reading MeshName (e.g. _lod2.scm)
//      OR by detecting an existing _LOD\d+_albedo pattern in AlbedoName.
//   2. For LOD2+ blocks: replace AlbedoName with customBaseName_LOD{n}_albedo.dds
//      (never shared via link — each prop owns its own LOD textures).
//   3. For the main/lod0 block: replace with mainAlbBase_albedo.dds
//      (mainAlbBase = linkSourceBase when linked, else customBaseName).
//
// Also patches MeshName and NormalsName inside the same pass.
// ═══════════════════════════════════════════════════════════════════════════════
function patchBpText(bpText, { customBaseName, mainAlbBase, normBase }) {
  // ── Pass 1: patch MeshName (simple global regex is fine here) ──────────────
  bpText = bpText.replace(/MeshName\s*=\s*'[^']*_lod(\d+)\.scm'/gi,  (_, n) => `MeshName = '${customBaseName}_lod${n}.scm'`);
  bpText = bpText.replace(/MeshName\s*=\s*"[^"]*_lod(\d+)\.scm"/gi,  (_, n) => `MeshName = '${customBaseName}_lod${n}.scm'`);
  // Only replace entries that do NOT already contain _lod\d+.scm (i.e. bare lod0 entries that
  // weren't matched by the specific regex above). Without the negative lookahead the generic
  // pattern would re-match the already-patched _lod2.scm / _lod3.scm entries and overwrite
  // them with _lod0.scm, causing lod2/lod3 blocks to receive the wrong AlbedoName later.
  bpText = bpText.replace(/MeshName\s*=\s*'(?![^']*_lod\d+\.scm)[^']*'/gi,  `MeshName = '${customBaseName}_lod0.scm'`);
  bpText = bpText.replace(/MeshName\s*=\s*"(?![^"]*_lod\d+\.scm)[^"]*"/gi,  `MeshName = '${customBaseName}_lod0.scm'`);

  // ── Pass 2: patch NormalsName (global, same for all LODs) ──────────────────
  bpText = bpText.replace(/NormalsName\s*=\s*'[^']*'/gi, `NormalsName = '${normBase}_normalsTS.dds'`);
  bpText = bpText.replace(/NormalsName\s*=\s*"[^"]*"/gi, `NormalsName = '${normBase}_normalsTS.dds'`);

  // ── Pass 3: patch AlbedoName block-by-block ─────────────────────────────────
  // Split text into blocks delimited by { }. We keep the delimiters so we can
  // reconstruct the full text afterwards.  We match balanced braces one level deep
  // (BP files are shallow — LOD blocks are not nested).
  bpText = bpText.replace(/\{([^{}]*)\}/g, (blockMatch, inner) => {
    // Determine LOD index for this block:
    //   1. Check MeshName (already patched above) → _lod(\d+).scm
    //   2. Fallback: check original AlbedoName for _LOD(\d+)_albedo
    let lodIndex = null;

    const meshLodMatch = inner.match(/MeshName\s*=\s*'[^']*_lod(\d+)\.scm'/i)
                      || inner.match(/MeshName\s*=\s*"[^"]*_lod(\d+)\.scm"/i);
    if (meshLodMatch) {
      const n = parseInt(meshLodMatch[1], 10);
      if (n >= 2) lodIndex = n;  // lod0/lod1 use main albedo
    }

    if (lodIndex === null) {
      // Fallback: detect _LOD\d+_ pattern in the current (pre-patch) AlbedoName
      const albLodMatch = inner.match(/AlbedoName\s*=\s*['"][^'"]*_LOD(\d+)_albedo\.dds['"]/i);
      if (albLodMatch) {
        const n = parseInt(albLodMatch[1], 10);
        if (n >= 2) lodIndex = n;
      }
    }

    // Replace AlbedoName inside this block
    const newAlbedo = lodIndex !== null
      ? `${customBaseName}_LOD${lodIndex}_albedo.dds`   // LOD2+ → always own file
      : `${mainAlbBase}_albedo.dds`;                     // lod0/lod1 → may be linked

    let patchedInner = inner.replace(
      /AlbedoName\s*=\s*['"][^'"]*['"]/gi,
      `AlbedoName = '${newAlbedo}'`
    );

    // If NormalsName is missing entirely from this block, inject it after AlbedoName
    if (!/NormalsName\s*=/i.test(patchedInner) && /AlbedoName\s*=/i.test(patchedInner)) {
      patchedInner = patchedInner.replace(
        /(AlbedoName\s*=\s*'[^']*')/i,
        `$1,\n            NormalsName = '${normBase}_normalsTS.dds'`
      );
    }

    return `{${patchedInner}}`;
  });

  return bpText;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IPC — GENERATE PROP FILES
//
// File naming conventions (from env.scd, confirmed by screenshot):
//   eg_fern01_prop.bp       ← blueprint
//   eg_fern01_lod0.scm      ← mesh  (NOT _prop.scm!)
//   eg_fern01_albedo.dds    ← albedo texture
//   eg_fern01_normalsTS.dds ← normals (copied as-is)
//
// Output into: <mapsFolder>/<mapName>/<targetDir>/
//   eg_fern01_custom_prop.bp
//   eg_fern01_custom_lod0.scm
//   eg_fern01_custom_albedo.dds
//   eg_fern01_custom_normalsTS.dds
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('generate-prop-files', withPathGuard(
  ({ mapsFolder }) => [mapsFolder],
  async (event, { textureOps, mapsFolder, mapName }) => {

  try {
    const mapFolderName = /\.v\d{4}$/.test(mapName) ? mapName : `${mapName}.v0001`;
    const mapFolderPath = path.join(mapsFolder, mapFolderName);

    const settings      = readSettings();
    const gamedataPaths = getGamedataPaths(settings);

    const results  = [];
    const warnings = [];

    for (const op of textureOps) {
      const { originalProp, targetBpPath, linkedEntry } = op;
      // Linked followers have no own adjustments — they use the source's adjustments
      // so their LOD2 textures get the same colour treatment as the source's textures.
      const adj      = op.adjustments ?? linkedEntry?.adjustments ?? null;

      // ── Linked texture source ─────────────────────────────────────────────
      // If this prop is linked to another, its bp references the source's textures.
      const isLinked = !!linkedEntry;
      let linkSourceBase = null;
      if (isLinked && linkedEntry.targetBpPath) {
        const lsRel = linkedEntry.targetBpPath.startsWith('/') ? linkedEntry.targetBpPath.slice(1) : linkedEntry.targetBpPath;
        linkSourceBase = path.basename(lsRel).replace(/_prop\.bp$/i, '');
      }

      // ── Derive paths ─────────────────────────────────────────────────────
      // For LINKED props: write into the SOURCE prop's folder so all files are co-located.
      // e.g. source targetBpPath = /env/props/DeadTree02/DeadTree02_s1_prop.bp
      //      linked               = /env/props/DeadTree02/DeadTree02_s2_prop.bp  (same folder!)
      let targetBpPathResolved = targetBpPath;
      if (isLinked && linkedEntry.targetBpPath) {
        const srcDir = path.dirname(
          linkedEntry.targetBpPath.startsWith('/') ? linkedEntry.targetBpPath.slice(1) : linkedEntry.targetBpPath
        );
        const myBpFile = path.basename(targetBpPath.startsWith('/') ? targetBpPath.slice(1) : targetBpPath);
        targetBpPathResolved = '/' + srcDir + '/' + myBpFile;
      }

      const targetRelative = targetBpPathResolved.startsWith('/') ? targetBpPathResolved.slice(1) : targetBpPathResolved;
      const targetDir      = path.join(mapFolderPath, path.dirname(targetRelative));
      const customBpName   = path.basename(targetRelative);            // eg_fern01_custom_prop.bp
      const customBaseName = customBpName.replace(/_prop\.bp$/i, ''); // eg_fern01_custom

      fs.mkdirSync(targetDir, { recursive: true });

      // origGamePath: /env/Evergreen/Props/Bush/eg_fern01_prop.bp
      const origGamePath = (originalProp.gamePath || '').replace(/\\/g, '/');
      const origInZip    = origGamePath.replace(/^\//, ''); // strip leading slash → env/Evergreen/Props/Bush/eg_fern01_prop.bp
      const origDir      = path.dirname(origInZip);         // env/Evergreen/Props/Bush
      const origBpFile   = path.basename(origInZip);        // eg_fern01_prop.bp
      const origBpBase   = origBpFile.replace(/\.bp$/i, ''); // eg_fern01_prop
      const origName     = origBpBase.replace(/_prop$/i, ''); // eg_fern01

      log.info(`generate-prop-files: processing ${originalProp.id}`);
      log.info(`  origInZip:  ${origInZip}`);
      log.info(`  origDir:    ${origDir}`);
      log.info(`  origName:   ${origName}`);
      log.info(`  targetDir:  ${targetDir}`);
      log.info(`  customBase: ${customBaseName}`);

      let foundBp  = false;
      let foundScm = false;
      let foundDds = false;
      let cachedAlbedoPathInZip = null; // extracted from original bp's AlbedoName
      // Collects LOD-specific albedo info found while parsing the bp.
      // Key: lodN string ("2","3"), Value: { zipPath, realFilename } where realFilename
      // preserves the exact capitalisation from the zip (needed for case-sensitive GitHub URLs).
      const lodAlbedoOrigPaths = {};

      // ── For map-custom props: read bp/scm directly from disk (no SCD search) ──
      if (originalProp.source === 'map-custom') {
        const mapFolderVersioned = /\.v\d{4}$/.test(mapName) ? mapName : `${mapName}.v0001`;
        const origBpOnDisk = originalProp.gamePath
          ? path.join(mapsFolder, mapFolderVersioned,
              originalProp.gamePath.replace(/^\//, '').replace(/\//g, path.sep))
          : null;
        const origDirOnDisk = origBpOnDisk ? path.dirname(origBpOnDisk) : null;

        if (origBpOnDisk && fs.existsSync(origBpOnDisk)) {
          try {
            let bpText = fs.readFileSync(origBpOnDisk, 'utf8');

            // Patch MeshName, NormalsName, AlbedoName (block-aware for LOD correctness)
            bpText = patchBpText(bpText, {
              customBaseName,
              mainAlbBase: isLinked ? linkSourceBase : customBaseName,
              normBase:    isLinked ? linkSourceBase : customBaseName,
            });
            fs.writeFileSync(path.join(targetDir, customBpName), bpText, 'utf8');
            log.info(`  ✓ wrote bp (disk): ${customBpName}`);
            foundBp = true;
          } catch (e) {
            warnings.push(`Could not write .bp for ${originalProp.id}: ${e.message}`);
            log.error(`  ✗ bp write failed:`, e);
          }
        } else {
          log.warn(`  map-custom bp not found on disk: ${origBpOnDisk}`);
        }

        // Copy scm files from disk — rename to customBaseName
        if (origDirOnDisk && fs.existsSync(origDirOnDisk)) {
          const scmFiles = fs.readdirSync(origDirOnDisk).filter(f => f.toLowerCase().endsWith('.scm'));
          let copiedAny = false;
          for (const f of scmFiles) {
            const lodMatch = f.match(/_lod(\d+)\.scm$/i);
            const destName = lodMatch
              ? `${customBaseName}_lod${lodMatch[1]}.scm`
              : `${customBaseName}_lod0.scm`;
            try {
              const dest = path.join(targetDir, destName);
              if (!fs.existsSync(dest)) fs.copyFileSync(path.join(origDirOnDisk, f), dest);
              log.info(`  ✓ copied scm (disk): ${f} → ${destName}`);
              copiedAny = true;
            } catch (e) { log.warn(`  scm copy failed: ${f}: ${e.message}`); }
          }
          if (copiedAny) foundScm = true;

          // Copy normalsTS from disk if not linked
          if (!isLinked) {
            const allFiles = fs.readdirSync(origDirOnDisk);
            for (const f of allFiles) {
              if (f.toLowerCase().includes('normalsts') || f.toLowerCase().includes('normalt')) {
                const dest = path.join(targetDir, `${customBaseName}_normalsTS.dds`);
                if (!fs.existsSync(dest)) {
                  try { fs.copyFileSync(path.join(origDirOnDisk, f), dest); log.info(`  ✓ copied normalsTS (disk): ${f}`); }
                  catch (e) { log.warn(`  normalsTS copy failed: ${e.message}`); }
                }
                break;
              }
            }
          }

          // ── LOD2/LOD3 albedos from disk — apply same adjustments as main albedo ──
          // Detect LOD albedo files by _LOD\d+_albedo pattern, process each one.
          if (sharp) {
            const allDiskFiles = fs.readdirSync(origDirOnDisk);
            for (const f of allDiskFiles) {
              const lodAlbMatch = f.match(/_LOD(\d+)_albedo\.dds$/i);
              if (!lodAlbMatch) continue;
              const lodN        = lodAlbMatch[1];
              const lodSrcPath  = path.join(origDirOnDisk, f);
              const lodDestPath = path.join(targetDir, `${customBaseName}_LOD${lodN}_albedo.dds`);
              const lodFileUrl  = 'file:///' + lodSrcPath.replace(/\\/g, '/');
              try {
                log.info(`  LOD${lodN} albedo (disk): ${f} → ${customBaseName}_LOD${lodN}_albedo.dds`);
                // Same pipeline as main albedo: baked pass + live adjustments
                await fetchAdjustWriteDDS(lodFileUrl, lodDestPath, `LOD${lodN} albedo (disk)`, false);
              } catch (e) {
                warnings.push(`Could not process LOD${lodN} albedo for ${originalProp.id}: ${e.message}`);
                log.error(`  ✗ LOD${lodN} albedo (disk) failed:`, e);
              }
            }
          }
        }
      }

      // ── Search gamedata SCDs — only for non-map-custom props ─────────────
      if (originalProp.source !== 'map-custom')
      for (const gdPath of gamedataPaths) {
      await yieldTick(1);
        if (!fs.existsSync(gdPath)) continue;

        const allScd = fs.readdirSync(gdPath)
          .filter(f => f.endsWith('.scd') || f.endsWith('.zip') || f.endsWith('.nx2'));

        // Props are always in env.scd — search it first for speed
        const scdFiles = [
          ...allScd.filter(f => f.toLowerCase() === 'env.scd'),
          ...allScd.filter(f => f.toLowerCase() !== 'env.scd'),
        ];

        for (const scdFile of scdFiles) {
          await yieldTick(1);
          if (foundBp && foundScm && foundDds) break;

          let zip;
          try {
            const buf = fs.readFileSync(path.join(gdPath, scdFile));
            zip = await JSZip.loadAsync(buf);
          } catch (e) {
            log.warn(`generate-prop-files: skip ${scdFile}: ${e.message}`);
            continue;
          }

          // Build lowercase lookup map for case-insensitive matching
          const zipLower = {};
          for (const key of Object.keys(zip.files)) {
            zipLower[key.toLowerCase()] = key;
          }

          // Case-insensitive entry finder
          const findEntry = (inZipPath) => {
            const realKey = zipLower[inZipPath.toLowerCase()];
            if (realKey) {
              log.debug(`  found "${inZipPath}" as "${realKey}" in ${scdFile}`);
              return zip.files[realKey];
            }
            return null;
          };

          // ── 1. _prop.bp ────────────────────────────────────────────────
          if (!foundBp) {
            const entry = findEntry(origInZip);
            if (entry) {
              try {
                let bpText = await entry.async('string');

                // ── Cache lod0 AlbedoName and collect LOD-specific albedo paths ──
                if (!cachedAlbedoPathInZip) {
                  const albMatch = bpText.match(/AlbedoName\s*=\s*['"]([^'"]+\.dds)['"]/i);
                  if (albMatch) {
                    cachedAlbedoPathInZip = albMatch[1].replace(/\\/g, '/').replace(/^\//, '');
                    log.info(`  AlbedoName from bp: ${cachedAlbedoPathInZip}`);
                  }
                }

                // Scan ALL AlbedoName entries for LOD-specific ones (_LOD2_albedo.dds etc.)
                // We store the real capitalised filename from the zip for use in the GitHub URL.
                const allAlbedoMatches = [...bpText.matchAll(/AlbedoName\s*=\s*['"]([^'"]*\.dds)['"]/gi)];
                for (const m of allAlbedoMatches) {
                  const rawPath = m[1].replace(/\\/g, '/');
                  const filename = rawPath.split('/').pop();
                  const lodAlbMatch = filename.match(/_LOD(\d+)_albedo\.dds$/i);
                  if (lodAlbMatch) {
                    const lodN = lodAlbMatch[1];
                    if (!lodAlbedoOrigPaths[lodN]) {
                      const lodZipPath = `${origDir}/${filename}`;
                      // Resolve the real case of the file as stored in the zip
                      const realKey    = zipLower[lodZipPath.toLowerCase()];
                      const realFilename = realKey ? realKey.split('/').pop() : filename;
                      lodAlbedoOrigPaths[lodN] = { zipPath: lodZipPath, realFilename };
                      log.info(`  Found LOD${lodN} albedo in bp: ${lodZipPath} (real: ${realFilename})`);
                    }
                  }
                }

                // ── Patch MeshName, NormalsName, AlbedoName (block-aware for LOD correctness) ──
                bpText = patchBpText(bpText, {
                  customBaseName,
                  mainAlbBase: isLinked ? linkSourceBase : customBaseName,
                  normBase:    isLinked ? linkSourceBase : customBaseName,
                });
                fs.writeFileSync(path.join(targetDir, customBpName), bpText, 'utf8');
                log.info(`  ✓ wrote bp: ${customBpName}`);
                foundBp = true;
              } catch (e) {
                warnings.push(`Could not write .bp for ${originalProp.id}: ${e.message}`);
                log.error(`  ✗ bp write failed:`, e);
              }
            }
          }

          // ── 2. _lod0.scm … _lod3.scm ─────────────────────────────────────
          if (!foundScm) {
            let copiedAnyLod = false;
            for (let lodIdx = 0; lodIdx <= 3; lodIdx++) {
              const scmInZip = `${origDir}/${origName}_lod${lodIdx}.scm`;
              const lodEntry = findEntry(scmInZip);
              if (lodEntry) {
                try {
                  const buf  = await lodEntry.async('nodebuffer');
                  fs.writeFileSync(path.join(targetDir, `${customBaseName}_lod${lodIdx}.scm`), buf);
                  log.info(`  ✓ wrote scm lod${lodIdx}: ${customBaseName}_lod${lodIdx}.scm`);
                  copiedAnyLod = true;
                } catch (e) {
                  warnings.push(`Could not write lod${lodIdx}.scm for ${originalProp.id}: ${e.message}`);
                  log.error(`  ✗ scm lod${lodIdx} write failed:`, e);
                }
              } else {
                lodIdx === 0
                  ? log.warn(`  scm lod0 not in ${scdFile}: tried "${scmInZip}"`)
                  : log.debug(`  scm lod${lodIdx} not found (optional): "${scmInZip}"`);
              }
            }
            if (copiedAnyLod) foundScm = true;
          }

          // ── 3. _albedo.dds handled OUTSIDE SCD loop (see below) ─────

          // ── 4. _normalsTS.dds — skip for linked props (they reference source's file) ──
          if (!isLinked) {
            const normEntry = findEntry(`${origDir}/${origName}_normalsTS.dds`);
            if (normEntry) {
              try {
                const buf  = await normEntry.async('nodebuffer');
                const dest = path.join(targetDir, `${customBaseName}_normalsTS.dds`);
                if (!fs.existsSync(dest)) {
                  fs.writeFileSync(dest, buf);
                  log.info(`  ✓ wrote normalsTS dds`);
                }
              } catch (e) {
                log.warn(`  normalsTS copy failed: ${e.message}`);
              }
            }
          } else {
            log.info(`  linked — skipping normalsTS (source: ${linkSourceBase})`);
          }

          if (foundBp && foundScm) break;
        }

        if (foundBp && foundScm) break;
      }


      // map-custom bp/scm/normalsTS are handled above — nothing more needed here

      // ── Albedo lod0 + LOD-specific albedos: all fetched as PNG from GitHub ──
      // The previewUrl points to e.g. ".../props/Pine06_V1_albedo.png"
      // LOD-specific PNGs follow the same base URL but use the DDS filename with .png:
      //   Pine06_Big_GroupA_LOD2_albedo.dds → Pine06_Big_GroupA_LOD2_albedo.png
      // Both are adjusted with the same hue/saturation/brightness/contrast settings.

      const hasAdj = adj && (
        adj.hue !== 0 || adj.saturation !== 100 ||
        adj.brightness !== 100 || adj.contrast !== 100 ||
        (adj.gamma !== undefined && adj.gamma !== 100) ||
        (adj.tint && adj.tint.opacity > 0) ||
        (adj.selectiveColor?.enabled) ||
        (adj.selection?.enabled) ||
        (adj._hasBakedPasses === true)
      );
      const bakedPngBuf = adj?._bakedImageDataUrl
        ? Buffer.from(adj._bakedImageDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
        : null;

      // Fetch PNG from remote URL or decode local DDS file
      const getPngBuffer = async (url) => {
        if (url && url.startsWith('file:')) {
          const filePath = decodeURIComponent(url.replace(/^file:\/+/, ''));
          const ddsBuf = fs.readFileSync(filePath);
          const png = await decodeDDSToPNG(ddsBuf);
          if (!png) throw new Error('Cannot decode DDS: ' + filePath);
          return png;
        }
        return fetchBuffer(url);
      };
      const liveAdj = adj && (
        adj.hue !== 0 || adj.saturation !== 100 ||
        adj.brightness !== 100 || adj.contrast !== 100 ||
        (adj.gamma !== undefined && adj.gamma !== 100) ||
        (adj.tint && adj.tint.opacity > 0) ||
        (adj.selectiveColor?.enabled) ||
        (adj.selection?.enabled)
      );
      const fetchAdjustWriteDDS = async (url, destPath, label, useBaked = false) => {
        const pngBuf = (useBaked && bakedPngBuf) ? bakedPngBuf : await getPngBuffer(url);
        if (useBaked && bakedPngBuf) {
          if (liveAdj) {
            const adjusted = await applyAdjustments(pngBuf, adj);
            const dds = encodeToDDS(adjusted.data, adjusted.width, adjusted.height);
            fs.writeFileSync(destPath, dds);
            log.info(`  ✓ wrote baked+adjusted ${label} dds (${adjusted.width}x${adjusted.height})`);
          } else {
            const { data, info } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const dds = encodeToDDS(data, info.width, info.height);
            fs.writeFileSync(destPath, dds);
            log.info(`  ✓ wrote baked ${label} dds (${info.width}x${info.height})`);
          }
        } else if (liveAdj) {
          const adjusted = await applyAdjustments(pngBuf, adj);
          const dds = encodeToDDS(adjusted.data, adjusted.width, adjusted.height);
          fs.writeFileSync(destPath, dds);
          log.info(`  ✓ wrote adjusted ${label} dds (${adjusted.width}x${adjusted.height})`);
        } else {
          const { data, info } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const dds = encodeToDDS(data, info.width, info.height);
          fs.writeFileSync(destPath, dds);
          log.info(`  ✓ wrote ${label} dds (${info.width}x${info.height})`);
        }
      };

      if (originalProp.previewUrl && sharp) {
        // ── lod0 main albedo — skip for linked props (they reference source's albedo) ──
        if (!isLinked) {
          try {
            log.info(`  albedo: fetching ${originalProp.previewUrl}`);
            await fetchAdjustWriteDDS(
              originalProp.previewUrl,
              path.join(targetDir, `${customBaseName}_albedo.dds`),
              'albedo',
              true
            );
            foundDds = true;
          } catch (e) {
            warnings.push(`Could not create albedo .dds for ${originalProp.id}: ${e.message}`);
            log.error(`  ✗ albedo dds failed:`, e);
          }
        } else {
          log.info(`  linked — skipping lod0 albedo (uses ${linkSourceBase}_albedo.dds)`);
          foundDds = true; // not a failure — shared texture
        }

        // ── LOD2/LOD3 albedos — generated for EVERY prop, including linked ──
        // Each prop always needs its own LOD2/LOD3 files; these are never shared.
        // Same adjustments (hue/sat/brightness/contrast/tint/baked) as the main albedo.
        // The PNG on GitHub uses the exact capitalisation from the zip entry (realFilename),
        // which may differ from the lowercase name written in the .bp file.
        const baseRepoUrl = originalProp.previewUrl.startsWith('file:')
          ? null
          : originalProp.previewUrl.substring(0, originalProp.previewUrl.lastIndexOf('/') + 1);

        for (const [lodN, { zipPath, realFilename }] of Object.entries(lodAlbedoOrigPaths)) {
          const lodDestPath = path.join(targetDir, `${customBaseName}_LOD${lodN}_albedo.dds`);

          let lodUrl;
          if (!baseRepoUrl) {
            // Local game install: DDS lives next to the original bp — use file: URL
            const gamedataDir = path.dirname(
              decodeURIComponent(originalProp.previewUrl.replace(/^file:\/+/, ''))
            );
            lodUrl = 'file:///' + path.join(gamedataDir, realFilename).replace(/\\/g, '/');
          } else {
            // GitHub repo: use the real capitalised filename (case-sensitive server)
            lodUrl = baseRepoUrl + realFilename.replace(/\.dds$/i, '.png');
          }

          // Use per-LOD adjustments if the user configured them, otherwise fall back to lod0 adj
          const lodAdj = originalProp.lodTextureAdjustments?.[lodN] ?? adj;
          const lodHasAdj = lodAdj && (
            lodAdj.hue !== 0 || lodAdj.saturation !== 100 ||
            lodAdj.brightness !== 100 || lodAdj.contrast !== 100 ||
            (lodAdj.gamma !== undefined && lodAdj.gamma !== 100) ||
            (lodAdj.tint && lodAdj.tint.opacity > 0) ||
            (lodAdj.selectiveColor?.enabled) ||
            (lodAdj.selection?.enabled) ||
            (lodAdj._hasBakedPasses === true)
          );

          try {
            log.info(`  LOD${lodN} albedo: fetching ${lodUrl} (adj: ${lodHasAdj ? 'yes' : 'none'})`);
            // fetchAdjustWriteDDS uses the module-level `adj` variable; temporarily override it
            // by passing lodAdj inline via a wrapper to avoid mutating shared state
            const lodBakedPng = lodAdj?._bakedImageDataUrl
              ? Buffer.from(lodAdj._bakedImageDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
              : null;
            const lodLiveAdj = lodHasAdj && !(lodAdj._hasBakedPasses && !lodAdj._bakedImageDataUrl);
            const pngBuf = lodBakedPng ? lodBakedPng : await getPngBuffer(lodUrl);
            if (lodLiveAdj) {
              const adjusted = await applyAdjustments(pngBuf, lodAdj);
              const dds = encodeToDDS(adjusted.data, adjusted.width, adjusted.height);
              fs.writeFileSync(lodDestPath, dds);
              log.info(`  ✓ wrote LOD${lodN} albedo dds (adjusted, ${adjusted.width}x${adjusted.height})`);
            } else {
              const { data, info } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
              const dds = encodeToDDS(data, info.width, info.height);
              fs.writeFileSync(lodDestPath, dds);
              log.info(`  ✓ wrote LOD${lodN} albedo dds (${info.width}x${info.height})`);
            }
          } catch (e) {
            warnings.push(`Could not create LOD${lodN} albedo for ${originalProp.id}: ${e.message}`);
            log.error(`  ✗ LOD${lodN} albedo failed:`, e);
          }
        }
        // ── Fallback: wenn keine eigenen LOD2+ Albedos im .bp definiert,
        //    verwende lodPreviewUrls aus dem originalProp (vom Scanner geliefert)
        //    oder kopiere lod0-Albedo für alle vorhandenen LOD-Levels ────────────
        if (Object.keys(lodAlbedoOrigPaths).length === 0) {
          const lod0DestPath = path.join(targetDir, `${customBaseName}_albedo.dds`);
          for (let lodN = 2; lodN <= 3; lodN++) {
            const scmPath = path.join(targetDir, `${customBaseName}_lod${lodN}.scm`);
            if (!fs.existsSync(scmPath)) continue;
            const lodDestPath = path.join(targetDir, `${customBaseName}_LOD${lodN}_albedo.dds`);
            const lodNStr = String(lodN);
            const lodScanUrl = originalProp.lodPreviewUrls?.[lodNStr];
            const lodAdj = originalProp.lodTextureAdjustments?.[lodNStr] ?? adj;
            const lodHasAdj = lodAdj && (
              lodAdj.hue !== 0 || lodAdj.saturation !== 100 ||
              lodAdj.brightness !== 100 || lodAdj.contrast !== 100 ||
              (lodAdj.gamma !== undefined && lodAdj.gamma !== 100) ||
              (lodAdj.tint && lodAdj.tint.opacity > 0) ||
              (lodAdj.selectiveColor?.enabled) ||
              (lodAdj.selection?.enabled) ||
              (lodAdj._hasBakedPasses === true)
            );
            if (lodScanUrl && sharp) {
              // Use the actual LOD DDS from disk/scan, apply its own adjustments
              try {
                const lodBakedPng = lodAdj?._bakedImageDataUrl
                  ? Buffer.from(lodAdj._bakedImageDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
                  : null;
                const pngBuf = lodBakedPng ? lodBakedPng : await getPngBuffer(lodScanUrl);
                if (lodHasAdj) {
                  const adjusted = await applyAdjustments(pngBuf, lodAdj);
                  const dds = encodeToDDS(adjusted.data, adjusted.width, adjusted.height);
                  fs.writeFileSync(lodDestPath, dds);
                  log.info(`  LOD${lodN} albedo: from scan url (adjusted)`);
                } else {
                  const { data, info } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
                  const dds = encodeToDDS(data, info.width, info.height);
                  fs.writeFileSync(lodDestPath, dds);
                  log.info(`  LOD${lodN} albedo: from scan url (no adj)`);
                }
              } catch (e) {
                log.warn(`  LOD${lodN} albedo from scan url failed, falling back to lod0 copy: ${e.message}`);
                if (fs.existsSync(lod0DestPath)) {
                  fs.copyFileSync(lod0DestPath, lodDestPath);
                  log.info(`  LOD${lodN} albedo: fallback copy from lod0 albedo`);
                }
              }
            } else if (fs.existsSync(lod0DestPath)) {
              // No separate LOD DDS available — copy lod0 (always overwrite)
              fs.copyFileSync(lod0DestPath, lodDestPath);
              log.info(`  LOD${lodN} albedo: fallback copy from lod0 albedo`);
            }
          }
        }
      } else {
        if (isLinked) {
          log.info(`  linked — no previewUrl, LOD2+ also skipped`);
          foundDds = true;
        } else {
          warnings.push(`No previewUrl or sharp unavailable: ${originalProp.id}`);
          log.warn(`  albedo skipped — no previewUrl or sharp missing`);
        }
      }

      if (!foundBp)  warnings.push(`Original .bp not found in gamedata: ${origInZip}`);
      if (!foundScm) warnings.push(`Original .scm not found: ${origDir}/${origName}_lod0.scm`);

      results.push({
        id: originalProp.id,
        targetBpPath,
        success: foundBp,
        foundBp, foundScm, foundDds,
      });


    }

    return {
      success:  results.every(r => r.foundBp),
      results,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

  } catch (err) {
    log.error('generate-prop-files error:', err);
    return { success: false, error: err.message };
  }
}));

// ── scan-global-props ─────────────────────────────────────────────────────────
// Scans public/props/ for all custom props saved via "Add Custom Prop".
// Each subfolder is one prop (or a pack-together multi-prop folder).
// Returns { success, props[] } — independent of any mapName/mapsFolder setting.
ipcMain.handle('scan-global-props', async () => {
  try {
    function walkDir(dir, results = []) {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walkDir(full, results);
          else results.push(full);
        }
      } catch (e) { log.warn('scan-global-props walkDir error:', e.message); }
      return results;
    }

    const publicPropsRoot = path.join(app.getAppPath(), 'public', 'props');
    if (!fs.existsSync(publicPropsRoot)) {
      log.info('scan-global-props: public/props folder not found at', publicPropsRoot);
      return { success: true, props: [] };
    }

    let subfolders = [];
    try {
      subfolders = fs.readdirSync(publicPropsRoot, { withFileTypes: true }).filter(e => e.isDirectory());
    } catch (e) {
      log.warn('scan-global-props: cannot read public/props subfolders:', e.message);
      return { success: true, props: [] };
    }

    const props = [];

    for (const sub of subfolders) {
      const subDir   = path.join(publicPropsRoot, sub.name);
      const allFiles = walkDir(subDir);
      const bpFiles  = allFiles.filter(f => f.toLowerCase().endsWith('_prop.bp'));
      const ddsFiles = new Set(
        allFiles
          .filter(f => /\.(dds|png|tga)$/i.test(f))
          .map(f => f.replace(/\\/g, '/').toLowerCase())
      );

      if (bpFiles.length === 0) continue;

      log.info(`scan-global-props: folder "${sub.name}" → ${bpFiles.length} _prop.bp file(s)`);

      for (const bpPath of bpFiles) {
        await yieldTick(20);
        const bpName   = path.basename(bpPath, '.bp');
        const propName = bpName.replace(/_prop$/i, '');
        const bpDir    = path.dirname(bpPath);

        let reclaimMass = null, reclaimEnergy = null, reclaimTime = null;
        let propType = 'misc';
        let matchedDds = null;
        const lodPreviewUrls = {};

        try {
          const bpContent = fs.readFileSync(bpPath, 'utf8');

          const massMatch   = bpContent.match(/ReclaimMassMax\s*=\s*([\d.eE+\-]+)/);
          const energyMatch = bpContent.match(/ReclaimEnergyMax\s*=\s*([\d.eE+\-]+)/);
          const timeMatch   = bpContent.match(/ReclaimTime\s*=\s*([\d.eE+\-]+)/);
          if (massMatch)   reclaimMass   = parseFloat(massMatch[1]);
          if (energyMatch) reclaimEnergy = parseFloat(energyMatch[1]);
          if (timeMatch)   reclaimTime   = parseFloat(timeMatch[1]);

          // Detect type from ScriptModule
          if (bpContent.includes('proptree.lua')) propType = 'trees';
          else propType = 'rocks';

          // Try to find the albedo from AlbedoName field
          const albedoMatch = bpContent.match(/AlbedoName\s*=\s*['"]([^'"]+\.(dds|png|tga))['"]/i);
          if (albedoMatch) {
            const albedoBase    = albedoMatch[1].replace(/\\/g, '/').split('/').pop();
            const sameFolderKey = path.join(bpDir, albedoBase).replace(/\\/g, '/').toLowerCase();
            if (ddsFiles.has(sameFolderKey)) {
              matchedDds = path.join(bpDir, albedoBase);
            } else {
              const found = [...ddsFiles].find(f => path.basename(f) === albedoBase.toLowerCase());
              if (found) matchedDds = found;
            }
          }
          // Fallback: look for <propName>_albedo.* in same folder
          if (!matchedDds) {
            const fallbackKey = path.join(bpDir, propName + '_albedo.dds').replace(/\\/g, '/').toLowerCase();
            if (ddsFiles.has(fallbackKey)) matchedDds = fallbackKey;
          }
          // Fallback 2: any albedo file in the folder
          if (!matchedDds) {
            const anyAlbedo = [...ddsFiles].find(f => f.includes('albedo'));
            if (anyAlbedo) matchedDds = anyAlbedo;
          }

          // Collect LOD-specific albedo DDS files (e.g. _LOD2_albedo.dds, _LOD3_albedo.dds)
          const allAlbedoMatches = [...bpContent.matchAll(/AlbedoName\s*=\s*['"]([^'"]*\.(?:dds|png|tga))['"]/gi)];
          for (const m of allAlbedoMatches) {
            const filename = m[1].replace(/\\/g, '/').split('/').pop();
            const lodAlbMatch = filename.match(/_LOD(\d+)_albedo\.(dds|png|tga)$/i);
            if (lodAlbMatch) {
              const lodN = lodAlbMatch[1];
              const lodKey = path.join(bpDir, filename).replace(/\\/g, '/').toLowerCase();
              const lodDdsPath = ddsFiles.has(lodKey)
                ? path.join(bpDir, filename)
                : [...ddsFiles].find(f => path.basename(f) === filename.toLowerCase());
              if (lodDdsPath && !lodPreviewUrls[lodN]) {
                lodPreviewUrls[lodN] = 'file:///' + lodDdsPath.replace(/\\/g, '/').replace(/^\//, '');
              }
            }
          }
        } catch (e) {
          log.warn(`scan-global-props: parse error for ${bpName}: ${e.message}`);
        }

        const previewUrl = matchedDds
          ? 'file:///' + matchedDds.replace(/\\/g, '/').replace(/^\//, '')
          : null;

        props.push({
          id:           `custom-global__${sub.name}__${bpName}`,
          name:         propName,
          gamePath:     `/env/props/${sub.name}/${bpName}.bp`,
          source:       'custom-global',
          biome:        'global',
          propType,
          previewUrl,
          lodPreviewUrls: Object.keys(lodPreviewUrls).length > 0 ? lodPreviewUrls : undefined,
          reclaimMass:   reclaimMass  || null,
          reclaimEnergy: reclaimEnergy || null,
          reclaimTime:   reclaimTime  || null,
          isCustom:      true,
          isGroup:       false,
        });
      }
    }

    log.info(`scan-global-props: found ${props.length} global custom props`);
    return { success: true, props };
  } catch (err) {
    log.error('scan-global-props failed:', err);
    return { success: false, error: err.message, props: [] };
  }
});

ipcMain.handle('save-custom-prop', async (event, { propName, files }) => {
  try {
    // Determine app root: in production, __dirname is inside /dist/
    // So we go up one level to get to the actual app root
    const appRoot  = app.getAppPath();
    // Guard against path traversal: propName must be a plain folder name, not a path
    const safePropName = path.basename(propName);
    if (!safePropName || safePropName !== propName) {
      log.warn(`[save-custom-prop] Rejected unsafe propName: "${propName}"`);
      return { success: false, error: 'Invalid prop name' };
    }
    const propDir  = path.join(appRoot, 'public', 'props', safePropName);

    // Create directory if it doesn't exist
    fs.mkdirSync(propDir, { recursive: true });

    // Write each file
    for (const [, fileInfo] of Object.entries(files)) {
      const destPath = path.join(propDir, fileInfo.name);
      if (fileInfo.encoding === 'base64') {
        fs.writeFileSync(destPath, Buffer.from(fileInfo.data, 'base64'));
      } else {
        fs.writeFileSync(destPath, fileInfo.data, 'utf8');
      }
    }

    // Check if an albedo image exists to use as previewUrl
    const albedoPath = path.join(propDir, `${safePropName}_albedo.dds`);
    const previewUrl = fs.existsSync(albedoPath)
      ? `file:///${albedoPath.replace(/\\/g, '/')}`
      : null;

    return { success: true, previewUrl };
  } catch (err) {
    console.error('[save-custom-prop] Error:', err);
    return { success: false, error: err.message };
  }
});

// ── save-custom-prop-folder ───────────────────────────────────────────────────
// Saves a prop folder uploaded from the "Ordner ablegen" mode.
//
// Two sub-cases:
//   A) packTogether=true  → all files go into public/props/<folderName>/
//      (multiple _prop.bp files share the same folder + textures)
//   B) packTogether=false / single prop → each prop gets its own subfolder
//      public/props/<propName>/
//
// `files` is a flat object: { [filename]: { name, data, encoding } }
// File names are plain basenames (no subfolder path component).
//
ipcMain.handle('save-custom-prop-folder', async (event, { propName, propType, files, packTogether }) => {
  try {
    const appRoot = app.getAppPath();
    // All custom folder props live under public/props/
    const propsRoot = path.join(appRoot, 'public', 'props');

    // Guard against path traversal: propName must be a plain folder name, not a path
    const safePropName = path.basename(propName);
    if (!safePropName || safePropName !== propName) {
      log.warn(`[save-custom-prop-folder] Rejected unsafe propName: "${propName}"`);
      return { success: false, error: 'Invalid prop name' };
    }

    // The target directory: always named after propName (folder name or individual prop name)
    const propDir = path.join(propsRoot, safePropName);
    fs.mkdirSync(propDir, { recursive: true });

    log.info(`[save-custom-prop-folder] Saving "${propName}" → ${propDir} (${Object.keys(files).length} files, packTogether=${!!packTogether})`);

    let firstAlbedoPath = null;

    for (const [, fileInfo] of Object.entries(files)) {
      // fileInfo.name is always a plain filename (no subdirectory component)
      const safeName = path.basename(fileInfo.name); // guard against path traversal
      const destPath = path.join(propDir, safeName);

      if (fileInfo.encoding === 'base64') {
        fs.writeFileSync(destPath, Buffer.from(fileInfo.data, 'base64'));
      } else {
        fs.writeFileSync(destPath, fileInfo.data, 'utf8');
      }

      // Track the first albedo file for the previewUrl
      if (!firstAlbedoPath && /albedo\.(dds|png|tga)$/i.test(safeName)) {
        firstAlbedoPath = destPath;
      }
    }

    // Fallback: look for any *_albedo.dds in the written folder
    if (!firstAlbedoPath) {
      const written = fs.readdirSync(propDir);
      const found   = written.find(f => /albedo\.(dds|png|tga)$/i.test(f));
      if (found) firstAlbedoPath = path.join(propDir, found);
    }

    const previewUrl = firstAlbedoPath
      ? `file:///${firstAlbedoPath.replace(/\\/g, '/')}`
      : null;

    log.info(`[save-custom-prop-folder] Done — previewUrl: ${previewUrl || '(none)'}`);
    return { success: true, previewUrl };
  } catch (err) {
    log.error('[save-custom-prop-folder] Error:', err);
    return { success: false, error: err.message };
  }
});



// ── resolve-lod-preview-urls — given a map folder + prop gamePath,
//    return lodPreviewUrls for all _lod\d+_albedo.dds found on disk.
//    Used by the Texture Editor to refresh lodPreviewUrls at open-time,
//    since originalProp snapshots in shared state may predate the scanner fix.
ipcMain.handle('resolve-lod-preview-urls', withPathGuard(
  ({ mapsFolder, mapName }) => [path.join(mapsFolder, mapName)],
  async (event, { mapsFolder, mapName, gamePath, targetBpPath }) => {
    try {
      const mapDir = path.join(mapsFolder, mapName);
      // Try gamePath first (map-custom props), then targetBpPath (generated custom props)
      const candidates = [];
      if (gamePath)     candidates.push(path.join(mapDir, path.dirname(gamePath).replace(/\//g, path.sep)));
      if (targetBpPath) candidates.push(path.join(mapDir, path.dirname(targetBpPath).replace(/\//g, path.sep)));
      const result = {};
      for (const bpDir of candidates) {
        if (!fs.existsSync(bpDir)) continue;
        const files = fs.readdirSync(bpDir);
        for (const f of files) {
          const m = f.match(/_lod(\d+)_albedo\.dds$/i);
          if (m) {
            const lodN = m[1];
            if (!result[lodN])
              result[lodN] = 'file:///' + path.join(bpDir, f).replace(/\\/g, '/').replace(/^\//, '');
          }
        }
        if (Object.keys(result).length > 0) break; // found in first candidate
      }
      log.debug('[resolve-lod-preview-urls] ' + (gamePath || targetBpPath) + ' → ' + JSON.stringify(result));
      return { lodPreviewUrls: result };
    } catch (e) {
      log.warn('[resolve-lod-preview-urls] error:', e.message);
      return { lodPreviewUrls: {} };
    }
  }
));

function register() {
  // handlers registered at module load time via ipcMain.handle above
}

module.exports = { register };
